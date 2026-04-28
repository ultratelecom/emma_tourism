/**
 * Model-free deterministic capture fixture check.
 *
 * Run:
 *   npx tsx scripts/ava-deterministic-capture-fixtures.ts
 */

import { AVA_EXTRACTION_FIXTURES } from '../lib/ava-extraction-fixtures';
import { deterministicCaptureFromTurn } from '../lib/ava-deterministic-capture';
import { detectAvaSpecifics, planAvaTurn } from '../lib/ava-turn-planner';
import type { AvaMessage } from '../lib/ava-db';

function makeLastAva(content: string): AvaMessage[] {
  return [
    {
      id: 'fixture-ava',
      session_id: 'fixture-session',
      user_id: 'fixture-user',
      sender: 'ava',
      content,
      turn_index: 2,
      is_system_delivered: false,
      model_provider: 'system',
      model_id: 'fixture',
      chapter_id: 'introductions',
      latency_ms: 0,
      input_tokens: null,
      output_tokens: null,
      created_at: new Date(),
    },
  ];
}

function fail(message: string): never {
  throw new Error(message);
}

function main() {
  const openFieldKeys = [
    'current_location_text',
    'current_city_region',
    'current_country',
    'generation',
    'visit_frequency',
    'industry',
    'profession_text',
  ];

  const fixtureIds = new Set([
    'location-new-york',
    'generation-grandparents',
    'generation-grandparents-typo',
    'visit-castara-from-small',
    'profession-verizon',
  ]);
  for (const fixture of AVA_EXTRACTION_FIXTURES.filter((f) => fixtureIds.has(f.id))) {
    const history = makeLastAva(fixture.last_ava_message);
    const turnPlan = planAvaTurn({
      userMessage: fixture.user_message,
      history,
      openFieldKeys,
      specifics: detectAvaSpecifics(fixture.user_message),
    });
    const extraction = deterministicCaptureFromTurn({
      userMessage: fixture.user_message,
      lastAvaMessage: fixture.last_ava_message,
      turnPlan,
    });
    if (!extraction) fail(`${fixture.id}: expected deterministic extraction`);

    const actual = new Map(extraction.profile_updates.map((u) => [u.field_key, u.value]));
    for (const [field, expected] of Object.entries(fixture.expected_fields)) {
      if (!actual.has(field)) fail(`${fixture.id}: missing ${field}`);
      const got = actual.get(field);
      if (Array.isArray(expected)) {
        if (!Array.isArray(got) || expected.join('|') !== got.join('|')) {
          fail(`${fixture.id}: expected ${field}=${expected.join(',')}, got ${String(got)}`);
        }
      } else if (String(got).replace(/[.!?]+$/, '') !== String(expected)) {
        fail(`${fixture.id}: expected ${field}=${String(expected)}, got ${String(got)}`);
      }
    }
  }

  console.log('Ava deterministic capture fixtures passed');
}

main();
