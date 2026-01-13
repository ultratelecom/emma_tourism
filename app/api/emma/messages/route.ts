import { NextRequest, NextResponse } from 'next/server';
import {
  getConversationByToken,
  saveMessage,
  getConversationMessages,
  getRecentMessages,
} from '@/lib/emma-db';

/**
 * POST /api/emma/messages - Save a message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      session_token, 
      sender, 
      content, 
      message_type,
      selection_value,
      rating_value,
      ai_generated,
      ai_prompt_type,
      metadata 
    } = body;

    if (!session_token || !sender || !content) {
      return NextResponse.json(
        { error: 'session_token, sender, and content are required' },
        { status: 400 }
      );
    }

    // Get conversation
    const conversation = await getConversationByToken(session_token);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Save message
    const message = await saveMessage(conversation.id, sender, content, {
      message_type,
      selection_value,
      rating_value,
      ai_generated,
      ai_prompt_type,
      metadata,
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Save message error:', error);
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emma/messages - Get messages for a conversation
 */
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.nextUrl.searchParams.get('session_token');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100');
    const recent = request.nextUrl.searchParams.get('recent') === 'true';

    if (!sessionToken) {
      return NextResponse.json({ error: 'session_token required' }, { status: 400 });
    }

    const conversation = await getConversationByToken(sessionToken);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages = recent
      ? await getRecentMessages(conversation.id, limit)
      : await getConversationMessages(conversation.id);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}
