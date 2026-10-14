#!/usr/bin/env node
// T-274: re-measure the recall trigger's relevance floor (read-only replay, aggregates only).
//
// Brief: docs/loops/t274-relevance-floor-remeasure-brief.md. Method: docs/loops/t264/measure.mjs,
// whose classifier, statistics and transcript reader are ported below verbatim (lines 28-200 and
// 241-299 at the base). Read-only on the knowledge DB (one read-only open, snapshot first) and on
// the transcripts. Writes only under --out, which must lie outside this repository. No network.
//
// Usage: node docs/loops/t274/floor.mjs --check-only
//        node docs/loops/t274/floor.mjs --out <OUT> --live-db <file> --projects <dir> --until <ISO-8601 UTC>
//
// OUT/fires.csv holds per-fire rows (no command text; local only). OUT/summary.md holds aggregates
// only: counts, rates, Wilson intervals, entry ids, relevance values.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(SCRIPT), "..", "..", "..");
const BUILD = path.join(REPO, "open-brain", "build", "trigger");
const USAGE = "usage: node docs/loops/t274/floor.mjs --check-only | --out <OUT> --live-db <file> --projects <dir> --until <ISO-8601 UTC>";

// ---------------------------------------------------------------------------
// Ported verbatim from docs/loops/t264/measure.mjs lines 28-200.

const TRIMMERS = new Set([
  "tail", "head", "grep", "egrep", "fgrep", "rg", "sed", "awk", "cut", "sort", "uniq",
  "wc", "tr", "tee", "cat", "less", "more", "column", "jq", "findstr",
]);

/** Drop heredoc bodies: their text is data for the receiving program, not shell. */
function stripHeredocs(cmd) {
  const lines = cmd.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const tags = [...lines[i].matchAll(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)].map((m) => m[2]);
    for (const tag of tags) {
      while (i + 1 < lines.length && lines[i + 1].trim() !== tag) i++;
      if (i + 1 < lines.length) i++;
    }
  }
  return out.join("\n");
}

/**
 * Split a shell command into top-level statements (on unquoted ; newline && || &) and each
 * statement into pipeline stages (on unquoted single |). Single-quoted text is blanked in
 * `masked`, because `$?` inside single quotes is literal to THIS shell; the contents are returned
 * separately in `quoted`, because a single-quoted string is often a script for another shell
 * (ssh host '...', bash -c '...') and is classified on its own. A bare `( ... )` subshell is
 * transparent; a `$( ... )` substitution is kept whole.
 */
function splitStatements(cmd) {
  const stmts = [];
  const quoted = [];
  let stages = [""];
  let masked = "";
  let sq = false, dq = false, esc = false, sqBuf = "";
  const parens = []; // "sub" for $( , "grp" for a bare (
  const flush = () => {
    if (stages.some((s) => s.trim()) || masked.trim()) stmts.push({ stages: stages.map((s) => s.trim()), masked });
    stages = [""];
    masked = "";
  };
  const add = (raw, m = raw) => {
    stages[stages.length - 1] += raw;
    masked += m;
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    const n = cmd[i + 1];
    if (esc) { add(c); esc = false; continue; }
    if (sq) { if (c === "'") { sq = false; quoted.push(sqBuf); add(c); } else { sqBuf += c; add(c, " "); } continue; }
    if (c === "\\") { add(c); esc = true; continue; }
    if (dq) { if (c === '"') dq = false; add(c); continue; }
    if (c === "'") { sq = true; sqBuf = ""; add(c); continue; }
    if (c === '"') { dq = true; add(c); continue; }
    const inSub = parens.includes("sub");
    if (c === "(") {
      parens.push(cmd[i - 1] === "$" || inSub ? "sub" : "grp");
      if (parens[parens.length - 1] === "sub") add(c);
      continue;
    }
    if (c === ")" && parens.length) {
      const k = parens.pop();
      if (k === "sub") add(c);
      continue;
    }
    if (inSub) { add(c); continue; }
    if (c === ";" || c === "\n") { flush(); continue; }
    if ((c === "&" && n === "&") || (c === "|" && n === "|")) { flush(); i++; continue; }
    if (c === "&" && n !== ">" && cmd[i - 1] !== ">" && cmd[i - 1] !== "<") { flush(); continue; }
    if (c === "|") { if (n === "&") i++; stages.push(""); masked += " "; continue; }
    add(c);
  }
  flush();
  return { stmts, quoted };
}

function stageProgram(stage) {
  const toks = stage.trim().split(/\s+/).filter(Boolean);
  while (toks.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[0])) toks.shift();
  if (toks.length && (toks[0] === "command" || toks[0] === "env" || toks[0] === "xargs")) toks.shift();
  const t = toks[0] ?? "";
  return path.basename(t.replace(/\\/g, "/")).toLowerCase().replace(/\.exe$/, "");
}

const isTrimmerPipeline = (s) => s.stages.length > 1 && TRIMMERS.has(stageProgram(s.stages[s.stages.length - 1]));

/** The base rules, for one script (the outer command, or one single-quoted inner script). */
function classifyScript(stmts) {
  const maskedAll = stmts.map((s) => s.masked).join(" ; ");
  const pipestatus = /PIPESTATUS/.test(maskedAll);
  const pipefail = /\bpipefail\b/.test(maskedAll);
  const statusIdx = stmts.map((s, i) => (/\$\?/.test(s.masked) ? i : -1)).filter((i) => i >= 0);
  const trimmerPipe = stmts.some(isTrimmerPipeline);
  // Capture-then-trim: a status read alongside a trimmer pipeline, or alongside a standalone
  // tail/head that trims a file the status was captured from.
  const trimmerAny = trimmerPipe || stmts.some((s) => s.stages.length === 1 && ["tail", "head"].includes(stageProgram(s.stages[0])));
  const readsStatus = pipestatus || statusIdx.length > 0;
  let cls, reason;
  if (!readsStatus) [cls, reason] = ["NOT_APPLICABLE", "no-status-read"];
  else if (pipestatus) [cls, reason] = ["COMPLIANT", "pipestatus"];
  else if (pipefail) [cls, reason] = ["COMPLIANT", "pipefail"];
  else if (statusIdx.some((i) => i > 0 && isTrimmerPipeline(stmts[i - 1]))) [cls, reason] = ["VIOLATING", "status-after-trimmer-pipe"];
  else if (trimmerAny) [cls, reason] = ["COMPLIANT", "status-captured-elsewhere"];
  else [cls, reason] = ["NOT_APPLICABLE", "status-read-no-trimmer"];
  return { cls, reason, trimmerPipe, readsStatus };
}

/**
 * Classify a command for entry 299 (brief 3f):
 * COMPLIANT: reads PIPESTATUS (or sets pipefail), or captures the status where no trimmer masks it.
 * VIOLATING: a `$?` whose referent (the statement just before it) is a pipeline into a trimmer.
 * NOT_APPLICABLE: no exit-status read, or a status read with no trimmer anywhere in the script.
 * The outer command and each single-quoted inner script are classified separately and combined:
 * a PIPESTATUS/pipefail read anywhere wins, then any VIOLATING, then any COMPLIANT.
 * Also returns the two flags the follow-up search needs.
 */
export function classify299(command) {
  const { stmts, quoted } = splitStatements(stripHeredocs(command));
  const parts = [classifyScript(stmts), ...quoted.filter((q) => /[;|\n]/.test(q)).map((q) => classifyScript(splitStatements(q).stmts))];
  const pick =
    parts.find((p) => p.reason === "pipestatus" || p.reason === "pipefail") ??
    parts.find((p) => p.cls === "VIOLATING") ??
    parts.find((p) => p.cls === "COMPLIANT") ??
    parts.find((p) => p.reason === "status-read-no-trimmer") ??
    parts[0];
  return {
    cls: pick.cls,
    reason: pick.reason,
    trimmerPipe: parts.some((p) => p.trimmerPipe),
    readsStatus: parts.some((p) => p.readsStatus),
  };
}

const SELF_CHECK = [
  ["npm test 2>&1 | tail -20; echo \"exit: $?\"", "VIOLATING"],
  ["npx vitest run | tail -8 && echo $?", "VIOLATING"],
  ["npm test 2>&1 | tail -20; echo \"exit: ${PIPESTATUS[0]}\"", "COMPLIANT"],
  ["npm test > out.log 2>&1; rc=$?; tail -20 out.log; echo $rc", "COMPLIANT"],
  ["set -o pipefail; make 2>&1 | tail -3; echo $?", "COMPLIANT"],
  ["git status | head -5", "NOT_APPLICABLE"],
  ["grep -E 'a|b' file.txt; echo $?", "NOT_APPLICABLE"],
  ["echo '$?' | tail -1", "NOT_APPLICABLE"],
  ["node build.js 2>&1 | grep -v warn\necho $?", "VIOLATING"],
  ["ssh host 'cd /opt/app && make 2>&1 | tail -8; echo \"rc=${PIPESTATUS[0]}\"'", "COMPLIANT"],
  ["ssh host 'make 2>&1 | tail -8; echo rc=$?'", "VIOLATING"],
  ["(npx tsc --noEmit 2>&1 | tail -3; echo tsc=$?)", "VIOLATING"],
  ["cat > f.txt <<'EOF'\nx | tail -1; echo $?\nEOF\nwc -l f.txt", "NOT_APPLICABLE"],
];

function selfCheck() {
  const lines = [];
  let fail = 0;
  for (const [cmd, want] of SELF_CHECK) {
    const got = classify299(cmd).cls;
    const ok = got === want;
    if (!ok) fail++;
    lines.push(`${ok ? "PASS" : "FAIL"} case ${lines.length + 1}: expected ${want}, got ${got}`);
  }
  lines.push(`self-check: ${SELF_CHECK.length - fail}/${SELF_CHECK.length} pass`);
  return { ok: fail === 0, lines };
}

// ---------------------------------------------------------------------------
// Statistics

export function wilson(k, n, z = 1.959964) {
  if (n === 0) return [NaN, NaN];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const pct = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + "%" : "n/a");

// ---------------------------------------------------------------------------
// Ported verbatim from docs/loops/t264/measure.mjs lines 241-299.

function indexTranscripts(projectsRoot) {
  const bySession = new Map();
  let sessionsWithSubagentDirs = new Set();
  for (const d of fs.readdirSync(projectsRoot)) {
    const dir = path.join(projectsRoot, d);
    let st;
    try { st = fs.statSync(dir); } catch { continue; }
    if (!st.isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (f.endsWith(".jsonl")) {
        const id = f.slice(0, -6);
        const size = fs.statSync(p).size;
        if (!bySession.has(id)) bySession.set(id, []);
        bySession.get(id).push({ p, size });
      } else if (fs.existsSync(path.join(p, "subagents"))) {
        sessionsWithSubagentDirs.add(f);
      }
    }
  }
  return { bySession, sessionsWithSubagentDirs };
}

const SHELL_TOOLS = new Set(["Bash", "Shell"]);

async function readTranscript(p, counters) {
  const toolUses = []; // {i, ts, id, name, input, requestId}
  const resultIdx = new Map(); // tool_use_id -> {i, ts}
  const attachments = []; // {i, ts, toolUseID, text}
  const textIdx = []; // file positions of assistant text blocks
  let i = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(p), crlfDelay: Infinity });
  for await (const line of rl) {
    i++;
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { counters.unparsable++; continue; }
    counters.lines++;
    const ts = o.timestamp ? Date.parse(o.timestamp) : NaN;
    if (o.type === "attachment" && o.attachment?.type === "hook_success" &&
        String(o.attachment.command ?? "").includes("cli-recall-trigger.js")) {
      let text = "";
      try { text = JSON.parse(o.attachment.stdout || "{}")?.hookSpecificOutput?.additionalContext ?? ""; } catch { /* empty */ }
      if (text) attachments.push({ i, ts, toolUseID: o.attachment.toolUseID, text });
      continue;
    }
    const content = o.message?.content;
    if (!Array.isArray(content)) continue;
    if (o.type === "assistant") {
      for (const c of content) {
        if (c?.type === "tool_use") toolUses.push({ i, ts, id: c.id, name: c.name, input: c.input ?? {}, requestId: o.requestId });
        else if (c?.type === "text" && c.text?.trim()) textIdx.push({ i, text: c.text });
      }
    } else if (o.type === "user") {
      for (const c of content) if (c?.type === "tool_result" && c.tool_use_id) resultIdx.set(c.tool_use_id, { i, ts });
    }
  }
  return { toolUses, resultIdx, attachments, textIdx };
}

// ---------------------------------------------------------------------------
// Labels: the only FTS expressions deriveQuery can produce at the base.

const LABELS = { "": "NONE", '"tail"': "TRIM", '"exit" "code"': "STATUS", '"tail" "exit" "code"': "TRIM+STATUS" };
const labelOf = (deriveQuery, cmd) => LABELS[deriveQuery(cmd)] ?? "OTHER";

const LABEL_CHECK = [
  ["npm test 2>&1 | tail -20; echo \"exit: $?\"", "TRIM+STATUS"],
  ["git log --oneline | tail -5", "TRIM"],
  ["git status", "NONE"],
  ["make 2>&1 | tail -3; echo $?; ls | wc -l", "STATUS"],
  ["npm test 2>&1 | tail -20; echo \"exit: ${PIPESTATUS[0]}\"", "TRIM"],
  ["set -o pipefail; make 2>&1 | tail -3; echo $?", "TRIM"],
  ["npm test 2>&1 | sed -n 1,5p; echo $?", "NONE"],
];

function labelCheck(deriveQuery) {
  const lines = [];
  let fail = 0;
  for (const [cmd, want] of LABEL_CHECK) {
    const got = labelOf(deriveQuery, cmd);
    const ok = got === want;
    if (!ok) fail++;
    lines.push(`${ok ? "PASS" : "FAIL"} label case ${lines.length + 1}: expected ${want}, got ${got}`);
  }
  lines.push(`label self-check: ${LABEL_CHECK.length - fail}/${LABEL_CHECK.length}`);
  return { ok: fail === 0, lines, total: `${LABEL_CHECK.length - fail}/${LABEL_CHECK.length}` };
}

// ---------------------------------------------------------------------------
// Aggregation at one floor. With max_injected = 1, a fire injects exactly when its label derives
// a query and the label's top-1 hit clears the floor.

export function atFloor(rows, floor) {
  const inj = rows.filter((r) => r.label !== "NONE" && r.top1Rel !== null && r.top1Rel >= floor);
  const by = new Map();
  for (const r of inj) by.set(r.top1Id, (by.get(r.top1Id) ?? 0) + 1);
  return {
    injected: inj.length,
    sessions: new Set(inj.map((r) => r.session)).size,
    V: inj.filter((r) => r.cls === "VIOLATING").length,
    C: inj.filter((r) => r.cls === "COMPLIANT").length,
    N: inj.filter((r) => r.cls === "NOT_APPLICABLE").length,
    byEntry: [...by.entries()].sort((a, b) => a[0] - b[0]).map(([id, n]) => `${id}:${n}`).join(" "),
  };
}

const AGG_ROWS = [
  { session: "s1", label: "TRIM+STATUS", cls: "VIOLATING", top1Id: 299, top1Rel: 10 },
  { session: "s1", label: "STATUS", cls: "VIOLATING", top1Id: 299, top1Rel: 7 },
  { session: "s2", label: "TRIM", cls: "NOT_APPLICABLE", top1Id: 642, top1Rel: 5 },
  { session: "s2", label: "NONE", cls: "VIOLATING", top1Id: null, top1Rel: null },
  { session: "s3", label: "TRIM", cls: "COMPLIANT", top1Id: 642, top1Rel: 5 },
];
const AGG_CHECK = [
  [4.5, { injected: 4, sessions: 3, V: 2, C: 1, N: 1, byEntry: "299:2 642:2" }],
  [7.0, { injected: 2, sessions: 1, V: 2, C: 0, N: 0, byEntry: "299:2" }],
  [10.0, { injected: 1, V: 1 }],
  [10.5, { injected: 0 }],
];

function aggCheck() {
  const lines = [];
  let fail = 0;
  for (const [floor, want] of AGG_CHECK) {
    const got = atFloor(AGG_ROWS, floor);
    const bad = Object.keys(want).filter((k) => got[k] !== want[k]);
    if (bad.length) fail++;
    lines.push(`${bad.length ? "FAIL" : "PASS"} aggregation at ${floor.toFixed(1)}: ` +
      Object.keys(want).map((k) => `${k} ${JSON.stringify(got[k])}${bad.includes(k) ? ` (expected ${JSON.stringify(want[k])})` : ""}`).join(", "));
  }
  lines.push(`aggregation self-check: ${AGG_CHECK.length - fail}/${AGG_CHECK.length}`);
  return { ok: fail === 0, lines, total: `${AGG_CHECK.length - fail}/${AGG_CHECK.length}` };
}

function runSelfChecks(deriveQuery) {
  const c = selfCheck();
  console.log("classifier self-check:");
  for (const l of c.lines) console.log(l);
  const l = labelCheck(deriveQuery);
  for (const x of l.lines) console.log(x);
  const a = aggCheck();
  for (const x of a.lines) console.log(x);
  const cTotal = `${SELF_CHECK.length - c.lines.filter((x) => x.startsWith("FAIL")).length}/${SELF_CHECK.length}`;
  return { ok: c.ok && l.ok && a.ok, totals: { classifier: cTotal, label: l.total, aggregation: a.total } };
}

// ---------------------------------------------------------------------------
// Arguments

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--check-only") a.checkOnly = true;
    else if (["--out", "--live-db", "--projects", "--until"].includes(k)) a[k.slice(2)] = argv[++i];
    else a.unknown = k;
  }
  return a;
}

function refuse(msg) {
  console.error(msg);
  process.exit(2);
}

const importBuild = async (file) => import(pathToFileURL(path.join(BUILD, file)).href);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.unknown !== undefined) refuse(USAGE);

  if (args.checkOnly) {
    const { deriveQuery } = await importBuild("query.js");
    const r = runSelfChecks(deriveQuery);
    process.exit(r.ok ? 0 : 2);
  }

  if (!args.out || !args["live-db"] || !args.projects || !args.until) refuse(USAGE);
  const OUT = path.resolve(args.out);
  const rel = path.relative(REPO, OUT);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) refuse(`refusing --out inside the repository; pick a directory outside it`);
  const liveDb = path.resolve(args["live-db"]);
  if (!fs.existsSync(liveDb)) refuse("refusing: --live-db does not exist");
  const projectsRoot = path.resolve(args.projects);
  if (!fs.existsSync(projectsRoot) || !fs.statSync(projectsRoot).isDirectory()) refuse("refusing: --projects is not a directory");
  const untilMs = Date.parse(args.until);
  if (!Number.isFinite(untilMs)) refuse("refusing: --until is not a date Date.parse can read");

  // The snapshot path is fixed by OUT, so the build is imported with KNOWLEDGE_V2_DB already
  // pointing at it (query.js and command-log.js import no DB module; this is belt and braces).
  const snap = path.join(OUT, "kv2-snapshot.db");
  process.env.KNOWLEDGE_V2_DB = snap;
  const { deriveQuery, queryStore } = await importBuild("query.js");
  const { formatCommandFireLog } = await importBuild("command-log.js");

  const checks = runSelfChecks(deriveQuery);
  if (!checks.ok) {
    console.error("self-check FAILED; stopping before the live DB is opened");
    process.exit(2);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const require_ = createRequire(path.join(REPO, "open-brain", "package.json"));
  const Database = require_("better-sqlite3");

  // --- snapshot (brief part 3)
  const stat = (p) => { const s = fs.statSync(p); return { size: s.size, mtime: s.mtime.toISOString() }; };
  const before = stat(liveDb);
  const src = new Database(liveDb, { readonly: true, fileMustExist: true });
  console.log(`live handle readonly: ${src.readonly}`);
  if (src.readonly !== true) { console.error("live handle is not read-only"); process.exit(3); }
  await src.backup(snap);
  const totalChanges = src.prepare("SELECT total_changes() AS n").get().n;
  console.log(`live handle total_changes: ${totalChanges}`);
  if (totalChanges !== 0) { console.error("live handle total_changes is not 0"); process.exit(3); }
  src.close();
  const after = stat(liveDb);
  const snapshotAt = new Date().toISOString();
  process.env.KNOWLEDGE_V2_DB = snap;
  console.log(`KNOWLEDGE_V2_DB=${process.env.KNOWLEDGE_V2_DB}`);

  const snapDb = new Database(snap, { readonly: true, fileMustExist: true });
  const store = snapDb.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN archived_into IS NULL THEN 1 ELSE 0 END) AS live FROM knowledge_index").get();
  const policy = JSON.parse(fs.readFileSync(path.join(REPO, "open-brain", "src", "trigger", "policies", "recall-trigger.json"), "utf8"));
  const scriptSha = crypto.createHash("sha256").update(fs.readFileSync(SCRIPT)).digest("hex").slice(0, 16);

  // --- fires (brief part 5)
  const fires = snapDb
    .prepare("SELECT id, session_uuid, created_at, state, command, injected_ids FROM trigger_fires ORDER BY id")
    .all()
    .filter((f) => Date.parse(f.created_at) < untilMs);
  const sessions = new Map();
  for (const f of fires) {
    if (!sessions.has(f.session_uuid)) sessions.set(f.session_uuid, []);
    sessions.get(f.session_uuid).push(f);
  }
  const { bySession } = indexTranscripts(projectsRoot);
  const counters = { lines: 0, unparsable: 0, filesRead: 0 };

  // --- anchors (brief part 6) and per-fire replay (brief part 7)
  const rows = [];
  const hitCache = new Map(); // q -> [{id, relevance}]
  const anchorUse = new Map(); // tool_use id -> fires anchored to it
  for (const [sid, sfires] of sessions) {
    const files = bySession.get(sid) ?? [];
    const file = files.sort((a, b) => b.size - a.size)[0];
    let T = null;
    if (file) { T = await readTranscript(file.p, counters); counters.filesRead++; }
    const shellUses = T ? T.toolUses.filter((u) => SHELL_TOOLS.has(u.name)) : [];
    const usedAttachments = new Set();
    for (const f of sfires) {
      const row = {
        fire_id: f.id, session_uuid: sid, created_at: f.created_at, state: f.state, anchor_status: "",
        anchor_reused: "", label: "", class_299: "", top1_id: "", top1_relevance: "", anchorId: null,
      };
      rows.push(row);
      if (!T) { row.anchor_status = "NO_TRANSCRIPT"; continue; }
      const created = Date.parse(f.created_at);
      let anchor = null;
      if (f.state === "injected") {
        const want = JSON.parse(f.injected_ids || "[]").map((id) => `[stored knowledge ${id}`);
        let best = null;
        for (const a of T.attachments) {
          if (usedAttachments.has(a)) continue;
          if (!want.every((w) => a.text.includes(w))) continue;
          const dt = Math.abs(a.ts - created);
          if (dt <= 5000 && (!best || dt < Math.abs(best.ts - created))) best = a;
        }
        if (best) {
          usedAttachments.add(best);
          anchor = T.toolUses.find((u) => u.id === best.toolUseID) ?? null;
          if (anchor) row.anchor_status = "ATTACHMENT";
        }
      }
      if (!anchor) {
        let cand = null;
        for (const u of shellUses) {
          if (!(u.ts <= created + 2000 && u.ts >= created - 120000)) continue;
          if (formatCommandFireLog(String(u.input.command ?? "")) !== f.command) continue;
          cand = u; // file order; ties -> latest
        }
        anchor = cand;
        if (anchor) row.anchor_status = "TIME_BASENAME";
      }
      if (!anchor) { row.anchor_status = "NO_ANCHOR"; continue; }
      row.anchorId = anchor.id;
      anchorUse.set(anchor.id, (anchorUse.get(anchor.id) ?? 0) + 1);

      const cmd = String(anchor.input.command ?? "");
      const q = deriveQuery(cmd);
      row.label = LABELS[q] ?? "OTHER";
      row.class_299 = classify299(cmd).cls;
      if (q) {
        if (!hitCache.has(q)) {
          const hits = queryStore({ db: snapDb, command: cmd, floor: -Infinity, limit: 5 });
          hitCache.set(q, { label: row.label, hits: hits.map((h) => ({ id: h.id, relevance: h.relevance })) });
        }
        const top1 = hitCache.get(q).hits[0] ?? null;
        if (top1) { row.top1_id = top1.id; row.top1_relevance = top1.relevance; }
      }
    }
  }
  for (const r of rows) if (r.anchorId) r.anchor_reused = anchorUse.get(r.anchorId) > 1;
  const anchorsReused = [...anchorUse.values()].filter((n) => n > 1).length;

  writeCsv(path.join(OUT, "fires.csv"), rows);
  const summary = summarise({
    rows, fires, args, before, after, snapshotAt, store, policy, scriptSha, checks, hitCache, anchorsReused,
  });
  fs.writeFileSync(path.join(OUT, "summary.md"), summary, "utf8");
  snapDb.close();
  console.log(`fires in window: ${fires.length}; sessions: ${sessions.size}; transcript files read: ${counters.filesRead}; lines: ${counters.lines}; unparsable: ${counters.unparsable}`);
  console.log(`wrote fires.csv (${rows.length} rows) and summary.md under OUT`);
}

const CSV_COLS = ["fire_id", "session_uuid", "created_at", "state", "anchor_status", "anchor_reused", "label", "class_299", "top1_id", "top1_relevance"];
function writeCsv(p, rows) {
  const q = (v) => {
    const s = String(v ?? "").replace(/[\t\r\n]+/g, " ");
    return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  fs.writeFileSync(p, [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => q(r[c])).join(","))].join("\n") + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Summary (aggregates only)

const rateCell = (k, n) => {
  const [lo, hi] = wilson(k, n);
  return n ? `${pct(k / n)} [${pct(lo)}, ${pct(hi)}]` : "n/a";
};
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : String(x));

/** The recommendation rule (brief part 9). Returns the printable lines. */
function recommend(labelTop1, labelHasV, gridResults, shipped) {
  const L = [];
  const silentMax = labelTop1.get("TRIM") ?? -Infinity;
  const injectLabels = ["STATUS", "TRIM+STATUS"].filter((l) => labelHasV.get(l) && labelTop1.has(l));
  L.push(`- silentMax (TRIM's top-1 relevance; -Infinity when TRIM has no anchored fire or no hit): ${f2(silentMax)}`);
  L.push(`- labels counted for injectMin (STATUS, TRIM+STATUS with an anchored VIOLATING fire and a hit): ${injectLabels.length ? injectLabels.join(", ") : "none"}`);
  if (!injectLabels.length) {
    L.push("", "**NO DATA**");
    return L;
  }
  const injectMin = Math.min(...injectLabels.map((l) => labelTop1.get(l)));
  L.push(`- injectMin (lowest top-1 relevance among those labels): ${f2(injectMin)}`, "");
  let out;
  if (silentMax < injectMin) {
    L.push(`Separating interval: (${f2(silentMax)}, ${f2(injectMin)}].`);
    if (shipped > silentMax && shipped <= injectMin) out = `RECOMMENDATION: KEEP ${shipped.toFixed(1)}`;
    else {
      // With no lower bound the midpoint is undefined; take the highest multiple inside instead.
      const mid = Number.isFinite(silentMax) ? (silentMax + injectMin) / 2 : injectMin;
      const cands = [];
      for (let c = Math.floor(injectMin * 2) / 2; c > silentMax && c >= injectMin - 1000; c -= 0.5) cands.push(c);
      let x;
      if (cands.length) {
        x = cands.reduce((b, c) => (Math.abs(c - mid) < Math.abs(b - mid) - 1e-12 || (Math.abs(Math.abs(c - mid) - Math.abs(b - mid)) <= 1e-12 && c > b) ? c : b));
        x = x.toFixed(1);
      } else x = mid.toFixed(2);
      out = `RECOMMENDATION: MOVE to ${x}`;
    }
  } else {
    let best = null;
    for (const g of gridResults) {
      const P = g.injected ? g.V / g.injected : 0;
      const R = g.recallAllN ? g.V / g.recallAllN : 0;
      const F1 = P + R === 0 ? 0 : (2 * P * R) / (P + R);
      if (!best || F1 > best.F1 + 1e-12 || (Math.abs(F1 - best.F1) <= 1e-12 && g.floor > best.floor)) best = { F1, floor: g.floor };
    }
    out = `RECOMMENDATION: NO SEPARATING FLOOR (best F1 at ${best.floor.toFixed(1)})`;
  }
  L.push("", `**${out}**`, "");
  L.push(`margins of ${shipped.toFixed(1)}: injectMin − ${shipped.toFixed(1)} = ${f2(injectMin - shipped)}; ${shipped.toFixed(1)} − silentMax = ${f2(shipped - silentMax)}`);
  return L;
}

function summarise({ rows, fires, args, before, after, snapshotAt, store, policy, scriptSha, checks, hitCache, anchorsReused }) {
  const L = [];
  const anchored = rows.filter((r) => r.anchorId);
  const CLS = ["VIOLATING", "COMPLIANT", "NOT_APPLICABLE"];
  const shipped = Number(policy.relevance_floor);

  L.push("# T-274 result: the recall trigger's relevance floor, re-measured", "");
  L.push("Generated by docs/loops/t274/floor.mjs. Aggregates only: counts, rates, Wilson 95% intervals, entry ids, relevance values. No command, query or entry text, keys, paths or session ids.", "");
  L.push(`- Snapshot taken: ${snapshotAt}`);
  L.push(`- Live file before backup: ${before.size} bytes, mtime ${before.mtime}; after: ${after.size} bytes, mtime ${after.mtime} (other sessions' hooks write to it: not the read-only proof)`);
  L.push("- live handle readonly: true; total_changes after backup: 0");
  L.push(`- Store size: knowledge_index rows: ${store.total}, live (archived_into IS NULL): ${store.live}`);
  L.push(`- Shipped policy: relevance_floor ${policy.relevance_floor}, max_injected ${policy.max_injected}`);
  L.push(`- Script sha256 (first 16): ${scriptSha}`);
  L.push(`- Fire window: ${fires[0]?.created_at ?? "n/a"} to ${new Date(Date.parse(args.until)).toISOString()} (exclusive)`);
  L.push(`- Self-checks: classifier ${checks.totals.classifier}, label ${checks.totals.label}, aggregation ${checks.totals.aggregation}`, "");

  // 1. census
  L.push("## 1. Census", "");
  L.push("| state | fires | anchored | NO_ANCHOR | NO_TRANSCRIPT | VIOLATING | COMPLIANT | NOT_APPLICABLE |", "|---|---:|---:|---:|---:|---:|---:|---:|");
  const censusRow = (name, rs) => {
    const a = rs.filter((r) => r.anchorId);
    L.push(`| ${name} | ${rs.length} | ${a.length} | ${rs.filter((r) => r.anchor_status === "NO_ANCHOR").length} | ${rs.filter((r) => r.anchor_status === "NO_TRANSCRIPT").length} | ` +
      CLS.map((c) => a.filter((r) => r.class_299 === c).length).join(" | ") + " |");
  };
  for (const s of ["injected", "silent", "not-asked"]) censusRow(s, rows.filter((r) => r.state === s));
  const otherStates = rows.filter((r) => !["injected", "silent", "not-asked"].includes(r.state));
  if (otherStates.length) censusRow("(other state)", otherStates);
  censusRow("total", rows);
  L.push("", `Anchors reused by more than one fire: ${anchorsReused}`, "");

  // 2. labels
  L.push("## 2. Labels at the snapshot", "");
  L.push("| label | anchored fires | VIOLATING | COMPLIANT | NOT_APPLICABLE | top-5 hits (id:relevance) |", "|---|---:|---:|---:|---:|---|");
  const byLabelHits = new Map();
  for (const { label, hits } of hitCache.values()) if (!byLabelHits.has(label)) byLabelHits.set(label, hits);
  const labels = ["TRIM+STATUS", "STATUS", "TRIM", "NONE"];
  if (anchored.some((r) => r.label === "OTHER")) labels.push("OTHER");
  for (const lab of labels) {
    const rs = anchored.filter((r) => r.label === lab);
    const hits = lab === "NONE" ? "n/a" : (byLabelHits.get(lab) ?? []).map((h) => `${h.id}:${h.relevance.toFixed(2)}`).join(", ") || "none";
    L.push(`| ${lab} | ${rs.length} | ` + CLS.map((c) => rs.filter((r) => r.class_299 === c).length).join(" | ") + ` | ${hits} |`);
  }
  const vNone = anchored.filter((r) => r.label === "NONE" && r.class_299 === "VIOLATING").length;
  L.push("", `VIOLATING fires with label NONE (a floor cannot reach them): ${vNone}`, "");

  // 3. per-floor table
  const aggRows = anchored.map((r) => ({
    session: r.session_uuid, label: r.label, cls: r.class_299,
    top1Id: r.top1_id === "" ? null : r.top1_id, top1Rel: r.top1_relevance === "" ? null : r.top1_relevance,
  }));
  const labelTop1 = new Map();
  for (const r of aggRows) if (r.top1Rel !== null && r.label !== "NONE" && !labelTop1.has(r.label)) labelTop1.set(r.label, r.top1Rel);
  const labelHasV = new Map();
  for (const r of aggRows) if (r.cls === "VIOLATING") labelHasV.set(r.label, true);
  const allV = aggRows.filter((r) => r.cls === "VIOLATING").length;
  const derivV = aggRows.filter((r) => r.cls === "VIOLATING" && r.label !== "NONE").length;

  const floors = []; // {floor, marks, grid}
  for (let k = 4; k <= 32; k++) floors.push({ floor: k / 2, marks: k / 2 === shipped ? ["(shipped)"] : [], grid: true });
  for (const rel of new Set(labelTop1.values())) {
    // A breakpoint row is computed at the exact top-1 value and displayed to 2 decimals.
    const same = floors.find((x) => x.floor === rel);
    if (same) same.marks.push("(breakpoint)");
    else floors.push({ floor: rel, marks: ["(breakpoint)"], grid: false });
  }
  const sorted = floors.sort((a, b) => a.floor - b.floor || (a.grid ? -1 : 1)).map((x) => [x.floor.toFixed(2), x]);

  L.push("## 3. Per-floor table", "");
  L.push(`Anchored fires only: ${anchored.length}. VIOLATING among them: ${allV} (any label), ${derivV} (label not NONE). A fire injects when its label derives a query and the label's top-1 hit is at or above the floor (max_injected ${policy.max_injected}).`, "");
  L.push("| floor | injected | sessions | VIOLATING | COMPLIANT | NOT_APPLICABLE | precision [Wilson 95%] | recall, all VIOLATING [Wilson 95%] | recall, derivable VIOLATING [Wilson 95%] | injected by entry |",
    "|---|---:|---:|---:|---:|---:|---|---|---|---|");
  const gridResults = [];
  for (const [key, { floor, marks, grid }] of sorted) {
    const g = atFloor(aggRows, floor);
    if (grid) gridResults.push({ floor,injected: g.injected, V: g.V, recallAllN: allV });
    L.push(`| ${key}${marks.length ? " " + marks.join(" ") : ""} | ${g.injected} | ${g.sessions} | ${g.V} | ${g.C} | ${g.N} | ${rateCell(g.V, g.injected)} | ${rateCell(g.V, allV)} | ${rateCell(g.V, derivV)} | ${g.byEntry || "none"} |`);
  }
  L.push("");

  // 4. recommendation
  L.push("## 4. The gap and the recommendation", "");
  L.push("Rule (brief part 9): silentMax is the TRIM label's top-1 relevance; injectMin is the lowest top-1 relevance among STATUS and TRIM+STATUS labels that have an anchored VIOLATING fire and a hit. When silentMax < injectMin the separating interval is (silentMax, injectMin]: KEEP the shipped floor if it lies inside, else MOVE to the multiple of 0.5 inside nearest the midpoint (ties up; the midpoint to 2 decimals if none). Otherwise NO SEPARATING FLOOR, with the grid floor of best F1 (precision x all-VIOLATING recall; ties up).", "");
  L.push(...recommend(labelTop1, labelHasV, gridResults, shipped));
  L.push("");

  // 5. limits
  L.push("## 5. Limits", "");
  L.push("- The replay scores every fire against the store as snapshotted, not as it stood at fire time.");
  L.push("- Cursor fires and sessions with no Claude Code transcript are NO_TRANSCRIPT. Subagent transcripts are not read.");
  L.push(`- Silent and not-asked fires are anchored by time and program basename. The reused-anchor count is above (${anchorsReused}).`);
  L.push("- VIOLATING is T-264's classifier, whose trimmer set is wider than deriveQuery's, so a VIOLATING fire with label NONE is a derivation miss.");
  L.push("- If T-159 (#678) is live in the main tree, not-asked fires still in its pending file are not in trigger_fires. They can only be NONE-label fires, so the injected counts cannot move. Only the \"all VIOLATING\" recall denominator can.");
  L.push("");
  return L.join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
