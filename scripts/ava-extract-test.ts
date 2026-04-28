/**
 * Ava extraction lane smoke test
 *
 * Runs a fixed set of sample user messages through the structured
 * extraction pass and prints what got pulled out. Useful for iterating
 * on the extractor prompt without hitting the chat UI.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/ava-extract-test.ts
 *   npx tsx --env-file=.env.local scripts/ava-extract-test.ts "your own message"
 */

import { extractFromUserMessage } from '../lib/ava-extract';
import { getAvaModelHealth } from '../lib/ava-model';

const DEFAULT_SAMPLES: Array<{
  label: string;
  chapter: string;
  openFields: string[];
  message: string;
}> = [
  {
    label: 'Introductions — lineage & location',
    chapter: 'introductions',
    openFields: ['current_country', 'generation'],
    message:
      "Marcus. Writing from Toronto. Been away a long time, my grandmother was Tobagonian, she grew up in Castara.",
  },
  {
    label: 'Who you are — profession with texture',
    chapter: 'who_you_are',
    openFields: ['industry', 'profession_text', 'education_level', 'age_bracket', 'gender'],
    message:
      "I'm a paediatric nurse, been doing it about twelve years. Trained at George Brown in Toronto. Three kids now, youngest just hit his teens.",
  },
  {
    label: 'Tobago now — visit frequency & connection',
    chapter: 'tobago_now',
    openFields: ['visit_frequency', 'connection_score'],
    message:
      "Last time I was home was 2019, before all that mess with covid. Try to keep up through family WhatsApp but honestly it feels further every year.",
  },
  {
    label: 'Contribution — mixed signal, barriers implied',
    chapter: 'what_youd_give',
    openFields: ['contribution_modes', 'barriers'],
    message:
      "I'd love to mentor young nurses back home, maybe run a clinic rotation. Problem is I don't know anyone in the health ministry and I can't keep flying down on my own dime.",
  },
  {
    label: 'Investment — yes with sector hint',
    chapter: 'money_on_island',
    openFields: ['invest_intent', 'invest_sectors'],
    message:
      "Honestly yeah, if the structure was right. Agriculture maybe, there's something about small-farm cooperatives I've been reading about.",
  },
  {
    label: 'Trust reflection — full paragraph',
    chapter: 'home_online',
    openFields: ['feature_priorities', 'trust_text'],
    message:
      "Trust is earned slow. I'd need to see real names behind it, not just a logo. People I can Google. And I'd need to see money come in AND money come out, so I know it's not one-way.",
  },
];

async function runOne(sample: (typeof DEFAULT_SAMPLES)[number]) {
  console.log('\n─── ' + sample.label + ' ─────────────────────────');
  console.log('Chapter:', sample.chapter);
  console.log('Message:', sample.message);

  const result = await extractFromUserMessage({
    userMessage: sample.message,
    chapterId: sample.chapter,
    openFieldKeys: sample.openFields,
  });

  console.log(
    `\n[parse_ok: ${result.parse_ok}]  [elapsed: ${result.elapsed_ms}ms]  [model: ${result.model_info.provider} ${result.model_info.modelId}]`,
  );

  if (result.profile_updates.length) {
    console.log('\n  profile_updates:');
    for (const u of result.profile_updates) {
      const valDisplay = Array.isArray(u.value) ? u.value.join(', ') : u.value;
      console.log(
        `    • ${u.field_key} = ${JSON.stringify(valDisplay)}  (conf ${u.confidence.toFixed(2)})  "${u.evidence}"`,
      );
    }
  } else {
    console.log('\n  profile_updates: (none)');
  }

  if (result.entities.length) {
    console.log('\n  entities:');
    for (const e of result.entities) {
      console.log(`    • ${e.kind}: ${e.name}  "${e.quote}"`);
    }
  }

  if (result.notes.length) {
    console.log('\n  notes:');
    for (const n of result.notes) {
      const s = n.sentiment ? `[${n.sentiment}]` : '';
      console.log(`    • ${s} ${n.content}  {${n.tags.join(', ')}}`);
    }
  }

  if (!result.parse_ok) {
    console.log('\n  RAW OUTPUT:\n' + result.raw_model_output);
  }
}

async function main() {
  console.log('\n─── Ava · Extraction Lane Smoke Test ────────────────');
  console.log('Health:', getAvaModelHealth());

  const customMessage = process.argv[2];
  if (customMessage) {
    await runOne({
      label: 'Custom',
      chapter: 'introductions',
      openFields: Object.keys(await import('../lib/ava-config').then((m) => m.AVA_PROFILE_FIELDS)),
      message: customMessage,
    });
    return;
  }

  let totalLatency = 0;
  let totalUpdates = 0;
  let totalEntities = 0;
  let totalNotes = 0;
  let parseFailures = 0;

  for (const sample of DEFAULT_SAMPLES) {
    const result = await extractFromUserMessage({
      userMessage: sample.message,
      chapterId: sample.chapter,
      openFieldKeys: sample.openFields,
    });
    totalLatency += result.elapsed_ms;
    totalUpdates += result.profile_updates.length;
    totalEntities += result.entities.length;
    totalNotes += result.notes.length;
    if (!result.parse_ok) parseFailures++;

    console.log('\n─── ' + sample.label + ' ─────────────────────────');
    console.log('Message:', sample.message);
    console.log(
      `[parse_ok: ${result.parse_ok}]  [elapsed: ${result.elapsed_ms}ms]`,
    );

    if (result.profile_updates.length) {
      console.log('  profile_updates:');
      for (const u of result.profile_updates) {
        const valDisplay = Array.isArray(u.value) ? u.value.join(', ') : u.value;
        console.log(
          `    • ${u.field_key} = ${JSON.stringify(valDisplay)}  (conf ${u.confidence.toFixed(2)})`,
        );
      }
    }

    if (result.entities.length) {
      console.log('  entities:');
      for (const e of result.entities) {
        console.log(`    • ${e.kind}: ${e.name}`);
      }
    }

    if (result.notes.length) {
      console.log('  notes:');
      for (const n of result.notes) {
        console.log(`    • ${n.content}`);
      }
    }

    if (!result.parse_ok) {
      console.log('  RAW OUTPUT:\n' + result.raw_model_output.slice(0, 500));
    }
  }

  console.log('\n─── Totals ──────────────────────────────────────────');
  console.log(`Samples: ${DEFAULT_SAMPLES.length}`);
  console.log(`Parse failures: ${parseFailures}`);
  console.log(`Total profile updates: ${totalUpdates}`);
  console.log(`Total entities: ${totalEntities}`);
  console.log(`Total notes: ${totalNotes}`);
  console.log(`Total latency: ${totalLatency}ms`);
  console.log(`Avg per sample: ${Math.round(totalLatency / DEFAULT_SAMPLES.length)}ms`);
  console.log('─────────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
