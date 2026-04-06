/**
 * Convert a string to a slug (lowercase, trim, replace spaces with hyphens, remove special characters)
 */
export function toSlug(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s\-.#+]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Sanitize a filename by replacing spaces and other potentially problematic characters with underscores.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  // Replace spaces and typical problematic characters with '_'
  return filename.replace(/[\s/\\:*?"<>|]/g, '_');
}
