#!/usr/bin/env node
// QA 120 (T-185): every documented invocation of a changed subcommand still parses.
// Scans EVERY tracked file of <tree> (git grep, docs/loops included) plus setup.mjs for
// `cli.js <sub> ...`, `open-brain <sub> ...` and `npm run dev -- <sub>` forms, cuts each at the end of
// its code span / line, and runs the candidate's own parseArgs (build/shared/cli-args.js) against
// build/cli-spec.js. Usage: node doc-invocations.mjs <tree>
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const tree = process.argv[2];
const { parseArgs } = await import(pathToFileURL(join(tree, "open-brain/build/shared/cli-args.js")).href);
const { COMMAND_SPECS } = await import(pathToFileURL(join(tree, "open-brain/build/cli-spec.js")).href);

const out = execFileSync("git", ["grep", "-n", "-I", "-E", "(cli\\.js|open-brain) +(sync|start|relocate|topics|detach|state)( |`|$|\\))"], { cwd: tree, encoding: "utf8", maxBuffer: 64 << 20 });
const seen = new Map();
for (const line of out.split(/\r?\n/)) {
  if (!line) continue;
  const m = /^([^:]+):(\d+):(.*)$/.exec(line);
  if (!m) continue;
  const [, file, ln, text] = m;
  const re = /(?:cli\.js|open-brain)\s+(sync|start|relocate|topics|detach|state)\b([^`\n|;&)"']*)/g;
  let mm;
  while ((mm = re.exec(text))) {
    let sub = mm[1];
    let rest = mm[2].trim();
    // Stop at prose: an invocation's tokens are flags, <placeholders>, [optional] groups and paths.
    const toks = [];
    for (const t of rest.split(/\s+/).filter(Boolean)) {
      if (/^[A-Za-z][a-z]+[,.:]?$/.test(t) && !/^(show|migrate|import)$/.test(t) && toks.length > 0 && !toks[toks.length - 1].startsWith("--")) break;
      if (/^(and|or|to|is|the|from|with|in|on|which|that|was|—|-|→|=>|then|as|a|an|runs?|it|at|for)$/.test(t)) break;
      toks.push(t.replace(/[.,:]$/, ""));
    }
    let key = sub;
    if (sub === "state") {
      const s2 = toks.shift();
      if (s2 === "show") key = "stateShow";
      else if (s2 === "migrate") key = "stateMigrate";
      else { key = `state ${s2 ?? ""}`.trim(); }
    }
    const inv = `${sub}${key.startsWith("state") && key !== "state" ? " " + (key === "stateShow" ? "show" : key === "stateMigrate" ? "migrate" : key.slice(6)) : ""} ${toks.join(" ")}`.trim();
    if (!seen.has(inv)) seen.set(inv, { key, toks, where: [] });
    seen.get(inv).where.push(`${file}:${ln}`);
  }
}

const rows = [];
for (const [inv, { key, toks, where }] of seen) {
  const spec = COMMAND_SPECS[key];
  if (!spec) { rows.push({ inv, verdict: key.startsWith("state import") ? "out of scope (state import)" : `no spec (${key})`, where }); continue; }
  // Expand documentation notation: [--a] [--b] -> the flags; <placeholder> -> a value/positional stand-in.
  const expanded = [];
  for (let t of toks) {
    t = t.replace(/^\[|\]$/g, "").replace(/^\(|\)$/g, "");
    for (const alt of t.split("|")) {
      if (/^<.*>$|^".*"$/.test(alt)) expanded.push(alt.startsWith("<") && /dir|path|root|project/i.test(alt) ? "." : "PLACEHOLDER");
      else if (alt) expanded.push(alt);
    }
  }
  const r = parseArgs(spec, expanded, tree);
  let verdict = r.ok ? "parses" : `REFUSED: ${r.error.replace(/\n/g, " ")}`;
  if (!r.ok && /is not an existing directory/.test(r.error)) verdict = `positional is not a directory here (${r.error.split(" is not")[0]}) - flags OK`;
  rows.push({ inv, verdict, expanded: expanded.join(" "), where });
}
rows.sort((a, b) => a.inv.localeCompare(b.inv));
console.log(`| invocation (as documented) | parsed as | result | first seen (of N) |\n|---|---|---|---|`);
for (const x of rows) console.log(`| \`${x.inv}\` | \`${x.expanded ?? ""}\` | ${x.verdict} | ${x.where[0]} (${x.where.length}) |`);
const bad = rows.filter((x) => x.verdict.startsWith("REFUSED") || x.verdict.startsWith("no spec"));
console.error(`${rows.length} distinct invocations; ${bad.length} refused or unmatched`);
