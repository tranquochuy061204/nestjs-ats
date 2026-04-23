export const HEADHUNTING_CONFIG = {
  SCORING: {
    MAX_SKILL: 40,
    NEUTRAL_SKILL: 20,
    MAX_EXPERIENCE: 25,
    SALARY: {
      MATCH: 20,
      PARTIAL: 10,
      MISMATCH: 0,
    },
    PROFILE: {
      HAS_CV: 4,
      HAS_WORK_EXP: 3,
      HAS_CERTIFICATE: 3,
    },
    LOCATION: 5,
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
