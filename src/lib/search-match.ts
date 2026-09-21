function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Matches when every word of the query appears somewhere across the given fields.
 * Whitespace is normalized on both sides, so double spaces or a stray non-breaking
 * space in scraped/synced data (e.g. platform application names) doesn't break a
 * literal-substring match. Splitting the query into words also lets a full name
 * match even when its parts live in different fields (client vs. firm) or the
 * combined text has more whitespace than the query does.
 */
export function matchesSearch(fields: Array<string | null | undefined>, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = normalize(fields.filter(Boolean).join(" "));
  return q.split(" ").every((word) => haystack.includes(word));
}
