import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Helper function to ensure SDPP tables exist
async function ensureSDPPTables() {
  try {
    // Create SDPP chats table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS sdpp_chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create SDPP messages table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS sdpp_messages (
        id SERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES sdpp_chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create index for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_sdpp_messages_chat_id ON sdpp_messages(chat_id)
    `;
  } catch (error) {
    console.error('Error creating SDPP tables:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { chatId, role, content } = await request.json();

    if (!chatId || !role || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure SDPP tables exist
    await ensureSDPPTables();

    // Insert message
    const result = await sql`
      INSERT INTO sdpp_messages (chat_id, role, content)
      VALUES (${chatId}, ${role}, ${content})
      RETURNING id
    `;

    return NextResponse.json({
      success: true,
      id: result[0].id,
    });
  } catch (error) {
    console.error('Error saving SDPP message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
