import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createChat, getChat } from '@/lib/db';

// POST /api/chats - Create a new chat
export async function POST() {
  try {
    // Generate a unique 21-character ID (like ChatGPT)
    const chatId = nanoid(21);
    
    // Create the chat in the database
    const chat = await createChat(chatId);
    
    return NextResponse.json({ 
      id: chat.id,
      url: `/chat/${chat.id}`
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}

// GET /api/chats/[id] is handled in the [id] folder

