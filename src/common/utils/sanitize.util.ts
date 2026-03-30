import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize rich text HTML input để chặn XSS attacks.
 * Chỉ cho phép các HTML tags an toàn từ trình soạn thảo richtext.
 */
export const sanitizeRichText = (dirty: string): string =>
  sanitizeHtml(dirty, {
    allowedTags: [
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
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
      p: ['style'],
    },
    // Chặn tất cả inline styles nguy hiểm (chỉ cho phép text-align, color)
    allowedStyles: {
      '*': {
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
        color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d+,\s*\d+,\s*\d+\)$/],
      },
    },
  });
