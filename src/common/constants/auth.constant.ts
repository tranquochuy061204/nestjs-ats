export const AUTH_CONFIG = {
  /**
   * Number of bcrypt salt rounds used when hashing passwords.
   *
   * Rationale: 10 rounds is the bcrypt library default, providing a good
   * balance between security (brute-force resistance) and CPU cost
   * (~100 ms per hash on modern hardware). Increase to 12 for stricter
   * security requirements at the cost of higher latency.
   */
  SALT_ROUNDS: 10,
  VERIFICATION_TOKEN_BYTES: 32,
  RESET_PASSWORD_EXPIRES_MIN: 15,
  REFRESH_TOKEN_DEFAULT_EXPIRY_DAYS: 7,
  COOKIE: {
    REFRESH_TOKEN: 'refresh_token', // Legacy/Fallback
    ADMIN_REFRESH_TOKEN: 'admin_refresh_token',
    EMPLOYER_REFRESH_TOKEN: 'employer_refresh_token',
    CANDIDATE_REFRESH_TOKEN: 'candidate_refresh_token',
    MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

export const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'b',
    'i',
    'u',
    'em',
    'strong',
    'a',
    'p',
    'br',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'span',
  ],
  ALLOWED_ATTRIBUTES: {
    a: ['href', 'target', 'rel'],
    span: ['style'],
    p: ['style'],
  },
  ALLOWED_STYLES: {
    '*': {
      'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d+,\s*\d+,\s*\d+\)$/],
    },
  },
};
