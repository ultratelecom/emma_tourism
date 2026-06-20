/**
 * Emma Field-Flow Planner
 *
 * Deterministic "what should Emma ask next?" logic, mirroring Ava's
 * `lib/ava-graph/field-flow.ts`. Given the set of still-open field keys, it
 * picks the next required field and computes which (if any) client picker to
 * surface via stream headers.
 *
 * At most ONE picker is active at a time. `name` and `email` have no picker
 * (free-text chat); the other three drive multiple-choice selectors.
 */

import {
  EMMA_REQUIRED_FIELD_ORDER,
  EMMA_FIELDS,
  type EmmaFieldKey,
} from './emma-fields';

/**
 * The next field Emma should focus on collecting, or `null` if everything is
 * filled.
 */
export function chooseNextEmmaField(openFieldKeys: string[]): EmmaFieldKey | null {
  return (
    EMMA_REQUIRED_FIELD_ORDER.find((k) => openFieldKeys.includes(k)) ?? null
  );
}

export type EmmaPickerKind = 'arrival' | 'rating' | 'activity';

export type EmmaStreamElicitationHeaders = {
  elicitArrival: '0' | '1';
  elicitRating: '0' | '1';
  elicitActivity: '0' | '1';
};

const ZERO_HEADERS: EmmaStreamElicitationHeaders = {
  elicitArrival: '0',
  elicitRating: '0',
  elicitActivity: '0',
};

/**
 * Which client picker (if any) the current turn should show. Driven only by
 * the next open field, so it stays consistent with what Emma is asking.
 */
export function pickerForNextField(
  openFieldKeys: string[],
): EmmaPickerKind | null {
  const next = chooseNextEmmaField(openFieldKeys);
  if (!next) return null;
  return EMMA_FIELDS[next].picker;
}

export function computeStreamElicitationHeaders(
  openFieldKeys: string[],
): EmmaStreamElicitationHeaders {
  const picker = pickerForNextField(openFieldKeys);
  if (picker === 'arrival') return { ...ZERO_HEADERS, elicitArrival: '1' };
  if (picker === 'rating') return { ...ZERO_HEADERS, elicitRating: '1' };
  if (picker === 'activity') return { ...ZERO_HEADERS, elicitActivity: '1' };
  return { ...ZERO_HEADERS };
}
