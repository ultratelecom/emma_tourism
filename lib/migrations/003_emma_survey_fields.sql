-- ============================================
-- PHASE 2: EMMA SURVEY FIELD STATE
-- Migration: 003_emma_survey_fields
-- Description: Per-user incremental survey field capture so Emma's field-flow
--              planner can compute open vs filled fields every turn (mirrors
--              Ava's profile-field model). Replaces the all-or-nothing
--              final-step survey insert; partial completions are now durable.
-- ============================================

CREATE TABLE IF NOT EXISTS emma_survey_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES emma_users(id) ON DELETE CASCADE,

  field_key VARCHAR(40) NOT NULL,   -- 'name' | 'email' | 'arrival_method' | 'journey_rating' | 'activity_interest'
  value_text TEXT,                  -- canonical value (numbers stored as text too)
  status VARCHAR(20) NOT NULL DEFAULT 'filled', -- 'filled' | 'declined'

  source_message_id UUID,
  confidence REAL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (user_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_emma_survey_fields_user ON emma_survey_fields(user_id);

-- ============================================
-- DONE: Phase 2 Schema Migration
-- ============================================
