import { Annotation } from '@langchain/langgraph';
import type { AvaMessage } from '../ava-db';
import type { AvaSpecifics, AvaTurnPlan } from '../ava-turn-planner';

export const AvaGraphState = Annotation.Root({
  userMessage: Annotation<string>,
  history: Annotation<AvaMessage[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  openFieldKeys: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  turnIndex: Annotation<number | undefined>,
  specifics: Annotation<AvaSpecifics | undefined>,
  turnPlan: Annotation<AvaTurnPlan | undefined>,
  nextRequiredField: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  forcedReply: Annotation<string | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  allowGif: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => true,
  }),
});

export type AvaGraphStateValue = typeof AvaGraphState.State;
