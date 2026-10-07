import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, renameSync, realpathSync, rmdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { isStateRecord, whyNotARecord } from "../../shared/state-record.js";

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
  /** `empty`: nothing outside .agents/ to commit, so the before-SIA commit must be --allow-empty (R-BF-13). */
  | { kind: "none"; empty: boolean }
  | { kind: "root"; commits: boolean; dirty: string[]; empty: boolean }
  | { kind: "nested"; toplevel: string };

export type AgentsState =
  | { kind: "absent" }
  | { kind: "empty" }
  | { kind: "residue"; entries: string[] }
  | { kind: "pre-state" }
  /** Scaffold's files, no record yet (R-BF-10). `inboxIsTemplate`: step 5 has not replaced the example tasks. */
  | { kind: "scaffolded"; inboxIsTemplate: boolean }
  /** A state.json that is not a record (R-BF-11, R-BF-17): not a JSON object carrying schema_version, or the old template's {{PROJECT}} seed. */
  | { kind: "not-a-record"; why: string }
  | { kind: "bootstrapped" };

export type ClaudeMdState = "absent" | "present" | "has-sia-section";

/** The four session commands scaffold copies from project-template (IMPORT-CMDS C1). */
export const SESSION_COMMAND_NAMES = ["start", "end", "task", "sync"] as const;
export type SessionCommandName = (typeof SESSION_COMMAND_NAMES)[number];
export type SessionCommandFileState = "SIA" | "OLD" | "absent";

export interface ProjectInspection {
  root: string;
  template: string;
  templateFound: boolean;
  git: GitState;
  claudeMd: ClaudeMdState;
  agents: AgentsState;
  /** Each `.claude/commands/<name>.md` versus project-template (IMPORT-CMDS C1). */
  commands: Record<SessionCommandName, SessionCommandFileState>;
  next: string;
}

export const COMMAND_ARCHIVE_PREFIX = "pre-bootstrap-commands-";

/** Line ob_start adds when the record is valid but project /start is not SIA's (IMPORT-CMDS C4). */
export const OLD_START_COMMAND_WARNING = "OLD /start in this project: run bootstrap install-commands";

export function sessionCommandRel(name: SessionCommandName): string {
  return `.claude/commands/${name}.md`;
}

export function classifySessionCommand(projectRoot: string, name: SessionCommandName, templateDir: string): SessionCommandFileState {
  const dest = join(resolve(projectRoot), sessionCommandRel(name));
  const tmpl = join(templateDir, sessionCommandRel(name));
  if (!existsSync(dest)) return "absent";
  if (!existsSync(tmpl)) return "OLD";
  return sameText(dest, tmpl) ? "SIA" : "OLD";
}

export function inspectSessionCommands(projectRoot: string, templateDir = defaultTemplateDir()): Record<SessionCommandName, SessionCommandFileState> {
  const out = {} as Record<SessionCommandName, SessionCommandFileState>;
  for (const n of SESSION_COMMAND_NAMES) out[n] = classifySessionCommand(projectRoot, n, templateDir);
  return out;
}

export function sessionCommandsNeedInstall(commands: Record<SessionCommandName, SessionCommandFileState>): boolean {
  return SESSION_COMMAND_NAMES.some((n) => commands[n] === "OLD" || commands[n] === "absent");
}

/** Null when no warning; valid record and an on-disk /start that is not SIA's template copy. */
export function oldStartCommandWarning(projectRoot: string, templateDir = defaultTemplateDir()): string | null {
  const statePath = join(resolve(projectRoot), ".agents", "state.json");
  if (!isStateRecord(statePath)) return null;
  const st = classifySessionCommand(projectRoot, "start", templateDir);
  return st === "OLD" ? OLD_START_COMMAND_WARNING : null;
}

/** The heading bootstrap appends to an owner's CLAUDE.md, and the one `check` looks for. */
export const SIA_SECTION_HEADING = "## Self-Improving Agent (SIA)";

export function inspectProject(projectRoot: string, templateDir = defaultTemplateDir()): ProjectInspection {
  const root = resolve(projectRoot);
  const git = gitState(root);
  const claudeMd = claudeMdState(root);
  const agents = agentsState(root, templateDir);
  const templateFound = existsSync(join(templateDir, ".agents"));
  const commands = inspectSessionCommands(root, templateDir);
  return { root, template: templateDir, templateFound, git, claudeMd, agents, commands, next: nextStep(git, agents, templateFound, commands) };
}

function gitState(root: string): GitState {
  const top = git(root, ["rev-parse", "--show-toplevel"]);
  if (top === null) return { kind: "none", empty: readdirSync(root).every((n) => n === ".agents" || n === ".git") };
  if (samePath(top, root)) {
    const commits = git(root, ["rev-parse", "--verify", "-q", "HEAD"]) !== null;
    // Per file, so an untracked .agents/archive/ (the residue move-residue set aside,
    // or an older archive) is seen as itself rather than as `?? .agents/`: it is
    // local by design and not a change for the owner to commit.
    // Not trimmed: porcelain's status is column-sensitive, and a trim eats the
    // first line's leading space (` D path` would read as `D path`).
    const porcelain = gitRaw(root, ["status", "--porcelain", "--untracked-files=all"]) ?? "";
    const dirty = porcelain.split("\n").filter(Boolean)
      .filter((l) => !(l.startsWith("?? ") && l.slice(3).replace(/^"|"$/g, "").startsWith(".agents/archive/")));
    // Nothing but .agents/ to commit: an empty project, whose first commit has to be --allow-empty.
    const empty = !commits && dirty.every((l) => l.slice(3).replace(/^"|"$/g, "").startsWith(".agents/"));
    return { kind: "root", commits, dirty, empty };
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
 *
 * Round 3: a record is one that parses and is not the old template's seed
 * (R-BF-11). Round 4: it must be a JSON object that carries `schema_version`
 * (R-BF-17). Scaffold's own `AGENT.md` marks a scaffold that has not been
 * imported yet, which goes on at step 4, not the import (R-BF-10) — a resumed
 * bootstrap used to skip steps 4 and 5 and import the template's example tasks.
 */
function agentsState(root: string, templateDir = defaultTemplateDir()): AgentsState {
  const agents = join(root, ".agents");
  if (!existsSync(agents)) return { kind: "absent" };
  const statePath = join(agents, "state.json");
  if (existsSync(statePath)) {
    const why = whyNotARecord(statePath);
    return why === null ? { kind: "bootstrapped" } : { kind: "not-a-record", why };
  }
  if (isScaffoldAgentMd(join(agents, "AGENT.md"))) {
    return { kind: "scaffolded", inboxIsTemplate: sameText(join(agents, "TASKS", "INBOX.md"), join(templateDir, ".agents", "TASKS", "INBOX.md")) };
  }
  if (existsSync(join(agents, "TASKS"))) return { kind: "pre-state" };
  // `archive/` is never residue: it is where things are set aside, the template
  // gitignore keeps it local, and nothing reads it as state. Counting it moved
  // an earlier residue folder INTO the next one (QA 135 D5).
  const entries = readdirSync(agents)
    .filter((n) => !(n === "archive" && statSync(join(agents, n)).isDirectory()))
    .map((n) => (statSync(join(agents, n)).isDirectory() ? `${n}/` : n))
    .sort();
  return entries.length === 0 ? { kind: "empty" } : { kind: "residue", entries };
}

/** The line scaffold writes into `.agents/AGENT.md`, and the one `check` reads to tell a scaffold from a pre-record project. */
export const SCAFFOLD_SIGNATURE = "Written by `open-brain bootstrap scaffold`.";

function isScaffoldAgentMd(path: string): boolean {
  return existsSync(path) && statSync(path).isFile() && readFileSync(path, "utf8").includes(SCAFFOLD_SIGNATURE);
}

/** Line ends aside: a checkout under core.autocrlf holds the same text. */
function sameText(a: string, b: string): boolean {
  if (!existsSync(a) || !existsSync(b)) return false;
  return readFileSync(a, "utf8").replace(/\r\n/g, "\n") === readFileSync(b, "utf8").replace(/\r\n/g, "\n");
}

function nextStep(g: GitState, a: AgentsState, templateFound: boolean, commands: Record<SessionCommandName, SessionCommandFileState>): string {
  if (!templateFound) return "STOP: project-template/ was not found beside this open-brain install — the install is incomplete.";
  if (a.kind === "bootstrapped") {
    if (sessionCommandsNeedInstall(commands)) {
      return "Bootstrapped, but session commands are not all SIA: run `bootstrap install-commands` (refuses a dirty tree).";
    }
    return "Already bootstrapped (.agents/state.json exists). Run /start.";
  }
  if (a.kind === "not-a-record") return `.agents/state.json is not a record (${a.why}), so this project is NOT bootstrapped. If it is left over, \`bootstrap move-residue\` moves it aside (nothing is deleted); then run check again. If it was this project's record, restore it from git instead (\`git checkout -- .agents/state.json\`).`;
  if (a.kind === "scaffolded") {
    return "Scaffolded, not yet imported: continue at step 4 (CLAUDE.md), then step 5, then step 6 (`state import --draft`)." +
      (a.inboxIsTemplate ? " .agents/TASKS/INBOX.md still holds the template's example tasks: step 5 replaces them with this project's." : "");
  }
  if (a.kind === "pre-state") {
    const base = "An existing project on the pre-record framework (.agents/TASKS/ with no state.json): this is the IMPORT path, not a fresh install. Run `state import --draft`.";
    return sessionCommandsNeedInstall(commands) ? `${base} After \`state import --commit\`, run \`bootstrap install-commands\`.` : base;
  }
  if (g.kind === "nested") return `STOP: this folder is inside another repository (${g.toplevel}). \`git init\` here makes this folder its own project, or move the folder out of the enclosing repository.`;
  // Residue first: moved before the pre-SIA commit, it never enters it.
  if (a.kind === "residue") return "Move the residue aside first (`bootstrap move-residue`), then run check again.";
  const leaveOut = "leaving .agents/ out of that commit (`git add -A -- . \":(exclude).agents\"`)";
  const emptyCommit = "`git commit --allow-empty -m \"The project before SIA\"`";
  if (g.kind === "none") {
    return g.empty
      ? `git init, then make the before-SIA commit. The folder has nothing to commit yet, so make it empty: ${emptyCommit}.`
      : `git init, then commit the project as it stands, ${leaveOut}, before anything is scaffolded.`;
  }
  if (!g.commits) {
    return g.empty
      ? `The repository has no commit and nothing to commit yet: make the before-SIA commit empty, ${emptyCommit}, before anything is scaffolded.`
      : `Commit the project as it stands (the repository has no commit yet), ${leaveOut}, before anything is scaffolded.`;
  }
  // Residue that git already tracked shows, once moved, as deletions under .agents/.
  if (g.dirty.length > 0 && g.dirty.every((l) => /^( D|D ) \.agents\//.test(l))) {
    return "The residue was tracked by git: commit its removal on its own (`git add -u -- .agents`, then `git commit -m \"Move old .agents/ files aside\"`). The files are kept, local, under .agents/archive/.";
  }
  if (g.dirty.length > 0) return `Commit the ${g.dirty.length} uncommitted change(s) first, ${leaveOut}, so the SIA commit holds only what bootstrap added.`;
  return "Scaffold (`bootstrap scaffold`).";
}

// ---------------------------------------------------------------------------
// move-residue
// ---------------------------------------------------------------------------

export interface MoveResidueResult { to: string; entries: string[] }

export const RESIDUE_PREFIX = "pre-bootstrap-residue-";

/**
 * A move that happened, and whose read-back does not match what was named. It
 * is NOT a refusal — the files moved — so the CLI must never print it as one
 * (R-BF-12; QA 135 D5 printed "refused" after moving everything).
 */
export class ResidueReadBackError extends Error {}

/**
 * A move that happened and could not be put back. It is NOT a refusal — some
 * entries moved — so the CLI must never print it as one (R-BF-20).
 */
export class ResidueUndoError extends Error {}

/** The line `bootstrap move-residue` prints for a thrown error. A failed undo is not a refusal (R-BF-20, R-BF-21). */
export function formatMoveResidueFailure(err: unknown): string {
  if (err instanceof ResidueReadBackError) return `bootstrap move-residue — MOVED, but ${err.message}`;
  if (err instanceof ResidueUndoError) return `bootstrap move-residue — not undone: ${err.message}`;
  const message = err instanceof Error ? err.message : String(err);
  return `bootstrap move-residue refused: ${message}`;
}

/**
 * Moves each residue entry of `.agents/` into a NEW folder,
 * `.agents/archive/pre-bootstrap-residue-<date>/` (then `-2`, `-3` … when that
 * exists), inside `.agents/archive/`, which the template gitignore ignores:
 * kept, named, local, and out of the scaffold's way. Only the named entries
 * move — never `archive/` itself, so no residue folder lands inside another
 * (R-BF-12). A `state.json` that is not a record is moved alone (R-BF-11).
 * Nothing is deleted; a failure part-way moves back what it moved; and every
 * entry is read back before the move is reported. `rename` is injectable so a
 * test can make a rename that silently does nothing (QA 135's M13).
 */
export function moveResidue(projectRoot: string, today: string, deps: { rename?: (from: string, to: string) => void } = {}): MoveResidueResult {
  const rename = deps.rename ?? renameSync;
  const root = resolve(projectRoot);
  const a = agentsState(root);
  if (a.kind !== "residue" && a.kind !== "not-a-record") throw new Error(`.agents/ is ${a.kind}, not residue — nothing moved`);
  const entries = a.kind === "residue" ? a.entries : ["state.json"];
  const agents = join(root, ".agents");
  let rel = `.agents/archive/${RESIDUE_PREFIX}${today}`;
  for (let n = 2; existsSync(join(root, rel)); n++) rel = `.agents/archive/${RESIDUE_PREFIX}${today}-${n}`;
  const dest = join(root, rel);
  mkdirSync(dest, { recursive: true });
  const names = entries.map((e) => e.replace(/\/$/, ""));
  const moved: string[] = [];
  try {
    for (const n of names) { rename(join(agents, n), join(dest, n)); moved.push(n); }
  } catch (err) {
    // Put back what moved, then remove the empty folder this call made. If even
    // that fails, name what moved and what stayed: that path is not a refusal (R-BF-20).
    try {
      for (const n of moved.reverse()) renameSync(join(dest, n), join(agents, n));
      rmdirSync(dest);
    } catch {
      const stayed = names.filter((n) => !moved.includes(n));
      throw new ResidueUndoError(`residue move failed (${(err as Error).message}) and could not be undone: ${moved.join(", ")} moved to ${rel}/, and ${stayed.join(", ")} stayed in .agents/`);
    }
    throw new Error(`residue move failed: ${(err as Error).message} — every entry put back, nothing moved`);
  }
  const missing = names.filter((n) => !existsSync(join(dest, n)));
  const stayed = names.filter((n) => existsSync(join(agents, n)));
  if (missing.length > 0 || stayed.length > 0) {
    throw new ResidueReadBackError(`the residue was MOVED to ${rel}/, but the read-back does not match: ${missing.length ? `not in the new folder: ${missing.join(", ")}` : ""}${missing.length && stayed.length ? "; " : ""}${stayed.length ? `still in .agents/: ${stayed.join(", ")}` : ""}. Nothing was deleted. Look at both places by hand before going on`);
  }
  const landed = readdirSync(dest).map((n) => (statSync(join(dest, n)).isDirectory() ? `${n}/` : n)).sort();
  return { to: rel, entries: landed };
}

// ---------------------------------------------------------------------------
// install-commands (IMPORT-CMDS C2)
// ---------------------------------------------------------------------------

export interface InstallCommandsLine {
  name: SessionCommandName;
  before: SessionCommandFileState;
  after: SessionCommandFileState;
}

export interface InstallCommandsResult {
  root: string;
  archive: string | null;
  lines: InstallCommandsLine[];
}

/**
 * After import: replace OLD session commands and copy missing ones from
 * project-template. Refuses without a valid record or on a dirty tree. Only
 * touches the four named files under `.claude/commands/`.
 */
export function installCommands(projectRoot: string, today: string, templateDir = defaultTemplateDir(), deps: { rename?: (from: string, to: string) => void } = {}): InstallCommandsResult {
  const rename = deps.rename ?? renameSync;
  const root = resolve(projectRoot);
  const ins = inspectProject(root, templateDir);
  if (!ins.templateFound) throw new Error(`project-template/ not found at ${templateDir} — nothing written`);
  // I9-M1 mutant: record gate removed
  if (ins.git.kind !== "root") {
    throw new Error(ins.git.kind === "none"
      ? "not a git repository — nothing written"
      : `inside another git repository (${ins.git.toplevel}) — nothing written`);
  }
  if (ins.git.dirty.length > 0) {
    throw new Error(`${ins.git.dirty.length} uncommitted change(s) — commit or stash first. Nothing written`);
  }

  const commandsDir = join(root, ".claude", "commands");
  let archiveRel: string | null = null;
  let archiveDir: string | null = null;
  const lines: InstallCommandsLine[] = [];

  for (const name of SESSION_COMMAND_NAMES) {
    const before = ins.commands[name];
    if (before === "SIA") {
      lines.push({ name, before, after: "SIA" });
      continue;
    }
    if (archiveDir === null) {
      let rel = `.agents/archive/${COMMAND_ARCHIVE_PREFIX}${today}`;
      for (let n = 2; existsSync(join(root, rel)); n++) rel = `.agents/archive/${COMMAND_ARCHIVE_PREFIX}${today}-${n}`;
      archiveRel = rel;
      archiveDir = join(root, rel);
      mkdirSync(archiveDir, { recursive: true });
    }
    const dest = join(commandsDir, `${name}.md`);
    if (before === "OLD") rename(dest, join(archiveDir, `${name}.md`));
    mkdirSync(commandsDir, { recursive: true });
    copyFileSync(join(templateDir, sessionCommandRel(name)), dest);
    lines.push({ name, before, after: "SIA" });
  }

  return { root, archive: archiveRel, lines };
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
  // Before the git checks: a scaffold's own files make the tree dirty, and "commit them first" would be the wrong advice.
  if (ins.agents.kind === "scaffolded") throw new Error("already scaffolded (.agents/AGENT.md is scaffold's) and not yet imported — continue at step 4. Nothing written");
  if (ins.git.kind !== "root") {
    throw new Error(ins.git.kind === "none"
      ? "not a git repository — run `git init` and commit the project as it stands first, so the pre-SIA project is its own commit. Nothing written"
      : `inside another git repository (${ins.git.toplevel}) — bootstrap a project at its own repository root. Nothing written`);
  }
  if (!ins.git.commits) throw new Error("the git repository has no commit — commit the project as it stands first, so the pre-SIA project is its own commit. Nothing written");
  if (ins.git.dirty.length > 0) throw new Error(`${ins.git.dirty.length} uncommitted change(s) (${ins.git.dirty.slice(0, 5).join("; ")}) — commit them first, so the SIA commit holds only what bootstrap added. Nothing written`);
  if (ins.agents.kind === "residue") throw new Error(`.agents/ holds residue (${ins.agents.entries.join(", ")}) — run \`bootstrap move-residue\` first. Nothing written`);
  if (ins.agents.kind === "bootstrapped") throw new Error("already bootstrapped: .agents/state.json exists. Nothing written");
  if (ins.agents.kind === "not-a-record") throw new Error(`.agents/state.json is not a record (${ins.agents.why}) — run \`bootstrap check\` and follow its Next line. Nothing written`);
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

${SCAFFOLD_SIGNATURE} This checkout is **not a seat**: a project
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

function gitRaw(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r?\n$/, "");
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
