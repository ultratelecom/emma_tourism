import { NextRequest, NextResponse } from 'next/server';
import { addMessage, getChat, createChat, updateChat } from '@/lib/db';

// POST /api/messages - Save a message to a chat
export async function POST(req: NextRequest) {
  try {
    const { chatId, role, content } = await req.json();

    if (!chatId || !role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if chat exists, create if not
    let chat = await getChat(chatId);
    if (!chat) {
      chat = await createChat(chatId);
      // Set title from first user message
      if (role === 'user') {
        const title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        await updateChat(chatId, title);
      }
    }

    // Save the message
    const message = await addMessage(chatId, role, content);

    return NextResponse.json({ 
      success: true,
      messageId: message.id 
    });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    );
  }
}

