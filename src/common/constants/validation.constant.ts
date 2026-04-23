export const VALIDATION_LIMITS = {
  EMAIL: {
    MAX: 255,
  },
  PASSWORD: {
    MIN: 8,
    MAX: 100,
  },
  NAME: {
    MIN: 1,
    MAX: 100,
  },
  PHONE: {
    MIN: 10,
    MAX: 20,
  },
  TEXT_SHORT: 255,
  TEXT_MEDIUM: 2000, // Bio, Descriptions
  TEXT_LONG: 10000, // Content, Job Description
};
