/**
 * T-332 (RSI research #3; option C of docs/loops/t332-measure.md): the evidence report, SHADOW ONLY.
 *
 * Which lessons carry a pointer that resolves (a commit sha, a tests/ path, a docs/loops/ path, a CI run id), and
 * which recall-trigger injections a gate on that would have withheld. It changes nothing: the store is opened
 * read-only, no column or table is added, and no recall path reads this module. Turning the shadow into a gate is
 * Aaron's ruling, not this task's.
 *
 * PR numbers are found and reported apart, as WEAK, and never count as evidence: SIA has over a thousand PRs, so
 * almost any "#N" resolves (the measure: 69 of 149 lenient passes rested on a PR number alone).
 *
 * The resolver is a parameter, so a test decides what exists and never depends on git state. Memory side:
 * `pipelines/store/` is in MEMORY_SIDE.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

export type PointerKind = "sha" | "test" | "loop" | "run" | "pr";

export interface Pointer {
  kind: PointerKind;
  value: string;
}

/** Answers "does this exist?" for each strong kind. With no `run`, every CI run id stays unresolved. */
export interface EvidenceResolver {
  sha(sha: string): boolean;
  path(path: string): boolean;
  run?(id: string): boolean;
}

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const SHA = /\b[0-9a-f]{7,40}\b/g;
const TEST_PATH = /(?:[\w.-]+\/)*tests?\/[\w./-]+\.(?:ts|js|mjs|cjs|tsx|py)\b/g;
const LOOP_PATH = /docs\/loops\/[\w./-]+\.(?:md|json)\b/g;
const RUN_ID = /\b(?:run(?:\s+id)?|runs\/|run_id[=:]?)\s*#?(\d{9,12})\b/gi;
const PR_NUMBER = /(?:\bPR\s*#?|\bpull\/|(?:^|[\s(])#)(\d{1,5})\b/g;

/** Every pointer-like string in `text`, once each, in kind order. Finding is not resolving. */
export function extractPointers(text: string): Pointer[] {
  const out: Pointer[] = [];
  const seen = new Set<string>();
  const add = (kind: PointerKind, value: string): void => {
    const k = `${kind}:${value}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ kind, value });
  };
  // A session UUID's first group is 8 hex digits and reads as a short sha, so UUIDs go before the sha scan.
  for (const m of text.replace(UUID, " ").matchAll(SHA)) {
    // "defaced" is hex and 1234567 is a number; a sha here needs a digit and a letter.
    if (/[0-9]/.test(m[0]) && /[a-f]/.test(m[0])) add("sha", m[0]);
  }
  for (const m of text.matchAll(TEST_PATH)) add("test", m[0]);
  for (const m of text.matchAll(LOOP_PATH)) add("loop", m[0]);
  for (const m of text.matchAll(RUN_ID)) add("run", m[1] ?? "");
  for (const m of text.matchAll(PR_NUMBER)) if (Number(m[1]) > 0) add("pr", m[1] ?? "");
  return out;
}

/** The strong pointers that resolve. A PR number is never one of them. */
export function resolvedPointers(pointers: readonly Pointer[], resolver: EvidenceResolver): Pointer[] {
  return pointers.filter((p) => {
    if (p.kind === "sha") return resolver.sha(p.value);
    if (p.kind === "test" || p.kind === "loop") return resolver.path(p.value);
    if (p.kind === "run") return resolver.run ? resolver.run(p.value) : false;
    return false; // pr: weak, reported apart
  });
}

/** The strict gate the shadow measures: at least one strong pointer resolves. */
export function isEvidenced(pointers: readonly Pointer[], resolver: EvidenceResolver): boolean {
  return resolvedPointers(pointers, resolver).length > 0;
}

/** The store, opened so that nothing this module does can write to it, and refused when it does not exist. */
export function openStoreReadOnly(dbPath: string): Database.Database {
  return new Database(dbPath, { readonly: true, fileMustExist: true });
}

export interface EvidenceReportOptions {
  /** ISO timestamp the window ends at, inclusive. */
  asOf: string;
  /** Window length in days, ending at `asOf`. */
  days: number;
}

export interface MonthRow {
  month: string;
  entries: number;
  evidenced: number;
  prOnly: number;
}

export interface WithheldEntry {
  id: number;
  key: string;
  injections: number;
}

export interface EvidenceReport {
  asOf: string;
  since: string;
  days: number;
  /** Live entries (archived_into IS NULL). */
  entries: number;
  evidenced: number;
  /** Not evidenced, but carrying a PR number: what a PR-counting gate would have let through. */
  prOnly: number;
  byMonth: MonthRow[];
  windowEntries: number;
  windowEvidenced: number;
  /** Ids served by trigger fires in state 'injected' inside the window, counted per id per fire. */
  injections: number;
  injectionsEvidenced: number;
  injectedEntries: number;
  injectedEntriesEvidenced: number;
  /** Injected in the window and not evidenced: what the gate would have withheld, most-served first. */
  withheld: WithheldEntry[];
  runResolver: boolean;
}

interface EntryRow {
  id: number;
  key: string | null;
  content: string;
  tags: string | null;
  source: string | null;
  created_at: string;
}

/** Read-only. Counts what a strict evidence gate would keep and withhold; gates nothing. */
export function evidenceReport(dbPath: string, resolver: EvidenceResolver, opts: EvidenceReportOptions): EvidenceReport {
  const asOf = opts.asOf;
  const since = new Date(Date.parse(asOf) - opts.days * 86_400_000).toISOString();
  const inWindow = (ts: string): boolean => ts >= since && ts <= asOf;

  // One answer per distinct pointer: the live store repeats shas and paths across entries.
  const memo = new Map<string, boolean>();
  const cached: EvidenceResolver = {
    sha: (v) => memoize(memo, `sha:${v}`, () => resolver.sha(v)),
    path: (v) => memoize(memo, `path:${v}`, () => resolver.path(v)),
    ...(resolver.run ? { run: (v: string) => memoize(memo, `run:${v}`, () => resolver.run!(v)) } : {}),
  };

  const db = openStoreReadOnly(dbPath);
  try {
    const rows = db
      .prepare("SELECT id, key, content, tags, source, created_at FROM knowledge_index WHERE archived_into IS NULL")
      .all() as EntryRow[];
    const evidenced = new Map<number, boolean>();
    const keys = new Map<number, string>();
    const months = new Map<string, MonthRow>();
    let evidencedCount = 0;
    let prOnly = 0;
    let windowEntries = 0;
    let windowEvidenced = 0;
    for (const r of rows) {
      const pointers = extractPointers([r.content, r.source ?? "", r.key ?? "", r.tags ?? ""].join("\n"));
      const ok = isEvidenced(pointers, cached);
      const weak = !ok && pointers.some((p) => p.kind === "pr");
      evidenced.set(r.id, ok);
      keys.set(r.id, r.key ?? "");
      const month = r.created_at.slice(0, 7);
      const row = months.get(month) ?? { month, entries: 0, evidenced: 0, prOnly: 0 };
      row.entries++;
      if (ok) row.evidenced++;
      if (weak) row.prOnly++;
      months.set(month, row);
      if (ok) evidencedCount++;
      if (weak) prOnly++;
      if (inWindow(r.created_at)) {
        windowEntries++;
        if (ok) windowEvidenced++;
      }
    }

    const fires = db
      .prepare("SELECT injected_ids, created_at FROM trigger_fires WHERE state = 'injected'")
      .all() as Array<{ injected_ids: string; created_at: string }>;
    const served = new Map<number, number>();
    for (const f of fires) {
      if (!inWindow(f.created_at)) continue;
      let ids: unknown;
      try {
        ids = JSON.parse(f.injected_ids);
      } catch {
        continue;
      }
      if (!Array.isArray(ids)) continue;
      for (const id of ids) if (typeof id === "number") served.set(id, (served.get(id) ?? 0) + 1);
    }
    let injections = 0;
    let injectionsEvidenced = 0;
    let injectedEntriesEvidenced = 0;
    const withheld: WithheldEntry[] = [];
    for (const [id, n] of served) {
      injections += n;
      // An id no longer live counts as not evidenced: nothing is left to point from.
      if (evidenced.get(id) === true) {
        injectionsEvidenced += n;
        injectedEntriesEvidenced++;
      } else {
        withheld.push({ id, key: keys.get(id) ?? "(not live)", injections: n });
      }
    }
    withheld.sort((a, b) => b.injections - a.injections || a.id - b.id);

    return {
      asOf,
      since,
      days: opts.days,
      entries: rows.length,
      evidenced: evidencedCount,
      prOnly,
      byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
      windowEntries,
      windowEvidenced,
      injections,
      injectionsEvidenced,
      injectedEntries: served.size,
      injectedEntriesEvidenced,
      withheld,
      runResolver: resolver.run !== undefined,
    };
  } finally {
    db.close();
  }
}

function memoize(memo: Map<string, boolean>, key: string, compute: () => boolean): boolean {
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  memo.set(key, value);
  return value;
}

const pct = (n: number, d: number): string => (d === 0 ? "0.0%" : `${((100 * n) / d).toFixed(1)}%`);

export function renderEvidenceReport(r: EvidenceReport, top = 20): string {
  const lines = [
    `evidence report (shadow: nothing is gated, nothing is written), window ${r.days} days ${r.since} .. ${r.asOf}`,
    `entries: ${r.entries} live; evidenced ${r.evidenced} (${pct(r.evidenced, r.entries)}); PR number only ${r.prOnly} (weak, never counts)`,
    `  by month: ${r.byMonth.map((m) => `${m.month} ${m.evidenced}/${m.entries}`).join(", ")}`,
    `new in window: ${r.windowEntries}; evidenced ${r.windowEvidenced} (${pct(r.windowEvidenced, r.windowEntries)})`,
    `trigger injections in window: ${r.injections}; of an evidenced entry ${r.injectionsEvidenced} (${pct(r.injectionsEvidenced, r.injections)}); entries ${r.injectedEntries}, evidenced ${r.injectedEntriesEvidenced}`,
    `a gate would have withheld ${r.injections - r.injectionsEvidenced} injection(s) of ${r.withheld.length} entr${r.withheld.length === 1 ? "y" : "ies"}:`,
    ...r.withheld.slice(0, top).map((w) => `  ${w.id} ${w.key} (${w.injections})`),
  ];
  if (r.withheld.length > top) lines.push(`  ... ${r.withheld.length - top} more`);
  if (!r.runResolver) lines.push("CI run ids are not resolved by this resolver: an entry whose only pointer is a run id counts as not evidenced.");
  return lines.join("\n");
}

/**
 * The CLI's resolver: a sha resolves when `git cat-file -e <sha>^{commit}` succeeds in `repoRoot`, a path when HEAD's
 * tree holds it (as written, or under open-brain/). No network, so no run resolver. Throws when `repoRoot` is not a
 * git checkout, rather than reporting every pointer unresolved.
 */
export function gitResolver(repoRoot: string): EvidenceResolver {
  // --full-tree: run from open-brain/, ls-tree would otherwise list only that subtree, relative to it.
  const ls = spawnSync("git", ["-C", repoRoot, "ls-tree", "-r", "--full-tree", "--name-only", "HEAD"], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (ls.status !== 0) throw new Error(`${repoRoot} is not a git checkout with a HEAD (git ls-tree exited ${ls.status})`);
  const files = new Set(ls.stdout.split("\n").filter((f) => f !== ""));
  return {
    sha: (sha) => spawnSync("git", ["-C", repoRoot, "cat-file", "-e", `${sha}^{commit}`], { stdio: "ignore" }).status === 0,
    path: (p) => files.has(p) || files.has(`open-brain/${p}`),
  };
}

/** T-333: the direct children of `dir` that are git checkouts. A worktree's `.git` is a file, and counts. */
export function reposUnder(dir: string): string[] {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((p) => existsSync(join(p, ".git")))
    .sort();
}

/**
 * Every commit object in a repo, sorted, from one spawn. `cat-file -e` per sha per repo is thousands of spawns over
 * the live store; this is one per repo, and like `cat-file` it sees unreachable commits and refuses blobs and trees.
 */
function commitsIn(repoRoot: string): string[] {
  const r = spawnSync("git", ["-C", repoRoot, "cat-file", "--batch-all-objects", "--batch-check=%(objecttype) %(objectname)"], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) throw new Error(`git cat-file exited ${r.status ?? r.error?.message}`);
  return r.stdout
    .split("\n")
    .filter((l) => l.startsWith("commit "))
    .map((l) => l.slice("commit ".length))
    .sort();
}

/** Does any sha in the sorted list start with `prefix`? */
function hasPrefix(sorted: readonly string[], prefix: string): boolean {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sorted[mid] ?? "") < prefix) lo = mid + 1;
    else hi = mid;
  }
  return (sorted[lo] ?? "").startsWith(prefix);
}

export interface RepoSet {
  resolver: EvidenceResolver;
  repos: string[];
  /** Repos that could not be read. Named in the report, so a smaller set never passes for a full one. */
  skipped: Array<{ repo: string; reason: string }>;
}

/**
 * T-333: a pointer resolves when ANY of `roots` holds it, as the T-332 measure resolved shas (lenient, "any of 25
 * repos"). A root that cannot be read is skipped and named; no readable root at all throws, rather than reporting
 * every pointer unresolved.
 */
export function repoSetResolver(roots: readonly string[]): RepoSet {
  const readable: Array<{ repo: string; commits: string[]; path: (p: string) => boolean }> = [];
  const skipped: RepoSet["skipped"] = [];
  for (const repo of new Set(roots)) {
    try {
      readable.push({ repo, commits: commitsIn(repo), path: gitResolver(repo).path });
    } catch (err) {
      skipped.push({ repo, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  if (readable.length === 0) throw new Error(`no readable git checkout among ${roots.length} root(s)`);
  return {
    resolver: {
      sha: (sha) => readable.some((r) => hasPrefix(r.commits, sha)),
      path: (p) => readable.some((r) => r.path(p)),
    },
    repos: readable.map((r) => r.repo),
    skipped,
  };
}

export function renderResolverScope(set: RepoSet): string {
  return [
    `pointers resolved against ${set.repos.length} repo(s), any one is enough; skipped ${set.skipped.length}`,
    ...set.skipped.map((s) => `  skipped ${s.repo}: ${s.reason}`),
  ].join("\n");
}

export type GhRunner = (args: string[]) => { status: number | null; stderr: string };

const ghSpawn: GhRunner = (args) => {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  return { status: r.status, stderr: r.stderr ?? r.error?.message ?? "" };
};

/**
 * T-333: the opt-in run resolver, and the only network this module does. A 404 means the run does not exist. Any other
 * failure (no gh, no auth, offline) throws: reported as "unresolved", it would read as a store with no evidence.
 */
export function ghRunResolver(slug: string, gh: GhRunner = ghSpawn): (id: string) => boolean {
  return (id) => {
    const r = gh(["api", `repos/${slug}/actions/runs/${id}`, "--silent"]);
    if (r.status === 0) return true;
    if (r.stderr.includes("HTTP 404")) return false;
    throw new Error(`gh could not answer for run ${id} (exit ${r.status}): ${r.stderr.trim().slice(0, 200)}`);
  };
}
