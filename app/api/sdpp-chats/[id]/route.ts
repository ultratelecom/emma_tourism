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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Ensure SDPP tables exist
    await ensureSDPPTables();

    // Get chat details
    const chatResult = await sql`
      SELECT id, title, created_at FROM sdpp_chats WHERE id = ${id}
    `;

    if (chatResult.length === 0) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Get messages for this chat
    const messagesResult = await sql`
      SELECT id, role, content, created_at FROM sdpp_messages
      WHERE chat_id = ${id}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      ...chatResult[0],
      messages: messagesResult.map(m => ({
        id: m.id.toString(),
        role: m.role,
        content: m.content,
        createdAt: m.created_at
      })),
    });
  } catch (error) {
    console.error('Error fetching SDPP chat:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
