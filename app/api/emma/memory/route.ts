import { NextRequest, NextResponse } from 'next/server';
import {
  saveMemory,
  getUserMemories,
  getMemoriesAboutSubject,
  logAnalyticsEvent,
} from '@/lib/emma-db';

/**
 * POST /api/emma/memory - Save a memory
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      memory_type,
      category,
      subject,
      sentiment,
      rating,
      raw_text,
      ai_summary,
      conversation_id,
      importance,
      metadata,
    } = body;

    if (!user_id || !memory_type) {
      return NextResponse.json(
        { error: 'user_id and memory_type are required' },
        { status: 400 }
      );
    }

    const memory = await saveMemory(user_id, {
      memory_type,
      category,
      subject,
      sentiment,
      rating,
      raw_text,
      ai_summary,
      conversation_id,
      importance,
      metadata,
    });

    await logAnalyticsEvent('memory_saved', {
      user_id,
      event_data: { memory_type, category, subject }
    });

    return NextResponse.json({ memory });
  } catch (error) {
    console.error('Save memory error:', error);
    return NextResponse.json(
      { error: 'Failed to save memory' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emma/memory - Get memories for a user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('user_id');
    const category = request.nextUrl.searchParams.get('category');
    const memoryType = request.nextUrl.searchParams.get('memory_type');
    const subject = request.nextUrl.searchParams.get('subject');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    let memories;

    if (subject) {
      memories = await getMemoriesAboutSubject(userId, subject);
    } else {
      memories = await getUserMemories(userId, {
        limit,
        category: category || undefined,
        memory_type: memoryType || undefined,
      });
    }

    return NextResponse.json({ memories });
  } catch (error) {
    console.error('Get memories error:', error);
    return NextResponse.json(
      { error: 'Failed to get memories' },
      { status: 500 }
    );
  }
}
