/**
 * Ava Simple Extraction
 *
 * Lightweight GPT-based profile field extraction that runs in the background
 * after Ava's streaming reply has been sent to the client. It uses a small,
 * fast model (gpt-4o-mini) with a concise few-shot prompt instead of the
 * heavyweight StepFun reasoning model — sufficient for straightforward answers.
 *
 * The previous StepFun extraction ran in the same request cycle, adding
 * latency. This module decouples it: the chat reply streams immediately
 * and extraction happens in the background.
 */

import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { applyExtractionResult } from './ava-db';
import { AVA_UNIFIED_PROFILE_FIELD_HINTS } from './ava-config';
import type { ExtractionResult, ExtractedProfileUpdate } from './ava-extract';

const EXTRACTION_MODEL = 'gpt-4o-mini';
const EXTRACTION_TIMEOUT_MS = 8000;

export interface SimpleExtractionInput {
  userId: string;
  userMessage: string;
  avaReply: string;
  lastAvaQuestion: string | null;
  openFieldKeys: string[];
  sourceMessageId: string;
}

export async function runSimpleExtraction(
  input: SimpleExtractionInput,
): Promise<void> {
  const openHints = AVA_UNIFIED_PROFILE_FIELD_HINTS.filter((h) =>
    input.openFieldKeys.includes(h.key),
  )
    .slice(0, 10) // cap tokens
    .map((h) => `  ${h.key}: ${h.hint}`)
    .join('\n');

  if (!openHints.trim()) return;

  const exchangeLines = [
    input.lastAvaQuestion ? `Ava asked: "${input.lastAvaQuestion}"` : null,
    `User said: "${input.userMessage}"`,
    `Ava replied: "${input.avaReply}"`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `You are a data extractor for a diaspora research chatbot.
Given a conversation exchange, extract profile field values the user has clearly revealed.

OPEN FIELDS (keys and what they mean):
${openHints}

EXCHANGE:
${exchangeLines}

OUTPUT: JSON with ONLY the fields the user clearly answered in their own message.
If a field is ambiguous or unanswered, omit it.
Return {} if nothing was clearly answered.

Examples:
  User said: "New York." → {"current_location_text":"New York"}
  User said: "My grandparents were from Tobago." → {"generation":"3rd"}
  User said: "I work in tech." → {"industry":"technology"}`;

  try {
    const resultPromise = generateText({
      model: openai(EXTRACTION_MODEL),
      prompt,
    });

    const timedResult = await Promise.race([
      resultPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('extraction_timeout')), EXTRACTION_TIMEOUT_MS),
      ),
    ]);

    const rawText = (timedResult as Awaited<typeof resultPromise>).text;

    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start === -1 || end <= start) return;

    const captured: Record<string, unknown> = JSON.parse(rawText.slice(start, end + 1));

    const updates: ExtractedProfileUpdate[] = Object.entries(captured)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([field_key, value]) => ({
        field_key,
        value: value as string | string[] | number | null,
        confidence: 0.9,
        evidence: '[simple-extraction/gpt-4o-mini]',
      }));

    if (updates.length === 0) return;

    const extraction: ExtractionResult = {
      profile_updates: updates,
      entities: [],
      notes: [],
      raw_model_output: rawText,
      model_info: { provider: 'openai', modelId: EXTRACTION_MODEL },
      elapsed_ms: 0,
      parse_ok: true,
    };

    await applyExtractionResult({
      userId: input.userId,
      extraction,
      sourceMessageId: input.sourceMessageId,
      minConfidence: 0.5,
    });

    console.log('[ava.extract-simple] saved', updates.map((u) => u.field_key));
  } catch (err) {
    if (err instanceof Error && err.message === 'extraction_timeout') {
      console.warn('[ava.extract-simple] timed out — skipping');
    } else {
      console.error('[ava.extract-simple] failed:', err);
    }
  }
}
