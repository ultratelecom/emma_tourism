import { NextRequest, NextResponse } from 'next/server';
import {
  createConversation,
  getConversationByToken,
  updateConversation,
  linkConversationToUser,
  endConversation,
  saveMessage,
  getConversationMessages,
  getRecentMessages,
  getUserConversations,
  logAnalyticsEvent,
} from '@/lib/emma-db';

/**
 * POST /api/emma/conversation - Create or update conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, session_token, user_id, browser_session_id, ...data } = body;

    switch (action) {
      case 'create': {
        if (!session_token) {
          return NextResponse.json({ error: 'Session token required' }, { status: 400 });
        }

        // Check if conversation already exists
        const existing = await getConversationByToken(session_token);
        if (existing) {
          return NextResponse.json({ conversation: existing, created: false });
        }

        const conversation = await createConversation(
          session_token,
          user_id,
          browser_session_id
        );

        await logAnalyticsEvent('conversation_started', {
          conversation_id: conversation.id,
          user_id,
        });

        return NextResponse.json({ conversation, created: true });
      }

      case 'update': {
        if (!session_token) {
          return NextResponse.json({ error: 'Session token required' }, { status: 400 });
        }

        const conversation = await getConversationByToken(session_token);
        if (!conversation) {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        await updateConversation(conversation.id, data);
        
        const updated = await getConversationByToken(session_token);
        return NextResponse.json({ conversation: updated });
      }

      case 'link_user': {
        if (!session_token || !user_id) {
          return NextResponse.json({ error: 'Session token and user_id required' }, { status: 400 });
        }

        await linkConversationToUser(session_token, user_id);
        const conversation = await getConversationByToken(session_token);
        
        return NextResponse.json({ conversation });
      }

      case 'end': {
        if (!session_token) {
          return NextResponse.json({ error: 'Session token required' }, { status: 400 });
        }

        const conversation = await getConversationByToken(session_token);
        if (!conversation) {
          return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        await endConversation(conversation.id, data.summary);

        await logAnalyticsEvent('conversation_ended', {
          conversation_id: conversation.id,
          user_id: conversation.user_id || undefined,
          event_data: { 
            message_count: conversation.message_count,
            survey_completed: conversation.survey_completed 
          }
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to process conversation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emma/conversation - Get conversation details
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.nextUrl.searchParams.get('session_token');
    const userId = request.nextUrl.searchParams.get('user_id');
    const includeMessages = request.nextUrl.searchParams.get('include_messages') === 'true';

    if (sessionToken) {
      const conversation = await getConversationByToken(sessionToken);
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const response: {
        conversation: typeof conversation;
        messages?: Awaited<ReturnType<typeof getConversationMessages>>;
      } = { conversation };

      if (includeMessages) {
        response.messages = await getConversationMessages(conversation.id);
      }

      return NextResponse.json(response);
    }

    if (userId) {
      const conversations = await getUserConversations(userId);
      return NextResponse.json({ conversations });
    }

    return NextResponse.json({ error: 'Session token or user_id required' }, { status: 400 });
  } catch (error) {
    console.error('Conversation lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup conversation' },
      { status: 500 }
    );
  }
}
