/**
 * Emma Survey Field Schema
 *
 * Single source of truth for the structured data Emma collects, mirroring the
 * pattern Ava uses (`lib/ava-config.ts` + `lib/ava-graph/field-flow.ts`).
 *
 * Emma's intake survey has exactly five fields. The planner
 * (`lib/emma-field-flow.ts`) walks them in this order and asks only for what
 * is still open, so returning users skip fields they have already answered.
 */

export const EMMA_FIELD_KEYS = [
  'name',
  'email',
  'arrival_method',
  'journey_rating',
  'activity_interest',
] as const;

export type EmmaFieldKey = (typeof EMMA_FIELD_KEYS)[number];

export type EmmaFieldType = 'text' | 'email' | 'enum' | 'scale_1_5';

export interface EmmaFieldSpec {
  key: EmmaFieldKey;
  type: EmmaFieldType;
  /** Allowed values for enum fields (lowercase canonical form). */
  options?: string[];
  /** Short factual hint of WHAT we still need — never a scripted question. */
  hint: string;
  /**
   * Whether this field has a client multiple-choice picker driven by stream
   * headers (mirrors Ava's elicitation). `name`/`email` stay free-text chat.
   */
  picker: 'arrival' | 'rating' | 'activity' | null;
}

export const EMMA_FIELDS: Record<EmmaFieldKey, EmmaFieldSpec> = {
  name: {
    key: 'name',
    type: 'text',
    hint: 'what they would like to be called (first name is fine)',
    picker: null,
  },
  email: {
    key: 'email',
    type: 'email',
    hint: 'an email address so Emma can send local tips (validate it looks like an email)',
    picker: null,
  },
  arrival_method: {
    key: 'arrival_method',
    type: 'enum',
    options: ['plane', 'cruise', 'ferry'],
    hint: 'how they arrived in Tobago — plane, cruise, or ferry',
    picker: 'arrival',
  },
  journey_rating: {
    key: 'journey_rating',
    type: 'scale_1_5',
    hint: 'how they rate their journey getting here, 1 (rough) to 5 (smooth)',
    picker: 'rating',
  },
  activity_interest: {
    key: 'activity_interest',
    type: 'enum',
    options: ['beach', 'adventure', 'food', 'nightlife', 'photos'],
    hint: 'what they are most excited to do — beach, adventure, food, nightlife, or photos',
    picker: 'activity',
  },
};

/** Priority order the planner asks fields in. */
export const EMMA_REQUIRED_FIELD_ORDER: EmmaFieldKey[] = [...EMMA_FIELD_KEYS];

/** Hints in priority order, for prompt construction and extraction. */
export const EMMA_FIELD_HINTS: { key: EmmaFieldKey; hint: string }[] =
  EMMA_REQUIRED_FIELD_ORDER.map((key) => ({ key, hint: EMMA_FIELDS[key].hint }));

// ============================================
// NORMALIZERS — coerce free-text answers to canonical enum / scale values
// ============================================

const ARRIVAL_SYNONYMS: Record<string, string> = {
  plane: 'plane', flight: 'plane', flew: 'plane', fly: 'plane', air: 'plane',
  airplane: 'plane', airport: 'plane',
  cruise: 'cruise', ship: 'cruise', boat: 'cruise',
  ferry: 'ferry', 'sea bridge': 'ferry', 'seabridge': 'ferry', crossing: 'ferry',
};

const ACTIVITY_SYNONYMS: Record<string, string> = {
  beach: 'beach', relax: 'beach', relaxation: 'beach', sand: 'beach', swim: 'beach',
  adventure: 'adventure', hike: 'adventure', hiking: 'adventure', nature: 'adventure',
  waterfall: 'adventure', rainforest: 'adventure', dive: 'adventure', diving: 'adventure',
  food: 'food', eat: 'food', cuisine: 'food', restaurant: 'food', culture: 'food',
  nightlife: 'nightlife', party: 'nightlife', music: 'nightlife', dancing: 'nightlife',
  fete: 'nightlife', lime: 'nightlife',
  photos: 'photos', photo: 'photos', photography: 'photos', sightseeing: 'photos',
  scenic: 'photos', view: 'photos', camera: 'photos',
};

function matchSynonym(raw: string, table: Record<string, string>): string | null {
  const lower = raw.toLowerCase().trim();
  if (table[lower]) return table[lower];
  for (const [needle, canonical] of Object.entries(table)) {
    if (lower.includes(needle)) return canonical;
  }
  return null;
}

/**
 * Coerce a raw extracted value to the canonical form for a field. Returns
 * `null` when the value cannot be confidently normalized (so we don't persist
 * garbage and keep the field open).
 */
export function normalizeEmmaFieldValue(
  key: EmmaFieldKey,
  value: unknown,
): string | number | null {
  if (value === null || value === undefined) return null;

  switch (key) {
    case 'name': {
      const s = String(value).trim();
      if (!s || s.length > 80) return null;
      return s
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    case 'email': {
      const s = String(value).trim().toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
    }
    case 'arrival_method':
      return matchSynonym(String(value), ARRIVAL_SYNONYMS);
    case 'activity_interest':
      return matchSynonym(String(value), ACTIVITY_SYNONYMS);
    case 'journey_rating': {
      const n = typeof value === 'number' ? value : parseInt(String(value).replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
    }
    default:
      return null;
  }
}

/** Is a snapshot value considered "filled" (not null/empty)? */
export function isEmmaFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return Boolean(value);
}
