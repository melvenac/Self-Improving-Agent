/**
 * Reject tool-call serialization that leaked into a content field.
 *
 * On 2026-08-31 eight stored entries arrived with their body running past its
 * own close and swallowing the next argument — the body ended with a closing
 * content tag followed by an opening parameter tag and a JSON tag array.
 *
 * `ob_store` stored exactly what it was handed, so this is not a logic bug in
 * the writer: the call was malformed at emit time and nothing validated it.
 * The damage is not cosmetic. The swallowed argument never arrived, so four of
 * those entries were written with `tags: []`, and the DB `content` column
 * carries the scaffolding into FTS where it is searchable.
 *
 * **Reject rather than strip.** A body that ran past its close means the
 * arguments after it went missing too, so silently repairing the text would
 * store an entry that reads correctly and is quietly missing its tags —
 * precisely the "operation that silently does not do what it says" shape this
 * repo keeps getting bitten by. Refusing makes the caller retry with a
 * well-formed call, which is the only way the tags come back.
 *
 * Note on this file: the markers are ASSEMBLED rather than written as literals.
 * Writing them out verbatim makes this source file itself look like a leaked
 * tool call to any tool that reads it — an author writing this guard reproduced
 * the exact bug on the first attempt, when the literal terminated the write.
 */

const TAG = 'parameter';
const CLOSE = '>';

/**
 * Markers that never appear in genuine prose but always appear in a leaked
 * tool call. Deliberately narrow: a bare `</` would match every legitimate
 * closing tag in a note that discusses HTML, which is most of them.
 */
const SCAFFOLD_MARKERS: readonly string[] = [
  `</content${CLOSE}`,
  `<${TAG} name=`,
  `</${TAG}${CLOSE}`,
  `<${TAG} `,
];

export interface ScaffoldFinding {
  /** The marker that matched, for a message the caller can act on. */
  marker: string;
  /** Byte offset where it starts, so a repair can truncate there. */
  index: number;
}

/** First scaffolding marker in `text`, or null when the text is clean. */
export function findToolCallScaffolding(text: string): ScaffoldFinding | null {
  let best: ScaffoldFinding | null = null;
  for (const marker of SCAFFOLD_MARKERS) {
    const index = text.indexOf(marker);
    if (index === -1) continue;
    if (!best || index < best.index) best = { marker, index };
  }
  return best;
}

/**
 * Content up to the first scaffolding marker, trimmed.
 *
 * For REPAIRING already-stored rows only. New writes are rejected, not
 * repaired — see the note above on why silently fixing the text is worse than
 * refusing it.
 */
export function stripToolCallScaffolding(text: string): string {
  const found = findToolCallScaffolding(text);
  return (found ? text.slice(0, found.index) : text).trimEnd();
}

/**
 * Tag array from a swallowed argument, when the leak captured one.
 *
 * The tags the author actually intended are sitting in the corrupted body — the
 * only place they survive, since they never reached the `tags` column. Used to
 * restore them rather than guess.
 */
export function recoverSwallowedTags(text: string): string[] | null {
  const pattern = new RegExp(`<${TAG} name="tags"${CLOSE}\\s*(\\[[^\\]]*\\])`);
  const match = text.match(pattern);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (!Array.isArray(parsed)) return null;
    const tags = parsed.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean);
    return tags.length > 0 ? tags : null;
  } catch {
    return null;
  }
}

/** Message for a rejected store, naming the marker and what was lost with it. */
export function scaffoldRejectionMessage(found: ScaffoldFinding): string {
  return (
    `Refused: the content field contains tool-call scaffolding ("${found.marker}" at offset ${found.index}). ` +
    `This means the call was malformed at emit — the body ran past its close and swallowed the arguments after it, ` +
    `so tags and other fields did not arrive either. Nothing was stored. ` +
    `Re-send with the content properly terminated; storing it as-is would write an entry that reads correctly ` +
    `while silently missing its tags, and put the scaffolding into FTS where it is searchable.`
  );
}
