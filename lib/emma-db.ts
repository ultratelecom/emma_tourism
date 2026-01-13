import { sql } from './db';

// ============================================
// TYPE DEFINITIONS
// ============================================

// User Types
export interface EmmaUser {
  id: string;
  email: string;
  name: string;
  first_seen_at: Date;
  last_seen_at: Date;
  visit_count: number;
  arrival_method: string | null;
  current_trip_start: Date | null;
  preferred_language: string;
  personality_tags: string[] | null;
  personality_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmmaUserInput {
  email: string;
  name: string;
  arrival_method?: string;
}

// Browser Session Types
export interface BrowserSession {
  id: string;
  user_id: string | null;
  browser_fingerprint: string;
  user_agent: string | null;
  ip_address: string | null;
  last_active: Date;
  created_at: Date;
  session_count: number;
}

// Memory Types
export interface EmmaMemory {
  id: string;
  user_id: string;
  memory_type: 'rating' | 'preference' | 'mention' | 'complaint' | 'recommendation';
  category: string | null;
  subject: string | null;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | null;
  rating: number | null;
  raw_text: string | null;
  ai_summary: string | null;
  conversation_id: string | null;
  importance: number;
  created_at: Date;
  expires_at: Date | null;
  metadata: Record<string, unknown>;
}

// Conversation Types
export interface EmmaConversation {
  id: string;
  user_id: string | null;
  browser_session_id: string | null;
  session_token: string;
  topic: string;
  status: 'active' | 'completed' | 'abandoned';
  survey_step: string | null;
  survey_completed: boolean;
  summary: string | null;
  key_topics: string[] | null;
  started_at: Date;
  last_message_at: Date;
  ended_at: Date | null;
  message_count: number;
  user_message_count: number;
  emma_message_count: number;
}

// Message Types
export interface EmmaMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'emma';
  content: string;
  message_type: string;
  selection_value: string | null;
  rating_value: number | null;
  ai_generated: boolean;
  ai_prompt_type: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

// Rating Types
export interface EmmaRating {
  id: string;
  user_id: string;
  conversation_id: string | null;
  category: string;
  place_name: string;
  place_id: string | null;
  location_description: string | null;
  overall_rating: number;
  food_rating: number | null;
  service_rating: number | null;
  ambiance_rating: number | null;
  value_rating: number | null;
  review_text: string | null;
  highlights: string[] | null;
  lowlights: string[] | null;
  would_recommend: boolean | null;
  recommend_for: string[] | null;
  visited_date: Date | null;
  visit_type: string | null;
  created_at: Date;
  updated_at: Date;
}

// Complaint Types
export interface EmmaComplaint {
  id: string;
  user_id: string | null;
  conversation_id: string | null;
  category: string;
  subject: string | null;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';
  resolution: string | null;
  resolved_at: Date | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Create a new Emma user
 */
export async function createUser(data: EmmaUserInput): Promise<EmmaUser> {
  const result = await sql`
    INSERT INTO emma_users (email, name, arrival_method)
    VALUES (${data.email}, ${data.name}, ${data.arrival_method || null})
    RETURNING *
  `;
  return result[0] as EmmaUser;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<EmmaUser | null> {
  const result = await sql`
    SELECT * FROM emma_users WHERE id = ${userId}
  `;
  return (result[0] as EmmaUser) || null;
}

/**
 * Get user by email (for returning user detection)
 */
export async function getUserByEmail(email: string): Promise<EmmaUser | null> {
  const result = await sql`
    SELECT * FROM emma_users WHERE email = ${email.toLowerCase()}
  `;
  return (result[0] as EmmaUser) || null;
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  updates: Partial<{
    name: string;
    arrival_method: string;
    current_trip_start: Date;
    personality_tags: string[];
    personality_notes: string;
  }>
): Promise<EmmaUser | null> {
  const result = await sql`
    UPDATE emma_users SET
      name = COALESCE(${updates.name || null}, name),
      arrival_method = COALESCE(${updates.arrival_method || null}, arrival_method),
      current_trip_start = COALESCE(${updates.current_trip_start || null}, current_trip_start),
      personality_tags = COALESCE(${updates.personality_tags || null}, personality_tags),
      personality_notes = COALESCE(${updates.personality_notes || null}, personality_notes),
      updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;
  return (result[0] as EmmaUser) || null;
}

/**
 * Increment visit count and update last_seen
 */
export async function recordUserVisit(userId: string): Promise<void> {
  await sql`
    UPDATE emma_users SET
      visit_count = visit_count + 1,
      last_seen_at = NOW()
    WHERE id = ${userId}
  `;
}

/**
 * Add personality tag to user
 */
export async function addPersonalityTag(userId: string, tag: string): Promise<void> {
  await sql`
    UPDATE emma_users SET
      personality_tags = array_append(
        COALESCE(personality_tags, ARRAY[]::text[]),
        ${tag}
      ),
      updated_at = NOW()
    WHERE id = ${userId}
    AND NOT (${tag} = ANY(COALESCE(personality_tags, ARRAY[]::text[])))
  `;
}

// ============================================
// BROWSER SESSION MANAGEMENT
// ============================================

/**
 * Create or get browser session by fingerprint
 */
export async function getOrCreateBrowserSession(
  fingerprint: string,
  userAgent?: string,
  ipAddress?: string
): Promise<BrowserSession> {
  // Try to get existing session
  const existing = await sql`
    SELECT * FROM emma_browser_sessions WHERE browser_fingerprint = ${fingerprint}
  `;

  if (existing.length > 0) {
    // Update last_active and increment count
    await sql`
      UPDATE emma_browser_sessions SET
        last_active = NOW(),
        session_count = session_count + 1,
        user_agent = COALESCE(${userAgent || null}, user_agent),
        ip_address = COALESCE(${ipAddress || null}, ip_address)
      WHERE browser_fingerprint = ${fingerprint}
    `;
    return existing[0] as BrowserSession;
  }

  // Create new session
  const result = await sql`
    INSERT INTO emma_browser_sessions (browser_fingerprint, user_agent, ip_address)
    VALUES (${fingerprint}, ${userAgent || null}, ${ipAddress || null})
    RETURNING *
  `;
  return result[0] as BrowserSession;
}

/**
 * Link browser session to user
 */
export async function linkBrowserToUser(fingerprint: string, userId: string): Promise<void> {
  await sql`
    UPDATE emma_browser_sessions SET user_id = ${userId}
    WHERE browser_fingerprint = ${fingerprint}
  `;
}

/**
 * Get user by browser fingerprint (for returning user detection without email)
 */
export async function getUserByBrowserFingerprint(fingerprint: string): Promise<EmmaUser | null> {
  const result = await sql`
    SELECT u.* FROM emma_users u
    JOIN emma_browser_sessions bs ON bs.user_id = u.id
    WHERE bs.browser_fingerprint = ${fingerprint}
  `;
  return (result[0] as EmmaUser) || null;
}

// ============================================
// CONVERSATION MANAGEMENT
// ============================================

/**
 * Create a new conversation
 */
export async function createConversation(
  sessionToken: string,
  userId?: string,
  browserSessionId?: string
): Promise<EmmaConversation> {
  const result = await sql`
    INSERT INTO emma_conversations (session_token, user_id, browser_session_id)
    VALUES (${sessionToken}, ${userId || null}, ${browserSessionId || null})
    RETURNING *
  `;
  return result[0] as EmmaConversation;
}

/**
 * Get conversation by session token
 */
export async function getConversationByToken(sessionToken: string): Promise<EmmaConversation | null> {
  const result = await sql`
    SELECT * FROM emma_conversations WHERE session_token = ${sessionToken}
  `;
  return (result[0] as EmmaConversation) || null;
}

/**
 * Get user's recent conversations
 */
export async function getUserConversations(userId: string, limit = 10): Promise<EmmaConversation[]> {
  const result = await sql`
    SELECT * FROM emma_conversations
    WHERE user_id = ${userId}
    ORDER BY started_at DESC
    LIMIT ${limit}
  `;
  return result as EmmaConversation[];
}

/**
 * Update conversation
 */
export async function updateConversation(
  conversationId: string,
  updates: Partial<{
    user_id: string;
    topic: string;
    status: string;
    survey_step: string;
    survey_completed: boolean;
    summary: string;
    key_topics: string[];
  }>
): Promise<void> {
  await sql`
    UPDATE emma_conversations SET
      user_id = COALESCE(${updates.user_id || null}, user_id),
      topic = COALESCE(${updates.topic || null}, topic),
      status = COALESCE(${updates.status || null}, status),
      survey_step = COALESCE(${updates.survey_step || null}, survey_step),
      survey_completed = COALESCE(${updates.survey_completed ?? null}, survey_completed),
      summary = COALESCE(${updates.summary || null}, summary),
      key_topics = COALESCE(${updates.key_topics || null}, key_topics)
    WHERE id = ${conversationId}
  `;
}

/**
 * Link conversation to user (after they provide email)
 */
export async function linkConversationToUser(sessionToken: string, userId: string): Promise<void> {
  await sql`
    UPDATE emma_conversations SET user_id = ${userId}
    WHERE session_token = ${sessionToken}
  `;
}

/**
 * End conversation
 */
export async function endConversation(conversationId: string, summary?: string): Promise<void> {
  await sql`
    UPDATE emma_conversations SET
      status = 'completed',
      ended_at = NOW(),
      summary = COALESCE(${summary || null}, summary)
    WHERE id = ${conversationId}
  `;
}

// ============================================
// MESSAGE MANAGEMENT
// ============================================

/**
 * Save a message
 */
export async function saveMessage(
  conversationId: string,
  sender: 'user' | 'emma',
  content: string,
  options?: {
    message_type?: string;
    selection_value?: string;
    rating_value?: number;
    ai_generated?: boolean;
    ai_prompt_type?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<EmmaMessage> {
  const result = await sql`
    INSERT INTO emma_messages (
      conversation_id, sender, content, message_type,
      selection_value, rating_value, ai_generated, ai_prompt_type, metadata
    )
    VALUES (
      ${conversationId},
      ${sender},
      ${content},
      ${options?.message_type || 'text'},
      ${options?.selection_value || null},
      ${options?.rating_value || null},
      ${options?.ai_generated || false},
      ${options?.ai_prompt_type || null},
      ${JSON.stringify(options?.metadata || {})}
    )
    RETURNING *
  `;
  return result[0] as EmmaMessage;
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(conversationId: string): Promise<EmmaMessage[]> {
  const result = await sql`
    SELECT * FROM emma_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;
  return result as EmmaMessage[];
}

/**
 * Get recent messages for context
 */
export async function getRecentMessages(conversationId: string, limit = 20): Promise<EmmaMessage[]> {
  const result = await sql`
    SELECT * FROM (
      SELECT * FROM emma_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    ) sub ORDER BY created_at ASC
  `;
  return result as EmmaMessage[];
}

// ============================================
// MEMORY MANAGEMENT
// ============================================

/**
 * Save a memory
 */
export async function saveMemory(
  userId: string,
  data: {
    memory_type: string;
    category?: string;
    subject?: string;
    sentiment?: string;
    rating?: number;
    raw_text?: string;
    ai_summary?: string;
    conversation_id?: string;
    importance?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<EmmaMemory> {
  const result = await sql`
    INSERT INTO emma_memories (
      user_id, memory_type, category, subject, sentiment,
      rating, raw_text, ai_summary, conversation_id, importance, metadata
    )
    VALUES (
      ${userId},
      ${data.memory_type},
      ${data.category || null},
      ${data.subject || null},
      ${data.sentiment || null},
      ${data.rating || null},
      ${data.raw_text || null},
      ${data.ai_summary || null},
      ${data.conversation_id || null},
      ${data.importance || 5},
      ${JSON.stringify(data.metadata || {})}
    )
    RETURNING *
  `;
  return result[0] as EmmaMemory;
}

/**
 * Get user's memories (for AI context)
 */
export async function getUserMemories(
  userId: string,
  options?: {
    limit?: number;
    category?: string;
    memory_type?: string;
  }
): Promise<EmmaMemory[]> {
  let query;
  
  if (options?.category && options?.memory_type) {
    query = sql`
      SELECT * FROM emma_memories
      WHERE user_id = ${userId}
        AND category = ${options.category}
        AND memory_type = ${options.memory_type}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY importance DESC, created_at DESC
      LIMIT ${options?.limit || 20}
    `;
  } else if (options?.category) {
    query = sql`
      SELECT * FROM emma_memories
      WHERE user_id = ${userId}
        AND category = ${options.category}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY importance DESC, created_at DESC
      LIMIT ${options?.limit || 20}
    `;
  } else if (options?.memory_type) {
    query = sql`
      SELECT * FROM emma_memories
      WHERE user_id = ${userId}
        AND memory_type = ${options.memory_type}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY importance DESC, created_at DESC
      LIMIT ${options?.limit || 20}
    `;
  } else {
    query = sql`
      SELECT * FROM emma_memories
      WHERE user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY importance DESC, created_at DESC
      LIMIT ${options?.limit || 20}
    `;
  }
  
  return await query as EmmaMemory[];
}

/**
 * Get memories about a specific subject
 */
export async function getMemoriesAboutSubject(userId: string, subject: string): Promise<EmmaMemory[]> {
  const result = await sql`
    SELECT * FROM emma_memories
    WHERE user_id = ${userId}
      AND subject ILIKE ${'%' + subject + '%'}
    ORDER BY created_at DESC
  `;
  return result as EmmaMemory[];
}

// ============================================
// RATINGS MANAGEMENT
// ============================================

/**
 * Save a rating
 */
export async function saveRating(
  userId: string,
  data: {
    category: string;
    place_name: string;
    overall_rating: number;
    conversation_id?: string;
    place_id?: string;
    location_description?: string;
    food_rating?: number;
    service_rating?: number;
    ambiance_rating?: number;
    value_rating?: number;
    review_text?: string;
    highlights?: string[];
    lowlights?: string[];
    would_recommend?: boolean;
    recommend_for?: string[];
    visited_date?: Date;
    visit_type?: string;
  }
): Promise<EmmaRating> {
  const result = await sql`
    INSERT INTO emma_ratings (
      user_id, conversation_id, category, place_name, place_id,
      location_description, overall_rating, food_rating, service_rating,
      ambiance_rating, value_rating, review_text, highlights, lowlights,
      would_recommend, recommend_for, visited_date, visit_type
    )
    VALUES (
      ${userId},
      ${data.conversation_id || null},
      ${data.category},
      ${data.place_name},
      ${data.place_id || null},
      ${data.location_description || null},
      ${data.overall_rating},
      ${data.food_rating || null},
      ${data.service_rating || null},
      ${data.ambiance_rating || null},
      ${data.value_rating || null},
      ${data.review_text || null},
      ${data.highlights || null},
      ${data.lowlights || null},
      ${data.would_recommend ?? null},
      ${data.recommend_for || null},
      ${data.visited_date || null},
      ${data.visit_type || null}
    )
    RETURNING *
  `;
  return result[0] as EmmaRating;
}

/**
 * Get user's ratings
 */
export async function getUserRatings(userId: string, limit = 20): Promise<EmmaRating[]> {
  const result = await sql`
    SELECT * FROM emma_ratings
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result as EmmaRating[];
}

/**
 * Get ratings for a place
 */
export async function getPlaceRatings(placeName: string): Promise<EmmaRating[]> {
  const result = await sql`
    SELECT * FROM emma_ratings
    WHERE place_name ILIKE ${'%' + placeName + '%'}
    ORDER BY created_at DESC
  `;
  return result as EmmaRating[];
}

/**
 * Get average rating for a place
 */
export async function getPlaceAverageRating(placeName: string): Promise<{
  average_rating: number;
  total_ratings: number;
  would_recommend_percent: number;
} | null> {
  const result = await sql`
    SELECT
      AVG(overall_rating) as average_rating,
      COUNT(*) as total_ratings,
      AVG(CASE WHEN would_recommend THEN 1 ELSE 0 END) * 100 as would_recommend_percent
    FROM emma_ratings
    WHERE place_name ILIKE ${'%' + placeName + '%'}
  `;
  
  if (!result[0] || !result[0].total_ratings) return null;
  
  return {
    average_rating: Number(result[0].average_rating),
    total_ratings: Number(result[0].total_ratings),
    would_recommend_percent: Number(result[0].would_recommend_percent),
  };
}

// ============================================
// COMPLAINTS MANAGEMENT
// ============================================

/**
 * Save a complaint
 */
export async function saveComplaint(
  data: {
    user_id?: string;
    conversation_id?: string;
    category: string;
    subject?: string;
    description: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<EmmaComplaint> {
  const result = await sql`
    INSERT INTO emma_complaints (
      user_id, conversation_id, category, subject, description, severity, metadata
    )
    VALUES (
      ${data.user_id || null},
      ${data.conversation_id || null},
      ${data.category},
      ${data.subject || null},
      ${data.description},
      ${data.severity || 'medium'},
      ${JSON.stringify(data.metadata || {})}
    )
    RETURNING *
  `;
  return result[0] as EmmaComplaint;
}

/**
 * Get complaints (for admin)
 */
export async function getComplaints(options?: {
  status?: string;
  severity?: string;
  limit?: number;
}): Promise<EmmaComplaint[]> {
  let query;
  
  if (options?.status && options?.severity) {
    query = sql`
      SELECT * FROM emma_complaints
      WHERE status = ${options.status} AND severity = ${options.severity}
      ORDER BY created_at DESC
      LIMIT ${options?.limit || 50}
    `;
  } else if (options?.status) {
    query = sql`
      SELECT * FROM emma_complaints
      WHERE status = ${options.status}
      ORDER BY created_at DESC
      LIMIT ${options?.limit || 50}
    `;
  } else if (options?.severity) {
    query = sql`
      SELECT * FROM emma_complaints
      WHERE severity = ${options.severity}
      ORDER BY created_at DESC
      LIMIT ${options?.limit || 50}
    `;
  } else {
    query = sql`
      SELECT * FROM emma_complaints
      ORDER BY created_at DESC
      LIMIT ${options?.limit || 50}
    `;
  }
  
  return await query as EmmaComplaint[];
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Log an analytics event
 */
export async function logAnalyticsEvent(
  eventType: string,
  data?: {
    user_id?: string;
    conversation_id?: string;
    event_category?: string;
    event_data?: Record<string, unknown>;
  }
): Promise<void> {
  await sql`
    INSERT INTO emma_analytics_events (user_id, conversation_id, event_type, event_category, event_data)
    VALUES (
      ${data?.user_id || null},
      ${data?.conversation_id || null},
      ${eventType},
      ${data?.event_category || null},
      ${JSON.stringify(data?.event_data || {})}
    )
  `;
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(days = 7): Promise<{
  total_users: number;
  new_users: number;
  returning_users: number;
  total_conversations: number;
  completed_surveys: number;
  total_ratings: number;
  avg_rating: number;
  total_complaints: number;
  unresolved_complaints: number;
}> {
  const result = await sql`
    SELECT
      (SELECT COUNT(*) FROM emma_users) as total_users,
      (SELECT COUNT(*) FROM emma_users WHERE first_seen_at > NOW() - INTERVAL '${days} days') as new_users,
      (SELECT COUNT(*) FROM emma_users WHERE visit_count > 1) as returning_users,
      (SELECT COUNT(*) FROM emma_conversations WHERE started_at > NOW() - INTERVAL '${days} days') as total_conversations,
      (SELECT COUNT(*) FROM emma_conversations WHERE survey_completed = true AND started_at > NOW() - INTERVAL '${days} days') as completed_surveys,
      (SELECT COUNT(*) FROM emma_ratings WHERE created_at > NOW() - INTERVAL '${days} days') as total_ratings,
      (SELECT AVG(overall_rating) FROM emma_ratings) as avg_rating,
      (SELECT COUNT(*) FROM emma_complaints WHERE created_at > NOW() - INTERVAL '${days} days') as total_complaints,
      (SELECT COUNT(*) FROM emma_complaints WHERE status NOT IN ('resolved', 'closed')) as unresolved_complaints
  `;
  
  return {
    total_users: Number(result[0].total_users) || 0,
    new_users: Number(result[0].new_users) || 0,
    returning_users: Number(result[0].returning_users) || 0,
    total_conversations: Number(result[0].total_conversations) || 0,
    completed_surveys: Number(result[0].completed_surveys) || 0,
    total_ratings: Number(result[0].total_ratings) || 0,
    avg_rating: Number(result[0].avg_rating) || 0,
    total_complaints: Number(result[0].total_complaints) || 0,
    unresolved_complaints: Number(result[0].unresolved_complaints) || 0,
  };
}

// ============================================
// USER CONTEXT BUILDER (For AI)
// ============================================

/**
 * Build comprehensive user context for AI prompts
 */
export async function buildUserContext(userId: string): Promise<string> {
  const user = await getUserById(userId);
  if (!user) return 'New user - no history available.';
  
  const memories = await getUserMemories(userId, { limit: 10 });
  const ratings = await getUserRatings(userId, 5);
  const conversations = await getUserConversations(userId, 3);
  
  // Calculate time since last visit
  const lastSeen = new Date(user.last_seen_at);
  const now = new Date();
  const daysSinceLastVisit = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24));
  
  let context = `## User Profile
- Name: ${user.name}
- Visit count: ${user.visit_count}
- Last seen: ${daysSinceLastVisit === 0 ? 'Today' : daysSinceLastVisit === 1 ? 'Yesterday' : `${daysSinceLastVisit} days ago`}
- Arrived via: ${user.arrival_method || 'Unknown'}
- Personality: ${user.personality_tags?.join(', ') || 'Not determined yet'}
`;

  if (memories.length > 0) {
    context += `\n## Recent Memories\n`;
    for (const m of memories.slice(0, 5)) {
      context += `- ${m.memory_type}: "${m.raw_text?.slice(0, 100) || m.ai_summary || m.subject}" (${m.sentiment || 'neutral'})\n`;
    }
  }

  if (ratings.length > 0) {
    context += `\n## Places Rated\n`;
    for (const r of ratings) {
      context += `- ${r.place_name}: ${r.overall_rating}⭐ ${r.would_recommend ? '(recommended)' : ''}\n`;
    }
  }

  if (conversations.length > 1) {
    context += `\n## Conversation History\n`;
    context += `- Previous conversations: ${conversations.length}\n`;
    const lastConvo = conversations[0];
    if (lastConvo.summary) {
      context += `- Last topic: ${lastConvo.topic}\n`;
      context += `- Summary: ${lastConvo.summary}\n`;
    }
  }

  return context;
}

// ============================================
// LEGACY SUPPORT (for existing code)
// ============================================

// Keep the old interfaces for backward compatibility
export interface EmmaSurvey {
  id: number;
  session_id: string;
  name: string;
  email: string;
  arrival_method: 'plane' | 'cruise' | 'ferry';
  journey_rating: number;
  activity_interest: 'beach' | 'adventure' | 'food' | 'nightlife' | 'photos';
  created_at: Date;
  ip_address?: string;
  user_agent?: string;
}

export interface EmmaSurveyInput {
  session_id: string;
  name: string;
  email: string;
  arrival_method: string;
  journey_rating: number;
  activity_interest: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Save a completed Emma survey (legacy)
 */
export async function saveEmmaSurvey(data: EmmaSurveyInput): Promise<EmmaSurvey> {
  const result = await sql`
    INSERT INTO emma_surveys (
      session_id, name, email, arrival_method, 
      journey_rating, activity_interest, ip_address, user_agent
    )
    VALUES (
      ${data.session_id}, ${data.name}, ${data.email}, ${data.arrival_method},
      ${data.journey_rating}, ${data.activity_interest},
      ${data.ip_address || null}, ${data.user_agent || null}
    )
    RETURNING *
  `;
  return result[0] as EmmaSurvey;
}

/**
 * Check if email has already submitted a survey
 */
export async function hasEmailSubmitted(email: string): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM emma_surveys WHERE email = ${email} LIMIT 1
  `;
  return result.length > 0;
}

/**
 * Get all Emma surveys (legacy)
 */
export async function getAllEmmaSurveys(limit = 100, offset = 0): Promise<EmmaSurvey[]> {
  const result = await sql`
    SELECT * FROM emma_surveys 
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return result as EmmaSurvey[];
}

/**
 * Get survey statistics (legacy)
 */
export async function getEmmaSurveyStats(): Promise<{
  total_surveys: number;
  avg_rating: number;
  arrival_breakdown: Record<string, number>;
  activity_breakdown: Record<string, number>;
  surveys_today: number;
  surveys_this_week: number;
}> {
  const totalResult = await sql`
    SELECT 
      COUNT(*) as total_surveys,
      COALESCE(AVG(journey_rating), 0) as avg_rating,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as surveys_today,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as surveys_this_week
    FROM emma_surveys
  `;

  const arrivalResult = await sql`
    SELECT arrival_method, COUNT(*) as count
    FROM emma_surveys
    GROUP BY arrival_method
  `;

  const activityResult = await sql`
    SELECT activity_interest, COUNT(*) as count
    FROM emma_surveys
    GROUP BY activity_interest
  `;

  const arrivalBreakdown: Record<string, number> = {};
  for (const row of arrivalResult) {
    arrivalBreakdown[row.arrival_method as string] = Number(row.count);
  }

  const activityBreakdown: Record<string, number> = {};
  for (const row of activityResult) {
    activityBreakdown[row.activity_interest as string] = Number(row.count);
  }

  return {
    total_surveys: Number(totalResult[0].total_surveys),
    avg_rating: Number(totalResult[0].avg_rating),
    surveys_today: Number(totalResult[0].surveys_today),
    surveys_this_week: Number(totalResult[0].surveys_this_week),
    arrival_breakdown: arrivalBreakdown,
    activity_breakdown: activityBreakdown,
  };
}
