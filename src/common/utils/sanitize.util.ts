import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize rich text HTML input để chặn XSS attacks.
 * Chỉ cho phép các HTML tags an toàn từ trình soạn thảo richtext.
 */
import { SANITIZE_CONFIG } from '../constants/auth.constant';

/**
 * Sanitize rich text HTML input để chặn XSS attacks.
 * Chỉ cho phép các HTML tags an toàn từ trình soạn thảo richtext.
 */
export const sanitizeRichText = (dirty: string): string =>
  sanitizeHtml(dirty, {
    allowedTags: SANITIZE_CONFIG.ALLOWED_TAGS,
    allowedAttributes: SANITIZE_CONFIG.ALLOWED_ATTRIBUTES,
    // Chặn tất cả inline styles nguy hiểm (chỉ cho phép text-align, color)
    allowedStyles: SANITIZE_CONFIG.ALLOWED_STYLES,
  });
