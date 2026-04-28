/**
 * Ava Model Provider
 *
 * Two lanes, chosen by where the intelligence actually pays off.
 *
 *  1. Chat lane (VISIBLE reply) — OpenAI's current flagship.
 *     Primary: OpenAI `gpt-5.4` (the GPT-5 family's current API-available
 *     flagship; GPT-5.5 is announced but API is not yet live as of Apr 2026).
 *     This is what the user sees. We want reasoning and emotional nuance
 *     here, not the cheapest token — the visible voice is the product.
 *     Env override: OPENAI_CHAT_MODEL.
 *
 *  2. Extraction lane (HIDDEN structured pass) — reasoning-heavy.
 *     Primary: StepFun `step-3.5-flash` via its OpenAI-compatible endpoint.
 *     Reasoning models earn their keep here, parsing messy free-form text
 *     into 17 typed profile fields, named entities, and nuanced notes.
 *     Falls back to the chat model if STEPFUN_API_KEY is not set.
 *
 * Env configuration:
 *   STEPFUN_API_KEY      (required for the extraction lane, else fallback)
 *   STEPFUN_MODEL        (optional, default "step-3.5-flash")
 *   STEPFUN_BASE_URL     (optional, default "https://api.stepfun.ai/step_plan/v1")
 *   OPENAI_API_KEY       (required for chat + extraction fallback)
 *   OPENAI_CHAT_MODEL    (optional, default "gpt-5.4")
 *   AVA_USE_STEPFUN_FOR_CHAT ("1" to route chat to StepFun too — slow & expensive,
 *                             only flip this if you want the reasoning-model voice)
 */

import { openai, createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

const STEPFUN_DEFAULT_BASE_URL = 'https://api.stepfun.ai/step_plan/v1';
const STEPFUN_DEFAULT_MODEL = 'step-3.5-flash';
const CHAT_DEFAULT_MODEL = 'gpt-5.4';

function stepfunProvider() {
  const apiKey = process.env.STEPFUN_API_KEY;
  if (!apiKey) return null;
  return createOpenAI({
    apiKey,
    baseURL: process.env.STEPFUN_BASE_URL || STEPFUN_DEFAULT_BASE_URL,
    name: 'stepfun',
  });
}

export interface AvaModelInfo {
  provider: 'stepfun' | 'openai';
  modelId: string;
  isFallback: boolean;
}

/**
 * Chat lane — visible reply. Fast OpenAI model by default. Opt-in to
 * StepFun with AVA_USE_STEPFUN_FOR_CHAT=1 if you want the reasoning
 * model on visible turns (expect ~15-20s latency).
 */
export function getAvaChatModel(): { model: LanguageModel; info: AvaModelInfo } {
  const routeToStepfun = process.env.AVA_USE_STEPFUN_FOR_CHAT === '1';
  const stepfun = stepfunProvider();
  const stepfunModelId = process.env.STEPFUN_MODEL || STEPFUN_DEFAULT_MODEL;

  if (routeToStepfun && stepfun) {
    return {
      // StepFun only exposes the classic Chat Completions API, not Responses.
      model: stepfun.chat(stepfunModelId),
      info: { provider: 'stepfun', modelId: stepfunModelId, isFallback: false },
    };
  }

  const modelId = process.env.OPENAI_CHAT_MODEL || CHAT_DEFAULT_MODEL;
  return {
    model: openai(modelId),
    info: { provider: 'openai', modelId, isFallback: false },
  };
}

/**
 * Extraction lane — hidden structured-output pass. StepFun reasoning
 * model by default. Falls back to gpt-4o-mini if StepFun unavailable.
 */
export function getAvaExtractionModel(): { model: LanguageModel; info: AvaModelInfo } {
  const stepfun = stepfunProvider();
  const stepfunModelId = process.env.STEPFUN_MODEL || STEPFUN_DEFAULT_MODEL;

  if (stepfun) {
    return {
      model: stepfun.chat(stepfunModelId),
      info: { provider: 'stepfun', modelId: stepfunModelId, isFallback: false },
    };
  }

  const fallbackModelId = CHAT_DEFAULT_MODEL;
  return {
    model: openai(fallbackModelId),
    info: { provider: 'openai', modelId: fallbackModelId, isFallback: true },
  };
}

/**
 * Health-check helper. Confirms creds exist and are the expected shape.
 * Does not make a network call.
 */
export function getAvaModelHealth() {
  return {
    stepfun_key_present: Boolean(process.env.STEPFUN_API_KEY),
    stepfun_model: process.env.STEPFUN_MODEL || STEPFUN_DEFAULT_MODEL,
    stepfun_base_url: process.env.STEPFUN_BASE_URL || STEPFUN_DEFAULT_BASE_URL,
    openai_key_present: Boolean(process.env.OPENAI_API_KEY),
    chat_lane:
      process.env.AVA_USE_STEPFUN_FOR_CHAT === '1' && process.env.STEPFUN_API_KEY
        ? 'stepfun'
        : 'openai',
    extraction_lane: process.env.STEPFUN_API_KEY ? 'stepfun' : 'openai',
  };
}
