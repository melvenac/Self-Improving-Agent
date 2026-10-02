// list-open-tasks.mjs: the audit's task list, derived from the record rather than typed.
//   node docs/loops/backlog-audit-2026-10-02/list-open-tasks.mjs [--ref origin/master] [--json out.json]
// Reads .agents/state.json AT A GIT REF (not the working copy), keeps tasks whose status is not "done",
// drops the ids that have an open PR from this session (EXCLUDED), and prints the counts.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { EXCLUDED } from "./excluded.mjs";

const argv = process.argv.slice(2);
const arg = (name, dflt) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt);
const ref = arg("ref", "origin/master");
const raw = execFileSync("git", ["show", `${ref}:.agents/state.json`], { encoding: "utf-8", maxBuffer: 1 << 28 });
const state = JSON.parse(raw);
const open = state.tasks.filter((t) => t.status !== "done");
const audited = open.filter((t) => !EXCLUDED.includes(t.id));
const excludedPresent = open.filter((t) => EXCLUDED.includes(t.id)).map((t) => t.id);
const excludedAbsent = EXCLUDED.filter((id) => !open.some((t) => t.id === id));
const out = audited.map((t) => ({ id: t.id, priority: t.priority, status: t.status, title: t.title, note: t.note ?? "" }));
const summary = {
  ref,
  record_revision: state.revision,
  tasks_total: state.tasks.length,
  open_total: open.length,
  excluded_listed: EXCLUDED.length,
  excluded_open_here: excludedPresent.length,
  excluded_not_open_here: excludedAbsent,
  to_audit: out.length,
  by_priority: Object.fromEntries(["P0", "P1", "P2", "P3"].map((p) => [p, out.filter((t) => t.priority === p).length])),
};
console.log(JSON.stringify(summary, null, 2));
const jsonPath = arg("json", null);
if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify(out, null, 2)}\n`);
