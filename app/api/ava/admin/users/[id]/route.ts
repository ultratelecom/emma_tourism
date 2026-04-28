/**
 * GET /api/ava/admin/users/[id]
 *
 * Full portrait of a single ava_user: profile snapshot with every field
 * (filled + declined + open), every entity, every note, every session
 * and its messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAvaUserById,
  getEntities,
  getNotes,
  getProfileFields,
} from '@/lib/ava-db';
import { AVA_PROFILE_FIELDS } from '@/lib/ava-config';
import { sql } from '@/lib/db';

interface SessionRow {
  id: string;
  status: string;
  current_chapter_id: string | null;
  turn_count: number;
  started_at: string | Date;
  last_turn_at: string | Date;
  ended_at: string | Date | null;
}

interface MessageRow {
  id: string;
  session_id: string;
  sender: string;
  content: string;
  turn_index: number;
  is_system_delivered: boolean;
  chapter_id: string | null;
  latency_ms: number | null;
  created_at: string | Date;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await getAvaUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    const [fields, entities, notes, sessions, messages] = await Promise.all([
      getProfileFields(id),
      getEntities(id, { limit: 500 }),
      getNotes(id, 500),
      sql`
        SELECT id, status, current_chapter_id, turn_count,
               started_at, last_turn_at, ended_at
        FROM ava_sessions WHERE user_id = ${id}
        ORDER BY started_at DESC
      ` as unknown as Promise<SessionRow[]>,
      sql`
        SELECT id, session_id, sender, content, turn_index,
               is_system_delivered, chapter_id, latency_ms, created_at
        FROM ava_messages WHERE user_id = ${id}
        ORDER BY created_at ASC
      ` as unknown as Promise<MessageRow[]>,
    ]);

    // Build a complete profile view: every key in AVA_PROFILE_FIELDS,
    // plus its status (filled / declined / open) and value.
    const byKey = new Map(fields.map((f) => [f.field_key, f]));
    const profile = Object.entries(AVA_PROFILE_FIELDS).map(([key, spec]) => {
      const row = byKey.get(key);
      let value: unknown = null;
      if (row?.status === 'filled') {
        if (spec.type === 'enum_multi') value = row.value_json;
        else if (spec.type === 'scale_1_5') value = row.value_text ? Number(row.value_text) : null;
        else value = row.value_text;
      }
      return {
        key,
        layer: spec.layer,
        type: spec.type,
        label: spec.natural_prompt,
        status: row?.status ?? 'open',
        value,
        confidence: row?.confidence ?? null,
        evidence: row?.evidence ?? null,
        updated_at: row?.updated_at ?? null,
      };
    });

    return NextResponse.json({
      user,
      profile,
      entities,
      notes,
      sessions,
      messages,
    });
  } catch (err) {
    console.error('[ava/admin/users/[id] GET] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'admin_user_failed' },
      { status: 500 },
    );
  }
}
