import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { id, title } = await request.json();

    if (!id || !title) {
      return NextResponse.json({ error: 'Missing id or title' }, { status: 400 });
    }

    // Ensure SDPP tables exist
    await ensureSDPPTables();

    // Create SDPP chat
    await sql`
      INSERT INTO sdpp_chats (id, title, created_at)
      VALUES (${id}, ${title}, NOW())
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating SDPP chat:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Ensure SDPP tables exist
    await ensureSDPPTables();

    const chats = await sql`
      SELECT id, title, created_at FROM sdpp_chats ORDER BY created_at DESC
    `;

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Error fetching SDPP chats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
