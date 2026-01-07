import { NextRequest, NextResponse } from 'next/server';
import { saveEmmaSurvey, hasEmailSubmitted, EmmaSurveyInput } from '@/lib/emma-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { session_id, name, email, arrival_method, journey_rating, activity_interest } = body;

    // Validate required fields
    if (!session_id || !name || !email || !arrival_method || !journey_rating || !activity_interest) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check for duplicate submission
    const alreadySubmitted = await hasEmailSubmitted(email);
    if (alreadySubmitted) {
      return NextResponse.json(
        { error: 'This email has already submitted a survey', duplicate: true },
        { status: 409 }
      );
    }

    // Get client info
    const ip_address = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
    const user_agent = request.headers.get('user-agent') || 'unknown';

    // Save the survey
    const surveyData: EmmaSurveyInput = {
      session_id,
      name,
      email,
      arrival_method,
      journey_rating,
      activity_interest,
      ip_address,
      user_agent,
    };

    const survey = await saveEmmaSurvey(surveyData);

    return NextResponse.json({ 
      success: true, 
      survey_id: survey.id,
      message: 'Thank you for completing the survey!'
    });

  } catch (error) {
    console.error('Emma survey API error:', error);
    return NextResponse.json(
      { error: 'Failed to save survey' },
      { status: 500 }
    );
  }
}

