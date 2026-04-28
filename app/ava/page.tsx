'use client';

/**
 * Ava chat page.
 *
 * Flow, identical to Emma's:
 *   1. Splash (2.5s tropical gradient + floating emojis + Ava portrait)
 *   2. Loading ("Ava is settling in…" ~800ms, also used to probe
 *      localStorage for an existing session_token and quietly resume)
 *   3. Chat. Nothing happens outside the chat bubble UI from this point
 *      on. Ava's first bubble asks for the name. The user types into
 *      the composer. The composer is the only input surface that ever
 *      exists. NO separate form. NO gate. NO pre-chat step.
 *
 * Backend:
 *   - POST /api/ava/session  → creates ava_user + ava_session + the
 *     opener message (turn 0). Requires a name.
 *   - POST /api/ava/turn     → free-chat loop after a session exists.
 *   - GET  /api/ava/session  → resume by token.
 *
 * Client-side state machine:
 *   phase = 'splash' | 'loading' | 'chat'
 *   inChat, a pre-session flag is tracked via !sessionId.
 *
 * Pre-session handling:
 *   - When the user arrives at `phase='chat'` without a session, we
 *     immediately show Ava's opener bubble client-side ("Before we
 *     really get into it, what do people call you?"). That bubble is
 *     also what the server persists as turn 0 when the session is
 *     created. We don't double-render it.
 *   - The user's first reply in the composer triggers:
 *        extractName(reply) → POST /api/ava/session {name} → on success
 *        POST /api/ava/turn with the full user reply as turn 1.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, CheckCheck, Send, MapPin } from 'lucide-react';
import { AVA_PERSONALITY } from '@/lib/ava-config';

// ============================================
// CONSTANTS
// ============================================

const AVA_AVATAR_URL = '/ava/avatar.png';
const LS_TOKEN = 'ava.session_token';
// Single source of truth: the same string the server writes as turn 0.
const OPENER_TEXT = AVA_PERSONALITY.opening_line;

// Typewriter reveal speed in characters-per-second. Must stay in sync
// with the <Typewriter /> component's default cps below. We also use it
// to compute how long stageOpener / appendAvaReply should wait before
// starting the next bubble's typing indicator — so two typewriters never
// run at once.
const TYPEWRITER_CPS = 42;
const TYPEWRITER_MIN_MS = 250;
const TYPEWRITER_MAX_MS = 4500;
function typewriterDurationMs(text: string): number {
  const naive = (text.length / TYPEWRITER_CPS) * 1000;
  return Math.max(TYPEWRITER_MIN_MS, Math.min(TYPEWRITER_MAX_MS, naive));
}

type GifCue =
  | 'welcome'
  | 'welcome_back'
  | 'hey_there'
  | 'name_reaction'
  | 'empathy'
  | 'celebration'
  | 'local_vibes'
  | 'farewell';

// ============================================
// TYPES
// ============================================

/** Tonal tint applied to an Ava bubble when she's evoking a place /
 *  mood. Ocean for sea imagery, palm for Castara/Tobago places, sunset
 *  for evening warmth, night for later-hour conversation. */
type BubbleTone = 'ocean' | 'palm' | 'sunset' | 'night';

interface UIMessage {
  id: string;
  sender: 'user' | 'ava';
  kind: 'text' | 'gif';
  content: string;
  gifUrl?: string;
  timestamp: Date;
  delivered?: boolean;
  read?: boolean;
  animate?: boolean;
  /** iMessage-style reaction Ava taps onto the user's bubble. */
  reaction?: string;
  /**
   * Optional bubble decoration. 'wave' renders an animated waving hand
   * next to the content. Reserved for Ava's very first hello.
   */
  flair?: 'wave';
  /**
   * Hero bubbles get a one-shot shimmer sweep across them on entry.
   * Used for the three opener beats and any Ava reply rich with place
   * / sensory language.
   */
  isHero?: boolean;
  /** Ambient tone glow behind the bubble. Ava only. */
  tone?: BubbleTone;
  /**
   * When true, the bubble types out its content char-by-char on
   * mount. Ava bubbles default to true; GIFs and user bubbles false.
   */
  typewriter?: boolean;
}

interface SessionOpenResponse {
  user_id: string;
  session_id: string;
  session_token: string;
  opener: { message_id: string; content: string; turn_index: number };
  is_returning: boolean;
  chapter_id: string | null;
}

interface TurnResponse {
  reply: string;
  reply_message_id: string;
  turn_index: number;
  chapter_id: string;
  chapter_changed: boolean;
  gif_cue: GifCue | null;
  meta: { chat_latency_ms: number };
}

/**
 * A heart detached from a user bubble and in-flight toward Ava's
 * avatar. Rendered via a fixed overlay with CSS vars controlling the
 * translation delta so the keyframes draw a parabolic arc.
 */
interface FlyingHeart {
  id: string;
  emoji: string;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

// ============================================
// PAGE
// ============================================

export default function AvaPage() {
  const [phase, setPhase] = useState<'splash' | 'loading' | 'chat'>('splash');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [avaTyping, setAvaTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);

  // Hearts flying from the user's bubble to Ava's avatar — rendered in
  // a fixed-position overlay so they can arc across the whole chat.
  const [flyingHearts, setFlyingHearts] = useState<FlyingHeart[]>([]);
  // When a heart lands on Ava's avatar, her ring pulses coral for ~900ms.
  const [avatarGlow, setAvatarGlow] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the tail of the transcript pinned to the bottom as the
  // conversation grows. Deferred through two animation frames so new
  // bubbles have had a chance to measure / land before we scroll to
  // them. scrollIntoView on a dedicated anchor is more reliable than
  // computing scrollHeight on the container while bubbles are still
  // mounting their entrance animation.
  useEffect(() => {
    if (phase !== 'chat') return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [messages, avaTyping, phase]);

  // Also watch the transcript for any in-flight layout changes (images
  // loading, GIFs decoding, virtual keyboard opening) and re-pin to
  // bottom so the view never feels stale.
  useEffect(() => {
    if (phase !== 'chat' || !scrollRef.current) return;
    const el = scrollRef.current;
    const ro = new ResizeObserver(() => {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // Splash → loading → chat transition.
  //
  // During `loading`, we probe localStorage for a session_token. If we
  // find one and it's valid, the transcript is rehydrated and we drop
  // into mid-conversation. Otherwise, we enter chat with Ava's opener
  // already showing (client-side) and a null session — the first user
  // message triggers session creation.
  useEffect(() => {
    if (phase !== 'splash') return;
    const t = setTimeout(() => setPhase('loading'), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'loading') return;

    (async () => {
      // Each page load starts fresh. Wipe any leftover token so we
      // never accidentally resume — the DB keeps the old session rows
      // for admin/analytics, but the UI always begins at the opener.
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LS_TOKEN);
      }
      await new Promise((r) => setTimeout(r, 800));
      setPhase('chat');
      // Stage the opener as three WhatsApp-style beats with a typing
      // indicator between each. The composer is focusable the whole
      // time so the user can start typing their name whenever.
      setTimeout(() => inputRef.current?.focus(), 80);
      void stageOpener(OPENER_TEXT);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /**
   * Play Ava's opener as a sequence of bubbles. Each bubble is
   * preceded by a typing indicator whose duration is proportional to
   * the length of the previous beat, so it feels like she's actually
   * composing the next thought rather than dumping a block of text.
   * The first beat gets a waving-hand flair — her "hi".
   */
  const stageOpener = useCallback(async (raw: string) => {
    // Fire a welcome GIF concurrently. It loads in the background while
    // the first typing indicator pause is running, so it usually arrives
    // just before Ava's first text beat — setting the warm, lively tone
    // before she even says a word.
    void playGif('welcome', (m) => setMessages((prev) => [...prev, m]));

    const beats = raw
      .split(/\n\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (beats.length === 0) beats.push(raw);

    for (let i = 0; i < beats.length; i++) {
      setAvaTyping(true);
      // The first beat leads with a short anticipatory pause. Each
      // subsequent beat's "typing" pause scales loosely off how long
      // the next line is (shorter thoughts feel quicker to compose).
      const nextLen = beats[i].length;
      const pause = Math.min(520 + nextLen * 10, 1400);
      await new Promise((r) => setTimeout(r, pause));
      setAvaTyping(false);

      setMessages((prev) => [
        ...prev,
        {
          id: `opener-${i}-${Date.now()}`,
          sender: 'ava',
          kind: 'text',
          content: beats[i],
          timestamp: new Date(),
          animate: true,
          flair: i === 0 ? 'wave' : undefined,
          isHero: true,
          typewriter: true,
          tone: detectTone(beats[i]),
        },
      ]);

      // Block the loop until the typewriter reveal for THIS beat has
      // fully finished. Otherwise the next bubble appears mid-reveal
      // and two typewriters race each other, which looks broken. We
      // add a small settle beat on top so the bubble has a moment of
      // stillness before the next "typing" indicator shows.
      const revealMs = typewriterDurationMs(beats[i]);
      await new Promise((r) => setTimeout(r, revealMs + 220));
    }
  }, []);

  /**
   * After a heart lands on a user's bubble and settles for a beat, it
   * detaches and flies in an arc to Ava's header avatar. We compute
   * the delta between the two DOM rects, stash it as CSS variables on
   * the flyer, then trust the keyframes in globals.css to draw the
   * parabola. The avatar ring pulses coral mid-arc so the arrival
   * feels kinetic — she absorbs the heart.
   *
   * If either element can't be found (scrolled out, unmounted, etc.)
   * we silently no-op: skipping one animation is better than throwing.
   */
  const launchHeartFly = useCallback((bubbleId: string, emoji: string) => {
    if (typeof window === 'undefined') return;
    const bubbleEl = document.querySelector<HTMLElement>(
      `[data-bubble-id="${CSS.escape(bubbleId)}"]`,
    );
    const avatarEl = document.querySelector<HTMLElement>(
      '[data-ava-anchor="header"]',
    );
    if (!bubbleEl || !avatarEl) return;

    const bRect = bubbleEl.getBoundingClientRect();
    const aRect = avatarEl.getBoundingClientRect();

    // Start at the bubble's reaction badge (bottom-left of the user
    // bubble, which is offset -left-3 -bottom-3 inside MessageBubble).
    const startX = bRect.left - 6;
    const startY = bRect.bottom - 6;
    // Land at the center of the avatar.
    const endX = aRect.left + aRect.width / 2;
    const endY = aRect.top + aRect.height / 2;

    const id = `fly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const dx = endX - startX;
    const dy = endY - startY;

    setFlyingHearts((prev) => [
      ...prev,
      { id, emoji, startX, startY, dx, dy },
    ]);

    // Avatar pulse overlaps the last third of the fly so the heart
    // visually "lands" inside the ring flare.
    window.setTimeout(() => setAvatarGlow(true), 720);
    window.setTimeout(() => setAvatarGlow(false), 1620);

    // Clean up the flyer once its animation completes.
    window.setTimeout(() => {
      setFlyingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 1250);
  }, []);

  /**
   * Schedule a reaction on the given user bubble: heart pops in, holds
   * for ~1.1s, then detaches and flies to Ava's avatar. This is the
   * one entry point used by both the first-turn and normal-turn flows.
   */
  const scheduleReactionAndFly = useCallback(
    (bubbleId: string, emoji: string) => {
      window.setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === bubbleId ? { ...m, reaction: emoji } : m,
          ),
        );
      }, 550);
      window.setTimeout(() => launchHeartFly(bubbleId, emoji), 1650);
    },
    [launchHeartFly],
  );

  // =========================================================
  // Pre-session: first user reply creates the session, then
  // runs the reply itself as turn 1.
  // =========================================================
  const createSessionAndFirstTurn = useCallback(
    async (firstMessage: string) => {
      const name = extractName(firstMessage);
      setSending(true);
      setError(null);

      const optimisticId = `pending-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          sender: 'user',
          kind: 'text',
          content: firstMessage,
          timestamp: new Date(),
          delivered: true,
          read: false,
          animate: true,
        },
      ]);
      setInput('');
      setAvaTyping(true);

      // Reaction: give Ava a beat, tap a heart onto the user's bubble,
      // then launch the heart on its arc toward her avatar.
      const reaction1 = pickReaction(firstMessage);
      if (reaction1) scheduleReactionAndFly(optimisticId, reaction1);

      try {
        const openRes = await fetch('/api/ava/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!openRes.ok) {
          const body = await openRes.json().catch(() => ({}));
          throw new Error(body.error || `session open failed (${openRes.status})`);
        }
        const openData: SessionOpenResponse = await openRes.json();
        setSessionId(openData.session_id);
        setSessionToken(openData.session_token);
        setUserId(openData.user_id);
        setChapter(openData.chapter_id);
        // Deliberately do NOT persist the session token to localStorage.
        // Every page load starts a fresh conversation from the opener.

        // Now send the user's first message as turn 1.
        const turnRes = await fetch('/api/ava/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: openData.session_id,
            user_id: openData.user_id,
            message: firstMessage,
          }),
        });
        if (!turnRes.ok) {
          const body = await turnRes.json().catch(() => ({}));
          throw new Error(body.error || `turn failed (${turnRes.status})`);
        }
        const turnData: TurnResponse = await turnRes.json();

        setChapter(turnData.chapter_id);

        // Upgrade the user's ticks to read.
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, read: true } : m)),
        );
        await new Promise((r) => setTimeout(r, 250));
        setAvaTyping(false);

        await appendAvaReply(turnData.reply);

        if (turnData.gif_cue) {
          void playGif(turnData.gif_cue, (m) =>
            setMessages((prev) => [...prev, m]),
          );
        }
      } catch (err) {
        setAvaTyping(false);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [scheduleReactionAndFly],
  );

  // =========================================================
  // In-session: normal turn loop.
  // =========================================================
  const sendTurn = useCallback(
    async (text: string) => {
      if (!sessionId || !userId || !text.trim() || sending) return;
      setSending(true);
      setError(null);

      const optimisticId = `pending-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          sender: 'user',
          kind: 'text',
          content: text.trim(),
          timestamp: new Date(),
          delivered: true,
          read: false,
          animate: true,
        },
      ]);
      setInput('');
      setAvaTyping(true);

      const reactionEmoji = pickReaction(text);
      if (reactionEmoji) scheduleReactionAndFly(optimisticId, reactionEmoji);

      try {
        const res = await fetch('/api/ava/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            user_id: userId,
            message: text.trim(),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `turn failed (${res.status})`);
        }
        const data: TurnResponse = await res.json();

        setChapter(data.chapter_id);

        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, read: true } : m)),
        );
        await new Promise((r) => setTimeout(r, 300));

        setAvaTyping(false);
        await appendAvaReply(data.reply, data.reply_message_id);

        if (data.gif_cue) {
          void playGif(data.gif_cue, (m) => setMessages((prev) => [...prev, m]));
        }
      } catch (err) {
        setAvaTyping(false);
        setError(err instanceof Error ? err.message : 'Turn failed');
      } finally {
        setSending(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [sessionId, userId, sending, scheduleReactionAndFly],
  );

  // Split long replies into up-to-two bubbles with a small pause, so
  // Ava feels like she's typing — same pattern Emma uses.
  //
  // Serialized: bubble N+1 is not inserted until bubble N's typewriter
  // reveal has fully completed. Without this the two bubbles race each
  // other on screen and it looks like a broken animation.
  const appendAvaReply = useCallback(
    async (reply: string, idSeed?: string) => {
      const parts = splitReply(reply);
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          setAvaTyping(true);
          await new Promise((r) => setTimeout(r, 650));
          setAvaTyping(false);
        }
        const part = parts[i];
        const tone = detectTone(part);
        setMessages((prev) => [
          ...prev,
          {
            id: `${idSeed ?? `ava-${Date.now()}`}-${i}`,
            sender: 'ava',
            kind: 'text',
            content: part,
            timestamp: new Date(),
            animate: true,
            typewriter: true,
            tone,
            // A tone-tinted bubble gets the shimmer too — these are the
            // replies where she's painting a picture. Plain bubbles land
            // quietly without any sweep.
            isHero: tone !== undefined,
          },
        ]);

        // Wait for this bubble's typewriter reveal to finish before we
        // kick off the next one. Otherwise the two bubbles reveal
        // simultaneously, which looks like a bug. Skip the wait on the
        // last part so we don't stall the composer unlock.
        if (i < parts.length - 1) {
          const revealMs = typewriterDurationMs(part);
          await new Promise((r) => setTimeout(r, revealMs + 180));
        }
      }
    },
    [],
  );

  const onSend = () => {
    const text = input.trim();
    if (!text || sending) return;
    if (sessionId) void sendTurn(text);
    else void createSessionAndFirstTurn(text);
  };

  const resetSession = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.removeItem(LS_TOKEN);
    setSessionId(null);
    setUserId(null);
    setSessionToken(null);
    setChapter(null);
    setMessages([]);
    setInput('');
    setError(null);
    setPhase('splash');
  }, []);

  // =========================================================
  // RENDER
  // =========================================================

  if (phase === 'splash') {
    return <SplashScreen />;
  }

  if (phase === 'loading') {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-sand-50 via-white to-sand-100">
      <Header
        onReset={sessionToken ? resetSession : null}
        chapter={chapter}
        typing={avaTyping}
        avatarGlow={avatarGlow}
      />

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 md:px-8"
      >
        {messages.map((m) =>
          m.kind === 'gif' && m.gifUrl ? (
            <GifMessage key={m.id} url={m.gifUrl} title={m.content} />
          ) : (
            <MessageBubble key={m.id} message={m} />
          ),
        )}
        {avaTyping && <TypingIndicator />}
        {error && (
          <div className="mx-auto max-w-md rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}
        <div ref={endRef} aria-hidden className="h-1 w-full" />
      </div>

      <Composer
        value={input}
        onChange={setInput}
        onSend={onSend}
        disabled={sending}
        inputRef={inputRef}
      />

      {/* Flying-hearts overlay. Sits above the whole chat so hearts
          can arc from user bubbles all the way to the header avatar
          without being clipped by the transcript's overflow-y-auto. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-40"
      >
        {flyingHearts.map((h) => (
          <span
            key={h.id}
            className="absolute animate-heart-fly text-[22px] leading-none select-none"
            style={
              {
                left: h.startX,
                top: h.startY,
                ['--dx' as string]: `${h.dx}px`,
                ['--dy' as string]: `${h.dy}px`,
              } as React.CSSProperties
            }
          >
            {h.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================
// GIF HELPER
// ============================================

async function playGif(cue: GifCue, push: (msg: UIMessage) => void) {
  try {
    const ctl = new AbortController();
    const timeout = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`/api/emma/gif?type=${cue}&random=true`, {
      signal: ctl.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.url) return;
    push({
      id: `gif-${cue}-${Date.now()}`,
      sender: 'ava',
      kind: 'gif',
      content: data.title || cue,
      gifUrl: data.url,
      timestamp: new Date(),
      animate: true,
    });
  } catch {
    // Silent-fail — UI still feels alive without the GIF.
  }
}

// ============================================
// TEXT HELPERS
// ============================================

/**
 * Extract the best-effort display name from the user's first reply.
 * Lifted directly from Emma's page.tsx — same patterns, same fallback.
 */
function extractName(input: string): string {
  const patterns = [
    /(?:my name is|i'm|i am|it's|its|call me|they call me|people call me|you can call me)\s+(.+)/i,
    /^(?:hi,?\s*)?(?:i'm|i am)\s+(.+)/i,
    /^(.+?)(?:\s+here|\s+speaking)?$/i,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim().split(/[,.!?\n]/)[0].trim();
      // If user dumped a sentence, keep just the first word or two.
      const words = name.split(/\s+/);
      if (words.length > 3) name = words.slice(0, 2).join(' ');
      if (!name) continue;
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  }
  const fallback = input.trim().split(/\s+/).slice(0, 2).join(' ');
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

/**
 * Reaction picker. Per explicit user direction: Ava hearts EVERY
 * substantive message. No mix, no variety — she's just genuinely
 * glad to hear you. Empty messages get no reaction.
 */
function pickReaction(message: string): string | null {
  const t = message.trim();
  if (t.length === 0) return null;
  return '❤️';
}

/**
 * Watercolor wash: pick a soft ambient tone for the bubble based on
 * what Ava is speaking about. Returns undefined for plain / transactional
 * replies so they land without a glow.
 *
 * Order matters: more specific cues first, atmospheric cues last. We
 * bail on the first hit so bubbles have exactly one tone, never fight.
 */
function detectTone(content: string): BubbleTone | undefined {
  const s = content.toLowerCase();

  // Sea / water imagery — ocean.
  if (
    /\b(sea|ocean|wave(?!s? goodbye)|tide|bay|salt|surf|shore|reef|snorkel|dive|boat|mangrove|fisher|fish(ing)?)\b/.test(
      s,
    )
  )
    return 'ocean';

  // Castara / Tobago / village / home — palm.
  if (
    /\b(castara|tobago|trinidad|trini|buccoo|speyside|charlotteville|parlatuvier|moriah|englishman|plymouth|scarborough|bacolet|lambeau|crown point|store bay|pigeon point|argyle|roxborough|village|home|back home|island|bush|forest|rainforest|mango|coconut|palm)\b/.test(
      s,
    )
  )
    return 'palm';

  // Evening / golden hour — sunset.
  if (
    /\b(sunset|sundown|dusk|golden hour|evening sky|orange sky|pink sky|sun going down|last light|sun set)\b/.test(
      s,
    )
  )
    return 'sunset';

  // Deep night — cooler blue.
  if (/\b(midnight|late night|stars|moon|dark sky|after dark)\b/.test(s))
    return 'night';

  return undefined;
}

/**
 * Split an Ava reply into at most two bubbles so long replies feel
 * like she's typing in natural beats. Mirrors Emma's
 * splitResponseIntoMessages.
 */
function splitReply(text: string): string[] {
  if (!text?.trim()) return [''];
  const trimmed = text.trim();

  // Prefer paragraph breaks if the model gave them.
  const parts = trimmed.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return [parts[0], parts.slice(1).join(' ')];
  }

  // If the reply is short, don't bother.
  if (trimmed.length < 140) return [trimmed];

  // Otherwise try to split after the first sentence-ending punctuation.
  const match = trimmed.match(/^([^.?!]*[.?!])\s+(.*)$/);
  if (match && match[1].length > 25 && match[2].length > 10) {
    return [match[1].trim(), match[2].trim()];
  }
  return [trimmed];
}

// ============================================
// UI: SPLASH
// ============================================

function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#2d5f4e] via-sunset to-coral">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {['🌴', '🌺', '🐚', '🌊', '☀️', '🏝️', '🐟', '🥥'].map((emoji, i) => (
          <span
            key={i}
            className="absolute animate-float text-4xl opacity-20"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.3}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="relative z-10 flex animate-scale-in flex-col items-center">
        <div className="mb-6 h-28 w-28 animate-pulse-glow rounded-full bg-white/20 p-1 shadow-2xl backdrop-blur-sm">
          <div className="h-full w-full overflow-hidden rounded-full ring-4 ring-white/50">
            <Image
              src={AVA_AVATAR_URL}
              alt="Ava"
              width={120}
              height={120}
              className="h-full w-full object-cover"
              priority
            />
          </div>
        </div>
        <h1 className="mb-2 text-center font-[family-name:var(--font-playfair)] text-4xl font-bold text-white">
          Meet Ava
        </h1>
        <p className="mb-8 text-center text-[15px] font-normal text-white/85">
          From Castara, with time to talk.
        </p>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-3 w-3 animate-bounce rounded-full bg-white/60"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32">
        <svg
          viewBox="0 0 1440 120"
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0,64 C480,150 960,-20 1440,64 L1440,120 L0,120 Z"
            fill="rgba(255,255,255,0.12)"
            className="animate-wave"
          />
        </svg>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-sand-50 via-white to-sand-100">
      <div className="flex flex-col items-center gap-4">
        <div className="h-16 w-16 animate-pulse overflow-hidden rounded-full ring-4 ring-coral/30">
          <Image
            src={AVA_AVATAR_URL}
            alt="Ava"
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex gap-1.5">
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-coral"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-sunset"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-palm"
            style={{ animationDelay: '300ms' }}
          />
        </div>
        <p className="text-sm text-slate-500">Ava is settling in…</p>
      </div>
    </div>
  );
}

// ============================================
// UI: HEADER
// ============================================

function Header({
  onReset,
  chapter,
  typing,
  avatarGlow,
}: {
  onReset: (() => void) | null;
  chapter: string | null;
  typing: boolean;
  avatarGlow: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sand-200 bg-white/80 px-4 py-3 backdrop-blur-md md:px-8">
      <div className="flex items-center gap-3">
        <AvaAvatar
          size="md"
          pulse={typing}
          glow={avatarGlow}
          anchorKey="header"
        />
        <div className="leading-tight">
          <div className="flex items-center gap-1.5 text-[16px] font-semibold tracking-[-0.01em] text-slate-800">
            Ava
          </div>
          <div className="flex items-center gap-1 text-[12px] text-slate-500">
            {typing ? (
              <span className="animate-fade-in italic text-coral">typing…</span>
            ) : (
              <>
                <MapPin className="h-3 w-3" />
                <span>Castara · Tobago</span>
                {chapter && (
                  <span className="text-slate-400">· {prettyChapter(chapter)}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {onReset && (
        <button
          onClick={onReset}
          className="rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs text-slate-500 transition hover:border-coral/40 hover:bg-sand-50 hover:text-slate-700"
        >
          End session
        </button>
      )}
    </header>
  );
}

// ============================================
// UI: AVATAR
// ============================================

function AvaAvatar({
  pulse = false,
  size = 'md',
  glow = false,
  anchorKey,
}: {
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Coral ring pulse when a heart just landed. */
  glow?: boolean;
  /**
   * Stable data attribute used by launchHeartFly to locate this avatar
   * as the landing target. Only the header avatar gets this.
   */
  anchorKey?: 'header';
}) {
  const sizeClasses = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' };
  const onlineDot = {
    sm: 'w-2.5 h-2.5 -bottom-0 -right-0',
    md: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
    lg: 'w-4 h-4 -bottom-0.5 -right-0.5',
  };
  const dim = size === 'sm' ? 32 : size === 'md' ? 40 : 56;

  return (
    <div
      className={`relative flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`}
      data-ava-anchor={anchorKey}
    >
      <div
        className={`${sizeClasses[size]} overflow-hidden rounded-full shadow-lg ring-2 ring-coral/30 ${
          glow ? 'avatar-receive' : ''
        }`}
      >
        <Image
          src={AVA_AVATAR_URL}
          alt="Ava"
          width={dim}
          height={dim}
          className="h-full w-full object-cover"
        />
      </div>
      <span
        className={`absolute ${onlineDot[size]} rounded-full border-2 border-white bg-emerald-400`}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
      </span>
    </div>
  );
}

// ============================================
// UI: TYPING
// ============================================

function TypingIndicator() {
  return (
    <div className="flex animate-fade-in items-end gap-2">
      <AvaAvatar size="sm" pulse />
      <div className="rounded-2xl rounded-bl-sm border border-sand-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex gap-1.5">
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-coral/50"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-coral/50"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-2 w-2 animate-bounce rounded-full bg-coral/50"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// UI: BUBBLES
// ============================================

/**
 * Reveal text character by character using a raf-driven clock. Reads
 * elapsed time instead of using setInterval so a dropped frame doesn't
 * desync the reveal. Leaves a blinking caret trailing the current
 * cursor while still typing, then snaps the caret away when done.
 *
 * `cps` = characters per second. ~42 feels right for WhatsApp-scale
 * sentences: fast enough not to drag, slow enough to let the reader
 * anticipate the line.
 */
function Typewriter({
  text,
  cps = 42,
  onDone,
}: {
  text: string;
  cps?: number;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) {
      setShown('');
      setDone(true);
      onDone?.();
      return;
    }
    setShown('');
    setDone(false);
    let rafId = 0;
    let start: number | null = null;
    const msPerChar = 1000 / cps;
    const total = text.length;
    const step = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const chars = Math.min(total, Math.floor(elapsed / msPerChar));
      setShown(text.slice(0, chars));
      if (chars < total) {
        rafId = requestAnimationFrame(step);
      } else {
        setDone(true);
        onDone?.();
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
    // Intentionally only re-run on text change; onDone identity isn't
    // stable and we don't want to restart the reveal when a parent
    // re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, cps]);

  return (
    <>
      {shown}
      {!done && <span className="typewriter-caret" aria-hidden />}
    </>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.sender === 'user';
  const useTypewriter = !isUser && message.typewriter && message.kind === 'text';

  // Base bubble container classes. Shimmer + tone stack onto the
  // standard rounded chrome. Shimmer requires overflow: hidden which
  // would clip the floating reaction badge — but reactions only land
  // on user bubbles and shimmer only fires on Ava bubbles, so the two
  // never coexist on the same bubble.
  const bubbleTone = message.tone ? `tone-${message.tone}` : '';
  const heroClass = message.isHero && !isUser ? 'shimmer-bubble' : '';

  return (
    <div
      data-bubble-id={message.id}
      className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''} ${
        message.animate ? 'animate-message-appear' : ''
      }`}
    >
      {!isUser && <AvaAvatar size="sm" />}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`relative rounded-2xl px-3.5 py-2 shadow-sm ${heroClass} ${bubbleTone} ${
            isUser
              ? 'rounded-br-sm bg-gradient-to-r from-ocean to-ocean-dark text-white'
              : 'rounded-bl-sm border border-sand-200 bg-white'
          }`}
          style={{ maxWidth: '75vw' }}
        >
          <p
            className={`relative z-[2] whitespace-pre-line text-[15px] leading-[1.35] tracking-[-0.005em] ${
              isUser ? 'text-white' : 'text-slate-700'
            }`}
          >
            {message.flair === 'wave' && (
              <span className="mr-1 inline-block animate-wave-hand align-[-2px] text-[18px] leading-none">
                👋
              </span>
            )}
            {useTypewriter ? (
              <Typewriter text={message.content} />
            ) : (
              message.content
            )}
          </p>
          {message.reaction && (
            <span
              className="pointer-events-none absolute -bottom-3 -left-3 z-10 flex h-7 w-7 animate-heart-pop items-center justify-center rounded-full bg-white text-[15px] leading-none shadow-md ring-1 ring-sand-200"
              aria-label={`Ava reacted ${message.reaction}`}
            >
              {message.reaction}
            </span>
          )}
        </div>
        <div
          className={`mt-0.5 flex items-center gap-1 px-1 ${
            isUser ? 'flex-row-reverse' : ''
          }`}
        >
          <span className="text-[10px] text-slate-400">
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isUser && (
            <span className="text-slate-400">
              {message.read ? (
                <CheckCheck className="h-3 w-3 text-ocean" />
              ) : message.delivered ? (
                <CheckCheck className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function GifMessage({ url, title }: { url: string; title?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);

  if (err) return null;

  return (
    <div className="flex animate-message-appear items-end gap-2">
      <AvaAvatar size="sm" />
      <div className="max-w-[65%] overflow-hidden rounded-2xl border border-sand-200 bg-sand-100 shadow-md">
        {!loaded && (
          <div className="flex h-32 w-48 items-center justify-center">
            <div className="flex gap-1">
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-coral/50"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-coral/50"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-coral/50"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title || 'GIF'}
          className={`h-auto w-full max-h-44 object-cover ${
            loaded ? 'block' : 'hidden'
          }`}
          loading="eager"
          crossOrigin="anonymous"
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
        />
      </div>
    </div>
  );
}

// ============================================
// UI: COMPOSER
// ============================================

function Composer({
  value,
  onChange,
  onSend,
  disabled,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="sticky bottom-0 border-t border-sand-200 bg-white/90 px-4 py-3 backdrop-blur-md md:px-8">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          rows={1}
          placeholder="Say anything to Ava…"
          disabled={disabled}
          className="min-h-[44px] max-h-40 flex-1 resize-none rounded-2xl border border-sand-300 bg-white px-4 py-2.5 text-[15px] leading-[1.35] text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-coral focus:outline-none focus:ring-2 focus:ring-coral/30 disabled:opacity-60"
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-coral via-coral-dark to-sunset-dark text-white shadow-md transition-transform duration-150 hover:scale-[1.04] hover:brightness-110 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          aria-label="Send"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// UTIL
// ============================================

function prettyChapter(id: string): string {
  const map: Record<string, string> = {
    introductions: 'Getting to know you',
    who_you_are: 'Who you are',
    tobago_now: 'Your Tobago now',
    what_youd_give: "What you'd give",
    money_on_island: 'On the island, money-wise',
    home_online: 'Home, online',
    tomorrow: 'Tomorrow',
  };
  return map[id] ?? id;
}
