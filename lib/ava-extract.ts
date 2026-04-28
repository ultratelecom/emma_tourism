/**
 * Ava Extraction Pass
 *
 * The hidden half of the twin-pass turn model. For every user message,
 * this module parses the text into:
 *
 *   1. Profile field updates — typed, keyed to AVA_PROFILE_FIELDS,
 *      with a confidence score and an evidence quote.
 *
 *   2. Named entities — people, places, foods, songs, employers,
 *      schools, phrases the user mentioned.
 *
 *   3. Free-form notes — texture the structured fields can't hold
 *      (emotional tone, life-circumstance hints, contradictions).
 *
 * Routes to the StepFun reasoning model (step-3.5-flash) by default,
 * falling back to gpt-4o-mini if STEPFUN_API_KEY is not set.
 *
 * This module is pure: it does NOT write to the database. The caller
 * is expected to take the ExtractionResult and persist fields / notes /
 * entities into ava_profile_fields / ava_notes / ava_entities. DB work
 * happens in step 3 of the build plan.
 */

import { generateText } from 'ai';
import { AVA_PROFILE_FIELDS, type AvaProfileFieldSpec } from './ava-config';
import { getAvaExtractionModel } from './ava-model';

// ============================================
// TYPES
// ============================================

export interface ExtractedProfileUpdate {
  field_key: string;
  value: string | string[] | number | null;
  confidence: number;
  evidence: string;
}

export type ExtractedEntityKind =
  | 'person'
  | 'place'
  | 'food'
  | 'song'
  | 'employer'
  | 'school'
  | 'phrase';

export interface ExtractedEntity {
  kind: ExtractedEntityKind;
  name: string;
  quote: string;
}

export interface ExtractedNote {
  content: string;
  tags: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface ExtractionResult {
  profile_updates: ExtractedProfileUpdate[];
  entities: ExtractedEntity[];
  notes: ExtractedNote[];
  raw_model_output: string;
  model_info: { provider: string; modelId: string };
  elapsed_ms: number;
  parse_ok: boolean;
}

export interface ExtractionInput {
  userMessage: string;
  currentProfile?: Record<string, unknown>;
  chapterId?: string;
  openFieldKeys?: string[];
  lastAvaMessage?: string | null;
}

// ============================================
// PROMPT BUILDING
// ============================================

function describeFieldsForPrompt(fieldKeys?: string[]): string {
  const fields = fieldKeys
    ? fieldKeys
        .map((k) => AVA_PROFILE_FIELDS[k])
        .filter((f): f is AvaProfileFieldSpec => Boolean(f))
    : Object.values(AVA_PROFILE_FIELDS);

  return fields
    .map((f) => {
      const optionsLine =
        f.options && f.options.length
          ? ` | options: ${f.options.join(', ')}`
          : '';
      const depLine = f.depends_on
        ? ` | depends on ${f.depends_on.field} = ${Array.isArray(f.depends_on.value) ? f.depends_on.value.join('/') : f.depends_on.value}`
        : '';
      return `- ${f.key} (${f.type}${optionsLine}${depLine}): ${f.natural_prompt}`;
    })
    .join('\n');
}

const EXTRACTION_SYSTEM_PROMPT = `You are a careful information extractor working silently behind a conversation between a Tobagonian named Ava and a Trinbagonian diaspora member. Your job is to parse the user's latest message into structured data.

RULES
- Extract only what the user actually said. Do not infer, do not fill gaps from prior context.
- Exception: for current_country only, you may infer the country from a very unambiguous location answer (New York/Brooklyn/Queens -> United States; Toronto -> Canada; London -> United Kingdom). Use moderate confidence unless they named the country directly.
- Use Ava's immediately previous question to interpret short answers. If Ava asked "How far back does Tobago go for you?" and the user says "Grandparents", extract generation = "3rd". If Ava asked where they are based and the user says "New York", extract current_location_text = "New York" and current_city_region = "New York".
- If a message contains nothing extractable, return empty arrays. Do not invent data.
- For enum fields, only emit one of the exact listed options. If the user's wording does not clearly map to an option, emit an empty update for that field.
- Confidence is a self-assessment from 0.0 to 1.0. Use 0.9+ for verbatim statements, 0.6-0.8 for clear paraphrase, below 0.6 for uncertain inference.
- Evidence is the shortest verbatim quote from the user that supports the extraction.
- Entities are explicit mentions only. If someone says "my grandmother", that is a person entity with name "grandmother". If they name a village, that is a place. Extract every distinct named thing.
- Notes are reserved for texture the structured fields do not capture: emotional weight, life circumstances, contradictions, recurring themes. One note per discrete observation, short.

FIELD EXAMPLES
- "35-44, male, master's degree" -> age_bracket="35-44", gender="male", education_level="masters".
- "I consult for Verizon on rural networks" -> industry="technology", profession_text="I consult for Verizon on rural networks", employer entity "Verizon".
- "Maybe, if returns make sense" -> invest_intent="maybe".
- "Tourism, renewable energy, agriculture and small business" -> invest_sectors=["tourism","renewable_energy","agriculture","small_business"].
- "Lack of information, trust, bureaucracy, time and distance" -> barriers=["lack_of_information","lack_of_trust_transparency","bureaucracy","time_constraints","distance_logistics"].
- "dashboard, networking, mentorship, updates, events, privacy" -> feature_priorities=["investment_dashboard","networking","mentorship_programs","government_updates","event_notifications","data_privacy_security"].
- "advisory group, virtual meetings, future surveys, pilots" -> future_roles=["diaspora_advisory_group","virtual_meetings","future_surveys","pilot_programs"].

OUTPUT FORMAT
Return ONLY a single valid JSON object matching this exact shape. No prose before or after, no markdown fences.

{
  "profile_updates": [
    { "field_key": "current_location_text", "value": "Toronto", "confidence": 0.95, "evidence": "writing from Toronto" },
    { "field_key": "current_city_region", "value": "Toronto", "confidence": 0.95, "evidence": "writing from Toronto" },
    { "field_key": "current_country", "value": "Canada", "confidence": 0.75, "evidence": "writing from Toronto" }
  ],
  "entities": [
    { "kind": "person", "name": "grandmother", "quote": "my grandmother was from Castara" },
    { "kind": "place", "name": "Castara", "quote": "my grandmother was from Castara" }
  ],
  "notes": [
    { "content": "References lineage through maternal line; distance from the island is generational.", "tags": ["lineage", "distance"], "sentiment": "neutral" }
  ]
}`;

function buildUserPrompt(input: ExtractionInput): string {
  const fieldsBlock = describeFieldsForPrompt(input.openFieldKeys);
  const profileBlock = input.currentProfile
    ? JSON.stringify(input.currentProfile, null, 2)
    : '(empty)';

  return `CONTEXT
- Conversation chapter: ${input.chapterId || '(unspecified)'}
- Prior profile state: ${profileBlock}
- Ava's previous message / question: ${input.lastAvaMessage ? JSON.stringify(input.lastAvaMessage) : '(none)'}

ELIGIBLE FIELDS FOR THIS MESSAGE
${fieldsBlock}

USER MESSAGE
${JSON.stringify(input.userMessage)}

Extract. JSON only.`;
}

// ============================================
// PARSING
// ============================================

function stripCodeFence(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return trimmed;
}

function extractJsonBlock(raw: string): string | null {
  const cleaned = stripCodeFence(raw);
  if (cleaned.startsWith('{')) return cleaned;
  const match = cleaned.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

function coerceArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function validateUpdates(arr: unknown[]): ExtractedProfileUpdate[] {
  return arr
    .filter((u): u is Record<string, unknown> => typeof u === 'object' && u !== null)
    .map((u): ExtractedProfileUpdate | null => {
      const field_key = typeof u.field_key === 'string' ? u.field_key : null;
      if (!field_key || !AVA_PROFILE_FIELDS[field_key]) return null;

      const spec = AVA_PROFILE_FIELDS[field_key];
      let value: ExtractedProfileUpdate['value'] = null;
      if (spec.type === 'enum_multi' && Array.isArray(u.value)) {
        value = u.value.filter((v): v is string => typeof v === 'string');
      } else if (spec.type === 'scale_1_5' && typeof u.value === 'number') {
        value = Math.max(1, Math.min(5, Math.round(u.value)));
      } else if (typeof u.value === 'string' || typeof u.value === 'number') {
        value = u.value;
      }
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) return null;

      const confidence =
        typeof u.confidence === 'number' ? Math.max(0, Math.min(1, u.confidence)) : 0.5;
      const evidence = typeof u.evidence === 'string' ? u.evidence : '';

      return { field_key, value, confidence, evidence };
    })
    .filter((u): u is ExtractedProfileUpdate => u !== null);
}

function validateEntities(arr: unknown[]): ExtractedEntity[] {
  const ALLOWED: ExtractedEntityKind[] = [
    'person', 'place', 'food', 'song', 'employer', 'school', 'phrase',
  ];
  return arr
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map((e) => {
      const kind = typeof e.kind === 'string' && (ALLOWED as string[]).includes(e.kind)
        ? (e.kind as ExtractedEntityKind)
        : null;
      const name = typeof e.name === 'string' ? e.name.trim() : '';
      const quote = typeof e.quote === 'string' ? e.quote : '';
      if (!kind || !name) return null;
      return { kind, name, quote };
    })
    .filter((e): e is ExtractedEntity => e !== null);
}

function validateNotes(arr: unknown[]): ExtractedNote[] {
  return arr
    .filter((n): n is Record<string, unknown> => typeof n === 'object' && n !== null)
    .map((n): ExtractedNote | null => {
      const content = typeof n.content === 'string' ? n.content.trim() : '';
      if (!content) return null;
      const tags = Array.isArray(n.tags)
        ? n.tags.filter((t): t is string => typeof t === 'string')
        : [];
      const sentiment =
        n.sentiment === 'positive' || n.sentiment === 'negative' || n.sentiment === 'neutral'
          ? n.sentiment
          : undefined;
      return { content, tags, sentiment };
    })
    .filter((n): n is ExtractedNote => n !== null);
}

// ============================================
// MAIN ENTRY POINT
// ============================================

export async function extractFromUserMessage(
  input: ExtractionInput,
): Promise<ExtractionResult> {
  const { model, info } = getAvaExtractionModel();
  const userPrompt = buildUserPrompt(input);

  const started = Date.now();
  const { text } = await generateText({
    model,
    system: EXTRACTION_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.1,
  });
  const elapsed_ms = Date.now() - started;

  const jsonBlock = extractJsonBlock(text);
  if (!jsonBlock) {
    return {
      profile_updates: [],
      entities: [],
      notes: [],
      raw_model_output: text,
      model_info: { provider: info.provider, modelId: info.modelId },
      elapsed_ms,
      parse_ok: false,
    };
  }

  try {
    const parsed = JSON.parse(jsonBlock) as Record<string, unknown>;
    return {
      profile_updates: validateUpdates(coerceArray(parsed.profile_updates)),
      entities: validateEntities(coerceArray(parsed.entities)),
      notes: validateNotes(coerceArray(parsed.notes)),
      raw_model_output: text,
      model_info: { provider: info.provider, modelId: info.modelId },
      elapsed_ms,
      parse_ok: true,
    };
  } catch {
    return {
      profile_updates: [],
      entities: [],
      notes: [],
      raw_model_output: text,
      model_info: { provider: info.provider, modelId: info.modelId },
      elapsed_ms,
      parse_ok: false,
    };
  }
}
