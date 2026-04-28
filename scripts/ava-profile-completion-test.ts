/**
 * Ava scripted profile completion check.
 *
 * This is an end-to-end harness for the core survey intent path. It uses
 * the real session orchestrator and database, then asserts that the
 * required fields are present. It excludes admin/debug UI work.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/ava-profile-completion-test.ts
 */

import { openOrResumeSession, runTurn } from '../lib/ava-session';
import { getProfileSnapshot } from '../lib/ava-db';
import { sql } from '../lib/db';

const SCRIPT = [
  'Joshua',
  'New York',
  'Grandparents',
  'I lived in Tobago for about eight years, now I get back every few years.',
  'I consult for Verizon on complex rural network builds.',
  "For demographics, I'm 35-44, male, and my highest education is a master's degree.",
  "I still care a lot about Tobago's development, probably a 5.",
  'I would help with mentorship, advisory work, knowledge sharing, and maybe business partnerships.',
  'Maybe I would invest if the risks and returns were transparent.',
  'Tourism, renewable energy, agriculture, and small business would interest me.',
  'The biggest barriers are lack of information, trust, bureaucracy, time, and distance.',
  'I would value an investment dashboard, networking, mentorship programs, government updates, events, and strong data privacy.',
  'Trust would take transparency, clear governance, privacy, and proof that people actually follow through.',
  'I would join an advisory group, attend virtual meetings, answer future surveys, and maybe participate in pilots.',
  "Tobago's biggest opportunity is high-value tourism tied to agriculture, renewable energy, and digital work.",
];

const REQUIRED_FIELDS = [
  'current_location_text',
  'current_city_region',
  'current_country',
  'generation',
  'visit_frequency',
  'industry',
  'profession_text',
  'age_bracket',
  'gender',
  'education_level',
  'connection_score',
  'contribution_modes',
  'invest_intent',
  'invest_sectors',
  'barriers',
  'feature_priorities',
  'trust_text',
  'future_roles',
  'opportunity_text',
];

function missing(snapshot: Record<string, unknown>): string[] {
  return REQUIRED_FIELDS.filter((key) => {
    const value = snapshot[key];
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  });
}

async function main() {
  const testEmail = `profile-completion+${Date.now()}@ava.local`;
  const open = await openOrResumeSession({
    name: 'Joshua (profile-completion-test)',
    email: testEmail,
  });

  try {
    for (const userMessage of SCRIPT) {
      const result = await runTurn({
        sessionId: open.session.id,
        userId: open.user.id,
        userMessage,
      });
      await result.finalize;
    }

    const snapshot = await getProfileSnapshot(open.user.id);
    const missingFields = missing(snapshot);
    if (missingFields.length) {
      console.error('Profile snapshot:', snapshot);
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    console.log(`Ava profile completion test passed (${REQUIRED_FIELDS.length} required fields)`);
  } finally {
    await sql`DELETE FROM ava_users WHERE id = ${open.user.id}`;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
