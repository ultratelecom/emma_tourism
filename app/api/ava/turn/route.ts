/**
 * POST /api/ava/turn
 *
 * Run one turn of an Ava conversation end-to-end. The twin-pass happens
 * inside the orchestrator: chat reply + structured extraction fire in
 * parallel, both await before the response returns.
 *
 *   Request:
 *     {
 *       session_id: string,   // uuid of ava_sessions.id
 *       user_id: string,      // uuid of ava_users.id
 *       message: string,
 *     }
 *
 *   Response:
 *     {
 *       reply: string,
 *       reply_message_id: string,
 *       turn_index: number,
 *       chapter_id: string,
 *       chapter_changed: boolean,
 *       profile_completion: number,
 *       meta: {
 *         chat_latency_ms: number,
 *         extraction_latency_ms: number,
 *         extraction_parse_ok: boolean,
 *         profile_fields_written: number,
 *         entities_written: number,
 *         notes_written: number,
 *       },
 *     }
 */

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { runTurn } from '@/lib/ava-session';
import { getAvaSessionById, getAvaUserById } from '@/lib/ava-db';

// The unified LLM call returns the GIF cue directly, so no client-side
// classification is needed. The `after()` hook persists captured fields.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const session_id = typeof body.session_id === 'string' ? body.session_id : null;
    const user_id = typeof body.user_id === 'string' ? body.user_id : null;
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!session_id || !user_id || !message) {
      return NextResponse.json(
        { error: 'session_id, user_id, and message are required' },
        { status: 400 },
      );
    }

    // Sanity-check the session and user exist and agree
    const [session, user] = await Promise.all([
      getAvaSessionById(session_id),
      getAvaUserById(user_id),
    ]);

    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
    }
    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }
    if (session.user_id !== user_id) {
      return NextResponse.json({ error: 'session_user_mismatch' }, { status: 403 });
    }
    if (session.status !== 'active') {
      return NextResponse.json(
        { error: `session_status_${session.status}` },
        { status: 409 },
      );
    }

    const result = await runTurn({
      sessionId: session_id,
      userId: user_id,
      userMessage: message,
    });

    // Let the structured extraction finish after we've returned Ava's reply
    // to the client. On Vercel/Next.js, `after()` keeps the function alive
    // long enough for this to complete.
    after(async () => {
      try {
        const summary = await result.finalize;
        console.log('[ava/turn] profile fields saved', {
          session_id,
          turn_index: result.turn_index,
          fields: summary.profile_fields_written,
          latency_ms: summary.extraction_latency_ms,
        });
      } catch (err) {
        console.error('[ava/turn] finalize threw:', err);
      }
    });

    return NextResponse.json({
      reply: result.reply,
      reply_message_id: result.reply_message_id,
      turn_index: result.turn_index,
      chapter_id: result.chapter_id,
      chapter_changed: result.chapter_changed,
      gif_cue: result.gif_cue,
      meta: {
        chat_latency_ms: result.chat_latency_ms,
        prompt_version: result.prompt_version,
        turn_plan: result.turn_plan,
        reply_quality: result.reply_quality,
        allow_gif: result.allow_gif,
      },
    });
  } catch (err) {
    console.error('[ava/turn POST] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'turn_failed' },
      { status: 500 },
    );
  }
}
