/**
 * Ava voice post-processor
 *
 * gpt-4o-mini has strong RLHF pull toward customer-service / wellness-app
 * warmth ("It sounds like you…", "I hear you, that distance must be tough",
 * "that's real dedication"). Prompt-level bans cut it down but don't kill
 * it. This module runs on the raw text the chat model produces and
 * applies three cheap cleanups:
 *
 *   1. Strip known banned openers if they occur as the first clause.
 *   2. Collapse double whitespace and fix em-dash → comma.
 *   3. If more than one question mark remains, keep only up to the first
 *      one (Ava's hard rule: one question per turn).
 *
 * Cheap, deterministic, no extra model call. Tracks what it changed so
 * we can log it for tuning.
 */

export interface PostProcessResult {
  text: string;
  edited: boolean;
  removed_phrases: string[];
  trimmed_second_question: boolean;
  normalized_dashes: boolean;
  stripped_cliche_shapes: string[];
}

export interface AvaReplyQualityAssessment {
  ok: boolean;
  issues: string[];
  should_retry: boolean;
  retry_instruction: string | null;
}

// Openers that must be stripped if they begin Ava's reply. Regex is
// anchored at the start (or first non-whitespace), case-insensitive.
// Each one captures the opener + trailing comma/period so the rest of
// the sentence reads cleanly after removal.
const BANNED_OPENERS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'it-sounds-like',   pattern: /^\s*it['’]?s?\s+sounds?\s+like\s+[^,.!?]*[,.]?\s*/i },
  { label: 'that-must-be',     pattern: /^\s*that\s+must\s+be\s+[^,.!?]*[,.]?\s*/i },
  { label: 'feeling-that',     pattern: /^\s*feeling\s+that\s+[^,.!?]*[,.]?\s*/i },
  { label: 'nice-to-meet',     pattern: /^\s*(nice|lovely|great)\s+to\s+meet\s+you[,. ]*\s*/i },
  { label: 'thanks-for-sharing', pattern: /^\s*thank[s]?\s+(you\s+)?for\s+sharing[,. ]*\s*/i },
  { label: 'thats-real-X',     pattern: /^\s*that['’]?s\s+(real|quite|such|so)\s+(a\s+)?\w+[,.]?\s*/i },
  { label: 'lovely',           pattern: /^\s*(how|that['’]?s)\s+lovely[,. ]*\s*/i },
  { label: 'great-question',   pattern: /^\s*great\s+question[,. ]*\s*/i },
  { label: 'absolutely',       pattern: /^\s*absolutely[,. ]*\s*/i },
  { label: 'i-understand',     pattern: /^\s*i\s+understand[,. ]*\s*/i },
  { label: 'im-so-glad',       pattern: /^\s*i['’]?m\s+so\s+glad[,. ]*\s*/i },
  { label: 'your-X-must-be',   pattern: /^\s*your\s+\w+.{0,40}?\s+must\s+be\s+[^,.!?]*[,.]?\s*/i },
];

/**
 * Remove only the FIRST matching banned opener (applied at the start of
 * the text). We don't chain multiple because stripping one often leaves
 * a clean sentence and we'd rather under-edit than over-edit.
 */
function stripBannedOpener(input: string): { out: string; removed?: string } {
  for (const { label, pattern } of BANNED_OPENERS) {
    if (pattern.test(input)) {
      const stripped = input.replace(pattern, '').trimStart();
      if (stripped.length > 0 && stripped !== input.trimStart()) {
        // capitalise the new first letter if we chopped a comma
        const capped = stripped[0].toUpperCase() + stripped.slice(1);
        return { out: capped, removed: label };
      }
    }
  }
  return { out: input };
}

/**
 * If more than one `?` is in the reply, keep everything up to (and
 * including) the first `?`. We prefer the first question because it's
 * usually the one the model actually committed to, whereas trailing
 * double-questions are drift.
 */
function trimToFirstQuestion(input: string): { out: string; trimmed: boolean } {
  const marks: number[] = [];
  for (let i = 0; i < input.length; i++) if (input[i] === '?') marks.push(i);
  if (marks.length <= 1) return { out: input, trimmed: false };

  const cut = marks[0] + 1;
  return { out: input.slice(0, cut).trim(), trimmed: true };
}

/**
 * Replace em-dashes with commas (Ava's voice rule bans em-dashes) and
 * collapse runs of whitespace. Returns whether any dash was replaced so
 * the caller can log drift.
 */
function normalizeDashes(input: string): { out: string; changed: boolean } {
  const hadDash = /[—–]/.test(input);
  const out = input
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { out, changed: hadDash };
}

/**
 * Cliché SENTENCE shapes the prompt bans but the model still slips
 * sometimes. Unlike BANNED_OPENERS these can appear anywhere in the
 * reply. We strip the entire offending sentence (up to the next .!?)
 * rather than trying to rewrite it in place, because half-cliché is
 * worse than no cliché.
 */
const BANNED_SHAPES: Array<{ label: string; pattern: RegExp }> = [
  { label: 'has-its-own-charm',   pattern: /[^.!?]*\bhas\s+its\s+own\s+charm[^.!?]*[.!?]+\s*/gi },
  { label: 'does-have-its-charm', pattern: /[^.!?]*\bdoes\s+have\s+its\s+(own\s+)?charm[^.!?]*[.!?]+\s*/gi },
  { label: 'has-its-own-rhythm',  pattern: /[^.!?]*\bhas\s+its\s+own\s+rhythm[^.!?]*[.!?]+\s*/gi },
  { label: 'that-must-be-a-change', pattern: /[^.!?]*\bthat\s+must\s+be\s+(quite\s+)?a\s+change[^.!?]*[.!?]+\s*/gi },
  { label: 'doesnt-it-tag',       pattern: /[^.!?]*,\s*doesn['’]?t\s+it\s*[?.!]+\s*/gi },
  { label: 'new-york-work-dodge', pattern: /[^.!?]*\bnew york\b[^.!?]*\b(all kinds of work|work|jobs?)\b[^.!?]*[.!?]+\s*/gi },
  { label: 'scarborough-forced-scene', pattern: /[^.!?]*\bscarborough\b[^.!?]*\b(saturday|wharf|market|fish vendors?)\b[^.!?]*[.!?]+\s*/gi },
];

function stripBannedShapes(input: string): { out: string; stripped: string[] } {
  let out = input;
  const stripped: string[] = [];
  for (const { label, pattern } of BANNED_SHAPES) {
    if (pattern.test(out)) {
      out = out.replace(pattern, ' ');
      stripped.push(label);
    }
  }
  out = out.replace(/\s{2,}/g, ' ').trim();
  return { out, stripped };
}

export function postProcessAvaReply(raw: string): PostProcessResult {
  const removed: string[] = [];

  const { out: afterDash, changed: normalized_dashes } = normalizeDashes(raw);

  const { out: afterStrip, removed: firstRemoved } = stripBannedOpener(afterDash);
  if (firstRemoved) removed.push(firstRemoved);

  const { out: afterShapes, stripped: stripped_cliche_shapes } =
    stripBannedShapes(afterStrip);

  const { out: afterQ, trimmed: trimmed_second_question } =
    trimToFirstQuestion(afterShapes);

  const edited =
    removed.length > 0 ||
    trimmed_second_question ||
    normalized_dashes ||
    stripped_cliche_shapes.length > 0 ||
    afterQ !== raw;

  return {
    text: afterQ,
    edited,
    removed_phrases: removed,
    trimmed_second_question,
    normalized_dashes,
    stripped_cliche_shapes,
  };
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function hasQuestion(text: string): boolean {
  return text.includes('?');
}

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

export function assessAvaReplyQuality(params: {
  userMessage: string;
  reply: string;
  turnPlan?: {
    moment_type?: string;
    reply_shape?: string;
    should_ask_question?: boolean;
    specifics_to_name?: string[];
    avoid_topics?: string[];
  };
}): AvaReplyQualityAssessment {
  const issues: string[] = [];
  const userLower = params.userMessage.toLowerCase();
  const replyLower = params.reply.toLowerCase();
  const plan = params.turnPlan;

  if ((params.reply.match(/\?/g) ?? []).length > 1) {
    issues.push('more than one question');
  }

  if (sentenceCount(params.reply) > 4) {
    issues.push('more than four sentences');
  }

  if (plan?.should_ask_question === false && hasQuestion(params.reply)) {
    issues.push('asked a question when planner said no question');
  }

  const specifics = plan?.specifics_to_name ?? [];
  const requiresSpecific =
    specifics.length > 0 &&
    ['career_achievement', 'identity_roots', 'place_memory'].includes(plan?.moment_type ?? '');
  if (requiresSpecific && !includesAny(params.reply, specifics)) {
    issues.push(`ignored required specific: ${specifics.join(', ')}`);
  }

  if (plan?.avoid_topics?.some((topic) => /place|scenery|postcard|sensory/i.test(topic))) {
    if (
      /\bscarborough\b.*\b(saturday|wharf|market|fish|vendors?|road|street)\b/i.test(params.reply) ||
      /\b(tobago|buccoo|big bay|store bay)\b.*\b(smell|sound|sea|breeze|market|wharf)\b/i.test(params.reply)
    ) {
      issues.push('forced place imagery despite planner restraint');
    }
  }

  if (plan?.avoid_topics?.some((topic) => /work-detail|case involves|third work/i.test(topic))) {
    if (/\b(what does your consult actually involve|what.*case.*that way|what.*repair|what kind of consulting|what kind of repairs|what kind of problem|what kind of issue|what issue|how did you learn|day to day)\b/i.test(replyLower)) {
      issues.push('over-probed same work topic after depth budget');
    }
  }

  if (plan?.avoid_topics?.some((topic) => /stalling with got you|no-question acknowledgement/i.test(topic))) {
    if (/^(got you|got it|okay|right|fair enough)[.!]?$/i.test(params.reply.trim())) {
      issues.push('stalled after short acknowledgement instead of recovering to profile');
    }
  }

  if (
    /\bverizon\b/i.test(params.userMessage) &&
    !/\bverizon\b/i.test(params.reply)
  ) {
    issues.push('ignored Verizon after user named it');
  }

  if (
    /\b(didn'?t|did not|couldn'?t|could not).{0,40}\b(opportunity|work|future|chance)\b/i.test(userLower) &&
    !/\b(i hear you|i get that|makes sense|understand that|no shame|good that you|backed yourself)\b/i.test(replyLower)
  ) {
    issues.push('missed validation for opportunity/life-decision disclosure');
  }

  if (/\b(guarantee|guaranteed returns?|you should invest|safe investment|risk[- ]free)\b/i.test(replyLower)) {
    issues.push('unsafe investment or guarantee language');
  }

  if (/\b(you can trust us|we will protect|government will|the government will|we'?ll contact you|we will contact you)\b/i.test(replyLower)) {
    issues.push('promise or institutional-defense language');
  }

  const should_retry = issues.some((issue) =>
    /ignored|required specific|forced place imagery|missed validation|planner said no question|over-probed|stalled after short/.test(issue),
  );

  return {
    ok: issues.length === 0,
    issues,
    should_retry,
    retry_instruction: should_retry
      ? [
          'Rewrite Ava reply once. Fix these quality failures:',
          ...issues.map((issue) => `- ${issue}`),
          'Keep one to four short sentences.',
          'Do not explain the rewrite.',
          'Do not mention planner, profile, survey, or system.',
        ].join('\n')
      : null,
  };
}
