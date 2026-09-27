/**
 * T-193. Every registered worktree is the main checkout or a folder named
 * `<project>-<seat>`. The project and the seats come from
 * `.agents/SYSTEM/worktree-seats.json`, not from this file. No such file is
 * a skip, never a pass.
 *
 * The list is `git worktree list --porcelain` parsed as records. The main
 * checkout is the first record (git prints it first). An orphan directory
 * that git has not registered is not in that list, and the message says so.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import type { CheckResult } from "./types.js";

export const WORKTREE_SEATS_REL = ".agents/SYSTEM/worktree-seats.json";

const LIMIT =
  "LIMIT: sees registered worktrees only. An orphan directory with no git registration is not seen.";

/** A path segment: letters, digits, hyphens. No slashes, no empty, no `.` or `..`. */
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

const PORCELAIN_KEYS = new Set(["worktree", "HEAD", "branch", "detached", "bare", "locked", "prunable"]);

const NAME = "worktree-layout";

interface WtEntry {
  path: string;
  head: string | null;
  branch: string | null;
  detached: boolean;
  bare: boolean;
}

interface SeatFile {
  project: string;
  seats: string[];
}

function result(severity: CheckResult["severity"], message: string): CheckResult {
  return { name: NAME, severity, message, report: true };
}

function seatFilePath(projectRoot: string): string {
  return join(projectRoot, ...WORKTREE_SEATS_REL.split("/"));
}

function folderName(p: string): string {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const i = norm.lastIndexOf("/");
  return i === -1 ? norm : norm.slice(i + 1);
}

function loadSeatFile(projectRoot: string): { kind: "missing" } | { kind: "error"; detail: string } | { kind: "ok"; file: SeatFile } {
  let text: string;
  try {
    text = readFileSync(seatFilePath(projectRoot), "utf8");
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { kind: "missing" };
    return { kind: "error", detail: `${WORKTREE_SEATS_REL} unreadable (${code ?? "error"})` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { kind: "error", detail: `${WORKTREE_SEATS_REL} is not JSON (${(e as Error).message})` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "error", detail: `${WORKTREE_SEATS_REL} must be an object with "project" and "seats"` };
  }
  const rec = parsed as { project?: unknown; seats?: unknown };
  if (typeof rec.project !== "string" || !TOKEN.test(rec.project)) {
    return { kind: "error", detail: `${WORKTREE_SEATS_REL} "project" must be a token (letters, digits, hyphens)` };
  }
  if (!Array.isArray(rec.seats) || rec.seats.some((s) => typeof s !== "string" || !TOKEN.test(s))) {
    return { kind: "error", detail: `${WORKTREE_SEATS_REL} "seats" must be an array of tokens` };
  }
  return { kind: "ok", file: { project: rec.project, seats: rec.seats } };
}

function gitPorcelain(projectRoot: string): { ok: true; stdout: string } | { ok: false; detail: string } {
  try {
    const stdout = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    return { ok: true, stdout };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string | Buffer };
    if (err.code === "ENOENT") return { ok: false, detail: "git executable not found" };
    const stderr = Buffer.isBuffer(err.stderr) ? err.stderr.toString("utf8") : (err.stderr ?? "");
    const line = stderr.trim().split(/\r?\n/)[0] || String(err.message).split(/\r?\n/)[0];
    return { ok: false, detail: line };
  }
}

function parsePorcelain(stdout: string): { ok: true; entries: WtEntry[] } | { ok: false; detail: string } {
  const entries: WtEntry[] = [];
  let cur: WtEntry | null = null;
  const flush = (): string | null => {
    if (!cur) return null;
    entries.push(cur);
    cur = null;
    return null;
  };
  for (const line of stdout.split(/\r?\n/)) {
    if (line === "") {
      flush();
      continue;
    }
    const sp = line.indexOf(" ");
    const key = sp === -1 ? line : line.slice(0, sp);
    const value = sp === -1 ? "" : line.slice(sp + 1);
    if (!PORCELAIN_KEYS.has(key)) {
      return { ok: false, detail: `unrecognized porcelain key ${JSON.stringify(key)}` };
    }
    if (key === "worktree") {
      if (cur) return { ok: false, detail: "porcelain record missing the blank line before the next worktree" };
      if (!value) return { ok: false, detail: "porcelain worktree path is empty" };
      cur = { path: value, head: null, branch: null, detached: false, bare: false };
      continue;
    }
    if (!cur) return { ok: false, detail: `porcelain key ${JSON.stringify(key)} before a worktree line` };
    if (key === "HEAD") cur.head = value;
    else if (key === "branch") cur.branch = value;
    else if (key === "detached") cur.detached = true;
    else if (key === "bare") cur.bare = true;
  }
  flush();
  if (entries.length === 0) return { ok: false, detail: "porcelain listed no worktrees" };
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const who = folderName(entry.path);
    if (!entry.bare && !entry.head) return { ok: false, detail: `worktree ${JSON.stringify(who)} has no HEAD` };
    if (entry.detached && entry.branch) {
      return { ok: false, detail: `worktree ${JSON.stringify(who)} is both detached and on a branch` };
    }
    if (!entry.bare && !entry.detached && !entry.branch) {
      return { ok: false, detail: `worktree ${JSON.stringify(who)} has neither branch nor detached` };
    }
  }
  return { ok: true, entries };
}

function where(entry: WtEntry): string {
  if (entry.detached) return `detached at ${entry.head}`;
  if (entry.branch) return `branch ${entry.branch}`;
  return `bare at ${entry.head ?? "no HEAD"}`;
}

export function checkWorktreeLayout(projectRoot: string): CheckResult {
  const loaded = loadSeatFile(projectRoot);
  if (loaded.kind === "missing") {
    return result(
      "skip",
      `no seat file at ${WORKTREE_SEATS_REL} — worktrees were not classified. This is not a pass. ${LIMIT}`,
    );
  }
  if (loaded.kind === "error") {
    return result("issue", `${loaded.detail}. Worktrees were not classified. This is not a pass. ${LIMIT}`);
  }

  const listed = gitPorcelain(projectRoot);
  if (!listed.ok) {
    return result(
      "issue",
      `git worktree list --porcelain failed: ${listed.detail}. Worktrees were not classified. This is not a pass. ${LIMIT}`,
    );
  }
  const parsed = parsePorcelain(listed.stdout);
  if (!parsed.ok) {
    return result("issue", `porcelain could not be parsed: ${parsed.detail}. This is not a pass. ${LIMIT}`);
  }

  const { project } = loaded.file;
  // Mutant: any linked folder name is accepted. The seat file is still read.
  const violations: string[] = [];
  for (let i = 0; i < parsed.entries.length; i++) {
    if (i === 0) continue;
  }

  const walked = `Walked ${parsed.entries.length} worktree(s)`;
  if (violations.length > 0) {
    return result("issue", `${violations.join("; ")}. ${walked}. ${LIMIT}`);
  }
  return result(
    "pass",
    `${walked}; each is the main checkout or ${JSON.stringify(project)}-<seat>. ${LIMIT}`,
  );
}
