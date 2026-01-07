import { NextRequest, NextResponse } from 'next/server';
import { getChat, getMessages } from '@/lib/db';

// GET /api/chats/[id] - Get chat with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const chat = await getChat(id);
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }
    
    const messages = await getMessages(id);
    
    return NextResponse.json({
      chat,
      messages: messages.map(m => ({
        id: m.id.toString(),
        role: m.role,
        content: m.content,
        createdAt: m.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    );
  }
}

