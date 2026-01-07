import { NextRequest, NextResponse } from 'next/server';
import { 
  createChatSession, 
  getChatSession, 
  findChatByEmail,
  getChatMessages,
  saveChatMessage,
  updateChatSession,
  incrementVisitCount
} from '@/lib/emma-db';

// GET - Check for existing session or find by email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const email = searchParams.get('email');

    // Check by email first (returning user detection)
    if (email) {
      const previousSession = await findChatByEmail(email);
      if (previousSession) {
        const messages = await getChatMessages(previousSession.session_id);
        return NextResponse.json({
          returning: true,
          session: previousSession,
          messages,
          message: `Welcome back! We found your previous chat.`
        });
      }
    }

    // Check by session ID
    if (sessionId) {
      const session = await getChatSession(sessionId);
      if (session) {
        const messages = await getChatMessages(sessionId);
        return NextResponse.json({
          returning: false,
          session,
          messages
        });
      }
    }

    return NextResponse.json({ 
      returning: false, 
      session: null,
      messages: []
    });

  } catch (error) {
    console.error('Session GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

// POST - Create new session or update existing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, email, name, arrivalMethod, journeyRating, activityInterest, role, content, messageType } = body;

    switch (action) {
      case 'create':
        // Create new chat session
        const newSession = await createChatSession(sessionId);
        return NextResponse.json({ session: newSession });

      case 'update':
        // Update session with user info
        await updateChatSession(sessionId, {
          user_email: email,
          user_name: name,
          arrival_method: arrivalMethod,
          journey_rating: journeyRating,
          activity_interest: activityInterest,
        });
        return NextResponse.json({ success: true });

      case 'complete':
        // Mark session as completed
        await updateChatSession(sessionId, { is_completed: true });
        return NextResponse.json({ success: true });

      case 'message':
        // Save a chat message
        const message = await saveChatMessage(sessionId, role, content, messageType || 'text');
        return NextResponse.json({ message });

      case 'returning':
        // Handle returning user - increment visit count
        await incrementVisitCount(sessionId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Session POST error:', error);
    return NextResponse.json({ error: 'Failed to process session action' }, { status: 500 });
  }
}

