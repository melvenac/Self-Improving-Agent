import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, renameSync, realpathSync, rmdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

/**
 * `/bootstrap`'s deterministic half (docs/loops/bootstrap-fix-brief.md,
 * BF-3/4/6; frogger's pilot report F3-F8).
 *
 * The pilot showed that a fresh install written as prose instructions does not
 * work: bootstrap.md carried inline copies of files the template also carried,
 * and the copies disagreed (F1, F3); it skipped scaffolding whenever `.agents/`
 * existed, whatever was in it (F5); it committed files its own gitignore
 * ignores (F6). This module holds the parts that can be decided without the
 * owner — what is in the project, where the template is, which files to copy,
 * and whether git will track each one as claimed — and leaves bootstrap.md with
 * the order and the owner's decisions.
 *
 * **One source of truth (BF-6):** every scaffolded file is copied byte for byte
 * from `project-template/`, except `.agents/AGENT.md`, which states a fact about
 * the checkout rather than a template. bootstrap.md carries no file content.
 */

/** Where `project-template/` is: beside this install's `open-brain/`, whether run from src/ or build/. */
export function defaultTemplateDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../../project-template");
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

export type GitState =
  | { kind: "none" }
  | { kind: "root"; commits: boolean; dirty: string[] }
  | { kind: "nested"; toplevel: string };

export type AgentsState =
  | { kind: "absent" }
  | { kind: "empty" }
  | { kind: "residue"; entries: string[] }
  | { kind: "pre-state" }
  | { kind: "bootstrapped" };

export type ClaudeMdState = "absent" | "present" | "has-sia-section";

export interface ProjectInspection {
  root: string;
  template: string;
  templateFound: boolean;
  git: GitState;
  claudeMd: ClaudeMdState;
  agents: AgentsState;
  next: string;
}

/** The heading bootstrap appends to an owner's CLAUDE.md, and the one `check` looks for. */
export const SIA_SECTION_HEADING = "## Self-Improving Agent (SIA)";

export function inspectProject(projectRoot: string, templateDir = defaultTemplateDir()): ProjectInspection {
  const root = resolve(projectRoot);
  const git = gitState(root);
  const claudeMd = claudeMdState(root);
  const agents = agentsState(root);
  const templateFound = existsSync(join(templateDir, ".agents"));
  return { root, template: templateDir, templateFound, git, claudeMd, agents, next: nextStep(git, agents, templateFound) };
}

function gitState(root: string): GitState {
  const top = git(root, ["rev-parse", "--show-toplevel"]);
  if (top === null) return { kind: "none" };
  if (samePath(top, root)) {
    const commits = git(root, ["rev-parse", "--verify", "-q", "HEAD"]) !== null;
    const porcelain = git(root, ["status", "--porcelain"]) ?? "";
    return { kind: "root", commits, dirty: porcelain.split("\n").filter(Boolean) };
  }
  return { kind: "nested", toplevel: top };
}

function claudeMdState(root: string): ClaudeMdState {
  const p = join(root, "CLAUDE.md");
  if (!existsSync(p)) return "absent";
  const text = readFileSync(p, "utf8");
  return text.split(/\r?\n/).some((l) => l.trimEnd() === SIA_SECTION_HEADING) ? "has-sia-section" : "present";
}

/**
 * BF-3 (F5): `.agents/` existing is not the same as the project being
 * bootstrapped. A record means bootstrapped; prose `TASKS/` means an existing
 * project on the pre-record framework, which goes the IMPORT path; anything
 * else is residue — named here, moved aside by `moveResidue`, never deleted.
 */
function agentsState(root: string): AgentsState {
  const agents = join(root, ".agents");
  if (!existsSync(agents)) return { kind: "absent" };
  if (existsSync(join(agents, "state.json"))) return { kind: "bootstrapped" };
  if (existsSync(join(agents, "TASKS"))) return { kind: "pre-state" };
  const entries = readdirSync(agents)
    .filter((n) => !(n === "archive" && onlyMovedResidue(join(agents, n))))
    .map((n) => (statSync(join(agents, n)).isDirectory() ? `${n}/` : n))
    .sort();
  return entries.length === 0 ? { kind: "empty" } : { kind: "residue", entries };
}

/** An archive/ holding nothing but what `moveResidue` put there is not residue — it is where residue went. */
function onlyMovedResidue(archive: string): boolean {
  if (!statSync(archive).isDirectory()) return false;
  const names = readdirSync(archive);
  return names.length > 0 && names.every((n) => n.startsWith(RESIDUE_PREFIX));
}

function nextStep(g: GitState, a: AgentsState, templateFound: boolean): string {
  if (!templateFound) return "STOP: project-template/ was not found beside this open-brain install — the install is incomplete.";
  if (a.kind === "bootstrapped") return "Already bootstrapped (.agents/state.json exists). Run /start.";
  if (a.kind === "pre-state") return "An existing project on the pre-record framework (.agents/TASKS/ with no state.json): this is the IMPORT path, not a fresh install. Run `state import --draft`.";
  if (g.kind === "nested") return `STOP: this folder is inside another repository (${g.toplevel}). Bootstrap a project at its own repository root.`;
  if (g.kind === "none") return "git init, then commit the project as it stands, before anything is scaffolded.";
  if (!g.commits) return "Commit the project as it stands (the repository has no commit yet), before anything is scaffolded.";
  if (g.dirty.length > 0) return `Commit or set aside the ${g.dirty.length} uncommitted change(s) first, so the SIA commit holds only what bootstrap added.`;
  if (a.kind === "residue") return "Move the residue aside (`bootstrap move-residue`), then scaffold.";
  return "Scaffold (`bootstrap scaffold`).";
}

// ---------------------------------------------------------------------------
// move-residue
// ---------------------------------------------------------------------------

export interface MoveResidueResult { to: string; entries: string[] }

export const RESIDUE_PREFIX = "pre-bootstrap-residue-";

/**
 * Moves the whole residue `.agents/` to `.agents/archive/pre-bootstrap-residue-<date>/`.
 * Inside `.agents/archive/`, which the template gitignore ignores: kept, named,
 * local, and out of the scaffold's way. Nothing is deleted, and the moved
 * entries are read back before the move is reported.
 */
export function moveResidue(projectRoot: string, today: string): MoveResidueResult {
  const root = resolve(projectRoot);
  const a = agentsState(root);
  if (a.kind !== "residue") throw new Error(`.agents/ is ${a.kind}, not residue — nothing moved`);
  const agents = join(root, ".agents");
  const rel = `.agents/archive/${RESIDUE_PREFIX}${today}`;
  const aside = join(root, `.agents.residue-moving-${process.pid}`);
  if (existsSync(aside)) throw new Error(`${basename(aside)} already exists — nothing moved`);
  renameSync(agents, aside);
  try {
    mkdirSync(join(agents, "archive"), { recursive: true });
    renameSync(aside, join(root, rel));
  } catch (err) {
    // Put it back exactly as it was. The only things removed are the two empty
    // directories this function just made; the refusal names where the residue
    // is if even that fails.
    try {
      if (existsSync(join(agents, "archive"))) rmdirSync(join(agents, "archive"));
      if (existsSync(agents)) rmdirSync(agents);
      renameSync(aside, agents);
    } catch {
      throw new Error(`residue move failed (${(err as Error).message}) and could not be undone: the residue is at ${aside}`);
    }
    throw new Error(`residue move failed: ${(err as Error).message} — .agents/ restored, nothing moved`);
  }
  const landed = readdirSync(join(root, rel)).map((n) => (statSync(join(root, rel, n)).isDirectory() ? `${n}/` : n)).sort();
  if (JSON.stringify(landed) !== JSON.stringify(a.entries)) {
    throw new Error(`residue moved to ${rel} but it holds [${landed.join(", ")}], not [${a.entries.join(", ")}] — check it by hand`);
  }
  return { to: rel, entries: landed };
}

// ---------------------------------------------------------------------------
// scaffold
// ---------------------------------------------------------------------------

export interface ScaffoldFile {
  /** Destination, relative to the project root, POSIX form. */
  path: string;
  /** Template-relative source, or null for a generated file. */
  from: string | null;
  /** Whether the template gitignore tracks it. `verify` checks this against git. */
  tracked: boolean;
  why: string;
}

/**
 * What a fresh install gets. Everything tracked is something a clone of the
 * project must have; the one local file is local because what it serves is.
 * Deliberately NOT scaffolded (bootstrap-fix BF-4): the template's PRD,
 * DECISIONS, ENTITIES, RULES, RUNBOOK, SECURITY, TESTING, FRAMEWORK, skills and
 * examples, and `.claude/rules/` — the template gitignore keeps all of those
 * local, so scaffolding them would put on one disk what a clone would never see.
 * Write them when the project needs them. `state.json` and
 * `SESSIONS/next-session.md` are not copied either: `state import --commit`
 * writes them.
 */
export const SCAFFOLD_FILES: readonly ScaffoldFile[] = [
  { path: ".agents/TASKS/INBOX.md", from: ".agents/TASKS/INBOX.md", tracked: true, why: "the task list `state import` reads into the record; afterwards a rendered view of it" },
  { path: ".agents/TASKS/task.md", from: ".agents/TASKS/task.md", tracked: true, why: "the current objective `state import` reads; afterwards a rendered view" },
  { path: ".agents/SYSTEM/SUMMARY.md", from: ".agents/SYSTEM/SUMMARY.md", tracked: true, why: "the project summary; its marked region is rendered from the record" },
  { path: ".agents/SESSIONS/SESSION_TEMPLATE.md", from: ".agents/SESSIONS/SESSION_TEMPLATE.md", tracked: false, why: "the shape of each per-session log, and session logs are local" },
  { path: ".agents/AGENT.md", from: null, tracked: true, why: "declares this checkout is not a seat (role: none), so /start says so instead of NO SEAT IDENTITY RESOLVED" },
  { path: ".claude/commands/start.md", from: ".claude/commands/start.md", tracked: true, why: "/start — travels with the project, so a clone on another machine has it" },
  { path: ".claude/commands/end.md", from: ".claude/commands/end.md", tracked: true, why: "/end — store the session's lessons" },
  { path: ".claude/commands/task.md", from: ".claude/commands/task.md", tracked: true, why: "/task — pick up the next priority" },
  { path: ".claude/commands/sync.md", from: ".claude/commands/sync.md", tracked: true, why: "/sync — validate before a commit" },
] as const;

/** Merged, never overwritten: the owner's lines stay and the template's missing lines are appended. */
export const MERGED_FILES = [
  { path: ".gitignore", from: "gitignore", why: "tracks the record and its views under .agents/ and keeps the rest local" },
  { path: ".gitattributes", from: "gitattributes", why: "keeps .agents/ LF on every checkout, so core.autocrlf cannot rewrite the record's bytes" },
] as const;

/** Paths git must treat a given way once the import has run; checked with `git check-ignore`, which needs no file. */
const FUTURE_TRACKED = [".agents/state.json", ".agents/SESSIONS/next-session.md"];
const FUTURE_LOCAL = [".agents/SESSIONS/Session_1.md", ".agents/archive/x", ".agents/state.draft.json", ".agents/state.import-report.md"];

export interface ScaffoldResult {
  root: string;
  template: string;
  written: { path: string; tracked: boolean; action: "copied" | "generated" | "created" | "merged"; from: string | null; why: string }[];
  skipped: { path: string; reason: string }[];
  verify: { ok: boolean; problems: string[] };
}

export function scaffold(projectRoot: string, templateDir = defaultTemplateDir()): ScaffoldResult {
  const ins = inspectProject(projectRoot, templateDir);
  const root = ins.root;
  if (!ins.templateFound) throw new Error(`project-template/ not found at ${templateDir} — nothing written`);
  if (ins.git.kind !== "root") {
    throw new Error(ins.git.kind === "none"
      ? "not a git repository — run `git init` and commit the project as it stands first, so the pre-SIA project is its own commit. Nothing written"
      : `inside another git repository (${ins.git.toplevel}) — bootstrap a project at its own repository root. Nothing written`);
  }
  if (!ins.git.commits) throw new Error("the git repository has no commit — commit the project as it stands first, so the pre-SIA project is its own commit. Nothing written");
  if (ins.git.dirty.length > 0) throw new Error(`${ins.git.dirty.length} uncommitted change(s) (${ins.git.dirty.slice(0, 5).join("; ")}) — commit them first, so the SIA commit holds only what bootstrap added. Nothing written`);
  if (ins.agents.kind === "residue") throw new Error(`.agents/ holds residue (${ins.agents.entries.join(", ")}) — run \`bootstrap move-residue\` first. Nothing written`);
  if (ins.agents.kind === "bootstrapped") throw new Error("already bootstrapped: .agents/state.json exists. Nothing written");
  if (ins.agents.kind === "pre-state") throw new Error(".agents/TASKS/ exists with no state.json — this is the import path (`state import --draft`), not a fresh install. Nothing written");

  const written: ScaffoldResult["written"] = [];
  const skipped: ScaffoldResult["skipped"] = [];

  for (const f of SCAFFOLD_FILES) {
    const dest = join(root, f.path);
    if (existsSync(dest)) { skipped.push({ path: f.path, reason: "already exists — never overwritten" }); continue; }
    mkdirSync(dirname(dest), { recursive: true });
    if (f.from === null) {
      writeFileSync(dest, agentMd(basename(root)), "utf8");
      written.push({ path: f.path, tracked: f.tracked, action: "generated", from: null, why: f.why });
    } else {
      copyFileSync(join(templateDir, f.from), dest);
      written.push({ path: f.path, tracked: f.tracked, action: "copied", from: `project-template/${f.from}`, why: f.why });
    }
  }

  for (const m of MERGED_FILES) {
    const dest = join(root, m.path);
    const tmpl = readFileSync(join(templateDir, m.from), "utf8");
    if (!existsSync(dest)) {
      writeFileSync(dest, tmpl, "utf8");
      written.push({ path: m.path, tracked: true, action: "created", from: `project-template/${m.from}`, why: m.why });
      continue;
    }
    const existing = readFileSync(dest, "utf8");
    const have = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
    const missing = tmpl.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#") && !have.has(l.trim()));
    if (missing.length === 0) { skipped.push({ path: m.path, reason: "already carries every rule in the template's copy" }); continue; }
    const nl = existing.includes("\r\n") ? "\r\n" : "\n";
    const sep = existing.length === 0 || existing.endsWith("\n") ? "" : nl;
    writeFileSync(dest, `${existing}${sep}${nl}# --- SIA (Self-Improving Agent): from project-template/${m.from} ---${nl}${missing.join(nl)}${nl}`, "utf8");
    written.push({ path: m.path, tracked: true, action: "merged", from: `project-template/${m.from}`, why: m.why });
  }

  return { root, template: templateDir, written, skipped, verify: verifyTracking(root, written) };
}

/**
 * BF-4 (F6), checked by git rather than asserted: every scaffolded file is
 * ignored exactly when this module says it is local, the files the import will
 * write are tracked, the session logs and archive are not, and `.agents/` is LF
 * (BF-7). A merged `.gitignore` whose older rule shadows the template's (an
 * owner's `.agents/`, say) is caught here and not in a later session.
 */
function verifyTracking(root: string, written: ScaffoldResult["written"]): ScaffoldResult["verify"] {
  const problems: string[] = [];
  const ignored = (p: string) => spawnSync("git", ["check-ignore", "-q", "--no-index", p], { cwd: root }).status === 0;
  for (const w of written) {
    const ig = ignored(w.path);
    if (ig === w.tracked) problems.push(`${w.path}: scaffold calls it ${w.tracked ? "tracked" : "local"}, but git ${ig ? "ignores" : "tracks"} it`);
  }
  for (const p of FUTURE_TRACKED) if (ignored(p)) problems.push(`${p}: the import writes it and it must be tracked, but git ignores it`);
  for (const p of FUTURE_LOCAL) if (!ignored(p)) problems.push(`${p}: must stay local, but git would track it`);
  const eol = git(root, ["check-attr", "eol", "--", ".agents/state.json"]);
  if (!eol || !/: eol: lf$/.test(eol)) problems.push(`.agents/state.json: expected eol=lf from .gitattributes, git says "${eol ?? "nothing"}"`);
  return { ok: problems.length === 0, problems };
}

function agentMd(name: string): string {
  return `---
name: ${name}
role: none
partner:
---

# ${name} — not a seat

Written by \`open-brain bootstrap scaffold\`. This checkout is **not a seat**: a project
bootstrapped with one agent has no planner / developer / QA loop, so there are no seat rules to
load, and \`/start\` says NOT A SEAT rather than reporting a missing identity.

To make a checkout a seat later, write \`.agents/AGENT.local.md\` (local to that checkout) with
\`role: planner\`, \`developer\` or \`qa\`, and track the role files under \`.agents/roles/\`.
`;
}

// ---------------------------------------------------------------------------

function git(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function samePath(a: string, b: string): boolean {
  const norm = (p: string) => {
    let r = p;
    try { r = realpathSync.native(p); } catch { /* keep as given */ }
    r = resolve(r).replace(/\\/g, "/").replace(/\/+$/, "");
    return process.platform === "win32" ? r.toLowerCase() : r;
  };
  return norm(a) === norm(b);
}
