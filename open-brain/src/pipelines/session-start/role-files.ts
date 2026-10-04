import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { AgentIdentity } from "./agent-identity.js";
import { gitShow } from "./git-read.js";

/**
 * Loads the seat's role knowledge and says where it came from.
 *
 * ## Why this exists: C1's remainder, which is G-032
 *
 * C1 shipped seat identity per checkout (`AGENT.local.md`) and tracked the role
 * knowledge in `.agents/roles/`. **Nothing read it.** A grep across
 * `open-brain/src` and `.claude/commands` for `agents/roles` returned nothing,
 * across two loops. C1's own acceptance criterion, set 2026-09-17, was
 * *"if `/start` does not consult it, it does not exist"* — so C1's warning
 * outlived C1.
 *
 * **A tracked file that nothing reads is an intention with a `git add`.** The
 * point of this module is the reading. It returns the CONTENT, not only the
 * filenames: naming a file the greeting never loaded would satisfy the letter of
 * "the greeting says it did" and leave G-032 standing.
 *
 * ## What it reports and why each is separate
 *
 * A seat must be able to tell these apart, because they mislead differently:
 *
 * - **absent** — the role has no file. The live case when this was written:
 *   tracked `AGENT.md` declares `role: builder`, the closed seat set is
 *   planner / developer / qa, and there is no `roles/builder.md`. A checkout
 *   with no `AGENT.local.md` resolves a role whose rules do not exist, and
 *   before this it did so silently.
 * - **untracked** — the file is there and is on one disk. That is the defect
 *   `roles/` was created to fix, so a local-only role file is reported rather
 *   than read as knowledge the project holds.
 * - **stale** — the working copy differs from HEAD's blob. This is the one that
 *   actively misleads: the seat reads rules the repository does not have.
 * - **behindUpstream** — HEAD's blob differs from `origin/master`'s. **Recorded
 *   only, never called stale.** A tree that has not merged is not a tree whose
 *   working copy lies about itself, and collapsing the two would make an
 *   ordinary unmerged branch look like a corrupted checkout.
 *
 * Commit resolution refuses to invent an answer: outside a git repository, or
 * for a file git does not know, `commit` is null WITH a note. Null is not "no
 * changes" and must never render as one.
 */

/**
 * The closed set of seats, matching the harness's `RoleName`
 * (`harness/roles.ts`). Declared here rather than imported because this module
 * is session-start and the harness is the loop runtime; the duplication is one
 * line and asserted equal by test, whereas the import would tie the greeting to
 * the runtime.
 */
export const ROLE_NAMES = ["planner", "developer", "qa"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

/**
 * A checkout that is deliberately NOT a seat.
 *
 * The main checkout is infrastructure: both session hooks hardcode paths into it
 * and the MCP server runs from its build. It is not a seat and should be able to
 * say so, rather than being forced to claim one because a tracked `AGENT.md` has
 * to name something. Before this it declared `role: builder`, which was outside
 * the closed set and had no role file — an accident that read as a seat.
 *
 * `none` is a READ-side value only. It never enters the record: `set_handoff`
 * takes `SeatName`, so the seat a handoff is filed under is named in the op
 * itself. A write from such a checkout is NOT refused: it is applied with the
 * checkout's seat null (bootstrap-fix BF-5; QA 135 applied one). This comment
 * used to say the schema refuses it, which was false.
 */
export const NOT_A_SEAT = "none";

export interface RoleFileReport {
  /** Repo-relative, always in POSIX form so it reads the same on every platform. */
  rel: string;
  /** Which seat this file belongs to, or "shared" for the file every seat holds. */
  owner: string;
  present: boolean;
  tracked: boolean;
  /** The working copy — what the seat would actually read. Null when absent. */
  content: string | null;
  /** Last commit touching this path. Null when unresolvable, always with a `note`. */
  commit: string | null;
  commitDate: string | null;
  /** Working copy differs from HEAD's blob. The misleading case. */
  stale: boolean;
  /** HEAD's blob differs from origin/master's. Recorded; never treated as stale. */
  behindUpstream: boolean;
  /** Why a field could not be resolved. Null when everything resolved. */
  note: string | null;
}

export interface RoleFilesResult {
  seat: AgentIdentity | null;
  files: RoleFileReport[];
  /** Ready to print. Never empty. */
  lines: string[];
  /** Conditions a seat must be told about. Empty when everything is clean. */
  problems: string[];
}

const ROLES_DIR = ".agents/roles";
const SHARED_REL = `${ROLES_DIR}/shared.md`;

export interface DescribeRoleFilesOptions {
  /**
   * Read every role file from this ref (`git show`) instead of the working copy (T-200). Set
   * when the record is read from origin/master, so the rules a seat holds come from the same
   * source as the state it is briefed on. Identity stays local: AGENT.local.md is untracked and
   * is the seat's own.
   */
  fromRef?: string;
}

export function describeRoleFiles(
  projectRoot: string,
  seat: AgentIdentity | null,
  options: DescribeRoleFilesOptions = {},
): RoleFilesResult {
  const problems: string[] = [];
  const lines0: string[] = [];
  const inGit = git(projectRoot, ["rev-parse", "--is-inside-work-tree"]) === "true";

  const wanted: Array<{ rel: string; owner: string }> = [];
  const notASeat = seat?.role === NOT_A_SEAT;

  if (notASeat) {
    // Declared, not guessed. No role file is looked for and NO PROBLEM is
    // raised: an infrastructure checkout that says it is not a seat is correct,
    // and reporting it as a missing role file would train readers to ignore the
    // line that matters.
    lines0.push(`This checkout is NOT A SEAT (${seat!.name}, role: ${NOT_A_SEAT}) — no seat-specific role file is expected here.`);
    // This line said set_handoff was REFUSED from such a checkout. It is not: the
    // writer records the session with no seat, and set_handoff names its own seat
    // (verified, record 127). After bootstrap-fix BF-5 every fresh install reads
    // this line at every /start, so it has to be true.
    lines0.push(`  Its sessions are recorded with no seat; a set_handoff names its seat in the op.`);
  } else if (seat) {
    wanted.push({ rel: `${ROLES_DIR}/${seat.role}.md`, owner: seat.role });
    if (!(ROLE_NAMES as readonly string[]).includes(seat.role)) {
      problems.push(
        `SEAT ROLE "${seat.role}" IS OUTSIDE THE CLOSED SET (${ROLE_NAMES.join(" / ")}) — ` +
          `this seat's role knowledge cannot be located by name, and the harness would not accept it as a stage role either. ` +
          `A checkout that is deliberately not a seat declares role: ${NOT_A_SEAT}.`
      );
    }
  } else {
    problems.push(
      `NO SEAT IDENTITY RESOLVED — neither .agents/AGENT.local.md nor .agents/AGENT.md yielded a name and role, ` +
        `so no seat-specific role file could be chosen. Only ${SHARED_REL} was loaded.`
    );
  }
  // shared.md is every seat's, and it loads even when identity did not resolve:
  // a session that cannot say who it is still has to obey the rules everyone has.
  wanted.push({ rel: SHARED_REL, owner: "shared" });

  const fromRef = options.fromRef;
  const files = wanted.map(({ rel, owner }) =>
    fromRef ? readOneFromRef(projectRoot, rel, owner, fromRef) : readOne(projectRoot, rel, owner, inGit),
  );

  for (const f of files) {
    if (!f.present) {
      // A checkout that declares it is not a seat has no seat rules to be
      // missing — a fresh /bootstrap install is one (bootstrap-fix BF-5,
      // frogger F8). shared.md is still loaded when it is there.
      if (notASeat) continue;
      problems.push(
        `ROLE FILE MISSING: ${f.rel} does not exist ${fromRef ? `at ${fromRef}` : "— the \"" + f.owner + "\" seat's rules are not in this checkout"}${fromRef && f.note ? ` (${f.note})` : ""}. ` +
          `This is absence, not an empty ruleset.`
      );
      continue;
    }
    if (!f.tracked) {
      problems.push(
        `ROLE FILE UNTRACKED: ${f.rel} exists but git does not know it — it is on this disk only, invisible to a ` +
          `fresh clone and destroyed by moving the worktree. That is the defect ${ROLES_DIR} exists to fix.`
      );
    }
    if (f.stale) {
      problems.push(
        `ROLE FILE STALE: ${f.rel} differs from HEAD's blob — the rules being read here are NOT the rules the ` +
          `repository holds. Commit the change or discard it before trusting either.`
      );
    }
  }

  return { seat, files, lines: [...lines0, ...render(files, inGit, notASeat, fromRef)], problems };
}

function render(files: RoleFileReport[], inGit: boolean, notASeat: boolean, fromRef?: string): string[] {
  const lines: string[] = [
    `Role knowledge loaded${fromRef ? ` from ${fromRef}` : ""} (${files.filter((f) => f.present).length} of ${files.length}):`,
  ];
  for (const f of files) {
    if (!f.present) {
      lines.push(`  ${f.rel} — ABSENT (${f.owner}${notASeat ? "; not a seat, so none is expected" : ""})`);
      continue;
    }
    const where = f.commit
      ? `@ ${f.commit.slice(0, 7)}${f.commitDate ? ` ${f.commitDate.slice(0, 10)}` : ""}`
      : `@ no commit resolved${f.note ? ` — ${f.note}` : ""}`;
    const flags = [f.stale ? "STALE vs HEAD" : null, !f.tracked ? "UNTRACKED" : null, f.behindUpstream ? "behind origin/master" : null]
      .filter(Boolean)
      .join(", ");
    lines.push(`  ${f.rel} ${where}${flags ? ` [${flags}]` : ""}`);
  }
  if (!inGit) {
    lines.push(`  (not inside a git work tree — commits could not be resolved; this is not a claim that the files are current)`);
  }
  return lines;
}

/**
 * A role file as `ref` holds it: content by `git show`, its commit from the log of that ref. The
 * working-copy questions do not apply — it is tracked by construction, cannot differ from HEAD's
 * blob, and there is no upstream to be behind — so those fields are fixed rather than derived.
 * A file absent at the ref is ABSENT, with git's own reason in `note`.
 */
function readOneFromRef(projectRoot: string, rel: string, owner: string, ref: string): RoleFileReport {
  const base: RoleFileReport = {
    rel,
    owner,
    present: false,
    tracked: true,
    content: null,
    commit: null,
    commitDate: null,
    stale: false,
    behindUpstream: false,
    note: null,
  };
  const shown = gitShow(projectRoot, ref, rel);
  if (!shown.ok) return { ...base, note: shown.cause };
  const log = git(projectRoot, ["log", "-1", "--format=%H%x00%cI", ref, "--", rel]);
  const [commit, commitDate] = log ? log.split(" ") : [null, null];
  return {
    ...base,
    present: true,
    content: shown.text,
    commit: commit || null,
    commitDate: commitDate || null,
    note: commit ? null : `no commit at ${ref} touches this path`,
  };
}

function readOne(projectRoot: string, rel: string, owner: string, inGit: boolean): RoleFileReport {
  const abs = join(projectRoot, rel);
  const base: RoleFileReport = {
    rel,
    owner,
    present: false,
    tracked: false,
    content: null,
    commit: null,
    commitDate: null,
    stale: false,
    behindUpstream: false,
    note: null,
  };

  if (!existsSync(abs)) return base;
  let content: string;
  try {
    content = readFileSync(abs, "utf8");
  } catch (err) {
    return { ...base, present: true, note: `unreadable: ${(err as Error).message}` };
  }

  if (!inGit) {
    return { ...base, present: true, content, note: "not inside a git work tree" };
  }

  // `ls-files --error-unmatch` is the tracked/untracked question asked directly,
  // rather than inferred from an empty `git log` — which is the same answer for
  // an untracked file and for a tracked file with no history.
  const tracked = git(projectRoot, ["ls-files", "--error-unmatch", rel]) !== null;
  if (!tracked) {
    return { ...base, present: true, content, tracked: false, note: "not tracked by git" };
  }

  const log = git(projectRoot, ["log", "-1", "--format=%H%x00%cI", "--", rel]);
  const [commit, commitDate] = log ? log.split("\0") : [null, null];

  // `diff --quiet` exits non-zero when there IS a difference, which `git()`
  // reports as null. Distinguishing "no diff" from "the command failed" matters,
  // so the diff is taken by name rather than by exit code.
  const changed = git(projectRoot, ["diff", "--name-only", "HEAD", "--", rel]);
  const stale = changed !== null && changed.length > 0;

  return {
    ...base,
    present: true,
    tracked: true,
    content,
    commit: commit || null,
    commitDate: commitDate || null,
    stale,
    behindUpstream: isBehindUpstream(projectRoot, rel),
    note: commit ? null : "tracked but no commit touches this path",
  };
}

/**
 * Compares the blob at HEAD with the blob at origin/master for one path.
 *
 * Blob ids, not a diff: a path identical on both sides has the same object id
 * whatever the surrounding history, so this answers "is my copy of this file the
 * one master has" without walking commits. Absent upstream ref, or a path absent
 * on either side, yields false — this is a RECORDED observation and an
 * unanswerable one must not read as a positive.
 */
function isBehindUpstream(projectRoot: string, rel: string): boolean {
  const here = git(projectRoot, ["rev-parse", `HEAD:${rel}`]);
  const there = git(projectRoot, ["rev-parse", `origin/master:${rel}`]);
  if (here === null || there === null) return false;
  return here !== there;
}

/**
 * T-236 slice 1 (closes T-183): the role docs, printed in full only when their content changed since
 * THIS seat last read them in THIS checkout; otherwise one line. Opt-in per repo (`role_docs_by_sha`
 * in greeting.json); off, the output is exactly what it was before.
 *
 * ## Where the last read lives, and why
 *
 * `.agents/role-reads.local.json`, untracked (the `.agents` allowlist ignores it), keyed by seat. Per
 * CHECKOUT by construction: every worktree has its own `.agents/`, so no two checkouts share it. Per
 * SEAT by key: a checkout whose declared seat changes reads its rules again. It is never a file two
 * seats share without keys.
 *
 * ## Fail toward reading
 *
 * A first read, an unknown seat, or a store that cannot be read prints in FULL: a seat that skipped
 * its rules because an instrument said it had read them is the PRD-unread failure. The read is
 * recorded only for text that was actually printed, by the caller, after it is in the output
 * (`recordRoleReads`); describing or measuring the greeting never records.
 */
export const ROLE_READS_REL = ".agents/role-reads.local.json";

/** git's blob id of the content: equal to `git rev-parse HEAD:<path>` when the working copy is clean. */
export function blobSha(content: string): string {
  const body = Buffer.from(content, "utf8");
  return createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest("hex");
}

/** The store key for a seat, or null when there is no seat to remember a read for. */
export function roleReadsKey(seat: AgentIdentity | null): string | null {
  if (!seat || seat.role === NOT_A_SEAT) return null;
  return `${seat.name}/${seat.role}`;
}

type RoleReads = Record<string, Record<string, { sha: string; read_at: string }>>;

function readRoleReads(projectRoot: string): { ok: true; seats: RoleReads } | { ok: false; reason: string } {
  const abs = join(projectRoot, ROLE_READS_REL);
  if (!existsSync(abs)) return { ok: true, seats: {} };
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(abs, "utf8"));
  } catch (err) {
    return { ok: false, reason: `${ROLE_READS_REL} unreadable (${(err as Error).message})` };
  }
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObj(data) || !isObj(data.seats)) return { ok: false, reason: `${ROLE_READS_REL} has no seats object` };
  for (const reads of Object.values(data.seats)) {
    if (!isObj(reads)) return { ok: false, reason: `${ROLE_READS_REL} has a malformed seat entry` };
    for (const r of Object.values(reads)) {
      if (!isObj(r) || typeof r.sha !== "string" || typeof r.read_at !== "string") {
        return { ok: false, reason: `${ROLE_READS_REL} has a malformed read entry` };
      }
    }
  }
  return { ok: true, seats: data.seats as RoleReads };
}

export interface RoleDocsRender {
  lines: string[];
  /** What this render printed in full, with the sha it printed: the only reads the caller may record. */
  printedFull: Array<{ rel: string; sha: string }>;
}

export function renderRoleDocs(projectRoot: string, files: RoleFileReport[], seat: AgentIdentity | null, bySha: boolean): RoleDocsRender {
  const lines: string[] = [];
  const printedFull: RoleDocsRender["printedFull"] = [];
  const key = bySha ? roleReadsKey(seat) : null;
  const store = bySha && key !== null ? readRoleReads(projectRoot) : null;
  if (bySha && key === null) lines.push(`\n(Role docs in full: no seat resolved, so there is no last read to compare with.)`);
  if (store && !store.ok) lines.push(`\n(Role docs in full: ${store.reason}.)`);
  const mine = store?.ok && key !== null ? store.seats[key] ?? {} : null;
  for (const f of files) {
    if (f.content === null) continue;
    const sha = blobSha(f.content);
    const last = mine?.[f.rel];
    if (last && last.sha === sha) {
      lines.push(`\n${f.rel} @ ${sha.slice(0, 12)} (unchanged since your last read: ${last.read_at})`);
      continue;
    }
    lines.push(`\n## ${f.rel}${f.commit ? ` @ ${f.commit.slice(0, 7)}` : ""}`);
    lines.push(f.content.replace(/\s+$/, ""));
    // Off, nothing is recordable: the repo did not opt in, so this render must leave no trace.
    if (bySha) printedFull.push({ rel: f.rel, sha });
  }
  return { lines, printedFull };
}

/**
 * Records `printed` as this seat's last read. Call it only with a render's `printedFull`, after those
 * lines are in the output. Returns a line to print when the record could not be written (the next
 * /start then prints in full again, which is the safe direction), else null. An unreadable store is
 * replaced: keeping it would print every doc in full forever, and its other seats read again once.
 */
export function recordRoleReads(projectRoot: string, seat: AgentIdentity | null, printed: RoleDocsRender["printedFull"], now: Date): string | null {
  const key = roleReadsKey(seat);
  if (key === null || printed.length === 0) return null;
  const existing = readRoleReads(projectRoot);
  const seats: RoleReads = existing.ok ? existing.seats : {};
  const reads = { ...(seats[key] ?? {}) };
  for (const p of printed) reads[p.rel] = { sha: p.sha, read_at: now.toISOString().slice(0, 16).replace("T", " ") + "Z" };
  seats[key] = reads;
  const abs = join(projectRoot, ROLE_READS_REL);
  try {
    writeFileSync(`${abs}.tmp`, `${JSON.stringify({ seats }, null, 2)}\n`);
    renameSync(`${abs}.tmp`, abs);
    return null;
  } catch (err) {
    return `(Role docs: the last read could not be recorded, so they print in full next time: ${(err as Error).message})`;
  }
}

/** execFileSync with an args array: no shell, so `HEAD:path` reaches git verbatim. */
function git(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
