import type {
  AvaMomentType,
  AvaQuestionSoftness,
  AvaReplyShape,
} from './ava-turn-planner';

export interface AvaConversationFixture {
  id: string;
  user_message: string;
  turn_index?: number;
  last_ava_message?: string;
  history_messages?: Array<{ sender: 'user' | 'ava'; content: string }>;
  open_field_keys?: string[];
  expected: {
    moment_type: AvaMomentType;
    reply_shape: AvaReplyShape;
    should_ask_question: boolean;
    question_softness: AvaQuestionSoftness;
    must_name_any?: string[];
    must_avoid?: string[];
  };
  why_it_matters: string;
}

export const AVA_CONVERSATION_FIXTURES: AvaConversationFixture[] = [
  {
    id: 'first-name-onboarding',
    user_message: 'Joshua.',
    turn_index: 1,
    expected: {
      moment_type: 'logistical_answer',
      reply_shape: 'mirror_specific_then_probe',
      should_ask_question: true,
      question_softness: 'direct',
      must_avoid: ['Glad you answered', 'welcome GIF'],
    },
    why_it_matters:
      'Ava must treat the first name answer as onboarding progress and ask where they are, not stop the conversation.',
  },
  {
    id: 'location-onboarding',
    user_message: 'New York',
    last_ava_message: 'Joshua, got you. Where in the world are you these days?',
    expected: {
      moment_type: 'logistical_answer',
      reply_shape: 'mirror_specific_then_probe',
      should_ask_question: true,
      question_softness: 'direct',
      must_name_any: ['New York'],
      must_avoid: ['Fair enough', 'take it slow'],
    },
    why_it_matters:
      'Ava must treat a short location answer as onboarding progress and ask about Tobago roots next.',
  },
  {
    id: 'roots-onboarding-grandparents',
    user_message: 'Grandparents.',
    last_ava_message:
      'New York, got you. How far back does Tobago go for you, were you born there or is it parents/grandparents?',
    expected: {
      moment_type: 'logistical_answer',
      reply_shape: 'mirror_specific_then_probe',
      should_ask_question: true,
      question_softness: 'direct',
      must_name_any: ['Grandparents'],
      must_avoid: ['Fair enough', 'take it slow'],
    },
    why_it_matters:
      'Ava must treat a short roots answer as onboarding progress and ask whether they lived in or visited Tobago.',
  },
  {
    id: 'roots-onboarding-typo-grandparents',
    user_message: 'Greantparents',
    last_ava_message:
      'Argentina, got you. How far back does Tobago go for you, were you born there or is it parents/grandparents?',
    expected: {
      moment_type: 'logistical_answer',
      reply_shape: 'mirror_specific_then_probe',
      should_ask_question: true,
      question_softness: 'direct',
      must_avoid: ['Fair enough', 'take it slow'],
    },
    why_it_matters:
      'Ava must keep the onboarding rail moving even when the user mistypes grandparents.',
  },
  {
    id: 'visit-onboarding-lived-there',
    user_message: 'I lived there for about eight years.',
    last_ava_message: 'That helps me place it. Did you ever live in Tobago yourself, or mostly visit?',
    open_field_keys: ['visit_frequency', 'industry', 'profession_text'],
    expected: {
      moment_type: 'logistical_answer',
      reply_shape: 'mirror_specific_then_probe',
      should_ask_question: true,
      question_softness: 'direct',
      must_name_any: ['eight years'],
      must_avoid: ['Fair enough', 'take it slow'],
    },
    why_it_matters:
      'Ava must treat lived/visited information as onboarding progress and move naturally into work.',
  },
  {
    id: 'visit-onboarding-castara-from-small',
    user_message: 'Lived 10 years in Castara from small, then moved to Argentina',
    last_ava_message: 'That helps me place it. Did you ever live in Tobago yourself, or mostly visit?',
    open_field_keys: ['generation', 'visit_frequency', 'industry', 'profession_text'],
    expected: {
      moment_type: 'logistical_answer',
      reply_shape: 'mirror_specific_then_probe',
      should_ask_question: true,
      question_softness: 'direct',
      must_name_any: ['10 years', 'Castara'],
      must_avoid: ['Castara is home for me', 'where in the village'],
    },
    why_it_matters:
      'Ava must not let Castara/place logic override the onboarding rail after asking whether they lived there.',
  },
  {
    id: 'verizon-specific-career',
    user_message: 'I do consulting for Verizon.',
    expected: {
      moment_type: 'career_achievement',
      reply_shape: 'celebrate_then_specific_ask',
      should_ask_question: true,
      question_softness: 'direct',
      must_name_any: ['Verizon', 'consulting'],
      must_avoid: ['New York can pull people into all kinds of work'],
    },
    why_it_matters:
      'Ava must react to the named company instead of zooming out to a generic city/work observation.',
  },
  {
    id: 'direct-work-answer-recovers-without-model',
    user_message: 'Mechanic, so I fix what goes. Private mechanic. I walk out of my home.',
    last_ava_message: 'Got you. What kind of work are you in these days?',
    open_field_keys: [
      'industry',
      'profession_text',
      'connection_score',
      'contribution_modes',
      'invest_intent',
      'barriers',
    ],
    expected: {
      moment_type: 'career_achievement',
      reply_shape: 'recover_to_profile_ask',
      should_ask_question: true,
      question_softness: 'soft',
      must_avoid: ['shift there usually like', 'tell me more', 'what kind of problem'],
    },
    why_it_matters:
      'A direct answer to the required work question should capture work and recover to the next profile field without a slow model call.',
  },
  {
    id: 'work-depth-budget-metro-oil-spill',
    user_message:
      'For example is there is an oil spill, but not a regular one, one that is based on a manufactures defect. I can consult if we need to push to the manufacturer or actually engage to fix it.',
    history_messages: [
      { sender: 'ava', content: 'Got you. What kind of work are you in these days?' },
      { sender: 'user', content: 'Consulting for Metro' },
      { sender: 'ava', content: 'Metro, okay. Major. What kind of consulting are you doing for them?' },
      {
        sender: 'user',
        content:
          'I am basically a mechanic, so if repairs are needed I consult and plan how the repair would be done then someone else takes over.',
      },
      {
        sender: 'ava',
        content:
          'Mechanic on the planning side for Metro, okay. Serious lane. What kind of repairs are usually yours to figure out before the next team takes over?',
      },
    ],
    open_field_keys: [
      'connection_score',
      'contribution_modes',
      'invest_intent',
      'barriers',
      'feature_priorities',
      'trust_text',
    ],
    expected: {
      moment_type: 'general_disclosure',
      reply_shape: 'recover_to_profile_ask',
      should_ask_question: true,
      question_softness: 'soft',
      must_avoid: ['consult actually involve', 'case goes that way', 'what kind of repairs'],
    },
    why_it_matters:
      'Ava can go two levels into work context, but the third work-detail answer must recover to required profile data instead of prying.',
  },
  {
    id: 'work-depth-budget-verizon-mechanical',
    user_message: 'Mechanical failures.',
    history_messages: [
      { sender: 'ava', content: 'Got you. What kind of work are you in these days?' },
      {
        sender: 'user',
        content:
          "Consult with Verizon. I'm actually a fiber expert, specifically for running fiber to rural areas in the U.S.",
      },
      {
        sender: 'ava',
        content:
          'Verizon on the rural fiber side, serious outfit. Getting service into the places that usually get skipped is major. What part of that build-out is yours day to day?',
      },
      {
        sender: 'user',
        content:
          "We needed a building out part, virtually. I design where the fiber runs.",
      },
      {
        sender: 'ava',
        content:
          'So at the Metro you were basically the engineer when something popped up, I get that. Being the one to assess it and tell them how to move forward takes something. Mind me asking what kind of problem you were usually brought in for?',
      },
      { sender: 'user', content: 'Really, any issue?' },
      {
        sender: 'ava',
        content:
          'Yeah, at the Metro it could be anything, electrical, mechanical, whatever decided to act up that day. Keeps you on your toes. What kind of issue did you end up seeing most often?',
      },
    ],
    open_field_keys: [
      'connection_score',
      'contribution_modes',
      'invest_intent',
      'barriers',
      'feature_priorities',
      'trust_text',
    ],
    expected: {
      moment_type: 'general_disclosure',
      reply_shape: 'recover_to_profile_ask',
      should_ask_question: true,
      question_softness: 'soft',
      must_avoid: ['How did you learn', 'what kind of issue', 'what kind of problem'],
    },
    why_it_matters:
      'After two broad work/problem probes, Ava must not ask a third work-depth question like how they learned it.',
  },
  {
    id: 'work-depth-budget-one-detail-still-allowed',
    user_message:
      "We design where the fiber runs before anybody goes out there.",
    history_messages: [
      { sender: 'ava', content: 'Got you. What kind of work are you in these days?' },
      {
        sender: 'user',
        content:
          "Consult with Verizon. I'm actually a fiber expert, specifically for running fiber to rural areas in the U.S.",
      },
      {
        sender: 'ava',
        content:
          'Verizon on the rural fiber side, serious outfit. Getting service into the places that usually get skipped is major. What part of that build-out is yours day to day?',
      },
    ],
    open_field_keys: [
      'connection_score',
      'contribution_modes',
      'invest_intent',
      'barriers',
      'feature_priorities',
      'trust_text',
    ],
    expected: {
      moment_type: 'general_disclosure',
      reply_shape: 'mirror_specific_then_probe',
      should_ask_question: true,
      question_softness: 'direct',
      must_avoid: ['recover_to_profile_ask'],
    },
    why_it_matters:
      'The first contextual work follow-up is allowed; only the third same-topic probe should force recovery.',
  },
  {
    id: 'short-ack-after-work-statement-recovers',
    user_message: 'Yup.',
    history_messages: [
      { sender: 'ava', content: 'Got you. What kind of work are you in these days?' },
      { sender: 'user', content: 'I work as a cashier in Walmart.' },
      {
        sender: 'ava',
        content: "Walmart cashier, you see everybody. Heavy work. What's a shift there usually like for you?",
      },
      { sender: 'user', content: 'Morning shift.' },
      {
        sender: 'ava',
        content: 'Morning shift at Walmart, okay. Early starts can take it out of you.',
      },
    ],
    open_field_keys: [
      'connection_score',
      'contribution_modes',
      'invest_intent',
      'barriers',
      'feature_priorities',
      'trust_text',
    ],
    expected: {
      moment_type: 'general_disclosure',
      reply_shape: 'recover_to_profile_ask',
      should_ask_question: true,
      question_softness: 'soft',
      must_avoid: ['Got you', 'Got it'],
    },
    why_it_matters:
      'A short acknowledgement after Ava makes a no-question work statement must recover to the next required field, not stall.',
  },
  {
    id: 'tobago-opportunity-life-decision',
    user_message:
      "I just moved, I was living in Tobago for about eight years, didn't see much opportunity locally and decided to move away and advance myself.",
    expected: {
      moment_type: 'life_decision',
      reply_shape: 'validate_then_soft_ask',
      should_ask_question: true,
      question_softness: 'very_soft',
      must_name_any: ['opportunity', 'moved', 'advance'],
      must_avoid: ['Scarborough', 'wharf', 'market', 'Saturday'],
    },
    why_it_matters:
      'Ava must validate the decision and avoid forced Tobago scenery when the place is incidental.',
  },
  {
    id: 'short-thin-reply',
    user_message: 'yes, I guess',
    expected: {
      moment_type: 'short_reply',
      reply_shape: 'sit_no_question',
      should_ask_question: false,
      question_softness: 'no_question',
      must_avoid: ['What keeps you connected', 'Where in the world'],
    },
    why_it_matters:
      'Thin replies often mean the user is not ready for another probe. Ava should let the moment breathe.',
  },
  {
    id: 'question-to-ava',
    user_message: 'Wait, why do you want to know all this?',
    expected: {
      moment_type: 'question_to_ava',
      reply_shape: 'answer_then_return',
      should_ask_question: true,
      question_softness: 'soft',
      must_avoid: ['database', 'profile extraction', 'survey'],
    },
    why_it_matters:
      'User questions outrank profile gaps. Ava must answer plainly before continuing.',
  },
  {
    id: 'family-roots',
    user_message: 'My grandparents were from Tobago, mostly my father side.',
    expected: {
      moment_type: 'identity_roots',
      reply_shape: 'mirror_specific_then_probe',
      should_ask_question: true,
      question_softness: 'soft',
      must_name_any: ['grandparents', 'father'],
      must_avoid: ["that's quite a connection", 'deep roots'],
    },
    why_it_matters:
      'Family-root disclosures should be mirrored specifically without cliché warmth.',
  },
  {
    id: 'trust-government-platform',
    user_message:
      "Honestly I don't trust government platforms with my data unless the privacy is very clear.",
    expected: {
      moment_type: 'trust_concern',
      reply_shape: 'trust_then_safety_ask',
      should_ask_question: true,
      question_softness: 'very_soft',
      must_name_any: ['trust', 'privacy', 'data'],
      must_avoid: ['you can trust us', "we'll protect"],
    },
    why_it_matters:
      'Ava must not defend institutions. She should acknowledge the concern and ask what transparency would require.',
  },
];
