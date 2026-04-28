/**
 * Ava turn-planner fixture check.
 *
 * This is a cheap, model-free regression check for the logic that runs
 * before the visible LLM reply. It does not call OpenAI, StepFun, or Neon.
 *
 * Run:
 *   npx tsx scripts/ava-turn-planner-fixtures.ts
 */

import { AVA_CONVERSATION_FIXTURES } from '../lib/ava-conversation-fixtures';
import { detectAvaSpecifics, planAvaTurn } from '../lib/ava-turn-planner';
import { runAvaGraphDecision } from '../lib/ava-graph/graph';
import type { AvaMessage } from '../lib/ava-db';

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const history: AvaMessage[] = [];
  const openFieldKeys = [
    'current_location_text',
    'current_city_region',
    'current_country',
    'generation',
    'visit_frequency',
    'industry',
    'profession_text',
  ];

  for (const fixture of AVA_CONVERSATION_FIXTURES) {
    const fixtureHistory =
      fixture.history_messages
        ? (fixture.history_messages.map((message, index) => ({
            id: `fixture-${fixture.id}-${index}`,
            session_id: 'fixture-session',
            user_id: 'fixture-user',
            sender: message.sender,
            content: message.content,
            turn_index: index,
            is_system_delivered: false,
            model_provider: message.sender === 'ava' ? 'system' : null,
            model_id: message.sender === 'ava' ? 'fixture' : null,
            chapter_id: 'introductions',
            latency_ms: 0,
            input_tokens: null,
            output_tokens: null,
            created_at: new Date(),
          })) satisfies AvaMessage[])
        : fixture.last_ava_message
        ? ([
            {
              id: `fixture-ava-${fixture.id}`,
              session_id: 'fixture-session',
              user_id: 'fixture-user',
              sender: 'ava',
              content: fixture.last_ava_message,
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
          ] satisfies AvaMessage[])
        : history;
    const specifics = detectAvaSpecifics(fixture.user_message);
    const manualPlan = planAvaTurn({
      userMessage: fixture.user_message,
      history: fixtureHistory,
      openFieldKeys: fixture.open_field_keys ?? openFieldKeys,
      turnIndex: fixture.turn_index,
      specifics,
    });
    const graphDecision = await runAvaGraphDecision({
      userMessage: fixture.user_message,
      history: fixtureHistory,
      openFieldKeys: fixture.open_field_keys ?? openFieldKeys,
      turnIndex: fixture.turn_index,
    });
    const plan = graphDecision.turnPlan;

    if (manualPlan.moment_type !== plan.moment_type) {
      fail(`${fixture.id}: manual planner and LangGraph planner diverged (${manualPlan.moment_type} vs ${plan.moment_type})`);
    }

    if (plan.moment_type !== fixture.expected.moment_type) {
      fail(`${fixture.id}: expected moment_type=${fixture.expected.moment_type}, got ${plan.moment_type}`);
    }
    if (plan.reply_shape !== fixture.expected.reply_shape) {
      fail(`${fixture.id}: expected reply_shape=${fixture.expected.reply_shape}, got ${plan.reply_shape}`);
    }
    if (plan.should_ask_question !== fixture.expected.should_ask_question) {
      fail(
        `${fixture.id}: expected should_ask_question=${fixture.expected.should_ask_question}, got ${plan.should_ask_question}`,
      );
    }
    if (plan.question_softness !== fixture.expected.question_softness) {
      fail(
        `${fixture.id}: expected question_softness=${fixture.expected.question_softness}, got ${plan.question_softness}`,
      );
    }
  }

  console.log(`Ava LangGraph turn-planner fixtures passed (${AVA_CONVERSATION_FIXTURES.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
