/**
 * Ava end-to-end persistence smoke test
 *
 * Proves the full stack works end to end:
 *   1. create an ava_user
 *   2. run a real user message through the extractor (step-3.5-flash)
 *   3. persist the ExtractionResult via applyExtractionResult()
 *   4. read the profile snapshot, notes, and entities back
 *   5. clean up the test user (cascades delete everything)
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/ava-persist-test.ts
 *
 * Pass --keep to skip the teardown (useful for manual inspection in psql).
 */

import {
  applyExtractionResult,
  createAvaUser,
  getEntities,
  getNotes,
  getProfileSnapshot,
  type AvaUser,
} from '../lib/ava-db';
import { extractFromUserMessage } from '../lib/ava-extract';
import { sql } from '../lib/db';

const TEST_MESSAGE =
  "Marcus. Writing from Toronto. Been away a long time — my grandmother was Tobagonian, she grew up in Castara. I'm a paediatric nurse, about twelve years in. Last time I was home was 2019.";

function section(title: string) {
  console.log(`\n─── ${title} ──────────────────────────────────`);
}

async function main() {
  const keep = process.argv.includes('--keep');

  console.log('\n━━━ Ava · End-to-End Persistence Test ━━━━━━━━━━━━━━━');

  // --- 1. Create user -----------------------------------------------------
  section('1. create ava_user');
  const user: AvaUser = await createAvaUser({ name: 'Marcus (persist-test)' });
  console.log(`  user_id = ${user.id}`);
  console.log(`  name    = ${user.name}`);

  // --- 2. Extract from a real message -------------------------------------
  section('2. extract (step-3.5-flash)');
  console.log(`  message: ${TEST_MESSAGE}`);
  const started = Date.now();
  const extraction = await extractFromUserMessage({
    userMessage: TEST_MESSAGE,
    chapterId: 'introductions',
    openFieldKeys: [
      'current_country',
      'generation',
      'industry',
      'profession_text',
      'visit_frequency',
    ],
  });
  console.log(`  elapsed: ${Date.now() - started}ms`);
  console.log(`  parse_ok: ${extraction.parse_ok}`);
  console.log(`  model: ${extraction.model_info.provider}/${extraction.model_info.modelId}`);
  console.log(
    `  produced: ${extraction.profile_updates.length} fields, ${extraction.entities.length} entities, ${extraction.notes.length} notes`,
  );

  // --- 3. Persist ---------------------------------------------------------
  section('3. persist via applyExtractionResult()');
  const summary = await applyExtractionResult({
    userId: user.id,
    extraction,
    minConfidence: 0.5,
  });
  console.log('  summary:', JSON.stringify(summary, null, 2));

  // --- 4. Read back -------------------------------------------------------
  section('4. read back');
  const snapshot = await getProfileSnapshot(user.id);
  console.log('  profile snapshot:');
  for (const [k, v] of Object.entries(snapshot)) {
    const display = Array.isArray(v) ? v.join(', ') : JSON.stringify(v);
    console.log(`    • ${k} = ${display}`);
  }

  const entities = await getEntities(user.id);
  console.log(`\n  entities (${entities.length}):`);
  for (const e of entities) {
    console.log(`    • [${e.kind}] ${e.name}  (mentions: ${e.mention_count})`);
  }

  const notes = await getNotes(user.id);
  console.log(`\n  notes (${notes.length}):`);
  for (const n of notes) {
    const sent = n.sentiment ? `[${n.sentiment}] ` : '';
    console.log(`    • ${sent}${n.content}  {${n.tags.join(', ')}}`);
  }

  // --- 5. Cleanup ---------------------------------------------------------
  section('5. teardown');
  if (keep) {
    console.log('  --keep passed, leaving data in place.');
    console.log(`  inspect with:  SELECT * FROM ava_users WHERE id = '${user.id}';`);
  } else {
    await sql`DELETE FROM ava_users WHERE id = ${user.id}`;
    console.log('  test user deleted (cascaded through fields/notes/entities).');
  }

  console.log('\n━━━ done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
