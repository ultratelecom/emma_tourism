import { applyExtractionResult } from './ava-db';
import type { ExtractedProfileUpdate, ExtractionResult } from './ava-extract';
import {
  AVA_PICKER_CONNECTION,
  AVA_PICKER_INVEST,
  AVA_PICKER_ROOTS,
  AVA_PICKER_VISIT,
} from './ava-elicitation-messages';

function buildExactPickerMap(): Map<string, ExtractedProfileUpdate> {
  const m = new Map<string, ExtractedProfileUpdate>();
  const put = (message: string, field_key: string, value: string | number) => {
    m.set(message.trim(), {
      field_key,
      value,
      confidence: 0.99,
      evidence: '[picker-sync]',
    });
  };
  for (const r of AVA_PICKER_ROOTS) put(r.message, 'generation', r.profileValue);
  for (const r of AVA_PICKER_VISIT) put(r.message, 'visit_frequency', r.profileValue);
  for (const r of AVA_PICKER_CONNECTION) put(r.message, 'connection_score', r.profileValue);
  for (const r of AVA_PICKER_INVEST) put(r.message, 'invest_intent', r.profileValue);
  return m;
}

const EXACT_PICKER_MESSAGES = buildExactPickerMap();

/**
 * When the user's message is a known picker line, persist the field before
 * the streaming turn computes X-Elicit-* headers so we don't surface the
 * same picker twice in a row. Background GPT extraction can still refine.
 */
export async function syncApplyPickerProfileIfExact(params: {
  userId: string;
  userMessage: string;
  sourceMessageId: string;
}): Promise<void> {
  const update = EXACT_PICKER_MESSAGES.get(params.userMessage.trim());
  if (!update) return;

  const extraction: ExtractionResult = {
    profile_updates: [update],
    entities: [],
    notes: [],
    raw_model_output: '[picker-sync]',
    model_info: { provider: 'system', modelId: 'picker-sync' },
    elapsed_ms: 0,
    parse_ok: true,
  };

  await applyExtractionResult({
    userId: params.userId,
    extraction,
    sourceMessageId: params.sourceMessageId,
    minConfidence: 0.5,
  });
}
