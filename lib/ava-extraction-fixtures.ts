export interface AvaExtractionFixture {
  id: string;
  last_ava_message: string;
  user_message: string;
  expected_fields: Record<string, string | number | string[]>;
}

export const AVA_EXTRACTION_FIXTURES: AvaExtractionFixture[] = [
  {
    id: 'location-new-york',
    last_ava_message: 'Where in the world are you these days?',
    user_message: 'New York',
    expected_fields: {
      current_location_text: 'New York',
      current_city_region: 'New York',
      current_country: 'United States',
    },
  },
  {
    id: 'generation-grandparents',
    last_ava_message:
      'How far back does Tobago go for you, were you born there or is it parents/grandparents?',
    user_message: 'Grandparents.',
    expected_fields: {
      generation: '3rd',
    },
  },
  {
    id: 'generation-grandparents-typo',
    last_ava_message:
      'How far back does Tobago go for you, were you born there or is it parents/grandparents?',
    user_message: 'Greantparents',
    expected_fields: {
      generation: '3rd',
    },
  },
  {
    id: 'visit-castara-from-small',
    last_ava_message: 'Did you ever live in Tobago yourself, or mostly visit?',
    user_message: 'Lived 10 years in Castara from small, then moved to Argentina',
    expected_fields: {
      visit_frequency: 'every_few_years',
    },
  },
  {
    id: 'profession-verizon',
    last_ava_message: 'What kind of work are you in these days?',
    user_message: 'I consult for Verizon on complex rural network builds.',
    expected_fields: {
      industry: 'technology',
      profession_text: 'I consult for Verizon on complex rural network builds',
    },
  },
  {
    id: 'visit-frequency',
    last_ava_message: 'When did your feet last touch the island, and how often do you make it back?',
    user_message: 'Maybe once a year if work allows.',
    expected_fields: {
      visit_frequency: 'once_per_year',
    },
  },
  {
    id: 'investment-maybe',
    last_ava_message: 'Would you ever put money behind something on the island?',
    user_message: 'Maybe, if the returns make sense and the risk is clear.',
    expected_fields: {
      invest_intent: 'maybe',
    },
  },
];
