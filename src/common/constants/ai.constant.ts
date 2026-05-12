/**
 * AI Provider Configuration Constants
 *
 * Centralises numeric and string constants used by AiProviderService
 * so their meaning and rationale are documented in one place.
 */
export const AI_CONFIG = {
  /**
   * Minimum number of characters that extracted PDF text must contain
   * before it is considered a "successful" extraction.
   *
   * Rationale: scanned / image-only PDFs produce near-empty text layers.
   * A threshold of 50 chars filters out those false positives while still
   * accepting very short (but real) text-based documents.
   */
  PDF_TEXT_MIN_LENGTH: 50,

  /**
   * Maximum number of retry attempts when calling the OpenRouter fallback API.
   *
   * Retries are used for transient failures (429 Rate-Limit, 5xx Server Errors,
   * and empty responses). Each retry adds an exponential back-off delay.
   */
  OPENROUTER_MAX_RETRIES: 3,

  /**
   * Base delay (in ms) between OpenRouter retry attempts.
   * Actual delay = attempt * BASE_RETRY_DELAY_MS (linear back-off).
   */
  OPENROUTER_BASE_RETRY_DELAY_MS: 2000,
};
