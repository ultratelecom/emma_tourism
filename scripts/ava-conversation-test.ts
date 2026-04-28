/**
 * Ava full-conversation smoke test
 *
 * Runs a scripted 4-turn conversation through the real orchestrator
 * (`openOrResumeSession` + `runTurn`), exercising the entire stack:
 *
 *   - ava_users / ava_sessions / ava_messages writes
 *   - deterministic opener on turn 0
 *   - chat model for every subsequent reply
 *   - parallel extraction into ava_profile_fields / ava_notes / ava_entities
 *   - chapter routing based on still-open field keys
 *   - session chapter updates
 *
 * Cleans up at the end unless --keep is passed.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/ava-conversation-test.ts
 *   npx tsx --env-file=.env.local scripts/ava-conversation-test.ts --keep
 */

import { openOrResumeSession, runTurn } from '../lib/ava-session';
import {
  getEntities,
  getNotes,
  getProfileSnapshot,
  getSessionMessages,
} from '../lib/ava-db';
import { sql } from '../lib/db';

const SCRIPT: string[] = [
  "Marcus. Writing from Toronto. My grandmother grew up in Castara. Haven't been home in 20 years.",
  "I'm a paediatric nurse, about twelve years in. Three kids, youngest just hit his teens.",
  "Honestly? Maybe twice a year if I'm lucky. I feel the distance every time a cousin messages me about something big.",
  "If the structure was right I'd mentor young nurses back home, maybe help set up a clinic rotation. The barrier is I don't know anyone in the health ministry and I can't fly down on my own dime forever.",
];

function section(title: string) {
  console.log(`\n━━━ ${title} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

async function main() {
  const keep = process.argv.includes('--keep');
  const testEmail = `persist-test+${Date.now()}@ava.local`;

  section('open session');
  const open = await openOrResumeSession({
    name: 'Marcus (conversation-test)',
    email: testEmail,
  });
  console.log(`  user_id       = ${open.user.id}`);
  console.log(`  session_id    = ${open.session.id}`);
  console.log(`  session_token = ${open.session.session_token.slice(0, 16)}…`);
  console.log(`  is_returning  = ${open.is_returning}`);
  console.log(`\n  Ava (turn 0, system-delivered):\n    ${open.opener_message.content}`);

  for (let i = 0; i < SCRIPT.length; i++) {
    const msg = SCRIPT[i];
    section(`turn ${i + 1}`);
    console.log(`  User:\n    ${msg}`);

    const result = await runTurn({
      sessionId: open.session.id,
      userId: open.user.id,
      userMessage: msg,
    });

    // Chat reply is ready; print it immediately so the smoke test mirrors
    // real UX latency.
    console.log(`\n  Ava (turn ${result.turn_index}):\n    ${result.reply}`);
    console.log('\n  chat meta:');
    console.log(`    chapter          : ${result.chapter_id}${result.chapter_changed ? ' (changed)' : ''}`);
    console.log(`    chat latency     : ${result.chat_latency_ms}ms  ← time to first visible reply`);

    // Await the hidden extraction pass so the test script reports what
    // landed in the profile. In the live route this would run under
    // after() and not block the response.
    const summary = await result.finalize;
    console.log('\n  extraction meta (background):');
    console.log(`    extract latency  : ${summary.extraction_latency_ms}ms  (parse_ok=${summary.extraction_parse_ok})`);
    console.log(`    fields written   : ${summary.profile_fields_written}`);
    console.log(`    entities written : ${summary.entities_written}`);
    console.log(`    notes written    : ${summary.notes_written}`);
    console.log(`    completion       : ${(summary.profile_completion * 100).toFixed(1)}%`);
  }

  section('final state');
  const [snapshot, entities, notes, allMessages] = await Promise.all([
    getProfileSnapshot(open.user.id),
    getEntities(open.user.id),
    getNotes(open.user.id),
    getSessionMessages(open.session.id),
  ]);

  console.log(`  messages in session: ${allMessages.length}`);
  console.log('\n  profile snapshot:');
  for (const [k, v] of Object.entries(snapshot)) {
    const disp = Array.isArray(v) ? v.join(', ') : JSON.stringify(v);
    console.log(`    • ${k} = ${disp}`);
  }
  console.log(`\n  entities (${entities.length}):`);
  for (const e of entities) {
    console.log(`    • [${e.kind}] ${e.name}  (×${e.mention_count})`);
  }
  console.log(`\n  notes (${notes.length}):`);
  for (const n of notes) {
    const s = n.sentiment ? `[${n.sentiment}] ` : '';
    console.log(`    • ${s}${n.content}`);
  }

  section('teardown');
  if (keep) {
    console.log(`  --keep passed, leaving user ${open.user.id} and session ${open.session.id}.`);
  } else {
    await sql`DELETE FROM ava_users WHERE id = ${open.user.id}`;
    console.log('  test user deleted (cascaded through sessions/messages/fields/notes/entities).');
  }

  console.log('\n━━━ done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
