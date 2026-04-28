/**
 * Ava chat lane smoke test
 *
 * Simulates turn 1 of a real conversation — the opener has already been
 * delivered to the user by the system on turn 0 (deterministic, no model
 * call), so this test invokes the model with the user's first actual
 * reply. Confirms voice, pacing, and that the opener is not repeated.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/ava-smoke-test.ts
 *   npx tsx --env-file=.env.local scripts/ava-smoke-test.ts "Your own message"
 */

import { generateText } from 'ai';
import {
  AVA_SYSTEM_PROMPT,
  AVA_PERSONALITY,
  AVA_CHAPTERS,
} from '../lib/ava-config';
import { getAvaChatModel, getAvaModelHealth } from '../lib/ava-model';

async function main() {
  const userMessage =
    process.argv[2] ||
    "Marcus. Writing from Toronto. Been away a long time, grandmother was Tobagonian.";

  console.log('\n─── Ava · Chat Lane Smoke Test ──────────────────────');
  console.log('Health:', getAvaModelHealth());

  const { model, info } = getAvaChatModel();
  console.log('Using (chat):', info);

  const chapter = AVA_CHAPTERS[0]; // introductions

  console.log('\n[system delivers opener on turn 0, deterministic]');
  console.log('Ava (turn 0):', AVA_PERSONALITY.opening_line);
  console.log('User (turn 1):', userMessage);
  console.log('\n…calling chat model…\n');

  const contextBlock = `CONVERSATION STATE
- Turn: 1 (opener already shown to the user)
- Chapter: ${chapter.id} (${chapter.title})
- Open profile fields this chapter: ${chapter.intents.join(', ')}
- Callback hints: none yet (this is their first message)

USER MESSAGE
${userMessage}

Reply as Ava. One to three short sentences. Do not repeat the opening line. Ask one open question rooted in the next most natural gap.`;

  const started = Date.now();
  try {
    const { text, usage } = await generateText({
      model,
      system: AVA_SYSTEM_PROMPT,
      prompt: contextBlock,
      temperature: 0.8,
    });

    const elapsed = Date.now() - started;
    console.log('Ava (turn 1):', text.trim());
    console.log('\n─── Meta ────────────────────────────────────────────');
    console.log('Latency:', `${elapsed}ms`);
    console.log('Tokens:', usage);
    console.log('─────────────────────────────────────────────────────\n');
  } catch (err) {
    console.error('\nFailed:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
