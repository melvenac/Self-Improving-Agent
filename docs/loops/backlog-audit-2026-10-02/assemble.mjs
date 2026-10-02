// assemble.mjs: build docs/loops/backlog-audit-2026-10-02.md from the derived task list and the five batch tables.
//   node docs/loops/backlog-audit-2026-10-02/assemble.mjs
// The row count is DERIVED: the script reads the open tasks from .agents/state.json at origin/master (list-open-tasks.mjs's
// rule), requires every one of them to have exactly one row in rows/batch-*.md and no other id to appear, and fails otherwise.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXCLUDED } from "./excluded.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../..");
const ref = "origin/master";
const state = JSON.parse(execFileSync("git", ["show", `${ref}:.agents/state.json`], { cwd: REPO, encoding: "utf-8", maxBuffer: 1 << 28 }));
const open = state.tasks.filter((t) => t.status !== "done");
const wanted = open.filter((t) => !EXCLUDED.includes(t.id));
const rev = execFileSync("git", ["rev-parse", ref], { cwd: REPO, encoding: "utf-8" }).trim();

const rows = new Map();
for (const f of readdirSync(join(HERE, "rows")).filter((n) => /^batch-\d+\.md$/.test(n)).sort()) {
  for (const line of readFileSync(join(HERE, "rows", f), "utf-8").split("\n")) {
    const m = /^\| (T-\d+) \| (P\d) \| (DONE|PARTLY|OPEN|OBSOLETE) \| (.*) \| ([^|]*) \|\s*$/.exec(line);
    if (!m) continue;
    if (rows.has(m[1])) throw new Error(`duplicate row for ${m[1]}`);
    rows.set(m[1], { id: m[1], priority: m[2], cls: m[3], evidence: m[4], right: m[5].trim(), file: f });
  }
}
const missing = wanted.filter((t) => !rows.has(t.id)).map((t) => t.id);
const extra = [...rows.keys()].filter((id) => !wanted.some((t) => t.id === id));
if (missing.length || extra.length) throw new Error(`rows do not match the derived list: missing ${missing} extra ${extra}`);
const wrongPriority = wanted.filter((t) => rows.get(t.id).priority !== t.priority).map((t) => t.id);
if (wrongPriority.length) throw new Error(`priority differs from the record for ${wrongPriority}`);

const ordered = wanted.map((t) => rows.get(t.id));
const count = (cls) => ordered.filter((r) => r.cls === cls).length;
const byPriority = (p) => ordered.filter((r) => r.priority === p).length;
const list = (cls) => ordered.filter((r) => r.cls === cls).map((r) => r.id).join(", ");
const out = [];
out.push(
  "# Backlog audit, 2026-10-02: every open task against master",
  "",
  "**By:** Forge (builder), for Atlas, record session 157. **Read-only.** No code and no record edit: closing tasks is the planner's, through `ob_state`.",
  `**Against:** \`origin/master\` \`${rev.slice(0, 8)}\`, record rev ${state.revision}. **Method:** each task's note read, then \`git grep\`, \`git log --grep/-S\` and reading the code. No suite was run. Five audit passes (one per batch of the task list), each told to verify by reading and to prefer PARTLY or OPEN to a guessed DONE. The evidence cells are theirs; I spot-checked the load-bearing lines of the DONE and OBSOLETE rows against master (last section).`,
  "",
  `**Derived counts (from \`list-open-tasks.mjs\` and \`assemble.mjs\`, not typed):** ${state.tasks.length} tasks in the record, ${open.length} open, ${open.length - wanted.length} excluded (open PRs from this session), **${wanted.length} audited**: P0 ${byPriority("P0")}, P1 ${byPriority("P1")}, P2 ${byPriority("P2")}, P3 ${byPriority("P3")}.`,
  "",
  "| class | n | tasks |",
  "|---|---|---|",
  `| DONE | ${count("DONE")} | ${list("DONE")} |`,
  `| OBSOLETE | ${count("OBSOLETE")} | ${list("OBSOLETE")} |`,
  `| PARTLY | ${count("PARTLY")} | ${list("PARTLY")} |`,
  `| OPEN | ${count("OPEN")} | ${list("OPEN")} |`,
  "",
  `**Closable now on this evidence:** the ${count("DONE")} DONE and the ${count("OBSOLETE")} OBSOLETE (${count("DONE") + count("OBSOLETE")} of ${wanted.length}). Excluded from the audit by instruction: ${EXCLUDED.join(", ")}.`,
  "",
  "**Reading the table.** *PARTLY* for T-199, T-200, T-201 and T-203 means built on an unmerged branch and absent from master. The id T-179 is overloaded in code (commits and comments cite it for the v3 migration as well as for `/end`); its row is about `/end`. T-101 and T-102 depend on vault and `~/` state outside the repo and could not be verified from master. T-067's \"153 open checkboxes\" count cannot be checked in the repo (the logs are local); it is closable on the RUNBOOK rule alone.",
  "",
  "## The table",
  "",
  "| id | priority | class | evidence | note still right? |",
  "|---|---|---|---|---|",
  ...ordered.map((r) => `| ${r.id} | ${r.priority} | ${r.cls} | ${r.evidence} | ${r.right} |`),
  "",
  readFileSync(join(HERE, "top10.md"), "utf-8").trimEnd(),
  "",
  "## Spot-check of the load-bearing evidence (done by me against this checkout)",
  "",
  "`.gitignore:84-86` holds `/.recalled-entries.json`, `/open-brain/.agents/` and `AGENTS.md` (T-091); `RUNBOOK.md:134-136` holds the write-once session-log rule (T-067); `start.md:91` says \"There is no mailbox step\" (T-093, T-103); `git grep inferKind` finds no classifier in `open-brain/src` (T-023); `qa-driver-template/drive.ps1:30-32` sets `C:\\qa-tmp` (T-190); `state-writer.ts:57-58` has `append_note` and `replace_note` (T-171); `session-log.ts:17-21` returns `source: \"record\"` or `\"local\"` (T-164); PR #270 (`bd07f604`), PR #274 (`2b39e5cc`) and `79d1f5d9` (T-211) are on master. Not independently re-read: the hub-presence, closeout-tables and policies line numbers cited for T-198, T-220 and T-222.",
  "",
);
writeFileSync(join(HERE, "..", "backlog-audit-2026-10-02.md"), out.join("\n"));
console.log(`wrote backlog-audit-2026-10-02.md: ${wanted.length} rows (DONE ${count("DONE")}, OBSOLETE ${count("OBSOLETE")}, PARTLY ${count("PARTLY")}, OPEN ${count("OPEN")})`);
