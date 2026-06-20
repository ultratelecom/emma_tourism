/**
 * Ava Database Layer
 *
 * Thin CRUD over ava_users, ava_profile_fields, ava_notes, ava_entities,
 * plus a single `applyExtractionResult()` helper that takes an
 * ExtractionResult (from lib/ava-extract) and persists all of it.
 *
 * Scalar fields (text, enum, yes_no_maybe, scale_1_5) go to value_text.
 * Multi-valued fields (enum_multi) go to value_json as a JSON array.
 *
 * All writes are idempotent where possible: profile fields upsert by
 * (user_id, field_key); entities upsert by (user_id, kind, name) and
 * increment mention_count on repeat mentions.
 */

import { sql } from './db';
import {
  AVA_PROFILE_FIELDS,
  isAvaFieldDependencyMet,
  type AvaProfileFieldSpec,
} from './ava-config';
import type {
  ExtractionResult,
  ExtractedEntity,
  ExtractedEntityKind,
  ExtractedNote,
  ExtractedProfileUpdate,
} from './ava-extract';

// ============================================
// TYPES
// ============================================

export interface AvaUser {
  id: string;
  name: string;
  email: string | null;
  first_seen_at: Date;
  last_seen_at: Date;
  visit_count: number;
  profile_completion: number;
  last_chapter_id: string | null;
  declined_fields: string[];
  profile_summary: string | null;
  migrated_from_emma: boolean;
  legacy_personality_tags: string[] | null;
  legacy_personality_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AvaProfileField {
  id: string;
  user_id: string;
  field_key: string;
  value_text: string | null;
  value_json: unknown;
  confidence: number | null;
  evidence: string | null;
  status: 'filled' | 'declined';
  source_message_id: string | null;
  extracted_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AvaNote {
  id: string;
  user_id: string;
  content: string;
  tags: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  source_message_id: string | null;
  extracted_by: string | null;
  created_at: Date;
}

export interface AvaEntity {
  id: string;
  user_id: string;
  kind: ExtractedEntityKind;
  name: string;
  first_quote: string | null;
  mention_count: number;
  first_mentioned_at: Date;
  last_mentioned_at: Date;
}

export interface AvaSession {
  id: string;
  user_id: string;
  session_token: string;
  status: 'active' | 'paused' | 'complete' | 'abandoned';
  current_chapter_id: string | null;
  turn_count: number;
  started_at: Date;
  last_turn_at: Date;
  ended_at: Date | null;
}

export interface AvaMessage {
  id: string;
  session_id: string;
  user_id: string;
  sender: 'user' | 'ava';
  content: string;
  turn_index: number;
  is_system_delivered: boolean;
  model_provider: string | null;
  model_id: string | null;
  chapter_id: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: Date;
}

// ============================================
// USERS
// ============================================

export async function getAvaUserById(id: string): Promise<AvaUser | null> {
  const rows = await sql`SELECT * FROM ava_users WHERE id = ${id}`;
  return (rows[0] as AvaUser) ?? null;
}

export async function getAvaUserByEmail(email: string): Promise<AvaUser | null> {
  const rows = await sql`SELECT * FROM ava_users WHERE email = ${email}`;
  return (rows[0] as AvaUser) ?? null;
}

export async function createAvaUser(input: {
  name: string;
  email?: string | null;
}): Promise<AvaUser> {
  const rows = await sql`
    INSERT INTO ava_users (name, email)
    VALUES (${input.name}, ${input.email ?? null})
    RETURNING *
  `;
  return rows[0] as AvaUser;
}

export async function touchAvaUser(userId: string): Promise<void> {
  await sql`
    UPDATE ava_users
    SET last_seen_at = NOW(),
        visit_count = visit_count + 1
    WHERE id = ${userId}
  `;
}

export async function setAvaUserChapter(
  userId: string,
  chapterId: string,
): Promise<void> {
  await sql`
    UPDATE ava_users SET last_chapter_id = ${chapterId} WHERE id = ${userId}
  `;
}

export async function recomputeProfileCompletion(userId: string): Promise<number> {
  const totalFields = Object.keys(AVA_PROFILE_FIELDS).length;
  const rows = await sql`
    SELECT COUNT(*)::int AS c
    FROM ava_profile_fields
    WHERE user_id = ${userId} AND status = 'filled'
  `;
  const filled = (rows[0] as { c: number }).c;
  const completion = Math.min(1, filled / totalFields);
  await sql`
    UPDATE ava_users SET profile_completion = ${completion} WHERE id = ${userId}
  `;
  return completion;
}

// ============================================
// PROFILE FIELDS
// ============================================

function splitValueForSpec(
  spec: AvaProfileFieldSpec,
  value: ExtractedProfileUpdate['value'],
): { value_text: string | null; value_json: unknown } {
  if (value === null || value === undefined) return { value_text: null, value_json: null };

  if (spec.type === 'enum_multi') {
    const arr = Array.isArray(value) ? value : [String(value)];
    return { value_text: null, value_json: arr };
  }

  if (spec.type === 'scale_1_5') {
    return { value_text: String(value), value_json: null };
  }

  return { value_text: String(value), value_json: null };
}

export async function upsertProfileField(params: {
  userId: string;
  fieldKey: string;
  value: ExtractedProfileUpdate['value'];
  confidence: number;
  evidence: string;
  sourceMessageId?: string | null;
  extractedBy?: string | null;
}): Promise<AvaProfileField | null> {
  const spec = AVA_PROFILE_FIELDS[params.fieldKey];
  if (!spec) return null;

  const { value_text, value_json } = splitValueForSpec(spec, params.value);

  // For enum_multi fields, MERGE new values with existing array instead of overwriting.
  // This fixes AC-12, AC-14, AC-17 from the swarm assessment.
  if (spec.type === 'enum_multi' && value_json && Array.isArray(value_json)) {
    const rows = await sql`
      INSERT INTO ava_profile_fields (
        user_id, field_key, value_text, value_json, confidence, evidence,
        status, source_message_id, extracted_by
      ) VALUES (
        ${params.userId},
        ${params.fieldKey},
        ${value_text},
        ${JSON.stringify(value_json)}::jsonb,
        ${params.confidence},
        ${params.evidence},
        'filled',
        ${params.sourceMessageId ?? null},
        ${params.extractedBy ?? null}
      )
      ON CONFLICT (user_id, field_key) DO UPDATE SET
        value_json = (
          SELECT jsonb_agg(DISTINCT value ORDER BY value)
          FROM (
            SELECT jsonb_array_elements_text(
              COALESCE(ava_profile_fields.value_json, '[]'::jsonb)
            ) AS value
            UNION ALL
            SELECT jsonb_array_elements_text(EXCLUDED.value_json) AS value
          ) merged
          WHERE value IS NOT NULL AND value <> ''
        ),
        value_text = (
          SELECT string_agg(DISTINCT value, ', ' ORDER BY value)
          FROM (
            SELECT jsonb_array_elements_text(
              COALESCE(ava_profile_fields.value_json, '[]'::jsonb)
            ) AS value
            UNION ALL
            SELECT jsonb_array_elements_text(EXCLUDED.value_json) AS value
          ) merged
          WHERE value IS NOT NULL AND value <> ''
        ),
        confidence = GREATEST(ava_profile_fields.confidence, EXCLUDED.confidence),
        evidence = ava_profile_fields.evidence || ' | ' || EXCLUDED.evidence,
        status = 'filled',
        source_message_id = EXCLUDED.source_message_id,
        extracted_by = EXCLUDED.extracted_by,
        updated_at = NOW()
      RETURNING *
    `;
    return rows[0] as AvaProfileField;
  }

  // For all other field types (text, enum, yes_no_maybe, scale_1_5), overwrite as before.
  const rows = await sql`
    INSERT INTO ava_profile_fields (
      user_id, field_key, value_text, value_json, confidence, evidence,
      status, source_message_id, extracted_by
    ) VALUES (
      ${params.userId},
      ${params.fieldKey},
      ${value_text},
      ${value_json ? JSON.stringify(value_json) : null}::jsonb,
      ${params.confidence},
      ${params.evidence},
      'filled',
      ${params.sourceMessageId ?? null},
      ${params.extractedBy ?? null}
    )
    ON CONFLICT (user_id, field_key) DO UPDATE SET
      value_text = EXCLUDED.value_text,
      value_json = EXCLUDED.value_json,
      confidence = EXCLUDED.confidence,
      evidence = EXCLUDED.evidence,
      status = 'filled',
      source_message_id = EXCLUDED.source_message_id,
      extracted_by = EXCLUDED.extracted_by,
      updated_at = NOW()
    RETURNING *
  `;
  return rows[0] as AvaProfileField;
}

export async function markFieldDeclined(
  userId: string,
  fieldKey: string,
): Promise<void> {
  if (!AVA_PROFILE_FIELDS[fieldKey]) return;
  await sql`
    INSERT INTO ava_profile_fields (user_id, field_key, status)
    VALUES (${userId}, ${fieldKey}, 'declined')
    ON CONFLICT (user_id, field_key) DO UPDATE SET
      status = 'declined',
      updated_at = NOW()
  `;
  await sql`
    UPDATE ava_users
    SET declined_fields = ARRAY(
      SELECT DISTINCT unnest(declined_fields || ARRAY[${fieldKey}])
    )
    WHERE id = ${userId}
  `;
}

export async function getProfileFields(userId: string): Promise<AvaProfileField[]> {
  const rows = await sql`
    SELECT * FROM ava_profile_fields
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows as AvaProfileField[];
}

/**
 * Collapse the profile into a flat map of { field_key → value } for the
 * chapter router and for context injection into Ava's chat prompt.
 */
export async function getProfileSnapshot(
  userId: string,
): Promise<Record<string, string | string[] | number | null>> {
  const rows = await getProfileFields(userId);
  const snapshot: Record<string, string | string[] | number | null> = {};
  for (const row of rows) {
    if (row.status === 'declined') {
      snapshot[row.field_key] = null;
      continue;
    }
    const spec = AVA_PROFILE_FIELDS[row.field_key];
    if (!spec) continue;
    if (spec.type === 'enum_multi') {
      snapshot[row.field_key] = Array.isArray(row.value_json)
        ? (row.value_json as string[])
        : [];
    } else if (spec.type === 'scale_1_5') {
      snapshot[row.field_key] = row.value_text ? Number(row.value_text) : null;
    } else {
      snapshot[row.field_key] = row.value_text;
    }
  }
  return snapshot;
}

/**
 * Which fields are still open (not filled, not declined)?
 */
export async function getOpenFieldKeys(userId: string): Promise<string[]> {
  const rows = await sql`
    SELECT field_key FROM ava_profile_fields WHERE user_id = ${userId}
  `;
  const taken = new Set((rows as { field_key: string }[]).map((r) => r.field_key));
  const snapshot = await getProfileSnapshot(userId);
  return Object.entries(AVA_PROFILE_FIELDS)
    .filter(([k, spec]) => !taken.has(k) && isAvaFieldDependencyMet(spec, snapshot))
    .map(([k]) => k);
}

// ============================================
// NOTES
// ============================================

export async function insertNote(params: {
  userId: string;
  content: string;
  tags?: string[];
  sentiment?: ExtractedNote['sentiment'];
  sourceMessageId?: string | null;
  extractedBy?: string | null;
}): Promise<AvaNote> {
  const rows = await sql`
    INSERT INTO ava_notes (
      user_id, content, tags, sentiment, source_message_id, extracted_by
    ) VALUES (
      ${params.userId},
      ${params.content},
      ${params.tags ?? []},
      ${params.sentiment ?? null},
      ${params.sourceMessageId ?? null},
      ${params.extractedBy ?? null}
    )
    RETURNING *
  `;
  return rows[0] as AvaNote;
}

export async function getNotes(
  userId: string,
  limit = 50,
): Promise<AvaNote[]> {
  const rows = await sql`
    SELECT * FROM ava_notes
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows as AvaNote[];
}

// ============================================
// ENTITIES
// ============================================

export async function upsertEntity(params: {
  userId: string;
  kind: ExtractedEntityKind;
  name: string;
  firstQuote?: string;
}): Promise<AvaEntity> {
  const rows = await sql`
    INSERT INTO ava_entities (user_id, kind, name, first_quote, mention_count)
    VALUES (${params.userId}, ${params.kind}, ${params.name}, ${params.firstQuote ?? null}, 1)
    ON CONFLICT (user_id, kind, name) DO UPDATE SET
      mention_count = ava_entities.mention_count + 1,
      last_mentioned_at = NOW()
    RETURNING *
  `;
  return rows[0] as AvaEntity;
}

export async function getEntities(
  userId: string,
  opts?: { kind?: ExtractedEntityKind; limit?: number },
): Promise<AvaEntity[]> {
  if (opts?.kind) {
    const rows = await sql`
      SELECT * FROM ava_entities
      WHERE user_id = ${userId} AND kind = ${opts.kind}
      ORDER BY mention_count DESC, last_mentioned_at DESC
      LIMIT ${opts?.limit ?? 100}
    `;
    return rows as AvaEntity[];
  }
  const rows = await sql`
    SELECT * FROM ava_entities
    WHERE user_id = ${userId}
    ORDER BY mention_count DESC, last_mentioned_at DESC
    LIMIT ${opts?.limit ?? 100}
  `;
  return rows as AvaEntity[];
}

// ============================================
// APPLY EXTRACTION RESULT (one-shot persistence)
// ============================================

export interface ApplyExtractionOptions {
  userId: string;
  extraction: ExtractionResult;
  sourceMessageId?: string | null;
  /** Minimum confidence to accept a profile update. Default 0.5. */
  minConfidence?: number;
}

export interface ApplyExtractionSummary {
  profile_fields_written: number;
  profile_fields_skipped_low_confidence: number;
  entities_written: number;
  notes_written: number;
  profile_completion: number;
}

export async function applyExtractionResult(
  opts: ApplyExtractionOptions,
): Promise<ApplyExtractionSummary> {
  const minConfidence = opts.minConfidence ?? 0.5;
  const extractedBy = `${opts.extraction.model_info.provider}/${opts.extraction.model_info.modelId}`;

  let profile_fields_written = 0;
  let profile_fields_skipped_low_confidence = 0;

  for (const update of opts.extraction.profile_updates) {
    if (update.confidence < minConfidence) {
      profile_fields_skipped_low_confidence++;
      continue;
    }
    const spec = AVA_PROFILE_FIELDS[update.field_key];
    if (!spec) continue;

    const row = await upsertProfileField({
      userId: opts.userId,
      fieldKey: update.field_key,
      value: update.value,
      confidence: update.confidence,
      evidence: update.evidence,
      sourceMessageId: opts.sourceMessageId ?? null,
      extractedBy,
    });
    if (row) profile_fields_written++;
  }

  let entities_written = 0;
  for (const e of opts.extraction.entities as ExtractedEntity[]) {
    await upsertEntity({
      userId: opts.userId,
      kind: e.kind,
      name: e.name,
      firstQuote: e.quote,
    });
    entities_written++;
  }

  let notes_written = 0;
  for (const n of opts.extraction.notes as ExtractedNote[]) {
    await insertNote({
      userId: opts.userId,
      content: n.content,
      tags: n.tags,
      sentiment: n.sentiment,
      sourceMessageId: opts.sourceMessageId ?? null,
      extractedBy,
    });
    notes_written++;
  }

  const profile_completion = await recomputeProfileCompletion(opts.userId);

  return {
    profile_fields_written,
    profile_fields_skipped_low_confidence,
    entities_written,
    notes_written,
    profile_completion,
  };
}

// ============================================
// SESSIONS
// ============================================

function randomSessionToken(): string {
  // 32 bytes of randomness, hex-encoded → 64 chars, fits session_token VARCHAR(64)
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createAvaSession(params: {
  userId: string;
  initialChapterId?: string;
}): Promise<AvaSession> {
  const token = randomSessionToken();
  const rows = await sql`
    INSERT INTO ava_sessions (user_id, session_token, current_chapter_id)
    VALUES (${params.userId}, ${token}, ${params.initialChapterId ?? null})
    RETURNING *
  `;
  return rows[0] as AvaSession;
}

export async function getAvaSessionByToken(token: string): Promise<AvaSession | null> {
  const rows = await sql`SELECT * FROM ava_sessions WHERE session_token = ${token}`;
  return (rows[0] as AvaSession) ?? null;
}

export async function getAvaSessionById(id: string): Promise<AvaSession | null> {
  const rows = await sql`SELECT * FROM ava_sessions WHERE id = ${id}`;
  return (rows[0] as AvaSession) ?? null;
}

export async function getLatestActiveSession(
  userId: string,
): Promise<AvaSession | null> {
  const rows = await sql`
    SELECT * FROM ava_sessions
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY last_turn_at DESC
    LIMIT 1
  `;
  return (rows[0] as AvaSession) ?? null;
}

export async function setSessionChapter(
  sessionId: string,
  chapterId: string,
): Promise<void> {
  await sql`
    UPDATE ava_sessions SET current_chapter_id = ${chapterId} WHERE id = ${sessionId}
  `;
}

export async function setSessionStatus(
  sessionId: string,
  status: AvaSession['status'],
): Promise<void> {
  const endedAt = status === 'complete' || status === 'abandoned' ? new Date() : null;
  await sql`
    UPDATE ava_sessions
    SET status = ${status},
        ended_at = ${endedAt ? endedAt.toISOString() : null}
    WHERE id = ${sessionId}
  `;
}

// ============================================
// MESSAGES
// ============================================

export async function insertUserMessage(params: {
  sessionId: string;
  userId: string;
  content: string;
  turnIndex: number;
}): Promise<AvaMessage> {
  const rows = await sql`
    INSERT INTO ava_messages (session_id, user_id, sender, content, turn_index)
    VALUES (${params.sessionId}, ${params.userId}, 'user', ${params.content}, ${params.turnIndex})
    RETURNING *
  `;
  return rows[0] as AvaMessage;
}

export async function insertAvaMessage(params: {
  sessionId: string;
  userId: string;
  content: string;
  turnIndex: number;
  isSystemDelivered?: boolean;
  modelProvider?: string | null;
  modelId?: string | null;
  chapterId?: string | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): Promise<AvaMessage> {
  const rows = await sql`
    INSERT INTO ava_messages (
      session_id, user_id, sender, content, turn_index,
      is_system_delivered, model_provider, model_id, chapter_id,
      latency_ms, input_tokens, output_tokens
    ) VALUES (
      ${params.sessionId},
      ${params.userId},
      'ava',
      ${params.content},
      ${params.turnIndex},
      ${params.isSystemDelivered ?? false},
      ${params.modelProvider ?? null},
      ${params.modelId ?? null},
      ${params.chapterId ?? null},
      ${params.latencyMs ?? null},
      ${params.inputTokens ?? null},
      ${params.outputTokens ?? null}
    )
    RETURNING *
  `;
  return rows[0] as AvaMessage;
}

export async function getSessionMessages(
  sessionId: string,
  opts?: { limit?: number },
): Promise<AvaMessage[]> {
  const rows = await sql`
    SELECT * FROM ava_messages
    WHERE session_id = ${sessionId}
    ORDER BY turn_index ASC
    LIMIT ${opts?.limit ?? 200}
  `;
  return rows as AvaMessage[];
}

/**
 * Get the last N messages for a session, chronological oldest-first.
 * Used to build the rolling conversation window for the chat model.
 */
export async function getRecentMessages(
  sessionId: string,
  n: number,
): Promise<AvaMessage[]> {
  const rows = await sql`
    SELECT * FROM (
      SELECT * FROM ava_messages
      WHERE session_id = ${sessionId}
      ORDER BY turn_index DESC
      LIMIT ${n}
    ) sub
    ORDER BY turn_index ASC
  `;
  return rows as AvaMessage[];
}

/**
 * Return every message in a session, turn_index ascending. Use this for
 * the chat lane so the model has the full conversation to reason over,
 * not just a trailing window. Optional limit for performance (e.g., resume
 * only needs recent 50 messages).
 */
export async function getFullSessionHistory(
  sessionId: string,
  limit?: number,
): Promise<AvaMessage[]> {
  if (limit && limit > 0) {
    // When limit is set, return the MOST RECENT N messages (DESC then reverse).
    const rows = await sql`
      SELECT * FROM ava_messages
      WHERE session_id = ${sessionId}
      ORDER BY turn_index DESC
      LIMIT ${limit}
    `;
    return (rows as AvaMessage[]).reverse();
  }
  const rows = await sql`
    SELECT * FROM ava_messages
    WHERE session_id = ${sessionId}
    ORDER BY turn_index ASC
  `;
  return rows as AvaMessage[];
}

/**
 * Next turn_index to use for a given session. Starts at 0.
 */
export async function getNextTurnIndex(sessionId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(MAX(turn_index), -1) + 1 AS next_turn
    FROM ava_messages
    WHERE session_id = ${sessionId}
  `;
  return (rows[0] as { next_turn: number }).next_turn;
}
