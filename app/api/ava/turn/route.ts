/**
 * POST /api/ava/turn  —  streaming twin-pass architecture
 *
 * Returns a plain-text stream of Ava's reply so the client can render
 * characters as they arrive (≈300 ms to first token vs. ≈3 s for a full
 * JSON response).  Metadata the client needs immediately travels in
 * custom response headers, readable before the body stream starts.
 *
 * Parallel to the stream, an `after()` background task persists Ava's
 * reply and kicks off a lightweight GPT-4o-mini extraction pass so
 * nothing blocks the user-visible response.
 *
 * Headers returned:
 *   X-Gif-Cue      — one of the known GIF cue strings, or empty
 *   X-Turn-Index   — integer: Ava's turn_index for this reply
 *   X-Chapter-Id   — current chapter slug (for debug / analytics)
 *
 * Request body:
 *   { session_id: string, user_id: string, message: string }
 */

import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { createTextStreamResponse, streamText } from 'ai';
import { getAvaSessionById, getAvaUserById } from '@/lib/ava-db';
import { getAvaChatModel } from '@/lib/ava-model';
import { prepareTurn, persistAvaReply } from '@/lib/ava-session';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // ── 1. Parse & validate request ──────────────────────────────────────
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const session_id = typeof body.session_id === 'string' ? body.session_id : null;
  const user_id = typeof body.user_id === 'string' ? body.user_id : null;
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!session_id || !user_id || !message) {
    return NextResponse.json(
      { error: 'session_id, user_id, and message are required' },
      { status: 400 },
    );
  }

  // ── 2. Verify session + user ──────────────────────────────────────────
  const [session, user] = await Promise.all([
    getAvaSessionById(session_id),
    getAvaUserById(user_id),
  ]);

  if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  if (session.user_id !== user_id) {
    return NextResponse.json({ error: 'session_user_mismatch' }, { status: 403 });
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: `session_status_${session.status}` }, { status: 409 });
  }

  // ── 3. Pre-flight: persist user message + load all context ───────────
  //    All DB reads happen here, before the LLM call, so the stream
  //    starts cleanly with no competing DB work.
  let prepared;
  try {
    prepared = await prepareTurn({ sessionId: session_id, userId: user_id, userMessage: message });
  } catch (err) {
    console.error('[ava/turn] prepareTurn failed:', err);
    return NextResponse.json({ error: 'turn_setup_failed' }, { status: 500 });
  }

  // ── 4. Start the streaming reply ────────────────────────────────────
  const { model } = getAvaChatModel();
  const startedAt = Date.now();

  const result = streamText({
    model,
    system: prepared.systemPrompt,
    prompt: prepared.userPrompt,
    providerOptions: {
      openai: { reasoningEffort: 'low' },
    },
  });

  // ── 5. After the stream is consumed: persist reply + extract fields ──
  after(async () => {
    try {
      const fullText = await result.text;
      await persistAvaReply({
        sessionId: session_id,
        userId: user_id,
        userMessage: message,
        rawText: fullText,
        avaTurnIndex: prepared.avaTurnIndex,
        chapterId: prepared.chapterId,
        startedAt,
        userMsgId: prepared.userMsgId,
        openFieldKeys: prepared.openFieldKeys,
        lastAvaMessage: prepared.lastAvaMessage,
      });
    } catch (err) {
      console.error('[ava/turn] after() persist failed:', err);
    }
  });

  // ── 6. Stream the reply with metadata in headers ─────────────────────
  return createTextStreamResponse({
    textStream: result.textStream,
    headers: {
      'X-Gif-Cue': prepared.gifCue ?? '',
      'X-Turn-Index': String(prepared.avaTurnIndex),
      'X-Chapter-Id': prepared.chapterId,
    },
  });
}
