/**
 * Single source of truth for Ava multiple-choice elicitation:
 * labels/messages shown in the client must match these strings exactly so
 * {@link syncApplyPickerProfileIfExact} can persist profile fields before
 * streaming headers are computed (avoid repeating the same picker).
 */

export const AVA_PICKER_ROOTS = [
  {
    id: 'island',
    label: 'Born in Tobago',
    message: 'I was born in Tobago myself.',
    profileValue: '1st',
  },
  {
    id: 'parents',
    label: 'Parents',
    message: "It's my parents — they're the Tobago connection.",
    profileValue: '2nd',
  },
  {
    id: 'grandparents',
    label: 'Grandparents',
    message: 'Grandparents on my Tobago side.',
    profileValue: '3rd',
  },
  {
    id: 'deep',
    label: 'Further back',
    message: 'It goes back further than grandparents for my family.',
    profileValue: '4th+',
  },
] as const;

export const AVA_PICKER_VISIT = [
  {
    id: 'multiple',
    label: 'Several visits / yr',
    message: "I'm back in Tobago several times a year.",
    profileValue: 'multiple_times_per_year',
  },
  {
    id: 'once',
    label: '~Once a year',
    message: 'Usually about once a year.',
    profileValue: 'once_per_year',
  },
  {
    id: 'few_years',
    label: 'Every few years',
    message: 'More like every few years.',
    profileValue: 'every_few_years',
  },
  {
    id: 'rarely',
    label: 'Rarely now',
    message: "It's rare these days — been a good while.",
    profileValue: 'rarely',
  },
  {
    id: 'never',
    label: 'Never been',
    message: "I've never been to Tobago myself.",
    profileValue: 'never',
  },
  {
    id: 'lived',
    label: 'Lived there',
    message: 'I actually lived there / grew up there.',
    profileValue: 'every_few_years',
  },
] as const;

/** 1–5 scale for connection_score (stored as string in DB). */
export const AVA_PICKER_CONNECTION = [
  {
    id: '1',
    label: '1 · Not at all',
    message: "Not tuned in at all — I'd say a 1.",
    profileValue: 1,
  },
  {
    id: '2',
    label: '2 · A little',
    message: "Only a little — about a 2.",
    profileValue: 2,
  },
  {
    id: '3',
    label: '3 · Middle',
    message: 'Somewhere in the middle — a 3.',
    profileValue: 3,
  },
  {
    id: '4',
    label: '4 · Pretty tuned in',
    message: "Pretty tuned in — I'd call it a 4.",
    profileValue: 4,
  },
  {
    id: '5',
    label: '5 · Very tuned in',
    message: "Very tuned in — solid 5.",
    profileValue: 5,
  },
] as const;

export const AVA_PICKER_INVEST = [
  {
    id: 'yes',
    label: 'Yes',
    message: "Yes — I'd consider putting money into something in Tobago.",
    profileValue: 'yes',
  },
  {
    id: 'maybe',
    label: 'Maybe',
    message: 'Maybe — it would depend on the opportunity.',
    profileValue: 'maybe',
  },
  {
    id: 'no',
    label: 'No',
    message: "No — that's not really my lane.",
    profileValue: 'no',
  },
] as const;
