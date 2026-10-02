import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync, execFileSync } from "node:child_process";
import type { CheckResult, SyncRuntime } from "./types.js";
import { parseSkillIndexRows } from "../../shared/skill-index.js";
import { parseState, SeatName, schemaVersionAdvice } from "../../shared/state-schema.js";
import { renderState } from "../session-start/state-render.js";
import { describeRoleFiles } from "../session-start/role-files.js";
import { readAgentIdentity } from "../session-start/agent-identity.js";
import { presenceBlockUpperBound } from "../session-start/hub-presence.js";
import { describeTreeCurrency } from "../session-start/tree-currency.js";
import { checkSummaryFromState } from "./checks-state.js";

/**
 * Slash-command files that are deliberately NOT mirrored, with the reason.
 * Anything drifting outside this list is real drift and fails the parity check.
 * Decisions recorded in Session 36.
 */
export const MIRROR_EXCEPTIONS: Record<string, string> = {
  "harness-audit.md": "repo-root only — SIA maintenance command, not for consumers",
  "notebooklm.md": "user-global only — personal workflow, never distributed",
  "transcript.md": "retracted from the template in Session 36",
  "bootstrap.md": "template only — consumers scaffold with it, SIA does not",
};

/**
 * The slash commands Cursor is meant to receive.
 *
 * Cursor deliberately gets the session-lifecycle subset, not every command:
 * `bootstrap`, `task` and `test` are Claude Code workflows that
 * have no Cursor equivalent. Declared here rather than left implicit, because a
 * deliberate omission and a forgotten one are indistinguishable by looking at
 * the directory — mirror parity only compares files present in both sides, so
 * a command silently dropped from the template would never be flagged.
 */
export const CURSOR_COMMAND_SET = ["checkpoint.md", "end.md", "start.md", "sync.md"];

export function syncReadmeVersion(
  version: string,
  projectRoot: string,
  checkOnly: boolean
): CheckResult {
  const readmePath = join(projectRoot, "README.md");
  if (!existsSync(readmePath)) {
    return { name: "readme-version", severity: "warn", message: "README.md not found" };
  }

  const content = readFileSync(readmePath, "utf-8");
  const pattern = /\*\*Latest: v[\d.]+\*\*/;
  const expected = `**Latest: v${version}**`;

  if (content.includes(expected)) {
    return { name: "readme-version", severity: "pass", message: `README version matches v${version}` };
  }

  if (!pattern.test(content)) {
    return { name: "readme-version", severity: "warn", message: "No version pattern found in README.md" };
  }

  if (checkOnly) {
    return { name: "readme-version", severity: "issue", message: `README version does not match v${version}` };
  }

  const fixed = content.replace(pattern, expected);
  writeFileSync(readmePath, fixed, "utf-8");
  return { name: "readme-version", severity: "fixed", message: `README version updated to v${version}`, autoFixed: true };
}

/**
 * Resolve a project document across the locations the framework supports.
 * `.agents/SYSTEM/` is the convention (matching checkSummary); `docs/` and the
 * repo root are legacy fallbacks so older layouts keep working.
 */
export function resolveDocPath(projectRoot: string, filename: string): string | null {
  const candidates = [
    join(projectRoot, ".agents", "SYSTEM", filename),
    join(projectRoot, "docs", filename),
    join(projectRoot, filename),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function syncPrdVersion(
  version: string,
  projectRoot: string,
  checkOnly: boolean
): CheckResult {
  const prdPath = resolveDocPath(projectRoot, "PRD.md");
  if (!prdPath) {
    return { name: "prd-version", severity: "warn", message: "PRD.md not found" };
  }

  const content = readFileSync(prdPath, "utf-8");

  // Tolerate the styles that appear across the framework and its consumers:
  //   | Version | 0.7.1 |      | **Version** | v0.7.1 |
  // Captures let us rewrite the number while preserving the author's bolding
  // and optional "v" prefix.
  const pattern = /(\|\s*\*{0,2}Version\*{0,2}\s*\|\s*)(v?)([\d.]+)(\s*\|)/;
  const match = content.match(pattern);

  if (!match) {
    return { name: "prd-version", severity: "warn", message: "No version pattern found in PRD.md" };
  }

  if (match[3] === version) {
    return { name: "prd-version", severity: "pass", message: `PRD version matches ${version}` };
  }

  if (checkOnly) {
    return { name: "prd-version", severity: "issue", message: `PRD version does not match ${version}` };
  }

  const fixed = content.replace(pattern, `$1$2${version}$4`);
  writeFileSync(prdPath, fixed, "utf-8");
  return { name: "prd-version", severity: "fixed", message: `PRD version updated to ${version}`, autoFixed: true };
}

export function checkChangelog(version: string, projectRoot: string): CheckResult {
  const changelogPath = join(projectRoot, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return { name: "changelog", severity: "warn", message: "CHANGELOG.md not found" };
  }
  const content = readFileSync(changelogPath, "utf-8");
  const pattern = new RegExp(`## \\[v?${version.replace(/\./g, "\\.")}\\]`);
  if (pattern.test(content)) {
    return { name: "changelog", severity: "pass", message: `CHANGELOG.md has entry for v${version}` };
  }
  return { name: "changelog", severity: "issue", message: `CHANGELOG.md missing entry for v${version}` };
}

export function checkReadmeRefs(projectRoot: string): CheckResult {
  const readmePath = join(projectRoot, "README.md");
  if (!existsSync(readmePath)) {
    return { name: "readme-refs", severity: "warn", message: "README.md not found" };
  }
  const content = readFileSync(readmePath, "utf-8");
  // Leading segments are part of the path, not context around it. The old
  // pattern started at `scripts/`, so `open-brain/scripts/dashboard.mjs` matched
  // only its tail and was then resolved from the repo root, where nothing sits —
  // reporting a file that had *moved into a subdirectory* as one that had been
  // deleted. The lookbehind stops a match beginning mid-path.
  const refPattern = /(?<![\w/.-])(?:[\w.-]+\/)*scripts\/[\w./-]+/g;
  const refs = [...new Set(content.match(refPattern) ?? [])];
  const missing = refs.filter((ref) => !existsSync(join(projectRoot, ref)));
  if (missing.length > 0) {
    return { name: "readme-refs", severity: "issue", message: `README references missing files: ${missing.join(", ")}` };
  }
  return { name: "readme-refs", severity: "pass", message: `All ${refs.length} script references in README exist` };
}

export function checkHookConfigs(settingsPath: string): CheckResult {
  if (!existsSync(settingsPath)) {
    return { name: "hook-configs", severity: "warn", message: "settings.json not found" };
  }
  const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  const hooks: unknown[] = [];
  if (settings.hooks && typeof settings.hooks === "object") {
    for (const hookList of Object.values(settings.hooks)) {
      if (Array.isArray(hookList)) hooks.push(...hookList);
    }
  }
  const missing: string[] = [];
  // T-048: every entry that is not stat'ed is counted by WHY, and the verdict says how many were
  // read. A zero here used to print "All hook command files exist".
  let checked = 0;
  const skipped = { notAnObject: 0, noCommand: 0, notNodeOrTsx: 0, noFilePath: 0 };
  for (const hook of hooks) {
    if (!hook || typeof hook !== "object") {
      skipped.notAnObject++;
      continue;
    }
    const h = hook as Record<string, unknown>;
    if (typeof h.command !== "string") {
      skipped.noCommand++;
      continue;
    }
    const cmd: string = h.command;
    if (!cmd.includes("node ") && !cmd.includes("npx tsx ")) {
      skipped.notNodeOrTsx++;
      continue;
    }
    // Extract file path: word after "node" or "npx tsx"
    const fileMatch = cmd.match(/(?:node|npx tsx)\s+([^\s]+)/);
    if (!fileMatch) {
      skipped.noFilePath++;
      continue;
    }
    const filePath = fileMatch[1];
    checked++;
    if (!existsSync(filePath)) {
      missing.push(filePath);
    }
  }
  const skippedCount = skipped.notAnObject + skipped.noCommand + skipped.notNodeOrTsx + skipped.noFilePath;
  const why = [
    skipped.notAnObject ? `${skipped.notAnObject} not an object` : "",
    skipped.noCommand ? `${skipped.noCommand} with no command string` : "",
    skipped.notNodeOrTsx ? `${skipped.notNodeOrTsx} not a node/npx tsx command` : "",
    skipped.noFilePath ? `${skipped.noFilePath} with no file path after node/npx tsx` : "",
  ].filter(Boolean).join(", ");
  const counts = `${checked} hook command file(s) checked; skipped ${skippedCount}${why ? ` (${why})` : ""} of ${hooks.length} entr${hooks.length === 1 ? "y" : "ies"}`;
  if (missing.length > 0) {
    return { name: "hook-configs", severity: "issue", message: `Hook commands reference missing files: ${missing.join(", ")}. ${counts}` };
  }
  if (checked === 0) {
    return { name: "hook-configs", severity: "skip", message: `not checked: no hook command file was read. ${counts}. This is not a pass.` };
  }
  return { name: "hook-configs", severity: "pass", message: `All hook command files exist: ${counts}` };
}

/**
 * `summary-version`. Two regimes (Loop 4 R3):
 * - `.agents/state.json` present → the views are generated; staleness is a
 *   header mismatch and the fix is a re-render (checkSummaryFromState). No
 *   prose is ever inserted into SUMMARY.md on this path.
 * - absent → the prose regime: SUMMARY.md must mention the version, and the
 *   remedy is a hand edit. This is the only path that can prompt a prose line.
 */
export function checkSummary(version: string, projectRoot: string, checkOnly = false): CheckResult {
  if (existsSync(join(projectRoot, ".agents", "state.json"))) {
    return checkSummaryFromState(version, projectRoot, checkOnly);
  }
  const summaryPath = join(projectRoot, ".agents", "SYSTEM", "SUMMARY.md");
  if (!existsSync(summaryPath)) {
    return { name: "summary-version", severity: "warn", message: ".agents/SYSTEM/SUMMARY.md not found" };
  }
  const content = readFileSync(summaryPath, "utf-8");
  if (content.includes(version)) {
    return { name: "summary-version", severity: "pass", message: `SUMMARY.md contains version ${version}` };
  }
  return { name: "summary-version", severity: "issue", message: `SUMMARY.md does not mention version ${version}` };
}

export function checkClaudeMd(projectRoot: string): CheckResult {
  const claudePath = join(projectRoot, "CLAUDE.md");
  if (!existsSync(claudePath)) {
    return { name: "claude-md", severity: "warn", message: "CLAUDE.md not found" };
  }
  const content = readFileSync(claudePath, "utf-8");
  // Find referenced directories (lines like `- \`dir/\`` or paths ending in /)
  const dirPattern = /`([a-zA-Z0-9._\-/]+\/)`/g;
  const refs = [...new Set([...content.matchAll(dirPattern)].map((m) => m[1]))];
  const missing = refs.filter((ref) => {
    const full = join(projectRoot, ref);
    return !existsSync(full);
  });
  if (missing.length > 0) {
    return { name: "claude-md", severity: "warn", message: `CLAUDE.md references missing dirs: ${missing.join(", ")}` };
  }
  return { name: "claude-md", severity: "pass", message: "CLAUDE.md exists and referenced dirs are valid" };
}

export function checkObsidianVault(vaultPath: string): CheckResult {
  if (!existsSync(vaultPath)) {
    return { name: "obsidian-vault", severity: "warn", message: `Vault directory not found: ${vaultPath}` };
  }
  // "Sessions" was a v1 folder. v2 records each session as a note in Summaries/
  // with the session UUID in frontmatter, so requiring Sessions/ warned on every
  // sync against a correctly-shaped vault.
  const expectedDirs = ["Experiences", "Skill-Candidates", "Summaries"];
  const missing = expectedDirs.filter((d) => !existsSync(join(vaultPath, d)));
  if (missing.length > 0) {
    return { name: "obsidian-vault", severity: "warn", message: `Vault missing directories: ${missing.join(", ")}` };
  }
  return { name: "obsidian-vault", severity: "pass", message: "Vault has all expected directories" };
}

/**
 * Markdown still pointing at the abandoned v1 vault.
 *
 * This bug class has recurred in every layer independently: slash commands in
 * four mirrors, setup.mjs, the guide skill, the reference doc. obsidianVaultDir()
 * contains it for code, but prose has no such chokepoint — a stale path in a
 * command file is read by an agent and acted on exactly as if it were current,
 * and nothing fails. A grep nobody remembers to run is not a guard; this is.
 *
 * Excluded by design, all for one reason — a record of what was true then is not
 * a stale instruction: CHANGELOG.md *should* say `Obsidian Vault/` when
 * describing what v1 did, the dream tests use v1 paths as fixtures for the rule
 * that detects them, and `docs/superpowers/plans/` holds dated plan documents
 * belonging to another plugin. Rewriting any of those would falsify the record.
 */
const V1_VAULT_REF = /Obsidian Vault(?! v2)[/\\]/;

export function checkVaultPathRefs(projectRoot: string, home = homedir()): CheckResult {
  const roots = [
    join(projectRoot, ".claude", "commands"),
    join(projectRoot, ".agents", "skills"),
    join(projectRoot, "project-template"),
    join(projectRoot, "scripts"),
    join(home, ".claude", "commands"),
    join(home, ".cursor", "commands"),
    join(home, "docs"),
  ];
  // Loaded into every session and therefore the highest-leverage place for a
  // stale path to sit: it is read as standing instruction, not as reference.
  // Named explicitly because neither lives in a directory worth walking whole.
  const files = [
    join(home, ".claude", "CLAUDE.md"),
    join(projectRoot, "CLAUDE.md"),
  ];
  const skipDirs = new Set(["node_modules", "build", ".git", "tests", "superpowers"]);
  const skipFiles = new Set(["CHANGELOG.md"]);
  const hits: string[] = [];
  // T-048: what was read and what was left out, counted.
  let scanned = 0;
  const left = { nonMd: 0, changelog: 0, skippedDirs: 0, absentDirs: 0, absentFiles: 0, unreadable: 0 };

  const scan = (full: string): void => {
    try {
      const text = readFileSync(full, "utf8");
      scanned++;
      if (V1_VAULT_REF.test(text)) hits.push(full);
    } catch (e) {
      // Absent is expected for the live user files; unreadable is not, and is counted apart.
      if ((e as NodeJS.ErrnoException).code === "ENOENT") left.absentFiles++;
      else left.unreadable++;
    }
  };

  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      // absent live dir — same tolerance as the parity check, but counted
      if ((e as NodeJS.ErrnoException).code === "ENOENT") left.absentDirs++;
      else left.unreadable++;
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(join(dir, entry.name));
        else left.skippedDirs++;
        continue;
      }
      if (skipFiles.has(entry.name)) {
        left.changelog++;
        continue;
      }
      if (!entry.name.endsWith(".md")) {
        left.nonMd++;
        continue;
      }
      scan(join(dir, entry.name));
    }
  };

  for (const root of roots) walk(root);
  for (const file of files) scan(file);
  const counts =
    `${scanned} .md file(s) scanned; not scanned: ${left.nonMd} non-.md, ${left.changelog} CHANGELOG.md, ${left.skippedDirs} skipped director${left.skippedDirs === 1 ? "y" : "ies"} ` +
    `(${[...skipDirs].join(", ")}), ${left.absentDirs} absent director${left.absentDirs === 1 ? "y" : "ies"}, ${left.absentFiles} absent named file(s), ${left.unreadable} unreadable`;

  if (hits.length > 0) {
    const shown = hits.slice(0, 5).map((h) => h.replace(projectRoot, ".").replace(home, "~"));
    const more = hits.length > 5 ? ` (+${hits.length - 5} more)` : "";
    return {
      name: "vault-path-refs",
      severity: "issue",
      message: `Docs reference the retired v1 vault: ${shown.join(", ")}${more}. ${counts}`,
    };
  }
  if (scanned === 0) {
    return { name: "vault-path-refs", severity: "skip", message: `not checked: no file was read. ${counts}. This is not a pass.` };
  }
  return { name: "vault-path-refs", severity: "pass", message: `No v1-vault references in docs or commands (${counts})` };
}


/**
 * Malformed rows in SKILL-INDEX.md's `## Skills` table.
 *
 * The parser used to `continue` past any row it could not read, so a mangled
 * row (a lost pipe, a blanked Domain cell) made the registered skill invisible
 * to graduation detection and the health score — the cluster it distilled kept
 * being re-proposed every scan, and a corrupted index was indistinguishable
 * from an empty one. The parser now reports what it dropped; this check turns
 * any drop into a sync failure so corruption is caught at commit time, not
 * after another twelve sessions of re-proposals.
 */
export function checkSkillIndex(vaultPath: string): CheckResult {
  const indexPath = join(vaultPath, "Skill-Candidates", "SKILL-INDEX.md");
  if (!existsSync(indexPath)) {
    return { name: "skill-index", severity: "pass", message: "SKILL-INDEX.md absent — nothing to validate" };
  }

  let content: string;
  try {
    content = readFileSync(indexPath, "utf-8");
  } catch (err) {
    return { name: "skill-index", severity: "warn", message: `Could not read SKILL-INDEX.md: ${(err as Error).message}` };
  }

  const { rows, dropped } = parseSkillIndexRows(content);
  if (dropped.length > 0) {
    const shown = dropped[0].length > 60 ? dropped[0].slice(0, 60) + "…" : dropped[0];
    return {
      name: "skill-index",
      severity: "issue",
      message: `SKILL-INDEX.md has ${dropped.length} malformed skill row(s) invisible to graduation (clusters will re-propose): ${shown}`,
    };
  }
  return { name: "skill-index", severity: "pass", message: `SKILL-INDEX.md parses cleanly (${rows.length} skill(s))` };
}

/**
 * `.agents/skills/` has three identities per skill and nothing used to check they agree
 * (T-051): the directory name, the `name` in SKILL.md's frontmatter, and the row in
 * `.agents/skills/INDEX.md`. Prime's loader found three directories and loaded two
 * different ones than the index registered; a 192-line guide had no frontmatter at all and
 * never loaded, for months. Neither reader was wrong about its own file.
 *
 * Every disagreement is one finding naming all three sources. A directory without a
 * SKILL.md, a SKILL.md without frontmatter or a `name`, a name that is not the directory,
 * a directory with no INDEX row, an INDEX row whose Skill or Directory cell is not the
 * directory, and an INDEX row naming a directory that does not exist, are all findings.
 * Absent `.agents/skills/` is SKIP: nothing was looked at, and that is not a pass.
 */
export function checkSkillsContract(projectRoot: string): CheckResult {
  const name = "skills-contract";
  const skillsDir = join(projectRoot, ".agents", "skills");
  if (!existsSync(skillsDir)) {
    return { name, severity: "skip", message: "not checked: .agents/skills/ does not exist in this checkout. This is not a pass." };
  }

  const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

  // INDEX.md: the table rows, whichever heading they sit under. Header and separator rows are structure.
  const indexPath = join(skillsDir, "INDEX.md");
  const indexRows: Array<{ skill: string; directory: string }> = [];
  let indexNote: string | null = null;
  if (!existsSync(indexPath)) {
    indexNote = "INDEX.md does not exist";
  } else {
    try {
      for (const line of readFileSync(indexPath, "utf-8").replace(/^﻿/, "").split(/\r?\n/)) {
        if (!line.trim().startsWith("|")) continue;
        const cells = line.split("|").map((c) => c.trim());
        const filled = cells.filter(Boolean);
        if (filled.length === 0 || filled.every((c) => /^:?-+:?$/.test(c))) continue;
        if (cells[1]?.toLowerCase() === "skill") continue;
        indexRows.push({ skill: (cells[1] ?? "").replace(/`/g, ""), directory: (cells[2] ?? "").replace(/`/g, "").replace(/[\\/]+$/, "") });
      }
    } catch (e) {
      indexNote = `INDEX.md could not be read (${(e as Error).message.split("\n")[0]})`;
    }
  }

  const findings: string[] = [];
  const describe = (dir: string | null, fm: string, row: string): string =>
    `directory ${dir ?? "absent"}; SKILL.md name ${fm}; INDEX.md ${row}`;
  const rowFor = (dir: string) => indexRows.filter((r) => r.directory === dir);

  for (const dir of dirs) {
    const skillMd = join(skillsDir, dir, "SKILL.md");
    let fm: string;
    if (!existsSync(skillMd)) {
      fm = "none (no SKILL.md)";
    } else {
      const text = readFileSync(skillMd, "utf-8").replace(/^﻿/, "");
      const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!block) fm = "none (no frontmatter)";
      else {
        const m = block[1]!.match(/^name\s*:\s*(.+?)\s*$/m);
        fm = m ? m[1]!.replace(/^["']|["']$/g, "") : "none (frontmatter has no name)";
      }
    }
    const rows = rowFor(dir);
    const rowText = indexNote !== null ? `unreadable (${indexNote})` : rows.length === 0 ? "no row" : rows.map((r) => `row "${r.skill}" -> ${r.directory}/`).join(", ");
    const bad =
      fm !== dir ||
      (indexNote === null && (rows.length !== 1 || rows[0]!.skill !== dir));
    if (bad) findings.push(describe(dir, fm === dir ? `"${fm}"` : fm.startsWith("none") ? fm : `"${fm}"`, rowText));
  }
  if (indexNote === null) {
    for (const r of indexRows) {
      if (!dirs.includes(r.directory)) findings.push(describe(null, "none (no directory)", `row "${r.skill}" -> ${r.directory || "(empty)"}/`));
    }
  }
  if (indexNote !== null && dirs.length > 0) findings.push(`${dirs.length} skill director${dirs.length === 1 ? "y" : "ies"} but ${indexNote}`);

  if (findings.length > 0) {
    return { name, severity: "issue", message: `${findings.length} skill(s) disagree across directory, SKILL.md frontmatter and INDEX.md — ${findings.join(" | ")}` };
  }
  return { name, severity: "pass", message: `${dirs.length} skill(s): directory, SKILL.md name and INDEX.md row agree for each` };
}

/**
 * Personal identity leaking into the distributable template.
 *
 * project-template/ ships to strangers, and it shipped with "Aaron" in ~20
 * places and "You are Clark" in the startup command — every consumer's agent
 * introduced itself as Clark and addressed its user as Aaron. Identity belongs
 * in the unshipped layers (the user's global CLAUDE.md, a project's
 * .agents/AGENT.md); template prose stays generic ("the user"). Found by
 * Atlas's self-containment scan (Session 52), same distribution-drift class as
 * Session 36 — and like mirror parity, "remember not to write names into the
 * template" is a prompt-level rule until a check enforces it.
 *
 * The name list is this repo's owner and agents. `melvenac` in GitHub URLs is
 * a repo reference, not a leak — \b keeps `melve` from matching inside it.
 * Case-insensitive: "you are clark" in prose is exactly the shape that would
 * recur, and a guard weaker than the state it protects is barely a guard.
 */
const PERSONAL_NAMES = /\b(Aaron|Clark|melve)\b/i;

export function checkTemplatePersonalNames(projectRoot: string): CheckResult {
  const templateRoot = join(projectRoot, "project-template");
  if (!existsSync(templateRoot)) {
    return { name: "template-personal-names", severity: "warn", message: "project-template/ not found" };
  }

  // T-048 SILENT 3. The old catch here was labelled "binary or unreadable", but
  // a utf-8 read of a binary does not throw — it decodes to replacement chars and
  // is scanned. Only an UNREADABLE file ever reached that catch, so a leak in a
  // file nobody could read was reported as "no personal names".
  const skipDirs = new Set(["node_modules", ".git"]);
  const rel = (p: string) => p.replace(templateRoot, "project-template").replace(/\\/g, "/");
  const hits: string[] = [];
  const unreadable: string[] = [];
  const skipped: string[] = [];
  let read = 0;
  const walk = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) {
      unreadable.push(`${rel(dir)}/ (${(e as NodeJS.ErrnoException).code ?? "error"})`);
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) skipped.push(`${rel(full)}/`);
        else walk(full);
        continue;
      }
      let txt: string;
      try { txt = readFileSync(full, "utf-8"); } catch (e) {
        unreadable.push(`${rel(full)} (${(e as NodeJS.ErrnoException).code ?? "error"})`);
        continue;
      }
      read++;
      const match = txt.match(PERSONAL_NAMES);
      if (match) hits.push(`${rel(full)} ("${match[1]}")`);
    }
  };
  walk(templateRoot);

  const skippedNote = skipped.length > 0
    ? `excluded ${skipped.length} dependency/VCS dir(s), not shipped prose: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? ` (+${skipped.length - 3} more)` : ""}`
    : `excluded: none (${[...skipDirs].join(", ")} would be skipped as not shipped prose)`;
  const scope = `${read} file(s) read; ${skippedNote}`;
  const unreadNote = unreadable.length > 0
    ? `${unreadable.length} unreadable path(s) under project-template/ — a leak there cannot be ruled out: ${unreadable.slice(0, 5).join(", ")}${unreadable.length > 5 ? ` (+${unreadable.length - 5} more)` : ""}. `
    : "";
  // D1. An unreadable path used to return here, so a name in a file that was
  // read never appeared. Every hit is named, and so is every unreadable path.
  if (hits.length > 0 || unreadable.length > 0) {
    const shown = hits.slice(0, 5).join(", ");
    const more = hits.length > 5 ? ` (+${hits.length - 5} more)` : "";
    const hitNote = hits.length > 0
      ? `Template ships personal names — consumers' agents will use them: ${shown}${more}. `
      : "";
    return {
      name: "template-personal-names",
      severity: "issue",
      message: `${hitNote}${unreadNote}${scope}`,
      report: true,
    };
  }
  return {
    name: "template-personal-names",
    severity: "pass",
    message: `No personal names in project-template/ — ${scope}`,
    report: true,
  };
}



export function checkTemplate(projectRoot: string): CheckResult {
  const templatePath = join(projectRoot, "project-template");
  if (!existsSync(templatePath)) {
    return { name: "template", severity: "warn", message: "project-template/ directory not found" };
  }
  const requiredDirs = [".agents", ".claude"];
  const missing = requiredDirs.filter((d) => !existsSync(join(templatePath, d)));
  if (missing.length > 0) {
    return { name: "template", severity: "issue", message: `project-template/ missing: ${missing.join(", ")}` };
  }
  return { name: "template", severity: "pass", message: "project-template/ has .agents and .claude" };
}

export function checkSpecProvenance(projectRoot: string): CheckResult {
  const candidates = [
    join(projectRoot, "specs"),
    join(projectRoot, "docs", "specs"),
    join(projectRoot, "docs", "superpowers", "specs"),
  ];
  const specsDir = candidates.find((d) => existsSync(d));
  if (!specsDir) {
    return { name: "spec-provenance", severity: "warn", message: "specs/ directory not found" };
  }
  const files = readdirSync(specsDir).filter((f) => f.endsWith(".md"));
  return { name: "spec-provenance", severity: "pass", message: `specs/ has ${files.length} spec file(s)` };
}

/**
 * Guards against the same hook script being registered more than once for the
 * same event. A duplicate SessionStart registration made the bootstrap hook emit
 * SESSION_UUID twice; setup.mjs re-adding an existing entry is the usual cause.
 * Counting registrations catches it without needing a live session to observe.
 */
export function checkHookRegistration(settingsPath: string): CheckResult {
  if (!existsSync(settingsPath)) {
    return { name: "hook-registration", severity: "warn", message: "settings.json not found" };
  }

  let parsed: { hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>> };
  try {
    parsed = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch {
    return { name: "hook-registration", severity: "issue", message: "settings.json is not valid JSON" };
  }

  const duplicates: string[] = [];
  // T-048: registrations counted, and what was not counted said by reason.
  let registrations = 0;
  let events = 0;
  const skipped = { noCommand: 0, noScriptName: 0 };

  for (const [event, matchers] of Object.entries(parsed.hooks ?? {})) {
    const counts = new Map<string, number>();
    events++;

    for (const matcher of matchers ?? []) {
      for (const hook of matcher.hooks ?? []) {
        const command = hook.command;
        if (!command) {
          skipped.noCommand++;
          continue;
        }
        // Key on the script filename so path spelling differences (slashes,
        // drive-letter case) still collapse to the same registration.
        const script = (command.match(/[\w.-]+\.(?:js|mjs|cjs|ts)/g) ?? []).pop();
        if (!script) {
          skipped.noScriptName++;
          continue;
        }
        registrations++;
        counts.set(script, (counts.get(script) ?? 0) + 1);
      }
    }

    for (const [script, n] of counts) {
      if (n > 1) duplicates.push(`${event}: ${script} registered ${n}x`);
    }
  }

  const skippedCount = skipped.noCommand + skipped.noScriptName;
  const counts =
    `${registrations} script registration(s) counted across ${events} event(s); skipped ${skippedCount}` +
    (skippedCount > 0 ? ` (${skipped.noCommand} with no command, ${skipped.noScriptName} with no recognisable script filename)` : "");
  if (duplicates.length > 0) {
    return {
      name: "hook-registration",
      severity: "issue",
      message: `Duplicate hook registrations — ${duplicates.join("; ")}. ${counts}`,
    };
  }
  if (registrations === 0) {
    return { name: "hook-registration", severity: "skip", message: `not checked: no hook script registration was read. ${counts}. This is not a pass.` };
  }

  return { name: "hook-registration", severity: "pass", message: `No duplicate hook registrations: ${counts}` };
}

/**
 * Deterministic mirror enforcement.
 *
 * Slash commands exist in up to three places: the live user dirs (~/.claude,
 * ~/.cursor), the distributable template, and the repo root for dogfooding.
 * Drift between them shipped stale commands to template consumers repeatedly
 * (12 sessions of recurring "distribution drift"), because parity was only ever
 * checked by eye. This compares them byte-for-byte instead.
 *
 * Live user directories are only compared when present, so the check still
 * works in CI and for consumers who have not installed the commands.
 */
export function checkMirrorParity(projectRoot: string, home = homedir()): CheckResult {
  const templateClaude = join(projectRoot, "project-template", ".claude", "commands");
  const templateCursor = join(projectRoot, "project-template", ".cursor", "commands");

  const pairs: Array<{ label: string; a: string; b: string; required: boolean }> = [
    { label: "repo↔template (.claude)", a: join(projectRoot, ".claude", "commands"), b: templateClaude, required: true },
    { label: "live↔template (.claude)", a: join(home, ".claude", "commands"), b: templateClaude, required: false },
    { label: "live↔template (.cursor)", a: join(home, ".cursor", "commands"), b: templateCursor, required: false },
  ];

  const problems: string[] = [];
  let compared = 0;
  // T-048: what the check did NOT compare, counted, so "N comparisons" cannot read as "everything".
  const excepted: string[] = [];
  const skippedPairs: string[] = [];
  let ignoredNonMd = 0;

  // The template's Cursor set is asserted against an explicit list, since the
  // pairwise comparison below can only see files that exist on both sides.
  if (existsSync(templateCursor)) {
    const entries = readdirSync(templateCursor);
    ignoredNonMd += entries.filter((f) => !f.endsWith(".md")).length;
    const actual = entries.filter((f) => f.endsWith(".md")).sort();
    const expected = [...CURSOR_COMMAND_SET].sort();
    for (const file of expected) {
      if (!actual.includes(file)) problems.push(`template (.cursor): ${file} missing`);
    }
    for (const file of actual) {
      if (!expected.includes(file)) {
        problems.push(`template (.cursor): ${file} unexpected — add it to CURSOR_COMMAND_SET if intended`);
      }
    }
  }

  for (const { label, a, b, required } of pairs) {
    const aExists = existsSync(a);
    const bExists = existsSync(b);

    if (!aExists || !bExists) {
      if (required) problems.push(`${label}: missing directory`);
      else skippedPairs.push(`${label} (${!aExists ? a : b} does not exist)`);
      continue;
    }

    const listMd = (d: string) => {
      const entries = readdirSync(d);
      ignoredNonMd += entries.filter((f) => !f.endsWith(".md")).length;
      return entries.filter((f) => f.endsWith(".md")).sort();
    };
    const aFiles = listMd(a);
    const bFiles = listMd(b);
    const all = [...new Set([...aFiles, ...bFiles])].sort();

    for (const file of all) {
      if (MIRROR_EXCEPTIONS[file]) {
        excepted.push(`${file} (${label})`);
        continue;
      }

      const inA = aFiles.includes(file);
      const inB = bFiles.includes(file);

      if (!inA) { problems.push(`${label}: ${file} missing from ${a}`); continue; }
      if (!inB) { problems.push(`${label}: ${file} missing from ${b}`); continue; }

      compared++;
      // Compare content, not bytes. A file copied on Windows picks up CRLF
      // while the repo copy stays LF, which a byte-for-byte check reports as
      // drift forever even though the two files say exactly the same thing.
      // Trailing-newline differences are noise for the same reason.
      const norm = (p: string) =>
        readFileSync(p, "utf-8").replace(/\r\n/g, "\n").replace(/\s+$/, "");
      if (norm(join(a, file)) !== norm(join(b, file))) {
        problems.push(`${label}: ${file} differs`);
      }
    }
  }

  const tail =
    `${compared} file comparison(s) + ${existsSync(templateCursor) ? "the template Cursor set asserted" : "no template Cursor set to assert"}; ${excepted.length} excepted${excepted.length ? ` [${excepted.join(", ")}]` : ""}; ` +
    `${ignoredNonMd} non-.md file(s) ignored; ${skippedPairs.length} optional pair(s) skipped${skippedPairs.length ? ` [${skippedPairs.join("; ")}]` : ""}`;
  if (problems.length > 0) {
    return {
      name: "mirror-parity",
      severity: "issue",
      message: `Slash-command mirrors out of sync — ${problems.join("; ")}. ${tail}`,
    };
  }
  if (compared === 0 && !existsSync(templateCursor)) {
    return { name: "mirror-parity", severity: "skip", message: `not checked: no file was compared and the template Cursor set was not asserted. ${tail}. This is not a pass.` };
  }

  return {
    name: "mirror-parity",
    severity: "pass",
    message: `Slash-command mirrors in sync (${tail})`,
  };
}

export function checkRules(projectRoot: string): CheckResult {
  const rulesPath = resolveDocPath(projectRoot, "RULES.md");
  if (!rulesPath) {
    return { name: "rules", severity: "warn", message: "RULES.md not found" };
  }
  return { name: "rules", severity: "pass", message: "RULES.md exists" };
}

/**
 * `.agents/state.json` (Loop 2, read side). Absent is a SKIP with the reason
 * printed, not a pass: the writer (ob_state, Loop 3) never creates the file,
 * so an unmigrated project has none, and a pass would claim a validation
 * that never ran. Present must parse against the strict schema.
 *
 * Loop 8 R3 / ADR-027: the `project.version` comparison is gone with the field.
 * The schema is strict, so a file still carrying it now fails the parse above
 * and is reported as invalid — which is the check that matters, since there is
 * no migration runner for this file.
 */
/**
 * Loop 10 R1 — the schema-staleness check.
 *
 * This parses the live `.agents/state.json` with **the calling process's own
 * loaded schema**, and now names which process that was. It tests the capability
 * rather than a proxy: can the process that will be asked to write this file even
 * read it.
 *
 * **Why not the obvious version comparison.** Loop 9's R3 held `schema_version` at
 * 1 while changing the shape of `ProjectSchema`, so a version check sees 1 against
 * 1 and passes. It would have been green through the entire two-loop outage.
 *
 * **The class this closes.** An MCP server holds its schema for the life of the
 * process, so a loop that changes a schema cannot close itself through the tool it
 * changed without a reconnect — a human action neither agent can perform. It
 * silently cost two loops of record-keeping. Running this from the CLI cannot
 * detect it, because that is a different process; the runtime label is what makes
 * the two distinguishable in the output.
 *
 * Reported whatever the severity, because a pass that is not shown is
 * indistinguishable from a check that never ran.
 */
export function checkStateSchema(
  _version: string,
  projectRoot: string,
  runtime: SyncRuntime = "cli",
): CheckResult {
  const name = "state-schema";
  const where = runtime === "mcp-server" ? "the running MCP server" : "this CLI process";
  const statePath = join(projectRoot, ".agents", "state.json");
  if (!existsSync(statePath)) {
    return {
      name,
      severity: "skip",
      message: "skipped — no .agents/state.json (this project has not been migrated; ob_state never creates the file)",
      report: true,
    };
  }
  const stateText = readFileSync(statePath, "utf-8");
  const parsed = parseState(stateText);
  if (!parsed.ok) {
    const versionAdvice = parsed.path === "schema_version" ? schemaVersionAdvice(stateText) : null;
    const remedy =
      runtime === "mcp-server"
        ? " — the server's loaded schema cannot read the live file. If the schema changed this session, ask Aaron to run `/mcp reconnect open-brain`, then re-run this check: a stale server reports success."
        : " — note this is the CLI's schema, not the running server's. The server may hold a different one; run ob_sync as an MCP tool to test that.";
    // T-163: which DIRECTION the version is off decides the remedy — an older
    // record is migrated, which no reconnect or rebuild would do.
    const direction = versionAdvice ? ` Version: ${versionAdvice}.` : "";
    return {
      name,
      severity: "issue",
      message: `.agents/state.json invalid at ${parsed.error}, as parsed by ${where}${remedy}${direction}`,
      report: true,
    };
  }
  return {
    name,
    severity: "pass",
    message: `.agents/state.json readable by ${where} (schema v${parsed.data.schema_version}, rev ${parsed.data.revision}, ${parsed.data.tasks.length} tasks)`,
    report: true,
  };
}

/**
 * Loop 8 R4 — slash-command parity between the repo and the template it ships.
 *
 * This repo IS the framework source, so it carries the commands it distributes
 * while the author also has them installed globally. The duplication is
 * expected; what was missing is any check that the copies agree. Loop 5's R4
 * had to be applied to every copy by hand and one copy drifted and stayed
 * drifted.
 *
 * Three tiers, deliberately scoped:
 *
 *   1. `.claude/commands/` vs `project-template/.claude/commands/` — `issue`.
 *      Fully deterministic, no machine dependence.
 *   2. `~/.claude/commands/` — `warn`, and SKIPPED ENTIRELY when absent. The
 *      template ships to other people and other machines; a check that reads
 *      the author's home directory must never be able to fail someone else's
 *      build.
 *   3. `project-template/.cursor/commands/` — NOT COVERED, on purpose. It holds
 *      four commands against the `.claude` set's eight and they are ADAPTED,
 *      not copied, so byte or content parity is the wrong assertion there and
 *      would produce a permanently red check. G-001 stays open and this check
 *      does not pretend to cover it.
 *
 * Line endings are normalised before comparing. The user-scope copy of
 * `sync.md` is CRLF where the repo copy is LF with identical content, and
 * reporting that as drift would fail on Windows for no reason.
 *
 * Asymmetric by design, and the asymmetry has an exception. A file only in the
 * repo is allowed — `harness-audit.md` is a framework-development command that
 * new projects have no use for. A file only in the template is normally an
 * issue, because the template would be shipping a command the repo does not
 * carry as source. `bootstrap.md` is the standing exception: it takes an empty
 * folder to an AI-ready project, so the already-bootstrapped framework repo has
 * no use for it, and it has never existed in repo scope.
 */
const TEMPLATE_ONLY_ALLOWED = new Set(["bootstrap.md"]);

/** Content equality ignoring line-ending style and a trailing newline. */
function sameCommandContent(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  return norm(a) === norm(b);
}

function listCommands(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

/**
 * listCommands with what it dropped (T-048): the non-.md files it ignored, counted, and a directory it
 * could not read, reported instead of becoming an empty list.
 */
function listCommandsCounted(dir: string): { files: string[]; ignoredNonMd: number; unreadable: string | null } {
  try {
    const entries = readdirSync(dir);
    return { files: entries.filter((f) => f.endsWith(".md")).sort(), ignoredNonMd: entries.filter((f) => !f.endsWith(".md")).length, unreadable: null };
  } catch (e) {
    return { files: [], ignoredNonMd: 0, unreadable: (e as Error).message.split("\n")[0] };
  }
}

export function checkCommandParity(projectRoot: string, home = homedir()): CheckResult {
  const name = "command-parity";
  const repoDir = join(projectRoot, ".claude", "commands");
  const templateDir = join(projectRoot, "project-template", ".claude", "commands");

  if (!existsSync(repoDir) || !existsSync(templateDir)) {
    return { name, severity: "skip", message: "skipped — .claude/commands or project-template/.claude/commands absent" };
  }

  const repoList = listCommandsCounted(repoDir);
  const templateList = listCommandsCounted(templateDir);
  const repo = repoList.files;
  const template = templateList.files;
  const problems: string[] = [];
  // T-048: what this check does not compare, counted.
  const templateOnly: string[] = [];
  let ignoredNonMd = repoList.ignoredNonMd + templateList.ignoredNonMd;
  if (repoList.unreadable) problems.push(`.claude/commands could not be listed (${repoList.unreadable})`);
  if (templateList.unreadable) problems.push(`project-template/.claude/commands could not be listed (${templateList.unreadable})`);

  // Tier 1: repo vs template.
  for (const f of template) {
    if (!repo.includes(f)) {
      if (TEMPLATE_ONLY_ALLOWED.has(f)) {
        templateOnly.push(f);
        continue;
      }
      problems.push(`${f} is in the template but not in .claude/commands`);
      continue;
    }
    const a = readFileSync(join(repoDir, f), "utf8");
    const b = readFileSync(join(templateDir, f), "utf8");
    if (!sameCommandContent(a, b)) problems.push(`${f} differs between .claude/commands and the template`);
  }

  if (problems.length) {
    return { name, severity: "issue", message: `command drift: ${problems.join("; ")}` };
  }

  const shared = template.filter((f) => repo.includes(f)).length;
  const notCompared = (ignored: number) => `excepted ${templateOnly.length} template-only${templateOnly.length ? ` [${templateOnly.join(", ")}]` : ""}; ${ignored} non-.md file(s) ignored`;

  // Tier 2: user scope. Absent is a skip for that tier, never a failure.
  const userDir = join(home, ".claude", "commands");
  if (!existsSync(userDir)) {
    return {
      name,
      severity: "pass",
      message: `${shared} shared commands identical to the template (user scope absent — not checked; ${notCompared(ignoredNonMd)})`,
      report: true,
    };
  }

  const userDrift: string[] = [];
  const userList = listCommandsCounted(userDir);
  ignoredNonMd += userList.ignoredNonMd;
  let userOnly = 0;
  for (const f of userList.files) {
    if (!repo.includes(f)) {
      userOnly++; // user-only commands are their own business, and are counted
      continue;
    }
    const a = readFileSync(join(repoDir, f), "utf8");
    const b = readFileSync(join(userDir, f), "utf8");
    if (!sameCommandContent(a, b)) userDrift.push(f);
  }

  if (userDrift.length) {
    return {
      name,
      severity: "warn",
      message: `${shared} shared commands identical to the template; user-scope copies differ: ${userDrift.join(", ")} (${userOnly} user-only command(s) not compared; ${notCompared(ignoredNonMd)})`,
      report: true,
    };
  }

  return {
    name,
    severity: "pass",
    message: `${shared} shared commands identical across repo, template and user scope (${userOnly} user-only command(s) not compared; ${notCompared(ignoredNonMd)})`,
    report: true,
  };
}

/**
 * Loop 11 C3 — every `ob_*` a command instructs an agent to call must exist in
 * the server's registered tool list.
 *
 * WHY THIS AND NOT PROSE PARITY. `command-parity` compares the three mirrors to
 * each other. Three identical copies of a false instruction agree perfectly and
 * it reports `pass` — which is exactly what happened to `/skill-scan`, live and
 * byte-identical in all three mirrors for a component Loop 10 had cut.
 *
 * WHAT IT DOES NOT CATCH, stated here so the check is never oversold: **a tool
 * that lies about itself.** Loop 11 found two of fourteen tool descriptions
 * falsified by Loop 10's own cuts — `ob_feedback` claiming to drive maturity
 * promotion and apoptosis, `ob_end` claiming to flag reflection clusters. Both
 * tools EXIST, under exactly the names the commands call them by, so this check
 * passes on both. Tool names are machine-checkable; whether a description is
 * true is not.
 *
 * It is a regression guard rather than a speculative one: `ob_summarize` and
 * `ob_store_summary` both shipped, and both were caught by a human reading the
 * files. This prevents the third recurrence, not a hypothetical first.
 *
 * The registry is read from `server.ts`'s registration sites rather than from a
 * list maintained beside them — a second list is the stand-in that rule 5 warns
 * about, and it would drift from the thing it describes exactly as the mirrors
 * did.
 */
export function checkCommandToolNames(projectRoot: string, home = homedir()): CheckResult {
  const name = "command-tool-names";
  const serverSrc = join(projectRoot, "open-brain", "src", "server.ts");

  if (!existsSync(serverSrc)) {
    return { name, severity: "skip", message: "skipped — open-brain/src/server.ts not found (running outside the source tree)" };
  }

  const registered = new Set(
    [...readFileSync(serverSrc, "utf8").matchAll(/^\s*"(ob_[a-z_]+)",\s*$/gm)].map((m) => m[1])
  );
  if (registered.size === 0) {
    return { name, severity: "skip", message: "skipped — no ob_* registrations found in server.ts (registration shape changed?)" };
  }

  const allDirs = [
    join(projectRoot, ".claude", "commands"),
    join(projectRoot, "project-template", ".claude", "commands"),
    join(projectRoot, "project-template", ".cursor", "commands"),
    join(home, ".claude", "commands"),
    join(home, ".cursor", "commands"),
  ];
  const dirs = allDirs.filter(existsSync);
  // T-048: a directory that is not there is not scanned; the verdict names which, instead of dropping it silently.
  const absentNote = `${dirs.length} of ${allDirs.length} command directories scanned${dirs.length < allDirs.length ? `; absent: ${allDirs.filter((d) => !existsSync(d)).map((d) => (d.startsWith(home) ? "~" + d.slice(home.length) : d.slice(projectRoot.length + 1)).replace(/\\/g, "/")).join(", ")}` : ""}`;

  if (dirs.length === 0) {
    return { name, severity: "skip", message: "skipped — no command directories found" };
  }

  const problems: string[] = [];
  let scanned = 0;
  let namesChecked = 0;

  for (const dir of dirs) {
    for (const f of listCommands(dir)) {
      const text = readFileSync(join(dir, f), "utf8");
      scanned++;
      const named = new Set([...text.matchAll(/\b(ob_[a-z_]+|kb_[a-z_]+)\b/g)].map((m) => m[1]));
      for (const tool of named) {
        namesChecked++;
        if (tool.startsWith("kb_")) {
          // The v1 prefix. Retired wholesale, so any survivor is a dead call.
          problems.push(`${f}: ${tool} (kb_* is the retired v1 prefix)`);
        } else if (!registered.has(tool)) {
          problems.push(`${f}: ${tool} is not a registered tool`);
        }
      }
    }
  }

  if (problems.length) {
    const shown = problems.slice(0, 6).join("; ");
    const more = problems.length > 6 ? `; +${problems.length - 6} more` : "";
    return { name, severity: "issue", message: `commands call tools that do not exist: ${shown}${more}` };
  }

  return {
    name,
    severity: "pass",
    message: `${namesChecked} tool references across ${scanned} command files (${absentNote}) all resolve to ${registered.size} registered tools (names only — this cannot tell whether a tool's description is true)`,
    report: true,
  };
}

/**
 * Loop 12 C2 — `command-names`, the second referent class.
 *
 * `command-tool-names` resolves `ob_*` against the server's registration sites.
 * This resolves `/name` against the command files that actually exist, across
 * the same five mirrors. It is the same mechanism pointed at the referent that
 * Loop 11's own worked example rotted on: **root `README.md` listed
 * `/skill-scan` in the live Commands table for two loops after the command was
 * deleted**, and `e0b2fc8` repaired the distributable copy while missing it.
 *
 * **Why command names and not file paths.** C2 tried file paths first and did
 * not ship them, on purpose. A path check over the same surface produced six
 * distinct findings of which **one** was a real defect; the other five were
 * prose naming a non-existent path *correctly* — an obituary (`test.md` citing
 * `.agents/workflows/test.md` inside the sentence explaining that it exists in
 * no mirror), an example (`e.g. src/components/BookingDrawer.tsx`) and a
 * conditional (`if .agents/META/ exists`). Separating those three from a
 * dangling reference means parsing intent, which this loop is forbidden to
 * attempt. **The difference is a registry.** Tool names have one in
 * `server.ts`; command names have one in the command directories; file paths
 * have none, and the filesystem is not a registry of what prose may mention.
 * **Extend this mechanism to a referent only where a registry exists.** A check
 * that cries wolf gets switched off, and then it occupies the slot a real check
 * would have had.
 *
 * `BUILTINS` is deliberately tiny and grows only by an explicit act, for the
 * same reason a retirement's allowed referrers are captured rather than
 * inferred: it lists the host's own commands that this repo's prose actually
 * names, not every command the host ships. Adding one is a decision someone
 * makes and can be asked about, which is the right cost.
 *
 * Out of scope, and stated here because `command-tool-names` set the precedent:
 * **this cannot tell whether a command's description is true.** It resolves the
 * name and nothing else.
 */
export function checkCommandNames(projectRoot: string, home = homedir()): CheckResult {
  const name = "command-names";

  /** Host commands, not this project's. Grows by explicit act, never inferred. */
  const BUILTINS = new Set(["compact", "init"]);

  const allCommandDirs = [
    join(projectRoot, ".claude", "commands"),
    join(projectRoot, "project-template", ".claude", "commands"),
    join(projectRoot, "project-template", ".cursor", "commands"),
    join(home, ".claude", "commands"),
    join(home, ".cursor", "commands"),
  ];
  const commandDirs = allCommandDirs.filter(existsSync);
  const absentNote = `${commandDirs.length} of ${allCommandDirs.length} command directories scanned${commandDirs.length < allCommandDirs.length ? `; absent: ${allCommandDirs.filter((d) => !existsSync(d)).map((d) => (d.startsWith(home) ? "~" + d.slice(home.length) : d.slice(projectRoot.length + 1)).replace(/\\/g, "/")).join(", ")}` : ""}`;

  if (commandDirs.length === 0) {
    return { name, severity: "skip", message: "skipped — no command directories found" };
  }

  const registered = new Set<string>();
  for (const dir of commandDirs) for (const f of listCommands(dir)) registered.add(f.slice(0, -3));

  if (registered.size === 0) {
    return { name, severity: "skip", message: "skipped — command directories hold no .md files" };
  }

  // The surface that gives instructions about THIS repo. Historical records —
  // CHANGELOG, DECISIONS, PRD, the loop docs, session logs, the archive — keep
  // their references by rule: they describe what was, not what is. They are
  // excluded by not being listed, rather than by a filter someone must
  // remember to apply.
  const surface: Array<[string, string]> = [];
  for (const dir of commandDirs) {
    const label = dir.startsWith(home)
      ? `~/${dir.slice(home.length + 1)}`
      : dir.slice(projectRoot.length + 1);
    for (const f of listCommands(dir)) surface.push([join(dir, f), `${label.replace(/\\/g, "/")}/${f}`]);
  }
  for (const f of ["README.md", "CLAUDE.md"]) {
    if (existsSync(join(projectRoot, f))) surface.push([join(projectRoot, f), f]);
  }
  const skillsDir = join(projectRoot, ".agents", "skills");
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir)) {
      const skill = join(skillsDir, entry, "SKILL.md");
      if (existsSync(skill)) surface.push([skill, `.agents/skills/${entry}/SKILL.md`]);
    }
  }

  const problems: string[] = [];
  let namesChecked = 0;

  for (const [abs, rel] of surface) {
    const seen = new Set<string>();
    for (const m of readFileSync(abs, "utf8").matchAll(/`\/([a-z][a-z0-9-]*)`/g)) {
      const cmd = m[1];
      if (seen.has(cmd)) continue;
      seen.add(cmd);
      namesChecked++;
      if (!registered.has(cmd) && !BUILTINS.has(cmd)) problems.push(`${rel}: /${cmd}`);
    }
  }

  if (problems.length) {
    const shown = problems.slice(0, 6).join("; ");
    const more = problems.length > 6 ? `; +${problems.length - 6} more` : "";
    return {
      name,
      severity: "issue",
      message: `instructions name commands that do not exist: ${shown}${more} (if one is a host command, add it to BUILTINS in checks.ts — an explicit act, not an inference)`,
    };
  }

  return {
    name,
    severity: "pass",
    message: `${namesChecked} command references across ${surface.length} instruction files (${absentNote}) all resolve to ${registered.size} command files or ${BUILTINS.size} declared host commands (names only — this cannot tell whether a command's description is true)`,
    report: true,
  };
}

/**
 * Loop 12 C3 — `retirements`, the check that makes a deletion finish itself.
 *
 * **The record this reads is not new. It is `.agents/LIFECYCLE.md`'s Component
 * Log, made into data.** That log already existed, already tracked, and already
 * held the right answer: `2026-04-16 | /recall | PRUNED | Absorbed into /start`.
 * The `/recall` reference in the gotchas skill survived to **v0.36.0 anyway** —
 * five months and thirty-four minor versions — because **nothing read it.**
 * That is Loop 11's rule 4 in one artifact: every containment that worked was a
 * command, every containment that failed was an intention. The log was an
 * intention. This check is the command.
 *
 * **Why an allowlist and not a parser.** C2 established that a referent is
 * checkable only where a registry exists, and that the filesystem is not one: a
 * registry is a closed list of what exists *and may be named*, and the
 * filesystem answers only the first half. **For a retired name there is no
 * registry anywhere, because the thing is gone — so the record IS the missing
 * registry**, built by hand at retirement time. `allowed_referrers` is captured
 * when the retirement is made, which is the only moment anyone knows which
 * mentions are deliberate. A correct obituary written then is in the set by
 * construction; a dangling reference appearing later is not.
 *
 * This is forced rather than chosen. A retired name read in prose is textually
 * identical whether it is a defect or an obituary — C2 proved it by firing on
 * its own repair, where `` `/recall` `` inside the sentence explaining that
 * `/recall` is gone was indistinguishable from the defect being described.
 *
 * **Entries are global, not per referent class.** A per-class record would have
 * no entry at all for a class with no registry, so it would under-cover
 * *silently*. Global keeps the record complete where checking cannot follow, and
 * moves the incompleteness into this message where a reader can see it — which
 * is why the pass text names the classes it cannot resolve. **Green here means
 * "every recorded retirement is finished", never "everything is finished".**
 *
 * **An empty record passing would be the same defect as a check nobody has seen
 * fail**, so the count of retirements and of verified referrers is in the
 * message, and a stale allowlist entry — a path that no longer exists, or no
 * longer names its retirement — is an issue rather than a silent pass.
 */
export function checkRetirements(projectRoot: string): CheckResult {
  const name = "retirements";
  const recordPath = join(projectRoot, ".agents", "retirements.json");

  if (!existsSync(recordPath)) {
    return { name, severity: "skip", message: "skipped — .agents/retirements.json not found" };
  }

  let record: RetirementRecord;
  try {
    record = JSON.parse(readFileSync(recordPath, "utf8")) as RetirementRecord;
  } catch (e) {
    return { name, severity: "issue", message: `.agents/retirements.json is not valid JSON: ${(e as Error).message}` };
  }

  const retirements = record.retirements ?? [];
  if (retirements.length === 0) {
    // Loud rather than green. A record with nothing in it proves nothing, and
    // the shape of this failure is the reason the count travels in every message.
    return { name, severity: "issue", message: ".agents/retirements.json records no retirements — an empty record passes for the same reason an unfallen check does" };
  }

  const historical = record.historical ?? [];
  const isHistorical = (rel: string) => historical.some((h) => rel === h || rel.startsWith(h));

  // T-048 SILENT 20/26. The listing says where it came from and what it could
  // not reach; the extension filter's exclusions are counted, not dropped.
  const listing = listScannableFiles(projectRoot);
  const live = listing.files.filter((rel) => !isHistorical(rel));
  const surface = live.filter((rel) => SCANNED_EXT.test(rel));
  const excludedByExt = new Map<string, number>();
  for (const rel of live) {
    if (SCANNED_EXT.test(rel)) continue;
    const base = rel.slice(rel.lastIndexOf("/") + 1);
    const ext = base.lastIndexOf(".") > 0 ? base.slice(base.lastIndexOf(".")) : "(no extension)";
    excludedByExt.set(ext, (excludedByExt.get(ext) ?? 0) + 1);
  }
  const excludedNote = excludedByExt.size === 0
    ? "excluded by extension: none"
    : `excluded by extension (not source or prose a retired name ships in): ${[...excludedByExt].sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e} ${n}`).join(", ")}`;
  const unreadable = [...listing.unreadable];
  const texts = new Map<string, string>();
  for (const rel of surface) {
    try { texts.set(rel, readFileSync(join(projectRoot, rel), "utf8")); } catch (e) {
      unreadable.push(`${rel} (${(e as NodeJS.ErrnoException).code ?? "error"})`);
    }
  }

  const unexpected: string[] = [];
  const stale: string[] = [];
  let verified = 0;
  // T-048: (file, retirement) pairs the unexpected-name scan skipped because the file is a declared referrer.
  let allowedPairsNotScanned = 0;
  const classes = new Set<string>();
  const events = new Set<string>();

  for (const r of retirements) {
    events.add(r.event);
    for (const c of r.classes ?? []) classes.add(c);
    // Case sensitivity is per retirement and defaults to STRICT. A prose name
    // ("Skill-scan" at the start of a sentence) needs `ignore_case`; an
    // identifier does not, and granting it globally made `KB_PATH` — a live
    // variable in dashboard.mjs — look like the retired `kb_*` TOOL prefix.
    // That is rule 8 arriving inside the check written to apply it.
    const re = () => new RegExp(r.pattern, r.ignore_case ? "i" : "");
    const allowed = new Set((r.allowed_referrers ?? []).map((a) => a.path));

    for (const a of r.allowed_referrers ?? []) {
      const abs = join(projectRoot, a.path);
      if (!existsSync(abs)) {
        stale.push(`${r.name}: allowed referrer ${a.path} no longer exists`);
        continue;
      }
      if (!re().test(readFileSync(abs, "utf8"))) {
        stale.push(`${r.name}: ${a.path} no longer names it — drop it from allowed_referrers`);
        continue;
      }
      verified++;
    }

    for (const rel of surface) {
      if (allowed.has(rel)) {
        allowedPairsNotScanned++;
        continue;
      }
      const txt = texts.get(rel);
      if (txt !== undefined && re().test(txt)) unexpected.push(`${rel} names ${r.name} (retired ${r.ruled}, ${r.event})`);
    }
  }

  // An unread file is an issue naming the path, never a skip: a retired name in
  // it would otherwise ship under "0 unexpected across N live files".
  if (unexpected.length || stale.length || unreadable.length) {
    const findings = [...unexpected, ...stale];
    const unreadNotes = unreadable.map((u) => `unreadable: ${u}`);
    // D1. Findings come first and are all named. Unreadables used to occupy
    // the six slots, so a retired name fell into "+N more".
    const unreadShown = unreadNotes.slice(0, 6).join("; ");
    const unreadMore = unreadNotes.length > 6 ? `; +${unreadNotes.length - 6} more` : "";
    if (findings.length === 0) {
      const lead = `${unreadable.length} path(s) could not be read, so the scan is ${listing.source === "git" ? "incomplete" : "partial"} (${listing.label})`;
      return { name, severity: "issue", message: `${lead}: ${unreadShown}${unreadMore}`, report: true };
    }
    const parts = [findings.join("; "), unreadShown].filter(Boolean).join("; ");
    // D2. A finding used to replace the listing label, so FALLBACK and PARTIAL
    // disappeared. The label stays, and D3 prints this issue.
    const scanNote = unreadable.length > 0
      ? ` The scan is ${listing.source === "git" ? "incomplete" : "partial"} (${listing.label}).`
      : ` (${listing.label}).`;
    return {
      name,
      severity: "issue",
      message: `retired names still referenced outside the record: ${parts}${unreadMore}.${scanNote}`,
      report: true,
    };
  }

  // The unverifiable half is stated, not omitted. `command` and `tool` names can
  // additionally be resolved against a live registry by command-names and
  // command-tool-names; every other class is guarded by this record alone.
  const RESOLVABLE = ["command", "tool"];
  const unresolvable = [...classes].filter((c) => !RESOLVABLE.includes(c)).sort();
  return {
    name,
    severity: "pass",
    message:
      `${retirements.length} retirements across ${events.size} event classes, ${verified} allowed referrers all present and still naming their retirement, ` +
      `0 unexpected across ${surface.length} live files read (${listing.label}), with ${allowedPairsNotScanned} (file, retirement) pair(s) not scanned because the file is a declared referrer; ${excludedNote}; ${live.length === listing.files.length ? "historical: none" : `historical: ${listing.files.length - live.length} (by rule)`} — ` +
      `resolvable against a registry: ${RESOLVABLE.join(", ")}; guarded by this record alone: ${unresolvable.join(", ")} ` +
      `(green means every RECORDED retirement is finished, not that every retirement is recorded)`,
    report: true,
  };
}

interface RetirementRecord {
  historical?: string[];
  retirements?: Array<{
    name: string;
    pattern: string;
    event: string;
    ruled: string;
    classes?: string[];
    ignore_case?: boolean;
    allowed_referrers?: Array<{ path: string; class: string; why: string }>;
  }>;
}

/**
 * Files worth scanning for a retired name: **the ones git tracks**.
 *
 * This used to be a filesystem walk with a hand-maintained skip list, and the
 * name asserted a property it did not have. It shipped that way and fired **115
 * findings** on a working tree that had a `.gitnexus/` index — a gitignored
 * generated cache whose parse artifacts happen to contain the string
 * `skill-scan`. The worktree it was developed in had no such directory, so it
 * was green there and broken everywhere else.
 *
 * **A hand-maintained skip list is the same defect this check exists to find:**
 * a second list, beside the thing it describes, that drifts. `.gitignore` is
 * already the repo's statement about what is not its own content, and `git
 * ls-files` reads it rather than duplicating it.
 *
 * The trade-off, stated rather than hidden: **an untracked file naming a retired
 * thing is not reported.** That is deliberate — an untracked file does not ship,
 * and the alternative is re-deriving `.gitignore` by hand. The filesystem walk
 * survives only as a fallback for a temp directory under test, where there is
 * no git repo to ask.
 */
interface FileListing {
  /** Every listed file, before the extension filter — the caller counts what it excludes. */
  files: string[];
  source: "git" | "walk";
  /** Printed in the check's output, so a fallback never reads as the primary path. */
  label: string;
  /** Paths the walk could not list or stat. Always empty on the git path. */
  unreadable: string[];
}

/**
 * What `checkRetirements` reads. T-048 SILENT 20: this was md/ts/mjs/cjs/js/json
 * only, and a retired name in a tracked `.sh`, `.yml` or `.toml` was neither a
 * finding nor a dropped count. Scripts and config that can invoke a retired
 * thing are now read; the rest (`.diff`, `.out`, `.txt` evidence, dotfiles) is
 * excluded by extension and counted in the output.
 */
const SCANNED_EXT = /\.(md|ts|mts|cts|mjs|cjs|js|json|sh|ps1|yml|yaml|toml)$/;

function listScannableFiles(root: string): FileListing {
  let why: string;
  try {
    const out = execSync("git ls-files -z", { cwd: root, encoding: "buffer", stdio: ["ignore", "pipe", "ignore"] });
    const files = out.toString("utf8").split("\0").filter(Boolean);
    if (files.length > 0) return { files, source: "git", label: "listed by git ls-files", unreadable: [] };
    why = "git ls-files listed nothing";
  } catch {
    why = "git ls-files failed — not a git repo, or git unavailable";
  }
  const unreadable: string[] = [];
  const skipped: string[] = [];
  const files = walkTracked(root, "", [], unreadable, skipped);
  const partial = unreadable.length > 0 ? `, PARTIAL: ${unreadable.length} path(s) unreadable` : "";
  const skipNote = skipped.length > 0 ? `, skipped ${skipped.length} build/dependency dir(s) with no .gitignore to ask: ${skipped.slice(0, 3).join(", ")}` : "";
  return { files, source: "walk", label: `listed by a filesystem walk — FALLBACK, ${why}${partial}${skipNote}`, unreadable };
}

/** Fallback only: a temp dir under test has no git repo to ask. */
function walkTracked(root: string, rel: string, out: string[], unreadable: string[], skipped: string[]): string[] {
  const SKIP = new Set(["node_modules", ".git", "build", "dist", "coverage", ".vitest"]);
  let entries: string[];
  try { entries = readdirSync(join(root, rel)); } catch (e) {
    unreadable.push(`${rel || "."}/ (${(e as NodeJS.ErrnoException).code ?? "error"})`);
    return out;
  }
  for (const e of entries) {
    const childRel = rel ? `${rel}/${e}` : e;
    if (SKIP.has(e)) { skipped.push(`${childRel}/`); continue; }
    const abs = join(root, childRel);
    let isDir = false;
    try { isDir = statSync(abs).isDirectory(); } catch (err) {
      unreadable.push(`${childRel} (${(err as NodeJS.ErrnoException).code ?? "error"})`);
      continue;
    }
    if (isDir) walkTracked(root, childRel, out, unreadable, skipped);
    else out.push(childRel);
  }
  return out;
}

/**
 * Files on the MEMORY side of the module boundary, relative to `open-brain/src`.
 *
 * Everything NOT listed here is CORE and must not reach memory. That default is
 * deliberate: a new file is core until someone says otherwise, so adding a
 * database import to a new protocol file fails this check instead of quietly
 * widening the boundary. A directory prefix ends with `/`.
 */
export const MEMORY_SIDE: string[] = [
  "db-v2.ts",
  "vault-writer.ts",
  "server.ts",
  "cli-session-end.ts",
  "cli-recall-trigger.ts",
  "pipelines/session-end/",
  "pipelines/store/",
  "pipelines/topics/",
  "pipelines/shadow/",
  "pipelines/sync/checks-memory.ts",
  "pipelines/sync/score.ts",
  // Loop 16. The recall trigger queries the knowledge store, so it is memory
  // by definition — but it arrived as new files, which this list's default
  // correctly classified as CORE, and the check went red on the first full
  // run after they existed. That is the design working: the boundary widened
  // by a reviewed line here rather than by a database import slipping into a
  // file nobody had classified. The OTHER boundary the trigger holds — no
  // edge either way with `src/harness/` (brief §3) — is a different rule and
  // is unaffected by this entry.
  "trigger/",
];

const isMemorySide = (rel: string): boolean =>
  MEMORY_SIDE.some((m) => (m.endsWith("/") ? rel.startsWith(m) : rel === m));

/**
 * The dependency direction, asserted mechanically: **core must never import
 * memory; memory may import core.**
 *
 * Loop 13 C3. A boundary maintained by discipline is an intention — Loop 12's
 * R4 — and this one had already closed once: `pipelines/sync/checks.ts` held a
 * value import of `better-sqlite3`, which dragged a native build into `cli.ts`,
 * whose entire job is reading version strings off disk.
 *
 * **`import type` is excluded and that is not a detail.** TypeScript erases
 * type-only imports, so they are not runtime edges. Counting them overstated
 * the boundary by exactly 2x when this was first measured in C1 — 14 apparent
 * memory roots against 7 real ones.
 *
 * ## What this check CANNOT see, stated here because a check whose limit is not
 * written down gets trusted past it
 *
 * 1. **It sees imports, not instructions.** A command file telling an agent to
 *    call `ob_recall` reaches memory at run time through the MCP transport, and
 *    no import graph contains that edge. `command-tool-names` covers the tool
 *    names themselves; nothing covers the reachability.
 * 2. **It does not model load-time failure.** `ob_start`, `ob_state` and
 *    `ob_sync` never touch the database, and are still unreachable without it,
 *    because `server.ts` resolves `better-sqlite3` at module load before any
 *    handler runs. This check passes on all three. **C4's acceptance test is
 *    what covers that, and this check is not a substitute for it.**
 * 3. **It reads `open-brain/src`, not the build.** A stale `build/` can
 *    disagree with a passing result here.
 */
export function checkModuleBoundary(projectRoot: string): CheckResult {
  const name = "module-boundary";
  const srcDir = join(projectRoot, "open-brain", "src");
  if (!existsSync(srcDir)) {
    return { name, severity: "skip", message: "open-brain/src not present — dependency direction not checked" };
  }

  // T-048 SILENT 2. An unreadable directory used to `return` out of the walk, so
  // its files never entered the graph and a crossing inside it was a pass. An
  // unreadable directory or file is now an issue naming it, checked before the
  // graph is trusted.
  const files: string[] = [];
  const unreadable: string[] = [];
  let excluded = 0;
  const walk = (dir: string, prefix: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) {
      unreadable.push(`${prefix || "."}/ (${(e as NodeJS.ErrnoException).code ?? "error"})`);
      return;
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), rel);
      else if (e.name.endsWith(".ts")) files.push(rel);
      else excluded++;
    }
  };
  walk(srcDir, "");

  const sources = new Map<string, string>();
  for (const rel of files) {
    try { sources.set(rel, readFileSync(join(srcDir, rel), "utf8")); } catch (e) {
      unreadable.push(`${rel} (${(e as NodeJS.ErrnoException).code ?? "error"})`);
    }
  }
  if (files.length === 0 && unreadable.length === 0) {
    return { name, severity: "skip", message: "open-brain/src contains no .ts files — nothing to check" };
  }

  // Group 1 = type-only (erased by tsc, NOT a runtime edge). Group 2/3 = value.
  const specPattern = new RegExp(
    "(?:^|\\n)\\s*(?:import|export)\\s+type\\s[^;]*?from\\s*[\"']([^\"']+)[\"']" +
      "|(?:^|\\n)\\s*(?:import|export)\\s[^;]*?from\\s*[\"']([^\"']+)[\"']" +
      "|(?:^|\\n)\\s*import\\s*[\"']([^\"']+)[\"']",
    "g",
  );

  const valueEdges = new Map<string, string[]>();
  const nativeImporters = new Set<string>();
  let unresolved = 0;
  // T-048: the two kinds of import that are NOT edges of this graph, counted instead of dropped silently.
  let typeOnlyImports = 0;
  let packageImports = 0;

  for (const rel of files) {
    const src = sources.get(rel);
    if (src === undefined) continue;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    specPattern.lastIndex = 0;
    while ((m = specPattern.exec(src)) !== null) {
      if (m[1] !== undefined) {
        typeOnlyImports++; // type-only: erased by tsc, not a runtime edge
        continue;
      }
      const spec = m[2] ?? m[3];
      if (!spec.startsWith(".")) {
        packageImports++;
        if (spec === "better-sqlite3") nativeImporters.add(rel);
        continue;
      }
      // Resolve "./x.js" -> "x.ts", or "./x" -> "x/index.ts", relative to rel.
      const fromDir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
      const parts = (fromDir ? fromDir.split("/") : []).concat(spec.replace(/\.js$/, "").split("/"));
      const stack: string[] = [];
      for (const p of parts) {
        if (p === "." || p === "") continue;
        if (p === "..") stack.pop();
        else stack.push(p);
      }
      const base = stack.join("/");
      const target = files.includes(`${base}.ts`) ? `${base}.ts` : files.includes(`${base}/index.ts`) ? `${base}/index.ts` : null;
      if (target) out.push(target);
      else unresolved++;
    }
    valueEdges.set(rel, out);
  }

  // An unresolved specifier drops an edge, and a dropped edge is a crossing this
  // check cannot see. Refuse rather than report a clean graph (rule 11).
  if (unresolved > 0) {
    return {
      name,
      severity: "issue",
      message: `${unresolved} relative import(s) did not resolve to a file — the dependency graph is incomplete and cannot be trusted; fix resolution before relying on this check`,
      report: true,
    };
  }

  const memo = new Map<string, boolean>();
  const reachesMemory = (rel: string, seen = new Set<string>()): boolean => {
    if (nativeImporters.has(rel) || rel === "vault-writer.ts") return true;
    const cached = memo.get(rel);
    if (cached !== undefined) return cached;
    if (seen.has(rel)) return false;
    seen.add(rel);
    const r = (valueEdges.get(rel) ?? []).some((t) => reachesMemory(t, seen));
    memo.set(rel, r);
    return r;
  };

  const violations: string[] = [];
  for (const rel of files) {
    if (isMemorySide(rel)) continue;
    for (const target of valueEdges.get(rel) ?? []) {
      if (isMemorySide(target) || reachesMemory(target)) {
        violations.push(`${rel} -> ${target}`);
      }
    }
    if (nativeImporters.has(rel)) violations.push(`${rel} -> better-sqlite3 (native build, direct)`);
  }

  const scale = `${files.length} file(s), ${files.filter((f) => !isMemorySide(f)).length} core; excluded ${excluded} non-.ts file(s), not modules in the graph; ${typeOnlyImports} type-only and ${packageImports} package import(s) are not edges`;
  const unreadNote = unreadable.length > 0
    ? `${unreadable.length} unreadable path(s) under open-brain/src — their imports are not in the graph, so a crossing there cannot be ruled out: ${unreadable.slice(0, 4).join(", ")}${unreadable.length > 4 ? ` (+${unreadable.length - 4} more)` : ""}. `
    : "";
  // D1. The unreadable return used to happen before this graph, so a crossing
  // in a file that was read was never named. D3: the file count is on the issue.
  if (violations.length > 0 || unreadable.length > 0) {
    const cross = violations.length > 0
      ? `core imports memory in ${violations.length} place(s) — the module boundary has re-closed: ` +
        `${violations.slice(0, 4).join("; ")}${violations.length > 4 ? `; +${violations.length - 4} more` : ""}. ` +
        `Core must never import memory; memory may import core. `
      : "";
    return {
      name,
      severity: "issue",
      message:
        `${cross}${unreadNote}Checked ${scale}. ` +
        `LIMIT: sees value imports only — not instructions that reach a tool at run time, and not load-time native resolution in server.ts.`,
      report: true,
    };
  }

  return {
    name,
    severity: "pass",
    message:
      `core does not import memory (${scale}). ` +
      `LIMIT: sees value imports only — not instructions that reach a tool at run time, and not load-time native resolution in server.ts.`,
    report: true,
  };
}

/**
 * Run a git command, returning null rather than throwing.
 *
 * Returns null for BOTH "git failed" and "git is not here", and every caller
 * below distinguishes those from a real answer before reporting anything. A
 * helper that folded a failure into an empty string would let a broken git
 * render as a clean result — the family this repo keeps finding.
 */
function gitOut(cwd: string, args: string[]): string | null {
  try {
    // execFileSync, NOT execSync: no shell, so arguments reach git verbatim.
    // Built as a shell string first, `<sha>^{commit}` came back as `<sha>{commit}`
    // because cmd.exe treats `^` as its escape character — the check then reported
    // "indexed commit is not present in this repository" for a commit that was.
    // It failed CLOSED, which is why a test caught it instead of a green run.
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/**
 * Is the GitNexus index current, and is it even anchored to something real?
 *
 * The index lives in ONE tree — the main checkout — and is read through the
 * GitNexus MCP tools, which `CLAUDE.md` tells agents they MUST consult before
 * editing a symbol. When it is stale those tools do not refuse: they ANSWER,
 * about code as it was at the indexed commit. An agent that obeys the
 * instruction gets a confident wrong blast radius; one that ignores it gets
 * nothing and notices. **The compliant path is the worse one**, and that is why
 * this check exists rather than a note telling people to reindex.
 *
 * Found at v0.39.0: the index was 137 commits behind AND pinned to
 * `loop/4-dogfood`, a branch deleted from both the local repo and origin.
 *
 * ## The anchor is the indexed SHA, NOT the recorded branch
 *
 * A first version judged staleness by whether the pinned branch still existed.
 * That was wrong, and it was caught by reindexing rather than by reasoning: a
 * successful reindex at `08e6486` left `branch: "loop/4-dogfood"` — a deleted
 * branch — because the tree was in a DETACHED head and the analyzer had no name
 * to record, so it kept the old one. The check would have reported ISSUE on a
 * perfectly current index. All three worktrees here are detached or will be.
 *
 * **`lastCommit` versus HEAD is a comparison of two SHAs and cannot be fooled.**
 * It was available the whole time. The branch field is reported as context and
 * never as the finding.
 *
 * ## Why the ref and timestamp are printed
 *
 * Two seats measured this an hour apart and got 137 and 138, because master
 * moved underneath them. A derived number must carry what it was derived from,
 * or two correct measurements look like a disagreement.
 *
 * LIMIT, stated in the output: this can see that the index is old. It cannot
 * see whether anything it indexed actually changed — a hundred commits touching
 * only Markdown leave the graph perfectly valid.
 */
export function checkGitNexusIndex(projectRoot: string): CheckResult {
  const name = "gitnexus-index";
  const metaPath = join(projectRoot, ".gitnexus", "meta.json");
  if (!existsSync(metaPath)) {
    return {
      name,
      severity: "skip",
      message: "no .gitnexus/ in this tree — index freshness not checked (the index lives in one checkout; this is not a pass)",
      report: true,
    };
  }

  let meta: { lastCommit?: string; branch?: string; indexedAt?: string };
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8"));
  } catch (err) {
    return { name, severity: "issue", message: `.gitnexus/meta.json unreadable: ${(err as Error).message}`, report: true };
  }

  const head = gitOut(projectRoot, ["rev-parse", "--short", "HEAD"]);
  if (head === null) {
    return { name, severity: "skip", message: "git unavailable here — index freshness not checked (not a pass)", report: true };
  }
  const at = `measured against HEAD ${head} at ${new Date().toISOString()}`;

  // The `branch` field is NOT evidence and must never drive the verdict.
  // The analyzer only records a branch name when one exists: in a DETACHED head
  // it keeps whatever was there before. Measured at v0.39.0 — a reindex at
  // 08e6486 left `branch: "loop/4-dogfood"`, a deleted branch, on a perfectly
  // current index. Judging staleness by it reports ISSUE on a fresh index, which
  // is a false positive on the exact case this check exists to catch, and it
  // would teach whoever sees it to ignore the check.
  //
  // All three worktrees here are detached or will be, so that is the NORMAL case
  // rather than an edge case. A dead pin is reported as context, never as the
  // finding.
  const branch = meta.branch;
  let branchNote = "";
  if (branch) {
    const exists =
      gitOut(projectRoot, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]) !== null ||
      gitOut(projectRoot, ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`]) !== null;
    if (!exists) {
      branchNote =
        ` NOTE: the recorded branch '${branch}' no longer exists, which is expected in a detached checkout —` +
        ` the analyzer keeps the previous name. It is not evidence of staleness either way.`;
    }
  }

  const indexed = meta.lastCommit;
  if (!indexed) {
    return { name, severity: "issue", message: `.gitnexus/meta.json records no lastCommit — staleness is undefined; reindex. ${at}`, report: true };
  }
  if (gitOut(projectRoot, ["cat-file", "-e", `${indexed}^{commit}`]) === null) {
    return {
      name,
      severity: "warn",
      message:
        `not checked: indexed commit ${indexed.slice(0, 7)} unknown — it is not present in this repository, so staleness is UNDEFINED, not zero. Reindex. ${at} ` +
        `LIMIT: sees that the index is old, not whether anything it indexed changed.`,
      report: true,
    };
  }

  // BOTH directions in one call (T-176): left = commits only the index has (it is ahead),
  // right = commits only HEAD has (it is behind). 'At HEAD' needs both to be zero; counting
  // one direction cannot tell 'same commit' from 'I only looked one way'.
  const lr = gitOut(projectRoot, ["rev-list", "--left-right", "--count", `${indexed}...HEAD`]);
  const m = lr === null ? null : /^(\d+)\s+(\d+)$/.exec(lr);
  if (m === null) {
    return { name, severity: "issue", message: `could not count commits between indexed ${indexed.slice(0, 7)} and HEAD — staleness undefined, not zero. ${at}`, report: true };
  }
  const ahead = Number(m[1]);
  const behind = Number(m[2]);
  const tail = `(indexed ${indexed.slice(0, 7)}, HEAD ${head}; behind=${behind} ahead=${ahead}; ${meta.indexedAt ?? "time unrecorded"}; ${at}) ` +
    `LIMIT: sees that the index is old, not whether anything it indexed changed.${branchNote}`;

  if (behind === 0 && ahead === 0) {
    return { name, severity: "pass", message: `index is at HEAD ${tail}`, report: true };
  }
  if (behind > 0 && ahead > 0) {
    const mb = gitOut(projectRoot, ["merge-base", indexed, "HEAD"]);
    return {
      name,
      severity: "issue",
      message:
        `index diverged from HEAD — ${behind} commit(s) behind and ${ahead} ahead, merge-base ${mb === null ? "none (unrelated histories)" : mb.slice(0, 7)}; neither is an ancestor of the other. Reindex. ${tail}`,
      report: true,
    };
  }
  if (ahead > 0) {
    return {
      name,
      severity: "warn",
      message: `index is ${ahead} commit(s) AHEAD of HEAD — HEAD is an ancestor of indexed ${indexed.slice(0, 7)}; the index describes code HEAD does not have yet. ${tail}`,
      report: true,
    };
  }
  return { name, severity: "warn", message: `index is ${behind} commit(s) behind HEAD, ahead=0 — run analyze ${tail}`, report: true };
}

/**
 * Does `build/` correspond to the commit that is checked out?
 *
 * **This is the more dangerous of the two derived artifacts and it had no check
 * at all.** The MCP server and both SessionStart/SessionEnd hooks execute the
 * main tree's `build/` — for every project on this machine, not just this one.
 * A build from a different commit serves old code and reports success.
 *
 * mtimes cannot answer this: checking out an older commit and rebuilding gives
 * a NEWER mtime over OLDER content. The build therefore stamps the SHA it was
 * built from (`scripts/write-build-info.mjs`, wired as `postbuild`) and this
 * check compares it to HEAD. **A comparison, not a heuristic.**
 *
 * An unstamped build is reported as UNKNOWN rather than fresh — a build that
 * predates the stamp cannot be vouched for, and saying so is the point.
 */
/**
 * Is this the main checkout, or a linked worktree?
 *
 * `--absolute-git-dir` and `--git-common-dir` are the SAME path in the main
 * checkout and differ in a linked worktree, where the git dir is
 * `<common>/worktrees/<name>`. Measured across all three trees here.
 *
 * Returns null when git cannot answer, and the caller then says nothing about
 * consequences rather than guessing one.
 */
function isMainCheckout(projectRoot: string): boolean | null {
  const gitDir = gitOut(projectRoot, ["rev-parse", "--path-format=absolute", "--absolute-git-dir"]);
  const commonDir = gitOut(projectRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (gitDir === null || commonDir === null) return null;
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(gitDir) === norm(commonDir);
}

/**
 * What a stale build actually costs, WHERE THE CHECK IS RUNNING.
 *
 * This sentence used to assert unconditionally that "the MCP server and both
 * hooks are running code from a different commit". **That is true only in the
 * main checkout.** Both hooks in `~/.claude/settings.json` hardcode absolute
 * paths into the main tree's `open-brain/build/`, so in a linked worktree a
 * stale local build means the local CLI is stale and the hooks and server are
 * untouched. Two of the three trees here are linked.
 *
 * It matters because this check fires OFTEN — every amend, rebase and branch
 * switch re-stales the build, correctly, since the stamp is a commit
 * comparison. **Frequent plus a false justification is how a check teaches
 * people to ignore it**, and this one has to survive being seen often.
 *
 * Rule 14: a statement true where it was written, used as an invariant,
 * falsified by an ordinary fact elsewhere. The verdict and the comparison are
 * unchanged — only the consequence is made true where it is read.
 */
function staleBuildConsequence(projectRoot: string): string {
  const main = isMainCheckout(projectRoot);
  if (main === null) {
    return "this build does not match the checked-out commit.";
  }
  return main
    ? "the MCP server and both hooks run from THIS tree's build, so they are running code from a different commit, and a stale server reports success."
    : "the local CLI in this checkout is stale. The hooks and MCP server run from the MAIN checkout's build and are unaffected by this one.";
}

export function checkBuildFreshness(projectRoot: string): CheckResult {
  const name = "build-freshness";
  const buildDir = join(projectRoot, "open-brain", "build");
  if (!existsSync(buildDir)) {
    return { name, severity: "skip", message: "open-brain/build absent — nothing built here to compare (not a pass)", report: true };
  }

  const infoPath = join(buildDir, "build-info.json");
  if (!existsSync(infoPath)) {
    return {
      name,
      severity: "issue",
      message:
        "build/ exists but carries no build-info.json — it predates the stamp, so which commit it was built from is UNKNOWN. " +
        `Rebuild. An unstamped build cannot be distinguished from a stale one, and ${staleBuildConsequence(projectRoot)}`,
      report: true,
    };
  }

  let info: { commit?: string | null; builtAt?: string; reason?: string | null };
  try {
    info = JSON.parse(readFileSync(infoPath, "utf8"));
  } catch (err) {
    return { name, severity: "issue", message: `build/build-info.json unreadable: ${(err as Error).message} — rebuild`, report: true };
  }

  if (!info.commit) {
    return {
      name,
      severity: "issue",
      message: `build was not stamped with a commit (${info.reason ?? "no reason recorded"}) — freshness is UNKNOWN, not fresh. Rebuild.`,
      report: true,
    };
  }

  const head = gitOut(projectRoot, ["rev-parse", "HEAD"]);
  if (head === null) {
    return { name, severity: "skip", message: "git unavailable here — build freshness not checked (not a pass)", report: true };
  }

  const short = (s: string) => s.slice(0, 7);
  if (head === info.commit) {
    return {
      name,
      severity: "pass",
      message:
        `build matches HEAD ${short(head)} (built ${info.builtAt ?? "at an unrecorded time"}). ` +
        `LIMIT: compares commits, not working-tree edits — uncommitted source changes are not in this build either.`,
      report: true,
    };
  }

  return {
    name,
    severity: "issue",
    message:
      `build was made from ${short(info.commit)} but HEAD is ${short(head)} — ${staleBuildConsequence(projectRoot)} Rebuild. ` +
      `(built ${info.builtAt ?? "at an unrecorded time"}) ` +
      `LIMIT: compares commits, not working-tree edits.`,
    report: true,
  };
}

/** Above this many characters the greeting is an ISSUE (T-183). */
export const GREETING_LIMIT = 40_000;

export interface ComposedGreeting {
  text: string;
  parts: { treeAndSeat: number; state: number; roleFiles: number; presence: number };
}

/**
 * T-183: the greeting `ob_start` returns, composed from the same functions
 * `handleStart` uses and in its order — tree currency, seat, the state render,
 * then the role files whole. `handleStart` itself is not called: it creates a
 * session log on every call (G-008), and a check must write nothing.
 *
 * NOT COUNTED, and the check says so: the mode, version, drift, session, warnings
 * and sizes lines `handleStart` adds around these parts. Their size is measured
 * in docs/loops/t183-developer-handoff.md, not restated here, where it would go
 * stale. Null when there is no valid state.json to render.
 */
export function composeGreeting(projectRoot: string, version: string): ComposedGreeting | null {
  const statePath = join(projectRoot, ".agents", "state.json");
  if (!existsSync(statePath)) return null;
  const parsed = parseState(readFileSync(statePath, "utf-8"));
  if (!parsed.ok) return null;

  const roles = describeRoleFiles(projectRoot, readAgentIdentity(projectRoot));
  const seat = roles.seat ? SeatName.safeParse(roles.seat.role) : null;
  const treeAndSeat = [
    ...describeTreeCurrency(projectRoot).lines,
    roles.seat ? `Seat: ${roles.seat.name} (${roles.seat.role})` : "Seat: UNRESOLVED",
    ...roles.lines,
    ...roles.problems,
  ].join("\n");
  const state = renderState(parsed.data, version, {
    seat: seat?.success ? seat.data : null,
    projectRoot,
  }).join("\n");
  const roleFiles = roles.files
    .filter((f) => f.content !== null)
    .map((f) => `\n## ${f.rel}${f.commit ? ` @ ${f.commit.slice(0, 7)}` : ""}\n${(f.content as string).replace(/\s+$/, "")}`)
    .join("\n");
  // T-198: the partner-presence block sits after the seat lines in handleStart. It is
  // fetched live there; a check must not call the hub, so its WORST-CASE size is counted.
  const presence = presenceBlockUpperBound(projectRoot, roles.seat).lines.join("\n");
  const text = [treeAndSeat, ...(presence ? [presence] : []), state, roleFiles].join("\n");
  return {
    text,
    parts: { treeAndSeat: treeAndSeat.length, state: state.length, roleFiles: roleFiles.length, presence: presence.length },
  };
}

/**
 * T-183 — does the greeting still fit one tool result? At rev 130 it was 98,679
 * characters and did not: every seat read it in chunks and one skipped it.
 *
 * The count is printed on every run, whatever the severity, because the number is
 * the point. ISSUE above `limit`.
 */
export function checkGreetingSize(version: string, projectRoot: string, limit = GREETING_LIMIT): CheckResult {
  const name = "greeting-size";
  const g = composeGreeting(projectRoot, version);
  if (!g) {
    return {
      name,
      severity: "skip",
      message: "skipped — no valid .agents/state.json, so ob_start returns the prose fallback, which this check does not measure",
      report: true,
    };
  }
  const n = g.text.length;
  const detail =
    `(state render ${g.parts.state}, role files ${g.parts.roleFiles}, tree and seat ${g.parts.treeAndSeat}, ` +
    `presence block ${g.parts.presence} (worst-case upper bound, not fetched)). ` +
    `LIMIT: composed from handleStart's parts, not by calling it; its mode, drift, session, warnings and sizes lines are not counted.`;
  return n > limit
    ? { name, severity: "issue", message: `greeting is ${n} characters, over the ${limit} limit ${detail}`, report: true }
    : { name, severity: "pass", message: `greeting is ${n} characters, within the ${limit} limit ${detail}`, report: true };
}
