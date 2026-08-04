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

/**
 * Infrastructure that has been retired, with what replaced it.
 *
 * Curated rather than inferred. A regex over content is precise here because
 * these are proper nouns — file and server names that either exist or do not —
 * whereas guessing obsolescence from prose would reintroduce exactly the
 * confidently-wrong proposals this rule exists to avoid.
 */
export interface RetiredReference {
  label: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Patterns match a *path*, not a mention.
 *
 * The first version matched the bare name anywhere, which flagged entries that
 * were entirely correct: notes naming the vault as one of three stores, and one
 * describing a historical bug in which a build pointed at the old directory.
 * Both reference retired infrastructure on purpose. Requiring an adjacent path
 * separator distinguishes an instruction to use the old thing — the only case
 * worth rewriting — from prose that merely names it.
 */
export const RETIRED_REFERENCES: RetiredReference[] = [
  {
    label: "knowledge-mcp",
    pattern: /knowledge-mcp[\\/]/i,
    replacement: "the open-brain server (ob_* tools)",
  },
  {
    label: "vault-utils.mjs",
    pattern: /vault-utils\.mjs/i,
    replacement: "removed in v0.5.3; see vault-writer.ts",
  },
  {
    label: "session-end-v2.mjs",
    pattern: /session-end-v2\.mjs|scripts[\\/]session-end/i,
    replacement: "build/cli-session-end.js",
  },
  {
    label: "v1 knowledge.db",
    pattern: /context-mode[\\/]knowledge\.db/i,
    replacement: "~/.claude/open-brain/knowledge-v2.db",
  },
  {
    label: "v1 vault path",
    // The v1 vault still exists as an archive, so this is a stale pointer
    // rather than a broken one — worth rewriting, not worth alarm. Only counts
    // when written as a path: `~/Obsidian Vault/…` or `Obsidian Vault\…`.
    pattern: /(?:~[\\/]|[A-Za-z]:[\\/](?:[^\s"']*[\\/])?)Obsidian Vault(?! v2)|Obsidian Vault(?! v2)[\\/]/,
    replacement: "~/Obsidian Vault v2",
  },
];

export interface ObsoleteOptions {
  retired?: RetiredReference[];
}

/**
 * Entries citing infrastructure that no longer exists.
 *
 * This is the staleness signal that can actually be verified. `findStale`
 * infers that an entry has outlived its use from disuse, but `ob_recall`
 * returned nothing for multi-word queries until July 2026 — so for most of this
 * corpus's life a low recall count records that an entry was unfindable, not
 * that it was unwanted. A reference to a deleted file carries no such
 * ambiguity.
 *
 * Proposes a rewrite, never a deletion: an entry whose lesson is still sound
 * but whose paths have moved wants updating, not removing.
 */
export function findObsoleteReferences(
  entries: KnowledgeIndexRow[],
  options: ObsoleteOptions = {},
): Candidate[] {
  const retired = options.retired ?? RETIRED_REFERENCES;
  const candidates: Candidate[] = [];

  for (const e of live(entries)) {
    const content = e.content ?? "";
    const hits = retired.filter((r) => r.pattern.test(content));
    if (hits.length === 0) continue;

    candidates.push({
      kind: "obsolete-reference",
      targetIds: [e.id],
      summary:
        `Entry ${e.id} ("${e.key}") cites ` +
        hits.map((h) => `${h.label} → ${h.replacement}`).join("; ") +
        `.`,
      evidence: hits.map((h) => ({
        source: "entry" as const,
        entryId: e.id,
        key: e.key ?? null,
        // Quote the sentence the reference sits in, so the proposal can be
        // judged without opening the entry.
        quote: excerpt(matchingSentence(content, h.pattern)),
      })),
      // Verifiable, so confident — but a rewrite still needs a human to decide
      // what the corrected text should say.
      confidence: retirementNarrated(content, hits) ? 0.35 : 0.8,
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Language suggesting the entry is recounting a retirement rather than relying
 * on the retired thing.
 *
 * Some of the most valuable entries cite an old path precisely because they
 * record its removal — "Deleted knowledge-mcp/", "dead vault-utils.mjs", "v1 …
 * used SQLite". Rewriting those would destroy the very history they exist to
 * preserve.
 *
 * This cannot be settled deterministically: separating "uses the old path" from
 * "narrates that the old path went away" is a semantic judgment, and that is
 * the model's job. So this lowers confidence rather than filtering, which keeps
 * the candidate visible for review while ranking it below the pointers that are
 * genuinely stale. Nothing auto-applies, so a mis-ranked candidate costs a
 * moment's reading, not a lost entry.
 */
function retirementNarrated(content: string, hits: RetiredReference[]): boolean {
  const markers =
    /\b(deleted|removed|dead|retired|legacy|deprecated|no longer|used to|formerly|old path|v1 of|replaced by|migrated (?:from|away))\b/i;
  return hits.some((h) => markers.test(matchingSentence(content, h.pattern)));
}

/** The sentence containing the first match, falling back to the whole text. */
function matchingSentence(text: string, pattern: RegExp): string {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (pattern.test(sentence)) return sentence;
  }
  return text;
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
