/**
 * Emma Background Field Extraction
 *
 * Lightweight GPT-based extraction that runs AFTER Emma's streaming reply has
 * been sent (inside `after()`), mirroring `lib/ava-extract-simple.ts`. It pulls
 * the survey-field values the user clearly revealed in their latest message and
 * persists them via `applyEmmaFieldUpdates`, so the planner sees them filled on
 * the next turn.
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { EMMA_FIELD_HINTS, type EmmaFieldKey } from './emma-fields';
import { applyEmmaFieldUpdates } from './emma-survey-state';

const EXTRACTION_MODEL = 'gpt-4o-mini';
const EXTRACTION_TIMEOUT_MS = 8000;

export interface EmmaExtractionInput {
  userId: string;
  userMessage: string;
  emmaReply: string;
  lastEmmaQuestion: string | null;
  openFieldKeys: string[];
  sourceMessageId?: string | null;
}

export async function runEmmaExtraction(input: EmmaExtractionInput): Promise<void> {
  const openHints = EMMA_FIELD_HINTS.filter((h) => input.openFieldKeys.includes(h.key))
    .map((h) => `  ${h.key}: ${h.hint}`)
    .join('\n');

  if (!openHints.trim()) return;

  const exchange = [
    input.lastEmmaQuestion ? `Emma asked: "${input.lastEmmaQuestion}"` : null,
    `Visitor said: "${input.userMessage}"`,
    `Emma replied: "${input.emmaReply}"`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `You extract structured survey fields from a tourism chat in Tobago.

OPEN FIELDS (key: meaning):
${openHints}

EXCHANGE:
${exchange}

Return JSON with ONLY the fields the VISITOR clearly answered in their own message.
Canonical values:
- arrival_method: one of "plane" | "cruise" | "ferry"
- activity_interest: one of "beach" | "adventure" | "food" | "nightlife" | "photos"
- journey_rating: integer 1-5
- name: their preferred name
- email: a valid email address
Omit anything ambiguous or unanswered. Return {} if nothing was clearly answered.

Examples:
  "I flew in" -> {"arrival_method":"plane"}
  "We took the ferry from Trinidad" -> {"arrival_method":"ferry"}
  "I'd give the trip a 4" -> {"journey_rating":4}
  "mostly here for the beaches" -> {"activity_interest":"beach"}
  "I'm Marcus" -> {"name":"Marcus"}`;

  try {
    const resultPromise = generateText({ model: openai(EXTRACTION_MODEL), prompt });
    const timed = await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('extraction_timeout')), EXTRACTION_TIMEOUT_MS),
      ),
    ]);

    const rawText = (timed as Awaited<typeof resultPromise>).text;
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end <= start) return;

    let captured: Record<string, unknown>;
    try {
      captured = JSON.parse(rawText.slice(start, end + 1));
    } catch {
      return;
    }

    const updates: Partial<Record<EmmaFieldKey, unknown>> = {};
    for (const [k, v] of Object.entries(captured)) {
      if (v !== null && v !== undefined && v !== '') {
        updates[k as EmmaFieldKey] = v;
      }
    }
    if (Object.keys(updates).length === 0) return;

    const saved = await applyEmmaFieldUpdates({
      userId: input.userId,
      updates,
      sourceMessageId: input.sourceMessageId,
      confidence: 0.9,
    });
    if (saved.length > 0) {
      console.log('[emma.extract] saved', saved);
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'extraction_timeout') {
      console.warn('[emma.extract] timed out — skipping');
    } else {
      console.error('[emma.extract] failed:', err);
    }
  }
}
