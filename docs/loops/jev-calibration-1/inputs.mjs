// inputs.mjs — build each case's D_t MECHANICALLY from its dispatch file at its dispatch commit.
//
// Reads ONLY dispatches.json and the dispatch blobs it names. It must not read a QA report, a verdict or a
// ruling, and it takes no hand edit: a dispatch that does not parse into a valid plan is DROPPED, with the
// reason logged, and never patched. Run with tsx (it imports the plan validator):
//   node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-1/inputs.mjs
//
// The derivation (one rule per D_t field, applied identically to every dispatch):
//   loop            "<case_no>-<case_id>", lower-cased, non-alphanumerics to "-"
//   objective       the H1 line, markdown backticks and bold marks removed
//   tasks           the list items and table rows under headings matching TASK_HEADINGS; with none, every list item
//   acceptance      table rows whose first cell looks like a row id (id = that cell), else each task as T<n>; all "blackbox"
//   out_of_scope    items under headings matching OUT_HEADINGS
//   preserve        items under headings matching PRESERVE_HEADINGS
//   repair_targets  items under headings matching REPAIR_HEADINGS
//   new_capability  the objective
//   reconstructed_* the script, and the dispatch's path and blob
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, git, readJson, stable, writeJson } from "./lib.mjs";
import { validatePlan } from "../../../open-brain/src/harness/schema.ts";

const TASK_HEADINGS = /(rows?\b.*\bscore|score\b|\bcheck|what to (?:read|do)|the design|procedure|task|goal|scope|requirements?|rows)/i;
const OUT_HEADINGS = /(out of scope|not in scope|non-goals?|do not|what not)/i;
const PRESERVE_HEADINGS = /(preserve|regression|unchanged|must not change)/i;
const REPAIR_HEADINGS = /(what changed since|defects? to|findings?|repair)/i;

const clean = (s) => s.replace(/[*`]/g, "").replace(/\s+/g, " ").trim();

/** Split a markdown document into { heading, level, lines } sections. The H1 is returned separately. */
function sections(text) {
  const out = [];
  let cur = { heading: "", level: 0, lines: [] };
  for (const line of text.split("\n")) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) {
      out.push(cur);
      cur = { heading: m[2], level: m[1].length, lines: [] };
    } else cur.lines.push(line);
  }
  out.push(cur);
  return out;
}

/** List items and table rows of a section, continuation lines joined. Table header rows are not items. */
function items(lines) {
  const res = [];
  let last = null;
  let inTable = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const li = /^\s{0,3}(?:[-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) { inTable = true; continue; }
      if (!inTable) { last = null; continue; } // the header row, before the separator
      res.push({ kind: "row", cells });
      last = null;
      continue;
    }
    inTable = false;
    if (li) { res.push({ kind: "item", text: li[1] }); last = res[res.length - 1]; continue; }
    if (last && /^\s{2,}\S/.test(line)) { last.text += ` ${line.trim()}`; continue; }
    last = null;
  }
  return res;
}

const itemText = (it) => clean(it.kind === "item" ? it.text : it.cells.join(" | "));
const looksLikeId = (c) => /^[A-Za-z][A-Za-z0-9_.-]*\d[A-Za-z0-9_.-]*$/.test(clean(c)) || /^[A-Z]{1,6}-?\d+[A-Za-z0-9.-]*$/.test(clean(c));

function derive(text, entry) {
  const secs = sections(text);
  const h1 = secs.find((s) => s.level === 1);
  if (!h1 || clean(h1.heading) === "") return { drop: "no-H1-objective" };
  const objective = clean(h1.heading);
  const under = (re) => secs.filter((s) => s.level > 1 && re.test(s.heading)).flatMap((s) => items(s.lines));
  let taskItems = under(TASK_HEADINGS);
  if (taskItems.length === 0) taskItems = secs.flatMap((s) => items(s.lines));
  if (taskItems.length === 0) return { drop: "no-list-items-or-table-rows" };
  const tasks = taskItems.map(itemText).filter((t) => t !== "");
  const rowAcc = taskItems.filter((it) => it.kind === "row" && it.cells.length >= 2 && looksLikeId(it.cells[0]));
  const acceptance =
    rowAcc.length > 0
      ? rowAcc.map((it) => ({ id: clean(it.cells[0]), observable: clean(it.cells.slice(1).join(" | ")), type: "blackbox" }))
      : tasks.map((t, i) => ({ id: `T${i + 1}`, observable: t, type: "blackbox" }));
  const seen = new Set();
  const acc = acceptance.filter((a) => a.observable !== "" && !seen.has(a.id) && seen.add(a.id));
  const plan = {
    loop: `${entry.case_no}-${entry.case_id}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
    objective,
    tasks,
    out_of_scope: under(OUT_HEADINGS).map(itemText).filter(Boolean),
    preserve: under(PRESERVE_HEADINGS).map(itemText).filter(Boolean),
    acceptance: acc,
    repair_targets: under(REPAIR_HEADINGS).map(itemText).filter(Boolean),
    new_capability: objective,
    reconstructed_by: "jev-calibration-1/inputs.mjs",
    reconstructed_from: { path: entry.dispatch_path, blob: entry.dispatch_blob },
  };
  const v = validatePlan(plan);
  if (!v.ok) return { drop: `plan-invalid: ${v.problems.slice(0, 2).join("; ")}` };
  return { plan: v.value };
}

const entries = readJson("dispatches.json");
const dir = join(HERE, "inputs");
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) rmSync(join(dir, f));

const built = [];
const dropped = [];
for (const e of entries) {
  const text = git(["show", e.dispatch_blob], { allowFail: true });
  if (text === null) { dropped.push({ case_id: e.case_id, case_no: e.case_no, reason: "dispatch-blob-unreadable" }); continue; }
  const r = derive(text, e);
  if (r.drop) { dropped.push({ case_id: e.case_id, case_no: e.case_no, reason: r.drop }); continue; }
  const file = `${String(e.case_no).padStart(3, "0")}-${e.case_id}.D_t.json`;
  writeFileSync(join(dir, file), stable(r.plan));
  built.push({ case_id: e.case_id, case_no: e.case_no, file: `inputs/${file}` });
}
writeJson("inputs.json", { built, dropped });
console.log(`inputs: ${built.length} D_t built, ${dropped.length} dropped`);
for (const d of dropped) console.log(`  dropped ${d.case_id}: ${d.reason}`);
