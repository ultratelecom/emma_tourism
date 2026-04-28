import { END, START, StateGraph } from '@langchain/langgraph';
import {
  detectAvaSpecifics,
  planAvaTurn,
  type AvaTurnPlan,
} from '../ava-turn-planner';
import type { AvaMessage } from '../ava-db';
import { AvaGraphState, type AvaGraphStateValue } from './state';
import {
  chooseNextRequiredField,
  promptForRequiredField,
  recoveryReplyForPlan,
} from './field-flow';

export interface AvaGraphDecision {
  turnPlan: AvaTurnPlan;
  nextRequiredField: string | null;
  forcedReply: string | null;
  allowGif: boolean;
}

function classifyTurn(state: AvaGraphStateValue): Partial<AvaGraphStateValue> {
  const specifics = state.specifics ?? detectAvaSpecifics(state.userMessage);
  const turnPlan = planAvaTurn({
    userMessage: state.userMessage,
    history: state.history,
    openFieldKeys: state.openFieldKeys,
    turnIndex: state.turnIndex,
    specifics,
  });

  return { specifics, turnPlan };
}

function chooseRecoveryField(state: AvaGraphStateValue): Partial<AvaGraphStateValue> {
  const skipWork =
    state.turnPlan?.reply_shape === 'recover_to_profile_ask' ||
    state.turnPlan?.moment_type === 'career_achievement';
  const nextRequiredField =
    state.turnPlan?.next_best_question_focus &&
    state.openFieldKeys.includes(state.turnPlan.next_best_question_focus)
      ? state.turnPlan.next_best_question_focus
      : chooseNextRequiredField(state.openFieldKeys, { skipWork });

  return { nextRequiredField };
}

function enforceDepthAndRecovery(state: AvaGraphStateValue): Partial<AvaGraphStateValue> {
  let plan = state.turnPlan;
  if (!plan) return {};

  let forcedReply = recoveryReplyForPlan(plan);
  let allowGif = ![
    'life_decision',
    'pain_or_frustration',
    'trust_concern',
  ].includes(plan.moment_type);

  if (
    plan.reply_shape === 'recover_to_profile_ask' &&
    !forcedReply &&
    state.nextRequiredField
  ) {
    const nextPlan: AvaTurnPlan = {
      ...plan,
      next_best_question_focus: state.nextRequiredField,
    };
    forcedReply = recoveryReplyForPlan(nextPlan);
  }

  // Hard product rule: if required data is still open, Ava cannot end
  // the turn with a statement unless this is a true emotional/user-question
  // moment. The model is allowed to add warmth in exceptional cases, but
  // ordinary profile progress must keep moving.
  if (
    !forcedReply &&
    state.nextRequiredField &&
    (
      plan.reply_shape === 'clarify_gently' ||
      plan.avoid_topics.some((topic) => /stalling with got you|no-question acknowledgement/i.test(topic))
    )
  ) {
    const modelAllowed = [
      'life_decision',
      'pain_or_frustration',
      'trust_concern',
      'question_to_ava',
      'logistical_answer',
    ].includes(plan.moment_type);
    const careerContextAllowed =
      plan.moment_type === 'career_achievement' &&
      plan.reply_shape !== 'recover_to_profile_ask';

    if (!modelAllowed && !careerContextAllowed) {
      const prompt = promptForRequiredField(state.nextRequiredField);
      if (prompt) {
        forcedReply = `Got it. ${prompt}`;
        plan = {
          ...plan,
          reply_shape: 'recover_to_profile_ask',
          should_ask_question: true,
          question_softness: 'soft',
          next_best_question_focus: state.nextRequiredField,
          rationale: `${plan.rationale}; graph forced recovery to ${state.nextRequiredField}`,
        };
      }
    }
  }

  if (forcedReply) allowGif = false;

  return { turnPlan: plan, forcedReply, allowGif };
}

const avaDecisionGraph = new StateGraph(AvaGraphState)
  .addNode('classifyTurn', classifyTurn)
  .addNode('chooseRecoveryField', chooseRecoveryField)
  .addNode('enforceDepthAndRecovery', enforceDepthAndRecovery)
  .addEdge(START, 'classifyTurn')
  .addEdge('classifyTurn', 'chooseRecoveryField')
  .addEdge('chooseRecoveryField', 'enforceDepthAndRecovery')
  .addEdge('enforceDepthAndRecovery', END)
  .compile();

export async function runAvaGraphDecision(input: {
  userMessage: string;
  history: AvaMessage[];
  openFieldKeys: string[];
  turnIndex?: number;
}): Promise<AvaGraphDecision> {
  const result = await avaDecisionGraph.invoke({
    userMessage: input.userMessage,
    history: input.history,
    openFieldKeys: input.openFieldKeys,
    turnIndex: input.turnIndex,
  });

  if (!result.turnPlan) {
    throw new Error('Ava graph failed to produce a turn plan');
  }

  return {
    turnPlan: result.turnPlan,
    nextRequiredField: result.nextRequiredField,
    forcedReply: result.forcedReply,
    allowGif: result.allowGif,
  };
}
