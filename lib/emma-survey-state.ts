/**
 * Emma Survey Field State
 *
 * Reads and writes Emma's incremental survey-field capture. The "snapshot" is
 * the union of:
 *   - durable columns on `emma_users` (name, email, arrival_method)
 *   - rows in `emma_survey_fields` (journey_rating, activity_interest, and any
 *     of the above captured before a user row existed)
 *
 * `getEmmaOpenFieldKeys` powers the field-flow planner so Emma asks only for
 * what is still missing — for both new and returning users.
 */

import { sql } from './db';
import {
  EMMA_REQUIRED_FIELD_ORDER,
  isEmmaFieldFilled,
  normalizeEmmaFieldValue,
  type EmmaFieldKey,
} from './emma-fields';

export type EmmaSnapshot = Partial<Record<EmmaFieldKey, string | number>>;

/** Build the merged field snapshot for a user. */
export async function getEmmaSnapshot(userId: string): Promise<EmmaSnapshot> {
  const snapshot: EmmaSnapshot = {};

  const userRows = await sql`
    SELECT name, email, arrival_method FROM emma_users WHERE id = ${userId}
  `;
  const user = userRows[0] as
    | { name: string | null; email: string | null; arrival_method: string | null }
    | undefined;
  if (user) {
    if (isEmmaFieldFilled(user.name)) snapshot.name = user.name as string;
    if (isEmmaFieldFilled(user.email)) snapshot.email = user.email as string;
    if (isEmmaFieldFilled(user.arrival_method)) {
      snapshot.arrival_method = user.arrival_method as string;
    }
  }

  const fieldRows = (await sql`
    SELECT field_key, value_text, status
    FROM emma_survey_fields
    WHERE user_id = ${userId}
  `) as { field_key: string; value_text: string | null; status: string }[];

  for (const row of fieldRows) {
    if (row.status === 'declined') continue;
    const key = row.field_key as EmmaFieldKey;
    if (!EMMA_REQUIRED_FIELD_ORDER.includes(key)) continue;
    if (row.value_text === null || row.value_text === '') continue;
    if (key === 'journey_rating') {
      const n = Number(row.value_text);
      if (Number.isFinite(n)) snapshot[key] = n;
    } else {
      snapshot[key] = row.value_text;
    }
  }

  return snapshot;
}

/**
 * Open field keys = required fields not yet filled. When there is no user yet
 * (brand-new visitor), everything is open.
 */
export async function getEmmaOpenFieldKeys(
  userId: string | null | undefined,
): Promise<EmmaFieldKey[]> {
  if (!userId) return [...EMMA_REQUIRED_FIELD_ORDER];
  const snapshot = await getEmmaSnapshot(userId);
  return EMMA_REQUIRED_FIELD_ORDER.filter((k) => !isEmmaFieldFilled(snapshot[k]));
}

/**
 * Persist a single survey field. Writes to `emma_users` for the columns that
 * live there, and always mirrors into `emma_survey_fields` so the planner has
 * one consistent source. Values are normalized; un-normalizable values are
 * skipped (field stays open).
 */
export async function saveEmmaField(params: {
  userId: string;
  key: EmmaFieldKey;
  value: unknown;
  sourceMessageId?: string | null;
  confidence?: number;
}): Promise<boolean> {
  const normalized = normalizeEmmaFieldValue(params.key, params.value);
  if (normalized === null) return false;

  const valueText = String(normalized);

  // Mirror into emma_users for the durable identity columns.
  if (params.key === 'name') {
    await sql`UPDATE emma_users SET name = ${valueText}, updated_at = NOW() WHERE id = ${params.userId}`;
  } else if (params.key === 'email') {
    await sql`UPDATE emma_users SET email = ${valueText}, updated_at = NOW() WHERE id = ${params.userId}`;
  } else if (params.key === 'arrival_method') {
    await sql`UPDATE emma_users SET arrival_method = ${valueText}, updated_at = NOW() WHERE id = ${params.userId}`;
  }

  await sql`
    INSERT INTO emma_survey_fields (user_id, field_key, value_text, status, source_message_id, confidence)
    VALUES (${params.userId}, ${params.key}, ${valueText}, 'filled', ${params.sourceMessageId ?? null}, ${params.confidence ?? null})
    ON CONFLICT (user_id, field_key)
    DO UPDATE SET value_text = EXCLUDED.value_text, status = 'filled',
                  source_message_id = EXCLUDED.source_message_id,
                  confidence = EXCLUDED.confidence, updated_at = NOW()
  `;
  return true;
}

/** Apply a batch of extracted field values; returns the keys actually saved. */
export async function applyEmmaFieldUpdates(params: {
  userId: string;
  updates: Partial<Record<EmmaFieldKey, unknown>>;
  sourceMessageId?: string | null;
  confidence?: number;
}): Promise<EmmaFieldKey[]> {
  const saved: EmmaFieldKey[] = [];
  for (const [key, value] of Object.entries(params.updates) as [EmmaFieldKey, unknown][]) {
    if (!EMMA_REQUIRED_FIELD_ORDER.includes(key)) continue;
    const ok = await saveEmmaField({
      userId: params.userId,
      key,
      value,
      sourceMessageId: params.sourceMessageId,
      confidence: params.confidence,
    });
    if (ok) saved.push(key);
  }
  return saved;
}
