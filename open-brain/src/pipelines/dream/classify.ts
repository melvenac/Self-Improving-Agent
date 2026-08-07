import type { FactKind, KnowledgeIndexRow } from "../../db-v2.js";

/**
 * State-vs-event classification for stored knowledge.
 *
 * Pure, like everything in `rules.ts`: a row in, a verdict out, no clock and no
 * filesystem.
 *
 * The distinction it draws is the one from `docs/dream-design.md` and the
 * `fact_kind` column: a **state** is one current value that changes and wants
 * replacing; an **event** is a timestamped thing that happened and wants
 * appending. `knowledge_index` can only append, so a state fact that changes
 * leaves its predecessor live and equally recallable — and that pair is what
 * `findSuperseded` looks for.
 *
 * ## This is a proposal generator, not an oracle
 *
 * Nothing here decides anything. Its output feeds a report a human approves,
 * and that is what makes an imperfect hit rate acceptable — the same reasoning
 * that put `retirementNarrated` on a confidence penalty rather than a filter.
 * Two consequences are deliberate:
 *
 * - **`null` is a real answer**, not a failure. An entry that reads as both, or
 *   as neither, returns `null` and produces no proposal. A wrong label is worth
 *   more caution than a missing one, because a missing one costs nothing.
 * - **Confidence is capped by tier**, and a tier earns its rank by how much it
 *   discriminates, not by how structural it looks. The live corpus settled this:
 *   the experience template matches 84% of entries, so it ranks *below* word
 *   choice despite being the more structural signal. See `EXPERIENCE_TEMPLATE`.
 */

export interface Classification {
  /** `null` = unclassified. Emit no proposal. */
  kind: FactKind | null;
  /** 0–1. Zero whenever `kind` is null. */
  confidence: number;
  /**
   * The matched text, verbatim, one entry per signal.
   *
   * Carried for the same reason `Evidence` exists: a proposal a human cannot
   * check is one they can only accept on trust. A classification that cannot
   * say *why* is not reviewable.
   */
  signals: string[];
}

const UNCLASSIFIED: Classification = { kind: null, confidence: 0, signals: [] };

/**
 * Headings only `writeFailure` emits.
 *
 * A failure is always something that happened, and nothing else in the corpus
 * writes these three — so unlike the experience template below, matching here
 * says something about the *fact*, not merely about the form it was typed in.
 */
const FAILURE_STRUCTURE: RegExp[] = [
  /^#{1,4}\s*What was attempted\b/im,
  /^#{1,4}\s*Why it failed\b/im,
  /^#{1,4}\s*What worked instead\b/im,
];

/**
 * The experience template — TRIGGER / ACTION / CONTEXT / OUTCOME, as headings or
 * inline, per `.agents/SYSTEM/ENTITIES.md`.
 *
 * **Weak evidence, deliberately ranked below word choice.** This started out as
 * a high-confidence structural signal and the live corpus disproved it: 287 of
 * 341 entries match, because the template is simply how almost everything gets
 * written here. A signal that fires on 84% of the corpus separates nothing, and
 * scoring it at 0.9 produced a confident "86% of this corpus is events" that
 * only ever supported the much weaker claim "86% uses the template".
 *
 * The template is event-*shaped* — situation, action, result — but a state fact
 * wrapped in it is still a state fact, and those are the ones that rot. So it
 * settles ties rather than pre-empting them: an entry whose OUTCOME reads "the
 * db now lives at knowledge-v2.db" must still be reachable as `state`.
 */
const EXPERIENCE_TEMPLATE: RegExp[] = [
  /^#{1,4}\s*TRIGGER\b/im,
  /^#{1,4}\s*ACTION\b/im,
  /^#{1,4}\s*OUTCOME\b/im,
  /\bTRIGGER:\s/,
  /\bOUTCOME:\s/,
];

/**
 * Present-tense assertions of a value that is true *now*.
 *
 * Every one of these introduces something replaceable: where a thing lives,
 * which version is in use, what a setting defaults to. That is the shape that
 * rots, because the sentence stays readable long after the value stops being
 * true.
 */
const STATE_MARKERS: RegExp[] = [
  /\blives (?:at|in|under)\b/i,
  /\b(?:is|are) now\b/i,
  /\bcurrently\b/i,
  /\bdefaults? to\b/i,
  /\bthe default is\b/i,
  /\buse \S+ (?:not|instead of|rather than)\b/i,
  /\bcanonical (?:path|location|source|value|copy)\b/i,
  /\b(?:path|location|db|database|vault|port|threshold) is\b/i,
  /\boverride (?:via|with)\b/i,
  /\bsource of truth\b/i,
  /\blives on\b/i,
  /\bpoints? (?:at|to)\b/i,
];

/**
 * Past-tense narration of something that occurred.
 *
 * Note what is absent: bare "failed" or "broke". Those appear just as readily in
 * a state fact describing an ongoing incompatibility ("Node v24 breaks Smart
 * Connections") as in a story about a past debugging session, and including them
 * cost more than they bought.
 */
const EVENT_MARKERS: RegExp[] = [
  /\broot cause (?:was|turned out)\b/i,
  /\bturned out (?:to|that)\b/i,
  /\bwhen (?:I|we) tried\b/i,
  /\bthe fix was\b/i,
  /\bthe (?:bug|problem|issue) was\b/i,
  /\bwas caused by\b/i,
  /\bfixed in\b/i,
  /\b(?:discovered|learned|found) that\b/i,
  /\bhad to\b/i,
  /\bended up\b/i,
  /\bsession \d+\b/i,
  /\bwent wrong\b/i,
];

function firstMatch(text: string, patterns: RegExp[]): string[] {
  const hits: string[] = [];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) hits.push(m[0].trim());
  }
  return hits;
}

/** Tag list is a comma-joined blob; separators vary between writers. */
function hasTag(entry: KnowledgeIndexRow, tag: string): boolean {
  return (entry.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .includes(tag);
}

export function classify(entry: KnowledgeIndexRow): Classification {
  const content = entry.content ?? "";
  const key = entry.key ?? "";

  // Tier 1 — a failure. Decisive: only writeFailure emits these, and a failure
  // is always something that happened.
  const failure = firstMatch(content, FAILURE_STRUCTURE);
  if (failure.length > 0) {
    return { kind: "event", confidence: 0.9, signals: failure };
  }

  // Tier 2 — the `failure` tag, already the one semantically special tag in the
  // corpus: `storeFailure` prepends it, prefixes the key, and lifecycle.ts gives
  // it a 1.3x recall boost.
  if (hasTag(entry, "failure") || /^failure-/i.test(key)) {
    return { kind: "event", confidence: 0.85, signals: ["tagged `failure`"] };
  }

  // Tier 3 — word choice. Inference, and scored as such.
  const stateHits = firstMatch(content, STATE_MARKERS);
  const eventHits = firstMatch(content, EVENT_MARKERS);
  const margin = Math.abs(stateHits.length - eventHits.length);
  const decisive = margin >= 2 || stateHits.length === 0 || eventHits.length === 0;

  if ((stateHits.length > 0 || eventHits.length > 0) && decisive) {
    const isState = stateHits.length > eventHits.length;
    return {
      kind: isState ? "state" : "event",
      // Ceiling of 0.65 keeps every inferred verdict below the two decisive
      // tiers, so a report sorted by confidence reads strongest-evidence-first.
      confidence: Math.min(0.65, 0.4 + 0.1 * margin),
      signals: isState ? stateHits : eventHits,
    };
  }

  // Tier 4 — the template, as a tiebreaker only. Reached when word choice was
  // silent, or when it split near-evenly: an entry that narrates a change *and*
  // asserts its result ("Fixed the path; it now lives at knowledge-v2.db") is
  // exactly where a confident wrong label costs most, so the template's weak
  // event lean settles it rather than a coin flip on regex ordering.
  const template = firstMatch(content, EXPERIENCE_TEMPLATE);
  if (template.length > 0) {
    return {
      kind: "event",
      // Below every linguistic verdict. 84% of the corpus matches this; it is a
      // prior, not a finding.
      confidence: 0.3,
      signals: [...template, ...stateHits, ...eventHits],
    };
  }

  if (stateHits.length > 0 || eventHits.length > 0) {
    // Split evidence and no template to break it. Say so rather than guess.
    return { kind: null, confidence: 0, signals: [...stateHits, ...eventHits] };
  }

  return UNCLASSIFIED;
}

/**
 * The kind to act on: recorded if present, inferred otherwise.
 *
 * A recorded `fact_kind` came from whoever stored the entry. That beats a regex
 * over prose every time, so the classifier fills gaps rather than second-guessing
 * — and as entries acquire real labels, the heuristic quietly stops mattering.
 */
export function effectiveKind(entry: KnowledgeIndexRow): Classification {
  if (entry.fact_kind === "state" || entry.fact_kind === "event") {
    return { kind: entry.fact_kind, confidence: 1, signals: ["recorded `fact_kind`"] };
  }
  return classify(entry);
}
