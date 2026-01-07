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

