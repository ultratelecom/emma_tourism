'use client';

/**
 * Ava Admin Page
 *
 * Read-only view of every ava_user with a drawer-style drill-down into
 * their full profile: profile fields (with status + evidence),
 * entities, notes, sessions, and complete message history.
 *
 * Not linked from the public UI; intended for staff. Add auth before
 * shipping externally.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

interface UserSummary {
  id: string;
  name: string;
  email: string | null;
  profile_completion: number;
  last_seen_at: string;
  first_seen_at: string;
  visit_count: number;
  last_chapter_id: string | null;
  declined_fields: string[];
  field_count: number;
  entity_count: number;
  note_count: number;
  session_count: number;
}

interface ProfileRow {
  key: string;
  layer: string;
  type: string;
  label: string;
  status: 'filled' | 'declined' | 'open';
  value: unknown;
  confidence: number | null;
  evidence: string | null;
  updated_at: string | null;
}

interface EntityRow {
  id: string;
  kind: string;
  name: string;
  first_quote: string | null;
  mention_count: number;
  last_mentioned_at: string;
}

interface NoteRow {
  id: string;
  content: string;
  tags: string[];
  sentiment: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  status: string;
  current_chapter_id: string | null;
  turn_count: number;
  started_at: string;
  last_turn_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  sender: 'user' | 'ava';
  content: string;
  turn_index: number;
  is_system_delivered: boolean;
  chapter_id: string | null;
  latency_ms: number | null;
  created_at: string;
}

interface UserDetail {
  user: { id: string; name: string; email: string | null };
  profile: ProfileRow[];
  entities: EntityRow[];
  notes: NoteRow[];
  sessions: SessionRow[];
  messages: MessageRow[];
}

export default function AvaAdminPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ava/admin/users');
      if (!res.ok) throw new Error(`list failed (${res.status})`);
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/ava/admin/users/${id}`);
      if (!res.ok) throw new Error(`detail failed (${res.status})`);
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'detail failed');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const stats = useMemo(() => {
    if (!users.length) return null;
    const avgCompletion =
      users.reduce((s, u) => s + u.profile_completion, 0) / users.length;
    const totalSessions = users.reduce((s, u) => s + u.session_count, 0);
    const totalNotes = users.reduce((s, u) => s + u.note_count, 0);
    const totalEntities = users.reduce((s, u) => s + u.entity_count, 0);
    return { avgCompletion, totalSessions, totalNotes, totalEntities };
  }, [users]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:py-10">
      <header className="mb-8 border-b border-[var(--border)] pb-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-[var(--foreground)]">
              Ava · portraits
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {total} {total === 1 ? 'person' : 'people'} on record
            </p>
          </div>
          <button
            onClick={loadUsers}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:bg-[var(--card-hover)] hover:text-[var(--foreground)]"
          >
            Refresh
          </button>
        </div>

        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Avg completion" value={`${(stats.avgCompletion * 100).toFixed(0)}%`} />
            <StatCard label="Sessions" value={stats.totalSessions} />
            <StatCard label="Entities tracked" value={stats.totalEntities} />
            <StatCard label="Notes captured" value={stats.totalNotes} />
          </div>
        )}
      </header>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full max-w-md rounded-md border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--palm-dark)] focus:outline-none focus:ring-1 focus:ring-[var(--palm-dark)]"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--card-hover)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 font-normal">Name</th>
              <th className="px-4 py-3 font-normal">Email</th>
              <th className="px-4 py-3 font-normal">Chapter</th>
              <th className="px-4 py-3 font-normal text-right">Completion</th>
              <th className="px-4 py-3 font-normal text-right">Fields</th>
              <th className="px-4 py-3 font-normal text-right">Entities</th>
              <th className="px-4 py-3 font-normal text-right">Notes</th>
              <th className="px-4 py-3 font-normal text-right">Visits</th>
              <th className="px-4 py-3 font-normal text-right">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--muted)]">
                  Loading portraits…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--muted)]">
                  No portraits yet. Send someone to /ava and come back.
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr
                key={u.id}
                onClick={() => openDetail(u.id)}
                className="cursor-pointer border-b border-[var(--border)] transition last:border-0 hover:bg-[var(--card-hover)]"
              >
                <td className="px-4 py-3 font-[family-name:var(--font-serif)] text-[var(--foreground)]">
                  {u.name}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{u.email ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {u.last_chapter_id ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <CompletionBar value={u.profile_completion} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground)]">
                  {u.field_count}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground)]">
                  {u.entity_count}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--foreground)]">
                  {u.note_count}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                  {u.visit_count}
                </td>
                <td className="px-4 py-3 text-right text-xs text-[var(--muted)]">
                  {relativeTime(u.last_seen_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <DetailDrawer
          loading={detailLoading}
          detail={detail}
          onClose={() => {
            setSelectedId(null);
            setDetail(null);
          }}
        />
      )}
    </main>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 font-[family-name:var(--font-playfair)] text-2xl text-[var(--foreground)]">
        {value}
      </div>
    </div>
  );
}

function CompletionBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="inline-flex items-center gap-2">
      <span className="tabular-nums text-[var(--foreground)]">{pct}%</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full bg-gradient-to-r from-[#2d5f4e] to-[#0abde3]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DetailDrawer({
  loading,
  detail,
  onClose,
}: {
  loading: boolean;
  detail: UserDetail | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-[var(--background)] shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-6 py-4">
          <h2 className="font-[family-name:var(--font-playfair)] text-xl text-[var(--foreground)]">
            {detail?.user.name ?? 'Loading…'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-sm text-[var(--muted)] hover:bg-[var(--card-hover)]"
          >
            Close
          </button>
        </div>

        {loading && (
          <div className="flex flex-1 items-center justify-center text-[var(--muted)]">
            Loading portrait…
          </div>
        )}

        {detail && (
          <div className="space-y-8 px-6 py-6">
            {detail.user.email && (
              <p className="text-sm text-[var(--muted)]">{detail.user.email}</p>
            )}

            <Section title="Profile fields">
              <div className="divide-y divide-[var(--border)]">
                {detail.profile.map((f) => (
                  <div key={f.key} className="flex items-start gap-3 py-3">
                    <div className="w-1/3 text-xs uppercase tracking-wide text-[var(--muted)]">
                      {f.key}
                    </div>
                    <div className="flex-1">
                      <div className="font-[family-name:var(--font-serif)] text-[var(--foreground)]">
                        {f.status === 'filled' ? (
                          <span>{formatValue(f.value)}</span>
                        ) : f.status === 'declined' ? (
                          <span className="italic text-[var(--muted)]">declined</span>
                        ) : (
                          <span className="italic text-[var(--muted)]">open</span>
                        )}
                      </div>
                      {f.evidence && (
                        <div className="mt-1 text-xs italic text-[var(--muted)]">
                          &ldquo;{f.evidence}&rdquo;
                          {f.confidence != null && ` · conf ${f.confidence.toFixed(2)}`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={`Entities (${detail.entities.length})`}>
              <div className="flex flex-wrap gap-2">
                {detail.entities.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">None yet.</p>
                )}
                {detail.entities.map((e) => (
                  <span
                    key={e.id}
                    className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--foreground)]"
                  >
                    <span className="text-[var(--muted)]">{e.kind}:</span> {e.name}
                    {e.mention_count > 1 && (
                      <span className="ml-1 text-[var(--muted)]">×{e.mention_count}</span>
                    )}
                  </span>
                ))}
              </div>
            </Section>

            <Section title={`Notes (${detail.notes.length})`}>
              <div className="space-y-3">
                {detail.notes.length === 0 && (
                  <p className="text-sm text-[var(--muted)]">None yet.</p>
                )}
                {detail.notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3"
                  >
                    <div className="font-[family-name:var(--font-serif)] text-sm text-[var(--foreground)]">
                      {n.content}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                      {n.sentiment && <span>[{n.sentiment}]</span>}
                      {n.tags.map((t) => (
                        <span key={t} className="rounded bg-[var(--card-hover)] px-1.5 py-0.5">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={`Sessions (${detail.sessions.length})`}>
              <div className="space-y-2">
                {detail.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
                  >
                    <span className="text-[var(--foreground)]">
                      {s.current_chapter_id ?? '—'}{' '}
                      <span className="ml-2 text-xs text-[var(--muted)]">[{s.status}]</span>
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {s.turn_count} turns · {relativeTime(s.last_turn_at)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={`Messages (${detail.messages.length})`}>
              <div className="max-h-96 space-y-2 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
                {detail.messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span
                      className={
                        m.sender === 'ava'
                          ? 'font-semibold text-[#2d5f4e] dark:text-[#5fcfb0]'
                          : 'font-semibold text-[var(--muted)]'
                      }
                    >
                      {m.sender === 'ava' ? 'Ava' : 'User'}:
                    </span>{' '}
                    <span className="text-[var(--foreground)]">{m.content}</span>
                    {m.is_system_delivered && (
                      <span className="ml-2 text-xs text-[var(--muted)]">(opener)</span>
                    )}
                    {m.latency_ms != null && (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        {m.latency_ms}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}
