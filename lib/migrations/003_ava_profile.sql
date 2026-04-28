-- ============================================
-- AVA PROFILE SCHEMA
-- Migration: 003_ava_profile
-- Description: Creates Ava's namespace (ava_users, ava_profile_fields,
--              ava_notes, ava_entities) and migrates existing emma_users
--              rows over, preserving ids so conversation history stays
--              linked across namespaces.
-- Idempotent: can be re-run safely.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. AVA_USERS (Core identity for the diaspora profile)
-- ============================================
-- Mirrors emma_users.id so existing emma_conversations / emma_messages
-- rows still reference the same person. Email is nullable because Ava
-- starts with a name, not an email.
CREATE TABLE IF NOT EXISTS ava_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),

  -- Visit tracking (carried from Emma where applicable)
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  visit_count INTEGER DEFAULT 1,

  -- Profile state
  profile_completion NUMERIC(4, 3) DEFAULT 0,   -- 0.000 to 1.000
  last_chapter_id VARCHAR(50),                  -- which chapter she was last in
  declined_fields TEXT[] DEFAULT '{}',          -- field_keys the user declined

  -- AI-generated rolling summary of who this person is, refreshed periodically
  profile_summary TEXT,

  -- Provenance
  migrated_from_emma BOOLEAN DEFAULT FALSE,
  legacy_personality_tags TEXT[],               -- preserved from emma_users for reference
  legacy_personality_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ava_users_email ON ava_users(email);
CREATE INDEX IF NOT EXISTS idx_ava_users_last_seen ON ava_users(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_ava_users_name ON ava_users(name);

-- ============================================
-- 2. AVA_PROFILE_FIELDS (Typed, keyed, one row per filled field)
-- ============================================
CREATE TABLE IF NOT EXISTS ava_profile_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ava_users(id) ON DELETE CASCADE,

  field_key VARCHAR(100) NOT NULL,              -- matches AVA_PROFILE_FIELDS keys

  -- Value is stored as either scalar text or a JSON blob depending on field type.
  -- Scalars (text / enum / yes_no_maybe / scale_1_5) → value_text.
  -- Multi-enums and arrays → value_json.
  value_text TEXT,
  value_json JSONB,

  confidence NUMERIC(3, 2),                     -- 0.00 to 1.00
  evidence TEXT,                                -- verbatim quote supporting the extraction
  status VARCHAR(20) NOT NULL DEFAULT 'filled', -- 'filled' | 'declined'

  source_message_id UUID,                       -- optional FK into emma_messages or future ava_messages
  extracted_by VARCHAR(100),                    -- model id that produced the value

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One authoritative row per (user, field). Upserts collapse repeated extractions.
  UNIQUE (user_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_ava_profile_fields_user ON ava_profile_fields(user_id);
CREATE INDEX IF NOT EXISTS idx_ava_profile_fields_key ON ava_profile_fields(field_key);
CREATE INDEX IF NOT EXISTS idx_ava_profile_fields_status ON ava_profile_fields(status);

-- ============================================
-- 3. AVA_NOTES (Free-form texture the structured fields can't hold)
-- ============================================
CREATE TABLE IF NOT EXISTS ava_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ava_users(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  sentiment VARCHAR(20),                        -- 'positive' | 'neutral' | 'negative' | NULL

  source_message_id UUID,
  extracted_by VARCHAR(100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ava_notes_user ON ava_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_ava_notes_sentiment ON ava_notes(sentiment);
CREATE INDEX IF NOT EXISTS idx_ava_notes_tags ON ava_notes USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_ava_notes_created ON ava_notes(created_at DESC);

-- ============================================
-- 4. AVA_ENTITIES (Named things the user mentioned)
-- ============================================
-- person | place | food | song | employer | school | phrase
CREATE TABLE IF NOT EXISTS ava_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ava_users(id) ON DELETE CASCADE,

  kind VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  first_quote TEXT,

  mention_count INTEGER NOT NULL DEFAULT 1,
  first_mentioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_mentioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Case-insensitive dedupe per user+kind.
  UNIQUE (user_id, kind, name)
);

CREATE INDEX IF NOT EXISTS idx_ava_entities_user ON ava_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_ava_entities_kind ON ava_entities(kind);
CREATE INDEX IF NOT EXISTS idx_ava_entities_name_lower ON ava_entities (LOWER(name));

-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Keep ava_users.updated_at fresh on any row update.
CREATE OR REPLACE FUNCTION ava_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ava_users_touch ON ava_users;
CREATE TRIGGER trigger_ava_users_touch
  BEFORE UPDATE ON ava_users
  FOR EACH ROW EXECUTE FUNCTION ava_touch_updated_at();

DROP TRIGGER IF EXISTS trigger_ava_profile_fields_touch ON ava_profile_fields;
CREATE TRIGGER trigger_ava_profile_fields_touch
  BEFORE UPDATE ON ava_profile_fields
  FOR EACH ROW EXECUTE FUNCTION ava_touch_updated_at();

-- ============================================
-- 6. DATA MIGRATION: emma_users → ava_users  (conditional)
-- ============================================
-- If the Emma namespace exists in this database, copy every row into
-- ava_users preserving the id so emma_conversations / emma_messages keep
-- pointing at the same person. If emma_users isn't here (fresh Neon, or
-- Ava is running in a different project than Emma), this block is a no-op.
-- Safe to re-run: ON CONFLICT DO NOTHING.
DO $migration$
BEGIN
  IF to_regclass('public.emma_users') IS NOT NULL THEN
    INSERT INTO ava_users (
      id,
      name,
      email,
      first_seen_at,
      last_seen_at,
      visit_count,
      migrated_from_emma,
      legacy_personality_tags,
      legacy_personality_notes,
      created_at,
      updated_at
    )
    SELECT
      e.id,
      e.name,
      e.email,
      e.first_seen_at,
      e.last_seen_at,
      e.visit_count,
      TRUE,
      e.personality_tags,
      e.personality_notes,
      e.created_at,
      e.updated_at
    FROM emma_users e
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'ava_users: copied from emma_users (rows now: %)', (SELECT COUNT(*) FROM ava_users);
  ELSE
    RAISE NOTICE 'emma_users not found in this database — skipping copy step.';
  END IF;
END
$migration$;

-- ============================================
-- DONE
-- ============================================
