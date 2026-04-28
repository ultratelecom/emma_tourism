/**
 * GET /api/ava/admin/users
 *
 * Admin/staff read-only endpoint. Returns every ava_user with a rollup
 * of their profile: completion %, filled field count, entity count,
 * note count, last seen. Sorted by last_seen_at DESC.
 *
 *   Response:
 *     {
 *       total: number,
 *       users: Array<{
 *         id, name, email, profile_completion, last_seen_at,
 *         visit_count, last_chapter_id,
 *         field_count, entity_count, note_count, session_count
 *       }>
 *     }
 *
 * GET /api/ava/admin/users/[id] is handled separately in [id]/route.ts.
 *
 * Access control for v1: unauthenticated. This endpoint is not linked
 * from the public UI. Put Vercel project-level auth on /ava/admin or
 * add a simple shared secret header before shipping.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  profile_completion: string | number;
  last_seen_at: string | Date;
  first_seen_at: string | Date;
  visit_count: number;
  last_chapter_id: string | null;
  declined_fields: string[] | null;
  field_count: number;
  entity_count: number;
  note_count: number;
  session_count: number;
}

export async function GET(_request: NextRequest) {
  try {
    const rows = (await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.profile_completion,
        u.last_seen_at,
        u.first_seen_at,
        u.visit_count,
        u.last_chapter_id,
        u.declined_fields,
        (SELECT COUNT(*)::int FROM ava_profile_fields WHERE user_id = u.id AND status = 'filled') AS field_count,
        (SELECT COUNT(*)::int FROM ava_entities WHERE user_id = u.id) AS entity_count,
        (SELECT COUNT(*)::int FROM ava_notes WHERE user_id = u.id) AS note_count,
        (SELECT COUNT(*)::int FROM ava_sessions WHERE user_id = u.id) AS session_count
      FROM ava_users u
      ORDER BY u.last_seen_at DESC
      LIMIT 500
    `) as UserRow[];

    const [{ c: total }] = (await sql`
      SELECT COUNT(*)::int AS c FROM ava_users
    `) as [{ c: number }];

    return NextResponse.json({
      total,
      users: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        profile_completion: Number(r.profile_completion),
        last_seen_at: r.last_seen_at,
        first_seen_at: r.first_seen_at,
        visit_count: r.visit_count,
        last_chapter_id: r.last_chapter_id,
        declined_fields: r.declined_fields ?? [],
        field_count: r.field_count,
        entity_count: r.entity_count,
        note_count: r.note_count,
        session_count: r.session_count,
      })),
    });
  } catch (err) {
    console.error('[ava/admin/users GET] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'admin_users_failed' },
      { status: 500 },
    );
  }
}
