-- ============================================
-- PHASE 1: ENHANCED EMMA DATABASE SCHEMA
-- Migration: 002_emma_users_enhanced
-- Description: Core user identity and memory system
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. EMMA USERS TABLE (Core Identity)
-- ============================================
CREATE TABLE IF NOT EXISTS emma_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  
  -- Visit tracking
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  visit_count INTEGER DEFAULT 1,
  
  -- Trip info
  arrival_method VARCHAR(50),
  current_trip_start DATE,
  
  -- Preferences
  preferred_language VARCHAR(10) DEFAULT 'en',
  
  -- Personality traits Emma learns over time
  personality_tags TEXT[], -- ['adventurous', 'foodie', 'relaxed', 'budget-conscious']
  personality_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_emma_users_email ON emma_users(email);
CREATE INDEX IF NOT EXISTS idx_emma_users_last_seen ON emma_users(last_seen_at DESC);

-- ============================================
-- 2. BROWSER SESSIONS TABLE (Device Recognition)
-- ============================================
CREATE TABLE IF NOT EXISTS emma_browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES emma_users(id) ON DELETE SET NULL,
  browser_fingerprint VARCHAR(64) NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address VARCHAR(45),
  
  -- Tracking
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_count INTEGER DEFAULT 1
);

-- Index for fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_emma_browser_fingerprint ON emma_browser_sessions(browser_fingerprint);
CREATE INDEX IF NOT EXISTS idx_emma_browser_user ON emma_browser_sessions(user_id);

-- ============================================
-- 3. MEMORIES TABLE (What Emma Remembers)
-- ============================================
CREATE TABLE IF NOT EXISTS emma_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES emma_users(id) ON DELETE CASCADE,
  
  -- Memory classification
  memory_type VARCHAR(50) NOT NULL, -- 'rating', 'preference', 'mention', 'complaint', 'recommendation'
  category VARCHAR(50),             -- 'restaurant', 'beach', 'activity', 'transport', 'accommodation'
  subject VARCHAR(255),             -- "Tobago Plantations", "Pigeon Point", etc.
  
  -- Content
  sentiment VARCHAR(20),            -- 'positive', 'negative', 'neutral', 'mixed'
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  raw_text TEXT,                    -- What user actually said
  ai_summary TEXT,                  -- Emma's interpretation
  
  -- Context
  conversation_id UUID,
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10), -- How important to remember
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Some memories can expire
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for memory retrieval
CREATE INDEX IF NOT EXISTS idx_emma_memories_user ON emma_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_emma_memories_type ON emma_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_emma_memories_category ON emma_memories(category);
CREATE INDEX IF NOT EXISTS idx_emma_memories_subject ON emma_memories(subject);
CREATE INDEX IF NOT EXISTS idx_emma_memories_importance ON emma_memories(importance DESC);

-- ============================================
-- 4. CONVERSATIONS TABLE (Chat Sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS emma_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES emma_users(id) ON DELETE CASCADE,
  browser_session_id UUID REFERENCES emma_browser_sessions(id) ON DELETE SET NULL,
  
  -- Session info
  session_token VARCHAR(64) NOT NULL UNIQUE, -- Client-side session ID
  
  -- Conversation state
  topic VARCHAR(100) DEFAULT 'general', -- 'onboarding', 'rating_restaurant', 'general_chat', etc.
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'completed', 'abandoned'
  
  -- Survey data (for onboarding conversations)
  survey_step VARCHAR(50),
  survey_completed BOOLEAN DEFAULT FALSE,
  
  -- AI-generated summary
  summary TEXT,
  key_topics TEXT[],
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  
  -- Stats
  message_count INTEGER DEFAULT 0,
  user_message_count INTEGER DEFAULT 0,
  emma_message_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emma_conversations_user ON emma_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_emma_conversations_token ON emma_conversations(session_token);
CREATE INDEX IF NOT EXISTS idx_emma_conversations_status ON emma_conversations(status);

-- ============================================
-- 5. MESSAGES TABLE (Individual Messages)
-- ============================================
CREATE TABLE IF NOT EXISTS emma_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES emma_conversations(id) ON DELETE CASCADE,
  
  -- Message content
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'emma')),
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'rating', 'selection', 'gif', 'button_click'
  
  -- For selections/ratings
  selection_value VARCHAR(255),
  rating_value INTEGER CHECK (rating_value BETWEEN 1 AND 5),
  
  -- AI-related
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt_type VARCHAR(50), -- 'name_reaction', 'email_thanks', etc.
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emma_messages_conversation ON emma_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emma_messages_sender ON emma_messages(sender);
CREATE INDEX IF NOT EXISTS idx_emma_messages_created ON emma_messages(created_at);

-- ============================================
-- 6. RATINGS TABLE (Structured Reviews)
-- ============================================
CREATE TABLE IF NOT EXISTS emma_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES emma_users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES emma_conversations(id) ON DELETE SET NULL,
  
  -- What's being rated
  category VARCHAR(50) NOT NULL,     -- 'restaurant', 'beach', 'hotel', 'transport', 'activity'
  place_name VARCHAR(255) NOT NULL,
  place_id VARCHAR(100),             -- Future: Google Places ID
  location_description TEXT,         -- "Near Store Bay", "In Scarborough"
  
  -- Ratings (all 1-5)
  overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
  ambiance_rating INTEGER CHECK (ambiance_rating BETWEEN 1 AND 5),
  value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 5),
  
  -- Review content
  review_text TEXT,
  highlights TEXT[], -- ['great view', 'friendly staff', 'fresh fish']
  lowlights TEXT[],  -- ['slow service', 'expensive']
  
  -- Recommendation
  would_recommend BOOLEAN,
  recommend_for TEXT[], -- ['families', 'couples', 'solo travelers', 'budget travelers']
  
  -- Visit info
  visited_date DATE,
  visit_type VARCHAR(50), -- 'first_time', 'return_visit'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emma_ratings_user ON emma_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_emma_ratings_category ON emma_ratings(category);
CREATE INDEX IF NOT EXISTS idx_emma_ratings_place ON emma_ratings(place_name);
CREATE INDEX IF NOT EXISTS idx_emma_ratings_overall ON emma_ratings(overall_rating DESC);

-- ============================================
-- 7. COMPLAINTS TABLE (Issue Tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS emma_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES emma_users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES emma_conversations(id) ON DELETE SET NULL,
  
  -- Complaint details
  category VARCHAR(50) NOT NULL, -- 'restaurant', 'transport', 'accommodation', 'safety', 'other'
  subject VARCHAR(255),
  description TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'new', -- 'new', 'acknowledged', 'investigating', 'resolved', 'closed'
  resolution TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emma_complaints_status ON emma_complaints(status);
CREATE INDEX IF NOT EXISTS idx_emma_complaints_severity ON emma_complaints(severity);

-- ============================================
-- 8. ANALYTICS EVENTS TABLE (For Dashboard)
-- ============================================
CREATE TABLE IF NOT EXISTS emma_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES emma_users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES emma_conversations(id) ON DELETE SET NULL,
  
  -- Event info
  event_type VARCHAR(50) NOT NULL, -- 'conversation_start', 'survey_complete', 'rating_submitted', etc.
  event_category VARCHAR(50),
  event_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emma_events_type ON emma_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_emma_events_created ON emma_analytics_events(created_at);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update user's last_seen_at
CREATE OR REPLACE FUNCTION update_user_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE emma_users SET last_seen_at = NOW() WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen on new conversation
DROP TRIGGER IF EXISTS trigger_update_user_last_seen ON emma_conversations;
CREATE TRIGGER trigger_update_user_last_seen
AFTER INSERT ON emma_conversations
FOR EACH ROW EXECUTE FUNCTION update_user_last_seen();

-- Function to increment message counts
CREATE OR REPLACE FUNCTION update_conversation_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE emma_conversations SET 
    message_count = message_count + 1,
    user_message_count = user_message_count + CASE WHEN NEW.sender = 'user' THEN 1 ELSE 0 END,
    emma_message_count = emma_message_count + CASE WHEN NEW.sender = 'emma' THEN 1 ELSE 0 END,
    last_message_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update counts on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_counts ON emma_messages;
CREATE TRIGGER trigger_update_conversation_counts
AFTER INSERT ON emma_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_counts();

-- ============================================
-- DONE: Phase 1 Schema Migration
-- ============================================
