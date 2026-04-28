-- ============================================
-- AVA SESSIONS + MESSAGES
-- Migration: 004_ava_sessions
-- Description: Conversation threads (ava_sessions) and every turn
--              (ava_messages). These support return-visit callbacks
--              and let the chat model see rolling history.
-- Idempotent: safe to re-run.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. AVA_SESSIONS (conversation threads)
-- ============================================
-- A session is a conversation thread for a single user. The Ava model is
-- designed around a resumable_long session — one thread that picks up
-- across visits. We still model sessions as rows so we can attribute
-- messages, track idle timeouts, and mark sessions complete when all
-- profile fields are filled or declined.
CREATE TABLE IF NOT EXISTS ava_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ava_users(id) ON DELETE CASCADE,

  -- Client-side opaque token used to resume a session across requests
  session_token VARCHAR(64) NOT NULL UNIQUE,

  -- State
  status VARCHAR(20) NOT NULL DEFAULT 'active',   -- 'active' | 'paused' | 'complete' | 'abandoned'
  current_chapter_id VARCHAR(50),
  turn_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_turn_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ava_sessions_user ON ava_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ava_sessions_token ON ava_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_ava_sessions_status ON ava_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ava_sessions_last_turn ON ava_sessions(last_turn_at DESC);

-- ============================================
-- 2. AVA_MESSAGES (every turn)
-- ============================================
-- Both user turns and Ava's replies live here. The opener Ava sends on
-- turn 0 is written by the system with sender='ava' and
-- is_system_delivered=true, so the chat model is never asked to produce it.
CREATE TABLE IF NOT EXISTS ava_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ava_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES ava_users(id) ON DELETE CASCADE,

  sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ava')),
  content TEXT NOT NULL,
  turn_index INTEGER NOT NULL,                    -- 0, 1, 2, ... within this session

  -- Metadata about Ava's generation (null for user rows)
  is_system_delivered BOOLEAN DEFAULT FALSE,      -- true for the deterministic opener
  model_provider VARCHAR(50),
  model_id VARCHAR(100),
  chapter_id VARCHAR(50),
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ava_messages_session ON ava_messages(session_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_ava_messages_user ON ava_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ava_messages_sender ON ava_messages(sender);
CREATE INDEX IF NOT EXISTS idx_ava_messages_created ON ava_messages(created_at DESC);

-- ============================================
-- 3. TRIGGERS
-- ============================================

-- Keep ava_sessions.last_turn_at fresh and bump turn_count as messages land.
CREATE OR REPLACE FUNCTION ava_touch_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ava_sessions
  SET last_turn_at = NOW(),
      turn_count = turn_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ava_messages_touch_session ON ava_messages;
CREATE TRIGGER trigger_ava_messages_touch_session
  AFTER INSERT ON ava_messages
  FOR EACH ROW EXECUTE FUNCTION ava_touch_session_on_message();

-- Also bump ava_users.last_seen_at on every message, so returning-visitor
-- heuristics in the chat flow stay correct.
CREATE OR REPLACE FUNCTION ava_touch_user_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ava_users SET last_seen_at = NOW() WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ava_messages_touch_user ON ava_messages;
CREATE TRIGGER trigger_ava_messages_touch_user
  AFTER INSERT ON ava_messages
  FOR EACH ROW EXECUTE FUNCTION ava_touch_user_on_message();

-- ============================================
-- 4. BACK-POPULATE FK: profile_fields / notes → messages
-- ============================================
-- ava_profile_fields.source_message_id and ava_notes.source_message_id
-- were created in 003 as plain UUID columns (no FK). Now that the
-- ava_messages table exists, promote them to real foreign keys.
-- Wrapped in DO blocks so repeated runs don't choke.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ava_profile_fields_source_message_fk'
  ) THEN
    ALTER TABLE ava_profile_fields
      ADD CONSTRAINT ava_profile_fields_source_message_fk
      FOREIGN KEY (source_message_id) REFERENCES ava_messages(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ava_notes_source_message_fk'
  ) THEN
    ALTER TABLE ava_notes
      ADD CONSTRAINT ava_notes_source_message_fk
      FOREIGN KEY (source_message_id) REFERENCES ava_messages(id) ON DELETE SET NULL;
  END IF;
END
$do$;

-- ============================================
-- DONE
-- ============================================
