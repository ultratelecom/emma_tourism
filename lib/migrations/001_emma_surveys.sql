-- Emma Survey Table
-- Run this migration on your Neon database

CREATE TABLE IF NOT EXISTS emma_surveys (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  arrival_method VARCHAR(20) NOT NULL CHECK (arrival_method IN ('plane', 'cruise', 'ferry')),
  journey_rating INTEGER NOT NULL CHECK (journey_rating >= 1 AND journey_rating <= 5),
  activity_interest VARCHAR(20) NOT NULL CHECK (activity_interest IN ('beach', 'adventure', 'food', 'nightlife', 'photos')),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_emma_surveys_email ON emma_surveys(email);
CREATE INDEX IF NOT EXISTS idx_emma_surveys_created_at ON emma_surveys(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emma_surveys_arrival_method ON emma_surveys(arrival_method);
CREATE INDEX IF NOT EXISTS idx_emma_surveys_activity_interest ON emma_surveys(activity_interest);

-- Add comments for documentation
COMMENT ON TABLE emma_surveys IS 'Stores completed Emma tourism survey responses';
COMMENT ON COLUMN emma_surveys.session_id IS 'Unique session identifier for the survey submission';
COMMENT ON COLUMN emma_surveys.arrival_method IS 'How the tourist arrived: plane, cruise, or ferry';
COMMENT ON COLUMN emma_surveys.journey_rating IS 'Rating from 1-5 stars for their journey experience';
COMMENT ON COLUMN emma_surveys.activity_interest IS 'Primary activity they are interested in during their visit';

