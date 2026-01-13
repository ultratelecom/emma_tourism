import { NextRequest, NextResponse } from 'next/server';
import {
  saveRating,
  getUserRatings,
  getPlaceRatings,
  getPlaceAverageRating,
  saveMemory,
  logAnalyticsEvent,
} from '@/lib/emma-db';

/**
 * POST /api/emma/ratings - Save a new rating
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      conversation_id,
      category,
      place_name,
      overall_rating,
      // Optional fields
      place_id,
      location_description,
      food_rating,
      service_rating,
      ambiance_rating,
      value_rating,
      review_text,
      highlights,
      lowlights,
      would_recommend,
      recommend_for,
      visited_date,
      visit_type,
    } = body;

    // Validate required fields
    if (!user_id || !category || !place_name || !overall_rating) {
      return NextResponse.json(
        { error: 'user_id, category, place_name, and overall_rating are required' },
        { status: 400 }
      );
    }

    // Validate rating range
    if (overall_rating < 1 || overall_rating > 5) {
      return NextResponse.json(
        { error: 'overall_rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Save the rating
    const rating = await saveRating(user_id, {
      category,
      place_name,
      overall_rating,
      conversation_id,
      place_id,
      location_description,
      food_rating,
      service_rating,
      ambiance_rating,
      value_rating,
      review_text,
      highlights,
      lowlights,
      would_recommend,
      recommend_for,
      visited_date: visited_date ? new Date(visited_date) : undefined,
      visit_type,
    });

    // Also save as a memory for AI context
    await saveMemory(user_id, {
      memory_type: 'rating',
      category,
      subject: place_name,
      sentiment: overall_rating >= 4 ? 'positive' : overall_rating >= 3 ? 'neutral' : 'negative',
      rating: overall_rating,
      raw_text: review_text || `Rated ${place_name} ${overall_rating}/5 stars`,
      conversation_id,
      importance: overall_rating === 5 || overall_rating === 1 ? 9 : 7,
    });

    // Log analytics
    await logAnalyticsEvent('rating_submitted', {
      user_id,
      conversation_id,
      event_category: category,
      event_data: {
        place_name,
        overall_rating,
        would_recommend,
      },
    });

    return NextResponse.json({ rating, success: true });
  } catch (error) {
    console.error('Save rating error:', error);
    return NextResponse.json(
      { error: 'Failed to save rating' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emma/ratings - Get ratings
 * 
 * Query params:
 * - user_id: Get ratings by user
 * - place_name: Get ratings for a place
 * - category: Filter by category
 * - average: If true, return average stats for place
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('user_id');
    const placeName = request.nextUrl.searchParams.get('place_name');
    const getAverage = request.nextUrl.searchParams.get('average') === 'true';

    if (placeName) {
      if (getAverage) {
        const average = await getPlaceAverageRating(placeName);
        if (!average) {
          return NextResponse.json({ 
            exists: false, 
            message: 'No ratings found for this place' 
          });
        }
        return NextResponse.json({ ...average, exists: true });
      }
      
      const ratings = await getPlaceRatings(placeName);
      return NextResponse.json({ ratings, total: ratings.length });
    }

    if (userId) {
      const ratings = await getUserRatings(userId);
      return NextResponse.json({ ratings, total: ratings.length });
    }

    return NextResponse.json(
      { error: 'user_id or place_name required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get ratings error:', error);
    return NextResponse.json(
      { error: 'Failed to get ratings' },
      { status: 500 }
    );
  }
}
