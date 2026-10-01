/**
 * Make free-text search safe to embed in a PostgREST `or=(...)` filter and in
 * an ILIKE pattern: drop characters that have meaning in either syntax.
 */
export function sanitizeSearch(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .replace(/[^\p{L}\p{N}\s.\-/#&@]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}
