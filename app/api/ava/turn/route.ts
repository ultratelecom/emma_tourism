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

/**
 * Pick a GIF cue based on the user's message and Ava's reply.
 * Ava now leads with warmth — GIFs appear on the first reply (name
 * reaction), every other turn as a baseline, and whenever specific
 * content signals call for one. The only exclusions are heavy
 * emotional moments (hardship, distrust, life decisions) where a GIF
 * would undercut the gravity of what the user shared.
 *
 * Cue palette:
 *   welcome        — opening greeting energy
 *   welcome_back   — returning visitor
 *   name_reaction  — warm response to user giving their name
 *   hey_there      — general warmth / positivity fallback
 *   empathy        — user expressed sadness, homesickness, distance pain
 *   celebration    — warmth, excitement, shared joy
 *   local_vibes    — Tobago/Caribbean cultural signal
 *   farewell       — goodbye / we'll talk later
 */
function pickGifCue(
  userMessage: string,
  reply: string,
  turnIndex: number,
  momentType?: string,
  nextFocus?: string,
): string | null {
  const u = userMessage.toLowerCase();
  const r = reply.toLowerCase();

  // Farewell (either side) always wins.
  if (/\b(bye|goodbye|gotta go|talk later|take care|catch you|ttyl|see ya)\b/.test(u + ' ' + r)) {
    return 'farewell';
  }

  // Hard suppress for truly serious moments — GIFs would feel cold or
  // tone-deaf here. Logistical onboarding (name / location) is no
  // longer suppressed; those are warm moments.
  if (
    momentType &&
    ['life_decision', 'pain_or_frustration', 'trust_concern'].includes(momentType)
  ) {
    return null;
  }

  // Turn 2 = user just gave their name for the first time → warm name reaction.
  if (turnIndex === 2) return 'name_reaction';

  // User just gave their location (next focus is roots / generation)
  // → celebration-style GIF to match the warm quip Ava gives.
  if (
    nextFocus &&
    (nextFocus.includes('Tobago roots') || nextFocus.includes('generation'))
  ) {
    return 'celebration';
  }

  // Empathy — the user expressed longing, hardship, being far.
  if (/\b(miss|missing|homesick|far from|too long|sad|hard|tough|lonely|grief|lost)\b/.test(u)) {
    return 'empathy';
  }

  // Local-vibe hook — Tobago/Trinidad cultural signals.
  if (/\b(seine|bay|beach|carnival|soca|pan|liming|doubles|bake.{0,5}shark|crab.{0,5}callaloo|maracas|maracas beach|sunday school|buccoo|speyside|castara)\b/.test(u)) {
    return 'local_vibes';
  }

  // User sent explicit excitement.
  if (/[!]{2,}|\b(love it|can't wait|so excited|beautiful|amazing|finally|yes yes)\b/.test(u)) {
    return 'celebration';
  }

  // Baseline: keep things visually lively every other turn.
  if (turnIndex % 2 === 0) return 'hey_there';

  return null;
}

// The chat lane should resolve in a few seconds on gpt-4o-mini; the
// background extraction on step-3.5-flash can take 10–40s but it runs
// after the response is sent via `after()`.
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
        console.log('[ava/turn] extraction finalized', {
          session_id,
          turn_index: result.turn_index,
          extraction_latency_ms: summary.extraction_latency_ms,
          fields: summary.profile_fields_written,
          entities: summary.entities_written,
          notes: summary.notes_written,
        });
      } catch (err) {
        console.error('[ava/turn] extraction finalize threw:', err);
      }
    });

    const gif_cue = result.allow_gif
      ? pickGifCue(
          message,
          result.reply,
          result.turn_index,
          result.turn_plan.moment_type,
          result.turn_plan.next_best_question_focus ?? undefined,
        )
      : null;

    return NextResponse.json({
      reply: result.reply,
      reply_message_id: result.reply_message_id,
      turn_index: result.turn_index,
      chapter_id: result.chapter_id,
      chapter_changed: result.chapter_changed,
      gif_cue,
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
