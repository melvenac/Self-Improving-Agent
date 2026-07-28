// FTS5 query construction, shared by ob_recall and the shadow-recall harness.
//
// These live outside server.ts so the harness can build the same MATCH
// expressions the live tool uses without importing the MCP server module (which
// registers tools as a side effect of import).

export function sanitizeFtsQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word.replace(/"/g, '""')}"`)
    .join(" ");
}

/**
 * Same terms, OR-joined instead of the FTS5 default AND.
 *
 * Multi-word queries are conjunctive by default, so "knowledge maturity
 * feedback loop" required all four terms in one entry and returned nothing —
 * while the OR form matched 86 entries. The /start protocol asks agents for
 * "methodology-focused" queries, which are exactly the multi-word shape that
 * silently returned zero results.
 */
export function broadenFtsQuery(query: string): string | null {
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null; // single term: AND and OR are identical
  return words.map((word) => `"${word.replace(/"/g, '""')}"`).join(" OR ");
}
