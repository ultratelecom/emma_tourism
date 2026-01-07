import { NextResponse } from 'next/server';
import { getEmmaSurveyStats, getAllEmmaSurveys } from '@/lib/emma-db';

export async function GET() {
  try {
    const stats = await getEmmaSurveyStats();
    const recentSurveys = await getAllEmmaSurveys(10, 0);

    return NextResponse.json({
      stats,
      recent_surveys: recentSurveys.map(s => ({
        id: s.id,
        name: s.name,
        arrival_method: s.arrival_method,
        journey_rating: s.journey_rating,
        activity_interest: s.activity_interest,
        created_at: s.created_at,
      })),
    });

  } catch (error) {
    console.error('Emma stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

