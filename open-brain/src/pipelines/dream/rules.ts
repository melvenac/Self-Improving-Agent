import type { KnowledgeIndexRow } from "../../db-v2.js";
import type { Candidate, Evidence } from "./types.js";

/**
 * Deterministic candidate rules over stored knowledge.
 *
 * Every function here is pure: entries in, candidates out, no clock and no
 * filesystem. That is what makes them testable against fixtures with no model
 * in the loop, and it is the reason the split in dream-design.md puts them in
 * the CLI rather than the skill.
 *
 * These rules *propose*. Nothing here decides — adjudication is the model's
 * job, and deletion belongs to the lifecycle rules that already own it.
 */

/** Entries archived into another are already resolved; they are not candidates. */
function live(entries: KnowledgeIndexRow[]): KnowledgeIndexRow[] {
  return entries.filter((e) => e.archived_into === null);
}

function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function entryEvidence(e: KnowledgeIndexRow): Evidence {
  return { source: "entry", entryId: e.id, key: e.key ?? null, quote: excerpt(e.content ?? "") };
}

/**
 * Normalise a key for comparison: case, punctuation and separator style vary
 * between the MCP path and hand-written entries, and none of that variation
 * makes two keys different.
 */
export function normaliseKey(key: string | null | undefined): string {
  return (key ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Content words, minus the filler that makes any two technical notes look alike. */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when", "of", "to",
  "in", "on", "at", "for", "with", "by", "from", "as", "is", "are", "was", "were",
  "be", "been", "it", "its", "this", "that", "these", "those", "not", "no", "so",
]);

export function tokenise(text: string): Set<string> {
  const tokens = (text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

/** Jaccard overlap. 1 = identical vocabulary, 0 = disjoint. */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const token of small) if (large.has(token)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Meaningful words within a key: `convex-deploy-notes` → {convex, deploy, notes}. */
export function keyTokens(key: string | null | undefined): Set<string> {
  return new Set(normaliseKey(key).split("-").filter((t) => t.length > 2));
}

export interface DuplicateOptions {
  /** Key overlap at or above this makes a pair a candidate. */
  keyThreshold?: number;
  /** Content overlap high enough to stand alone, regardless of the keys. */
  contentThreshold?: number;
}

/**
 * Pairs of entries that appear to say the same thing.
 *
 * Keyed primarily off the *key*, not the content. Measured across all 54,946
 * pairs in the live corpus, content overlap tops out at 0.386 — and the pair
 * scoring 0.386 (`traefik-docker-api-version` / `traefik-docker-29-api-version`,
 * a genuine near-duplicate) is indistinguishable from one at 0.379 that shares
 * only a topic. Long-form technical notes about one stack reuse the same
 * vocabulary whether or not they say the same thing, so content overlap alone
 * cannot separate a duplicate from a neighbour. Key overlap does: it ranked
 * that same pair at 1.00 and left the topical neighbours far below.
 *
 * Content is kept as an independent backstop for entries filed under unrelated
 * keys, at a threshold high enough that the corpus does not currently reach it.
 *
 * Deliberately quadratic — at a few hundred entries that is microseconds, and an
 * index would have to be kept correct for a gain nobody would notice.
 */
export function findDuplicates(
  entries: KnowledgeIndexRow[],
  options: DuplicateOptions = {},
): Candidate[] {
  const keyThreshold = options.keyThreshold ?? 0.5;
  const contentThreshold = options.contentThreshold ?? 0.7;
  const rows = live(entries);
  const ctok = new Map<number, Set<string>>();
  const ktok = new Map<number, Set<string>>();
  for (const e of rows) {
    ctok.set(e.id, tokenise(e.content));
    ktok.set(e.id, keyTokens(e.key));
  }

  const candidates: Candidate[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const normA = normaliseKey(a.key);
      const sameKey = normA !== "" && normA === normaliseKey(b.key);
      const keySim = similarity(ktok.get(a.id)!, ktok.get(b.id)!);
      const contentSim = similarity(ctok.get(a.id)!, ctok.get(b.id)!);

      if (!sameKey && keySim < keyThreshold && contentSim < contentThreshold) continue;

      let confidence: number;
      let summary: string;
      if (sameKey) {
        confidence = 0.9;
        summary = `Entries ${a.id} and ${b.id} share the key "${a.key}".`;
      } else if (keySim >= keyThreshold) {
        // Weighted toward the key, with content able to raise or temper it.
        confidence = Math.min(0.85, keySim * 0.7 + contentSim * 0.3);
        summary =
          `Entries ${a.id} ("${a.key}") and ${b.id} ("${b.key}") have ` +
          `${Math.round(keySim * 100)}% key overlap and ${Math.round(contentSim * 100)}% content overlap.`;
      } else {
        confidence = Math.min(0.85, contentSim);
        summary = `Entries ${a.id} and ${b.id} overlap ${Math.round(contentSim * 100)}% in content despite unrelated keys.`;
      }

      candidates.push({
        kind: "duplicate",
        targetIds: [a.id, b.id],
        summary,
        evidence: [entryEvidence(a), entryEvidence(b)],
        confidence,
      });
    }
  }
  return candidates.sort((x, y) => y.confidence - x.confidence);
}

export interface StaleOptions {
  /** Evaluation time, passed in so the rule stays pure and reproducible. */
  now: Date;
  /**
   * Days without a recall before an entry is considered stale.
   *
   * 120 rather than 90 because of what the live corpus does at each setting:
   * 90 days flags 167 of 332 entries — half the knowledge base, which is not a
   * report anyone reviews. 120 gives 86. The corpus only spans ~140 days, so
   * disuse thresholds below its own age flag a large fraction by construction;
   * expect to raise this as the corpus ages.
   */
  unusedDays?: number;
  /** Recall count at or below which an entry counts as unused. */
  maxRecalls?: number;
}

/**
 * Entries that look like they have outlived their usefulness.
 *
 * Proposes only. Apoptosis already prunes on success rate, and two systems must
 * not both delete — so this deliberately ignores harmful/success_rate and looks
 * purely at disuse, which apoptosis does not consider.
 */
export function findStale(entries: KnowledgeIndexRow[], options: StaleOptions): Candidate[] {
  const unusedDays = options.unusedDays ?? 120;
  const maxRecalls = options.maxRecalls ?? 1;
  const cutoff = options.now.getTime() - unusedDays * 24 * 60 * 60 * 1000;

  const candidates: Candidate[] = [];
  for (const e of live(entries)) {
    if (e.recall_count > maxRecalls) continue;

    // Never recalled: judge by age, so a note written yesterday is not stale
    // merely because nothing has needed it yet.
    const reference = e.last_recalled_at ?? e.created_at;
    if (!reference) continue;
    const referenceMs = Date.parse(reference);
    if (Number.isNaN(referenceMs) || referenceMs > cutoff) continue;

    const days = Math.floor((options.now.getTime() - referenceMs) / (24 * 60 * 60 * 1000));
    const neverRecalled = e.last_recalled_at === null;

    candidates.push({
      kind: "stale",
      targetIds: [e.id],
      summary: neverRecalled
        ? `Entry ${e.id} ("${e.key}") has never been recalled in ${days} days since it was written.`
        : `Entry ${e.id} ("${e.key}") was last recalled ${days} days ago and has ${e.recall_count} recall(s).`,
      evidence: [entryEvidence(e)],
      // Mature entries earned their standing; disuse is weaker evidence against
      // them than against something that never proved itself.
      confidence: e.maturity === "mature" ? 0.4 : neverRecalled ? 0.7 : 0.6,
    });
  }
  return candidates;
}
