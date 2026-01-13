import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getAnalyticsSummary } from '@/lib/emma-db';

/**
 * GET /api/emma/analytics - Get comprehensive analytics for THA dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7');
    const type = request.nextUrl.searchParams.get('type') || 'summary';

    switch (type) {
      case 'summary':
        return NextResponse.json(await getSummaryAnalytics(days));
      
      case 'ratings':
        return NextResponse.json(await getRatingsAnalytics(days));
      
      case 'arrivals':
        return NextResponse.json(await getArrivalsAnalytics(days));
      
      case 'activities':
        return NextResponse.json(await getActivitiesAnalytics(days));
      
      case 'complaints':
        return NextResponse.json(await getComplaintsAnalytics(days));
      
      case 'trends':
        return NextResponse.json(await getTrendsAnalytics(days));
      
      case 'full':
        return NextResponse.json(await getFullAnalytics(days));
      
      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}

/**
 * Summary analytics
 */
async function getSummaryAnalytics(days: number) {
  const summary = await getAnalyticsSummary(days);
  
  // Get additional metrics
  const additionalMetrics = await sql`
    SELECT
      (SELECT COUNT(*) FROM emma_conversations WHERE started_at > NOW() - INTERVAL '${days} days') as conversations,
      (SELECT AVG(message_count) FROM emma_conversations WHERE started_at > NOW() - INTERVAL '${days} days') as avg_messages,
      (SELECT COUNT(*) FROM emma_messages WHERE created_at > NOW() - INTERVAL '${days} days') as total_messages,
      (SELECT COUNT(DISTINCT user_id) FROM emma_conversations WHERE started_at > NOW() - INTERVAL '${days} days') as active_users
  `;
  
  return {
    ...summary,
    period_days: days,
    conversations: Number(additionalMetrics[0].conversations),
    avg_messages_per_conversation: Number(additionalMetrics[0].avg_messages) || 0,
    total_messages: Number(additionalMetrics[0].total_messages),
    active_users: Number(additionalMetrics[0].active_users),
  };
}

/**
 * Ratings breakdown analytics
 */
async function getRatingsAnalytics(days: number) {
  // Overall stats
  const overallStats = await sql`
    SELECT
      COUNT(*) as total_ratings,
      AVG(overall_rating) as average_rating,
      COUNT(*) FILTER (WHERE overall_rating = 5) as five_star,
      COUNT(*) FILTER (WHERE overall_rating = 4) as four_star,
      COUNT(*) FILTER (WHERE overall_rating = 3) as three_star,
      COUNT(*) FILTER (WHERE overall_rating <= 2) as low_rating,
      COUNT(*) FILTER (WHERE would_recommend = true) as recommended
    FROM emma_ratings
    WHERE created_at > NOW() - INTERVAL '${days} days'
  `;
  
  // By category
  const byCategory = await sql`
    SELECT
      category,
      COUNT(*) as count,
      AVG(overall_rating) as avg_rating,
      COUNT(*) FILTER (WHERE would_recommend = true) as recommended
    FROM emma_ratings
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY category
    ORDER BY count DESC
  `;
  
  // Top rated places
  const topPlaces = await sql`
    SELECT
      place_name,
      category,
      AVG(overall_rating) as avg_rating,
      COUNT(*) as rating_count
    FROM emma_ratings
    GROUP BY place_name, category
    HAVING COUNT(*) >= 2
    ORDER BY avg_rating DESC, rating_count DESC
    LIMIT 10
  `;
  
  // Worst rated places (for attention)
  const needsAttention = await sql`
    SELECT
      place_name,
      category,
      AVG(overall_rating) as avg_rating,
      COUNT(*) as rating_count,
      COUNT(*) FILTER (WHERE would_recommend = false) as not_recommended
    FROM emma_ratings
    GROUP BY place_name, category
    HAVING AVG(overall_rating) < 3 AND COUNT(*) >= 2
    ORDER BY avg_rating ASC
    LIMIT 5
  `;
  
  return {
    period_days: days,
    overall: {
      total: Number(overallStats[0].total_ratings),
      average: Number(overallStats[0].average_rating) || 0,
      distribution: {
        five_star: Number(overallStats[0].five_star),
        four_star: Number(overallStats[0].four_star),
        three_star: Number(overallStats[0].three_star),
        low_rating: Number(overallStats[0].low_rating),
      },
      recommendation_rate: overallStats[0].total_ratings > 0 
        ? (Number(overallStats[0].recommended) / Number(overallStats[0].total_ratings) * 100).toFixed(1)
        : 0,
    },
    by_category: byCategory.map(r => ({
      category: r.category,
      count: Number(r.count),
      avg_rating: Number(r.avg_rating),
      recommended: Number(r.recommended),
    })),
    top_places: topPlaces.map(r => ({
      name: r.place_name,
      category: r.category,
      rating: Number(r.avg_rating),
      count: Number(r.rating_count),
    })),
    needs_attention: needsAttention.map(r => ({
      name: r.place_name,
      category: r.category,
      rating: Number(r.avg_rating),
      count: Number(r.rating_count),
      not_recommended: Number(r.not_recommended),
    })),
  };
}

/**
 * Arrivals analytics
 */
async function getArrivalsAnalytics(days: number) {
  const byMethod = await sql`
    SELECT
      arrival_method,
      COUNT(*) as count,
      COUNT(DISTINCT email) as unique_visitors
    FROM emma_surveys
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY arrival_method
    ORDER BY count DESC
  `;
  
  const byDay = await sql`
    SELECT
      DATE(created_at) as date,
      arrival_method,
      COUNT(*) as count
    FROM emma_surveys
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at), arrival_method
    ORDER BY date DESC
  `;
  
  const journeyRatings = await sql`
    SELECT
      arrival_method,
      AVG(journey_rating) as avg_rating,
      COUNT(*) FILTER (WHERE journey_rating >= 4) as good_journeys,
      COUNT(*) FILTER (WHERE journey_rating <= 2) as bad_journeys
    FROM emma_surveys
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY arrival_method
  `;
  
  return {
    period_days: days,
    by_method: byMethod.map(r => ({
      method: r.arrival_method,
      count: Number(r.count),
      unique_visitors: Number(r.unique_visitors),
    })),
    daily_breakdown: byDay.map(r => ({
      date: r.date,
      method: r.arrival_method,
      count: Number(r.count),
    })),
    journey_experience: journeyRatings.map(r => ({
      method: r.arrival_method,
      avg_rating: Number(r.avg_rating),
      good_journeys: Number(r.good_journeys),
      bad_journeys: Number(r.bad_journeys),
    })),
  };
}

/**
 * Activity interests analytics
 */
async function getActivitiesAnalytics(days: number) {
  const interests = await sql`
    SELECT
      activity_interest,
      COUNT(*) as count,
      COUNT(DISTINCT email) as unique_visitors
    FROM emma_surveys
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY activity_interest
    ORDER BY count DESC
  `;
  
  // Cross-reference with arrival method
  const interestByArrival = await sql`
    SELECT
      arrival_method,
      activity_interest,
      COUNT(*) as count
    FROM emma_surveys
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY arrival_method, activity_interest
    ORDER BY arrival_method, count DESC
  `;
  
  // Top activities from ratings
  const topActivities = await sql`
    SELECT
      place_name,
      AVG(overall_rating) as avg_rating,
      COUNT(*) as rating_count
    FROM emma_ratings
    WHERE category = 'activity' AND created_at > NOW() - INTERVAL '${days} days'
    GROUP BY place_name
    ORDER BY rating_count DESC, avg_rating DESC
    LIMIT 10
  `;
  
  return {
    period_days: days,
    interests: interests.map(r => ({
      activity: r.activity_interest,
      count: Number(r.count),
      unique_visitors: Number(r.unique_visitors),
    })),
    interest_by_arrival: interestByArrival.map(r => ({
      arrival: r.arrival_method,
      activity: r.activity_interest,
      count: Number(r.count),
    })),
    top_rated_activities: topActivities.map(r => ({
      name: r.place_name,
      rating: Number(r.avg_rating),
      count: Number(r.rating_count),
    })),
  };
}

/**
 * Complaints analytics
 */
async function getComplaintsAnalytics(days: number) {
  const overall = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'new') as new_count,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE severity = 'urgent') as urgent,
      COUNT(*) FILTER (WHERE severity = 'high') as high
    FROM emma_complaints
    WHERE created_at > NOW() - INTERVAL '${days} days'
  `;
  
  const byCategory = await sql`
    SELECT
      category,
      COUNT(*) as count,
      AVG(CASE severity
        WHEN 'low' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'high' THEN 3
        WHEN 'urgent' THEN 4
      END) as avg_severity
    FROM emma_complaints
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY category
    ORDER BY count DESC
  `;
  
  const recent = await sql`
    SELECT
      id,
      category,
      subject,
      severity,
      status,
      created_at
    FROM emma_complaints
    WHERE created_at > NOW() - INTERVAL '${days} days'
    ORDER BY
      CASE severity WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      created_at DESC
    LIMIT 10
  `;
  
  return {
    period_days: days,
    summary: {
      total: Number(overall[0].total),
      new: Number(overall[0].new_count),
      resolved: Number(overall[0].resolved),
      urgent: Number(overall[0].urgent),
      high: Number(overall[0].high),
    },
    by_category: byCategory.map(r => ({
      category: r.category,
      count: Number(r.count),
      avg_severity: Number(r.avg_severity),
    })),
    recent_complaints: recent.map(r => ({
      id: r.id,
      category: r.category,
      subject: r.subject,
      severity: r.severity,
      status: r.status,
      created_at: r.created_at,
    })),
  };
}

/**
 * Trends analytics
 */
async function getTrendsAnalytics(days: number) {
  const dailySurveys = await sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as surveys,
      AVG(journey_rating) as avg_journey_rating
    FROM emma_surveys
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `;
  
  const dailyRatings = await sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as ratings,
      AVG(overall_rating) as avg_rating
    FROM emma_ratings
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `;
  
  const returningUsers = await sql`
    SELECT
      DATE(last_seen_at) as date,
      COUNT(*) FILTER (WHERE visit_count > 1) as returning,
      COUNT(*) as total
    FROM emma_users
    WHERE last_seen_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(last_seen_at)
    ORDER BY date
  `;
  
  return {
    period_days: days,
    daily_surveys: dailySurveys.map(r => ({
      date: r.date,
      count: Number(r.surveys),
      avg_journey_rating: Number(r.avg_journey_rating),
    })),
    daily_ratings: dailyRatings.map(r => ({
      date: r.date,
      count: Number(r.ratings),
      avg_rating: Number(r.avg_rating),
    })),
    user_retention: returningUsers.map(r => ({
      date: r.date,
      returning: Number(r.returning),
      total: Number(r.total),
      retention_rate: r.total > 0 ? (Number(r.returning) / Number(r.total) * 100).toFixed(1) : 0,
    })),
  };
}

/**
 * Full analytics (combines all)
 */
async function getFullAnalytics(days: number) {
  const [summary, ratings, arrivals, activities, complaints, trends] = await Promise.all([
    getSummaryAnalytics(days),
    getRatingsAnalytics(days),
    getArrivalsAnalytics(days),
    getActivitiesAnalytics(days),
    getComplaintsAnalytics(days),
    getTrendsAnalytics(days),
  ]);
  
  return {
    generated_at: new Date().toISOString(),
    period_days: days,
    summary,
    ratings,
    arrivals,
    activities,
    complaints,
    trends,
  };
}
