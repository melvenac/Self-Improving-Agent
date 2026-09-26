#!/usr/bin/env node
// QA 114 (T-183): the REAL greeting, from the built handleStart, against greeting-size's composition.
//
// Calls handleStart (server.js) in a scratch worktree, which is what ob_start runs, for a given seat,
// and — when the build has it — composeGreeting / checkGreetingSize from the same build. Reports:
//   live       the tool result's text length (what a seat receives)
//   composed   composeGreeting's length, and the check's verdict and message
//   drift      live - composed, and which live lines are not in the composed text (the uncounted part)
//   parts      whether each composed part occurs in the live text verbatim
//   roles      each role file's content present whole in the live text
//
// handleStart writes a session log under <root>/.agents/SESSIONS (G-008): the root is a scratch
// worktree, never the QA tree. KNOWLEDGE_V2_DB is pointed at scratch before the import.
//
// Usage: node greeting-live.mjs <open-brain-dir> <project-root> <seat|default> [--dump <file>]
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";

const [ob, root, seat, dumpFlag, dumpFile] = process.argv.slice(2);
process.env.KNOWLEDGE_V2_DB ??= join(process.env.TEMP ?? "C:\\qa-tmp", "qa114-knowledge-v2.db");

const local = join(root, ".agents", "AGENT.local.md");
if (seat !== "default") {
  const name = { planner: "Atlas", developer: "Forge", qa: "QA" }[seat];
  writeFileSync(local, `---\nname: ${name}\nrole: ${seat}\npartner: Atlas\n---\n\nQA 114 probe seat.\n`);
} else if (existsSync(local)) rmSync(local);

const sessionsBefore = new Set(existsSync(join(root, ".agents", "SESSIONS")) ? readdirSync(join(root, ".agents", "SESSIONS")) : []);
const server = await import(pathToFileURL(join(ob, "build", "server.js")).href);
const checks = await import(pathToFileURL(join(ob, "build", "pipelines", "sync", "checks.js")).href);
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

const res = await server.handleStart({ project_root: root });
const live = res.content[0].text;
// Remove the session log the call created, so repeated runs stay comparable.
for (const f of readdirSync(join(root, ".agents", "SESSIONS"))) if (!sessionsBefore.has(f)) rmSync(join(root, ".agents", "SESSIONS", f), { recursive: true });

const out = { root, seat, version, isError: !!res.isError, live: live.length };
if (typeof checks.composeGreeting === "function") {
  const g = checks.composeGreeting(root, version);
  const r = checks.checkGreetingSize(version, root);
  out.composed = g.text.length;
  out.parts = g.parts;
  out.check = { severity: r.severity, message: r.message };
  out.drift = live.length - g.text.length;
  // Which live lines does the composition not contain? (Line-multiset difference.)
  const have = new Map();
  for (const l of g.text.split("\n")) have.set(l, (have.get(l) ?? 0) + 1);
  const extra = [];
  for (const l of live.split("\n")) {
    const n = have.get(l) ?? 0;
    if (n > 0) have.set(l, n - 1); else extra.push(l);
  }
  const missing = [...have].filter(([, n]) => n > 0).flatMap(([l, n]) => Array(n).fill(l));
  out.live_lines_not_composed = { count: extra.length, chars_incl_newlines: extra.reduce((a, l) => a + l.length + 1, 0), lines: extra };
  out.composed_lines_not_live = { count: missing.length, lines: missing };
  // The state render as one block: is the composition's state part a verbatim substring of live?
  const stateStart = g.text.indexOf("\n## State (");
  out.state_block_verbatim_in_live = live.includes(g.text.slice(stateStart, stateStart + g.parts.state));
}
// Role files whole: every file shared.md + the seat's file, byte for byte.
const roleDir = join(root, ".agents", "roles");
out.roles = {};
for (const f of readdirSync(roleDir)) {
  const body = readFileSync(join(roleDir, f), "utf8").replace(/\s+$/, "");
  out.roles[f] = live.includes(body) ? "whole" : "absent";
}
if (dumpFlag === "--dump") writeFileSync(dumpFile, live);
console.log(JSON.stringify(out, null, 2));
