import { sql } from './db';

// ============================================
// EMMA SURVEY DATA
// ============================================

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
 * Save a completed Emma survey
 */
export async function saveEmmaSurvey(data: EmmaSurveyInput): Promise<EmmaSurvey> {
  const result = await sql`
    INSERT INTO emma_surveys (
      session_id, 
      name, 
      email, 
      arrival_method, 
      journey_rating, 
      activity_interest,
      ip_address,
      user_agent
    )
    VALUES (
      ${data.session_id},
      ${data.name},
      ${data.email},
      ${data.arrival_method},
      ${data.journey_rating},
      ${data.activity_interest},
      ${data.ip_address || null},
      ${data.user_agent || null}
    )
    RETURNING *
  `;
  return result[0] as EmmaSurvey;
}

/**
 * Get all Emma surveys (for admin dashboard)
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
 * Get survey statistics
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

/**
 * Check if email has already submitted a survey (prevent duplicates)
 */
export async function hasEmailSubmitted(email: string): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM emma_surveys WHERE email = ${email} LIMIT 1
  `;
  return result.length > 0;
}

/**
 * Get survey by session ID
 */
export async function getSurveyBySession(sessionId: string): Promise<EmmaSurvey | null> {
  const result = await sql`
    SELECT * FROM emma_surveys WHERE session_id = ${sessionId}
  `;
  return result[0] as EmmaSurvey || null;
}

// ============================================
// CHAT PERSISTENCE
// ============================================

export interface ChatSession {
  id: number;
  session_id: string;
  user_email: string | null;
  user_name: string | null;
  arrival_method: string | null;
  journey_rating: number | null;
  activity_interest: string | null;
  started_at: Date;
  last_active_at: Date;
  is_completed: boolean;
  visit_count: number;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: 'emma' | 'user';
  content: string;
  message_type: string;
  created_at: Date;
}

/**
 * Create a new chat session
 */
export async function createChatSession(sessionId: string): Promise<ChatSession> {
  const result = await sql`
    INSERT INTO emma_chat_sessions (session_id)
    VALUES (${sessionId})
    RETURNING *
  `;
  return result[0] as ChatSession;
}

/**
 * Get chat session by session ID
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const result = await sql`
    SELECT * FROM emma_chat_sessions WHERE session_id = ${sessionId}
  `;
  return result[0] as ChatSession || null;
}

/**
 * Find previous chat session by email (for returning users)
 */
export async function findChatByEmail(email: string): Promise<ChatSession | null> {
  const result = await sql`
    SELECT * FROM emma_chat_sessions 
    WHERE user_email = ${email}
    ORDER BY last_active_at DESC
    LIMIT 1
  `;
  return result[0] as ChatSession || null;
}

/**
 * Update chat session with user info
 */
export async function updateChatSession(
  sessionId: string, 
  updates: Partial<{
    user_email: string;
    user_name: string;
    arrival_method: string;
    journey_rating: number;
    activity_interest: string;
    is_completed: boolean;
  }>
): Promise<void> {
  const setClauses = [];
  const values: (string | number | boolean)[] = [];
  
  if (updates.user_email !== undefined) {
    setClauses.push('user_email = $' + (values.length + 1));
    values.push(updates.user_email);
  }
  if (updates.user_name !== undefined) {
    setClauses.push('user_name = $' + (values.length + 1));
    values.push(updates.user_name);
  }
  if (updates.arrival_method !== undefined) {
    setClauses.push('arrival_method = $' + (values.length + 1));
    values.push(updates.arrival_method);
  }
  if (updates.journey_rating !== undefined) {
    setClauses.push('journey_rating = $' + (values.length + 1));
    values.push(updates.journey_rating);
  }
  if (updates.activity_interest !== undefined) {
    setClauses.push('activity_interest = $' + (values.length + 1));
    values.push(updates.activity_interest);
  }
  if (updates.is_completed !== undefined) {
    setClauses.push('is_completed = $' + (values.length + 1));
    values.push(updates.is_completed);
  }
  
  if (setClauses.length > 0) {
    await sql`
      UPDATE emma_chat_sessions 
      SET ${sql.unsafe(setClauses.join(', '))}, last_active_at = NOW()
      WHERE session_id = ${sessionId}
    `;
  }
}

/**
 * Increment visit count for returning user
 */
export async function incrementVisitCount(sessionId: string): Promise<void> {
  await sql`
    UPDATE emma_chat_sessions 
    SET visit_count = visit_count + 1, last_active_at = NOW()
    WHERE session_id = ${sessionId}
  `;
}

/**
 * Save a chat message
 */
export async function saveChatMessage(
  sessionId: string,
  role: 'emma' | 'user',
  content: string,
  messageType: string = 'text'
): Promise<ChatMessage> {
  const result = await sql`
    INSERT INTO emma_chat_messages (session_id, role, content, message_type)
    VALUES (${sessionId}, ${role}, ${content}, ${messageType})
    RETURNING *
  `;
  
  // Update last active time
  await sql`
    UPDATE emma_chat_sessions SET last_active_at = NOW() WHERE session_id = ${sessionId}
  `;
  
  return result[0] as ChatMessage;
}

/**
 * Get all messages for a chat session
 */
export async function getChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const result = await sql`
    SELECT * FROM emma_chat_messages 
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `;
  return result as ChatMessage[];
}

/**
 * Get chat history for a user by email
 */
export async function getChatHistoryByEmail(email: string): Promise<{
  session: ChatSession;
  messages: ChatMessage[];
} | null> {
  const session = await findChatByEmail(email);
  if (!session) return null;
  
  const messages = await getChatMessages(session.session_id);
  return { session, messages };
}

