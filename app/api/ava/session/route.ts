/**
 * POST /api/ava/session
 *
 * Open a new Ava session or resume the latest active one for this user.
 * Delivers the deterministic opener as turn 0 and returns everything the
 * client needs to start chatting:
 *
 *   Request:
 *     { name: string, email?: string }
 *
 *   Response:
 *     {
 *       user_id: string,
 *       session_id: string,
 *       session_token: string,
 *       opener: { message_id: string, content: string, turn_index: number },
 *       is_returning: boolean,
 *       chapter_id: string,
 *     }
 *
 * GET /api/ava/session?token=<session_token>
 *
 * Rehydrate a session by its opaque token (useful when a client reloads).
 */

import { NextRequest, NextResponse } from 'next/server';
import { openOrResumeSession } from '@/lib/ava-session';
import {
  getAvaSessionByToken,
  getSessionMessages,
  getAvaUserById,
} from '@/lib/ava-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : null;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 },
      );
    }

    const result = await openOrResumeSession({ name, email });

    return NextResponse.json({
      user_id: result.user.id,
      session_id: result.session.id,
      session_token: result.session.session_token,
      opener: {
        message_id: result.opener_message.id,
        content: result.opener_message.content,
        turn_index: result.opener_message.turn_index,
      },
      is_returning: result.is_returning,
      chapter_id: result.session.current_chapter_id,
    });
  } catch (err) {
    console.error('[ava/session POST] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'session_failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json(
        { error: 'token query param is required' },
        { status: 400 },
      );
    }

    const session = await getAvaSessionByToken(token);
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
    }

    // Security fix: Check session abandonment (30 days). If abandoned, return 410 Gone
    // so client falls back to fresh session instead of resuming stale state.
    const lastActivity = session.last_turn_at
      ? new Date(session.last_turn_at)
      : new Date(session.started_at);
    const daysSinceActivity =
      (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 30) {
      return NextResponse.json(
        { error: 'session_abandoned', days_since_activity: Math.floor(daysSinceActivity) },
        { status: 410 },
      );
    }

    // Load session data. Limit messages to recent 50 for performance (client only needs
    // recent context, not full 100+ message history).
    const [user, messages] = await Promise.all([
      getAvaUserById(session.user_id),
      getSessionMessages(session.id, { limit: 50 }),
    ]);

    return NextResponse.json({
      user_id: session.user_id,
      user_name: user?.name ?? null,
      session_id: session.id,
      session_token: session.session_token,
      status: session.status,
      chapter_id: session.current_chapter_id,
      turn_count: session.turn_count,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        turn_index: m.turn_index,
        is_system_delivered: m.is_system_delivered,
        created_at: m.created_at,
      })),
    });
  } catch (err) {
    console.error('[ava/session GET] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'session_failed' },
      { status: 500 },
    );
  }
}
