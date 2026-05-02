export const HEADHUNTING_CONFIG = {
  SEARCH_SCORING: {
    KEYWORD_MULTIPLIER: {
      NAME_POSITION: 3,
      SKILL: 2,
      BIO: 1.5,
      OTHER: 1,
    },
    DEFAULT_WEIGHTS: {
      SKILL: 30,
      LEVEL: 20,
      EXPERIENCE: 15,
      SALARY: 15,
      DEGREE: 10,
      LOCATION: 5,
      PROFILE: 5,
    },
    MIN_RELEVANCE_SCORE: 10,
    DEGREE_RANK: {
      postgraduate: 6,
      university: 5,
      college: 4,
      intermediate: 3,
      high_school: 2,
      certificate: 1,
      none: 0,
    },
  },
  THRESHOLDS: {
    MIN_SUGGESTION_SCORE: 30,
    MAX_SUGGESTIONS: 30,
  },
};

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
};
