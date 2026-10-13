#!/usr/bin/env node
// T-264 (D-148): does an injected lesson change the next act?
//
// Design: docs/loops/recall-effect-design-2026-10-11.md; brief: docs/loops/t264-recall-effect-brief.md
// (the brief wins where they differ). Read-only on the knowledge DB (snapshot first) and on the
// transcripts. Writes only under --out, which must lie outside this repository. No network, no LLM:
// the design's judge step (2.3) is not run, so UNDETERMINED stays UNDETERMINED.
//
// Usage: node docs/loops/t264/measure.mjs --out <OUT>
//
// OUT/fires.csv holds per-fire rows (transcript excerpts; local only). OUT/summary.md holds
// aggregates only: counts, rates, intervals, entry ids and keys, program basenames.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(SCRIPT), "..", "..", "..");
const BUILD = path.join(REPO, "open-brain", "build", "trigger");

// ---------------------------------------------------------------------------
// Entry-299 classifier (brief 3f). Exported; self-checked before any analysis.

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
const rateCell = (k, n) => {
  const [lo, hi] = wilson(k, n);
  return n ? `${pct(k / n)} [${pct(lo)}, ${pct(hi)}]` : "n/a";
};

// ---------------------------------------------------------------------------
// Arguments and output directory

function parseArgs(argv) {
  // --exclude-session: the measuring session's own Bash calls fire the trigger too; keep them out.
  const out = { exclude: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i];
    else if (argv[i] === "--exclude-session") out.exclude.push(argv[++i]);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out) throw new Error("usage: measure.mjs --out <OUT>");
  const OUT = path.resolve(args.out);
  const rel = path.relative(REPO, OUT);
  if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
    throw new Error(`refusing OUT inside the repository (${REPO}); pick a directory outside it`);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const check = selfCheck();
  for (const l of check.lines) console.log(l);
  if (!check.ok) {
    console.error("classifier self-check FAILED; stopping before analysis");
    process.exit(2);
  }
  return run(OUT, check, args.exclude);
}

// ---------------------------------------------------------------------------
// Transcripts

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
// Outcome rules (design Part 2.2), shared by both arms

const NEG_RE = /\b(never|don't|do not|avoid|instead of)\b/i;

function actionTokens(action, programs) {
  const negAt = (() => { const m = NEG_RE.exec(action); return m ? m.index : Infinity; })();
  const toks = new Map(); // token -> {kind, pos}
  const put = (tok, kind, pos) => { if (tok && !toks.has(tok)) toks.set(tok, { kind, pos }); };
  for (const m of action.matchAll(/`([^`]+)`/g)) put(m[1], "span", m.index);
  for (const m of action.matchAll(/[a-z][a-z0-9._-]*/g)) {
    const w = m[0].replace(/[.]+$/, "");
    if (/^[a-z][a-z0-9._-]{1,24}$/.test(w) && programs.has(w)) {
      const before = action[m.index - 1];
      if (before && /[A-Za-z0-9]/.test(before)) continue;
      put(w, "prog", m.index);
    }
  }
  for (const m of action.matchAll(/(?:^|\s)(--?[a-z][a-z0-9-]*)/g)) put(m[1], "flag", m.index);
  const require = [], forbid = [];
  for (const [tok, { kind, pos }] of toks) (pos > negAt ? forbid : require).push({ tok, kind });
  return { require, forbid };
}

function hasToken(text, { tok, kind }) {
  if (kind === "span") return text.includes(tok);
  if (kind === "flag") return text.split(/\s+/).includes(tok);
  const esc = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9._-])${esc}([^a-z0-9._-]|$)`).test(text);
}

function scoreOutcome({ entryId, key, action, anchorCmd, next, textBefore, programs }) {
  if (!next) return { rule: "none", outcome: "NA", source: "none" };
  const nextText = next.isShell ? String(next.input.command ?? "") : JSON.stringify(next.input);
  const ref = `stored knowledge ${entryId}`;
  if (nextText.includes(ref) || textBefore.includes(ref) || (key && (nextText.includes(key) || textBefore.includes(key)))) {
    return { rule: "a", outcome: "FOLLOW", source: "det" };
  }
  const { require, forbid } = actionTokens(action, programs);
  if (next.isShell) {
    if (forbid.some((t) => hasToken(nextText, t))) return { rule: "c", outcome: "CONTRADICT", source: "det" };
    if (require.some((t) => hasToken(nextText, t))) return { rule: "c", outcome: "FOLLOW", source: "det" };
    if (anchorCmd != null && nextText === anchorCmd && require.length && !require.some((t) => hasToken(nextText, t))) {
      return { rule: "d", outcome: "IGNORE", source: "det" };
    }
  }
  return { rule: "none", outcome: "UNDETERMINED", source: "none" };
}

// ---------------------------------------------------------------------------

async function run(OUT, check, exclude) {
  const require_ = createRequire(path.join(REPO, "open-brain", "package.json"));
  const Database = require_("better-sqlite3");
  const live = path.join(process.env.USERPROFILE ?? process.env.HOME, ".claude", "open-brain", "knowledge-v2.db");
  const snap = path.join(OUT, "kv2-snapshot.db");
  {
    const src = new Database(live, { readonly: true, fileMustExist: true });
    await src.backup(snap);
    src.close();
  }
  process.env.KNOWLEDGE_V2_DB = snap;
  const { actionOf } = await import(pathToFileURL(path.join(BUILD, "run.js")).href);
  const { formatCommandFireLog } = await import(pathToFileURL(path.join(BUILD, "command-log.js")).href);
  const { queryStore } = await import(pathToFileURL(path.join(BUILD, "query.js")).href);

  const db = new Database(snap, { readonly: true, fileMustExist: true });
  const liveMtime = fs.statSync(live).mtime.toISOString();
  const scriptSha = crypto.createHash("sha256").update(fs.readFileSync(SCRIPT)).digest("hex").slice(0, 16);
  const allFires = db.prepare("SELECT * FROM trigger_fires ORDER BY id").all();
  const fires = allFires.filter((f) => !exclude.includes(f.session_uuid));
  const excluded = allFires.length - fires.length;
  const entryRow = db.prepare("SELECT id, key, content FROM knowledge_index WHERE id = ?");
  const programs = new Set(
    db.prepare("SELECT DISTINCT command FROM trigger_fires").all().map((r) => r.command).filter((c) => c !== "?"),
  );

  const projectsRoot = path.join(process.env.USERPROFILE ?? process.env.HOME, ".claude", "projects");
  const { bySession, sessionsWithSubagentDirs } = indexTranscripts(projectsRoot);
  const counters = { lines: 0, unparsable: 0, filesRead: 0 };

  const sessions = new Map();
  for (const f of fires) {
    if (!sessions.has(f.session_uuid)) sessions.set(f.session_uuid, []);
    sessions.get(f.session_uuid).push(f);
  }

  const rows = [];
  const queryCache = new Map();
  const wouldHaveBeen = (cmd) => {
    if (!queryCache.has(cmd)) {
      const hits = queryStore({ db, command: cmd, floor: -Infinity, limit: 1 });
      queryCache.set(cmd, hits[0] ?? null);
    }
    return queryCache.get(cmd);
  };

  for (const [sid, sfires] of sessions) {
    const files = bySession.get(sid) ?? [];
    const multi = files.length > 1;
    const file = files.sort((a, b) => b.size - a.size)[0];
    let T = null;
    if (file) { T = await readTranscript(file.p, counters); counters.filesRead++; }
    const shellUses = T ? T.toolUses.filter((u) => SHELL_TOOLS.has(u.name)) : [];
    const usedAttachments = new Set();
    let injOrdinal = 0;

    for (const f of sfires) {
      const created = Date.parse(f.created_at);
      const injectedIds = JSON.parse(f.injected_ids || "[]");
      const arm = f.state === "injected" ? "A" : f.state === "silent" ? "B" : "census";
      const row = {
        fire_id: f.id, session_uuid: sid, created_at: f.created_at, state: f.state, command: f.command,
        query: f.query, injected_ids: injectedIds.join(" "), entry_ids_scored: "", anchor_status: "",
        anchor_source: "", anchor_tool_use_id: "", next_act_tool: "", next_act_excerpt: "", gap_s: "",
        next_text_before: "", rule_hit: "", outcome: "NA", outcome_source: "none", arm,
        has_transcript: !!T, multi, class_299: "", followup_299: "", inj_ordinal: "",
      };
      rows.push(row);
      if (arm === "census") { row.anchor_status = T ? "NOT_SCORED" : "NO_TRANSCRIPT"; continue; }
      if (!T) { row.anchor_status = "NO_TRANSCRIPT"; continue; }

      // --- anchor
      let anchor = null, att = null;
      if (arm === "A") {
        const want = injectedIds.map((id) => `[stored knowledge ${id}`);
        let best = null;
        for (const a of T.attachments) {
          if (usedAttachments.has(a)) continue;
          if (!want.every((w) => a.text.includes(w))) continue;
          const dt = Math.abs(a.ts - created);
          if (dt <= 5000 && (!best || dt < Math.abs(best.ts - created))) best = a;
        }
        if (best) {
          usedAttachments.add(best);
          att = best;
          anchor = T.toolUses.find((u) => u.id === best.toolUseID) ?? null;
          row.anchor_source = anchor ? "ATTACHMENT" : "ATTACHMENT_NO_TOOL_USE";
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
        if (anchor && arm === "A") row.anchor_source = "ANCHOR_INFERRED";
        if (anchor && arm === "B") row.anchor_source = "TIME_BASENAME";
      }
      if (!anchor) { row.anchor_status = "NO_ANCHOR"; continue; }
      const res = T.resultIdx.get(anchor.id);
      row.anchor_status = res && Number.isFinite(res.ts) ? (res.ts <= created + 2000 ? (multi ? "MULTI" : "OK") : "ANCHOR_WEAK") : "ANCHOR_WEAK";
      row.anchor_tool_use_id = anchor.id;
      const anchorCmd = String(anchor.input.command ?? "");

      // --- next act: first tool_use after the point the hook output was visible
      // (after the anchor's tool_result and its attachment), so tool_uses issued in the same
      // model response as the anchor, which could not have seen the injection, are skipped.
      const after = Math.max(anchor.i, res?.i ?? 0, att?.i ?? 0);
      const nextIdx = T.toolUses.findIndex((u) => u.i > after);
      const next = nextIdx >= 0 ? { ...T.toolUses[nextIdx], isShell: SHELL_TOOLS.has(T.toolUses[nextIdx].name) } : null;
      const textBefore = next ? T.textIdx.filter((t) => t.i > after && t.i < next.i).map((t) => t.text).join("\n") : "";
      if (next) {
        row.next_act_tool = next.name;
        const nt = next.isShell ? String(next.input.command ?? "") : JSON.stringify(next.input);
        row.next_act_excerpt = nt.replace(/\s+/g, " ").slice(0, 120);
        row.gap_s = Number.isFinite(next.ts) ? ((next.ts - created) / 1000).toFixed(1) : "";
        row.next_text_before = textBefore.length > 0;
      } else {
        row.next_act_tool = "NO_NEXT_ACT";
      }

      // --- outcome
      const entries = [];
      if (arm === "A") {
        for (const id of injectedIds) {
          const e = entryRow.get(id);
          // The attachment carries the injected text verbatim; read the action from it when present.
          let action = null;
          if (att) {
            const m = att.text.split("\n").find((l) => l.startsWith(`[stored knowledge ${id}`));
            if (m) action = m.replace(/^\[stored knowledge \d+[^\]]*\]\s*/, "");
          }
          if (action == null && e) action = actionOf(e.content);
          entries.push(action == null ? { id, gone: true } : { id, key: e?.key ?? null, action });
        }
      } else {
        const hit = wouldHaveBeen(anchorCmd);
        if (hit) entries.push({ id: hit.id, key: hit.key, action: actionOf(hit.content), relevance: hit.relevance });
      }
      row.entry_ids_scored = entries.map((e) => e.id).join(" ");
      if (!entries.length) { row.outcome = "NA"; row.rule_hit = "none"; }
      else {
        const outs = entries.map((e) => e.gone ? { rule: "none", outcome: "ENTRY_GONE", source: "none" }
          : scoreOutcome({ entryId: e.id, key: e.key, action: e.action, anchorCmd, next, textBefore, programs }));
        const pick = (o) => outs.find((x) => x.outcome === o);
        const chosen = pick("FOLLOW") ?? pick("CONTRADICT") ?? pick("IGNORE") ?? pick("UNDETERMINED") ?? outs[0];
        row.outcome = chosen.outcome; row.rule_hit = chosen.rule; row.outcome_source = chosen.source;
        if (arm === "B") row.wb_entry = entries[0].id;
      }

      // --- entry-299 section: arm A anchors; arm B anchors as the uninjected baseline
      if (arm === "B" || injectedIds.includes(299)) {
        if (arm === "A") row.inj_ordinal = ++injOrdinal;
        const c299 = classify299(anchorCmd);
        row.class_299 = c299.cls;
        row.reason_299 = c299.reason;
        if (row.class_299 === "VIOLATING") {
          const from = T.toolUses.findIndex((u) => u.i > after);
          let fu = "NONE";
          if (from >= 0) {
            for (const u of T.toolUses.slice(from, from + 20)) {
              if (!SHELL_TOOLS.has(u.name)) continue;
              const c = classify299(String(u.input.command ?? ""));
              if (!(c.trimmerPipe && c.readsStatus)) continue;
              fu = c.cls === "VIOLATING" ? "REPEAT" : c.cls === "COMPLIANT" ? "FOLLOW" : "NONE";
              if (fu !== "NONE") break;
            }
          }
          row.followup_299 = fu;
        }
      }
    }
  }

  writeCsv(path.join(OUT, "fires.csv"), rows);
  const tokenInfo = [...new Set([299, ...rows.filter((r) => r.wb_entry != null).map((r) => r.wb_entry)])].map((id) => {
    const e = entryRow.get(id);
    return e ? { id, key: e.key, ...actionTokens(actionOf(e.content), programs) } : { id, gone: true };
  });
  const summary = summarise({ rows, fires, check, counters, liveMtime, scriptSha, sessionsWithSubagentDirs, sessions, queryCache, tokenInfo, excluded });
  fs.writeFileSync(path.join(OUT, "summary.md"), summary, "utf8");
  db.close();
  console.log(`wrote ${path.join(OUT, "fires.csv")} (${rows.length} rows) and ${path.join(OUT, "summary.md")}`);
}

const CSV_COLS = [
  "fire_id", "session_uuid", "created_at", "state", "command", "query", "injected_ids", "entry_ids_scored",
  "anchor_status", "anchor_source", "anchor_tool_use_id", "next_act_tool", "next_act_excerpt", "gap_s",
  "next_text_before", "rule_hit", "outcome", "outcome_source", "arm", "class_299", "followup_299", "inj_ordinal", "reason_299", "wb_entry",
];
function writeCsv(p, rows) {
  const q = (v) => {
    const s = String(v ?? "").replace(/[\t\r\n]+/g, " ");
    return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  fs.writeFileSync(p, [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => q(r[c])).join(","))].join("\n") + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Summary (aggregates only)

function summarise({ rows, fires, check, counters, liveMtime, scriptSha, sessionsWithSubagentDirs, sessions, queryCache, tokenInfo, excluded }) {
  const L = [];
  const count = (arr, f) => arr.reduce((m, x) => { const k = f(x); m.set(k, (m.get(k) ?? 0) + 1); return m; }, new Map());
  const STATES = ["injected", "silent", "not-asked"];
  const DET = new Set(["FOLLOW", "CONTRADICT", "IGNORE"]);

  L.push("# T-264 result: recall-trigger effect measurement (D-148)", "");
  L.push("Generated by docs/loops/t264/measure.mjs. Aggregates only: counts, rates, Wilson 95% intervals, entry ids and keys,");
  L.push("program basenames. The per-fire data stays on the desktop.", "");
  L.push(`- Live DB mtime at snapshot: ${liveMtime}; analysed a read-only snapshot.`);
  L.push(`- Script sha256 (first 16): ${scriptSha}`);
  L.push("- Judge (design 2.3): off, NOT RUN. UNDETERMINED stays UNDETERMINED.");
  L.push(`- Fire window: ${fires[0]?.created_at ?? "n/a"} to ${fires[fires.length - 1]?.created_at ?? "n/a"}`, "");

  // 1. census
  L.push("## 1. Census", "");
  const byState = count(fires, (f) => f.state);
  L.push(`Fires: ${fires.length} over ${sessions.size} sessions (${excluded} fires of the measuring session excluded).`, "");
  L.push("| state | fires | sessions | with transcript | NO_TRANSCRIPT |", "|---|---:|---:|---:|---:|");
  for (const s of STATES) {
    const rs = rows.filter((r) => r.state === s);
    const withT = rs.filter((r) => r.has_transcript).length;
    L.push(`| ${s} | ${byState.get(s) ?? 0} | ${new Set(rs.map((r) => r.session_uuid)).size} | ${withT} | ${rs.length - withT} |`);
  }
  L.push("");
  const byCmd = count(fires, (f) => f.command);
  const cmds = [...byCmd.entries()].sort((a, b) => b[1] - a[1]);
  const shown = cmds.filter(([, n]) => n >= 20).map(([c]) => c);
  L.push("Fires by state x stored command (basenames with 20 or more fires; the rest pooled as (other)):", "");
  L.push("| command | injected | silent | not-asked | total |", "|---|---:|---:|---:|---:|");
  const cell = (c, s) => fires.filter((f) => (c === "(other)" ? !shown.includes(f.command) : f.command === c) && f.state === s).length;
  for (const c of [...shown, "(other)"]) {
    const v = STATES.map((s) => cell(c, s));
    L.push(`| ${c} | ${v.join(" | ")} | ${v.reduce((a, b) => a + b, 0)} |`);
  }
  L.push("");
  L.push(`Transcript lines parsed: ${counters.lines}; unparsable lines skipped: ${counters.unparsable}; transcript files read: ${counters.filesRead}.`);
  L.push(`Sessions with a MULTI transcript (more than one file, largest taken): ${new Set(rows.filter((r) => r.multi).map((r) => r.session_uuid)).size}.`);
  const fireSessWithSub = [...sessions.keys()].filter((s) => sessionsWithSubagentDirs.has(s)).length;
  L.push(`Sessions with fires that also have a subagents directory (not read; subagent Bash calls fire under the parent session id): ${fireSessWithSub}.`, "");

  for (const arm of ["A", "B"]) {
    const rs = rows.filter((r) => r.arm === arm);
    L.push(`Arm ${arm} (${arm === "A" ? "injected" : "silent"}) anchor status: ` +
      [...count(rs, (r) => r.anchor_status).entries()].sort().map(([k, v]) => `${k} ${v}`).join(", ") + ".");
    L.push(`Arm ${arm} anchor source: ` + [...count(rs.filter((r) => r.anchor_source), (r) => r.anchor_source).entries()].sort().map(([k, v]) => `${k} ${v}`).join(", ") + ".");
    L.push(`Arm ${arm} outcome: ` + [...count(rs, (r) => `${r.outcome}${r.rule_hit && r.rule_hit !== "none" ? "(" + r.rule_hit + ")" : ""}`).entries()].sort().map(([k, v]) => `${k} ${v}`).join(", ") + ".");
    L.push("");
  }
  const wb = count(rows.filter((r) => r.arm === "B" && r.wb_entry != null), (r) => r.wb_entry);
  L.push("Arm B would-have-been entry (queryStore, floor -Infinity, limit 1), by entry id: " +
    [...wb.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(", ") + ".", "");

  // 2. gate
  const scored = (arm) => rows.filter((r) => r.arm === arm && DET.has(r.outcome));
  const aCmds = new Set(scored("A").map((r) => r.command));
  const bCmds = new Set(scored("B").map((r) => r.command));
  const sharedStrata = [...aCmds].filter((c) => bCmds.has(c)).sort();
  const inShared = (arm) => scored(arm).filter((r) => sharedStrata.includes(r.command));
  const nA = inShared("A").length, nB = inShared("B").length;
  const pass = nA >= 30 && nB >= 30;
  L.push("## 2. Gate (Part 4.2)", "");
  L.push(`Determinate-scored fires in shared strata: A = ${nA}, B = ${nB} (threshold 30 each). Shared strata: ${sharedStrata.length ? sharedStrata.join(", ") : "none"}.`);
  L.push(`Determinate-scored fires in all strata: A = ${scored("A").length}, B = ${scored("B").length}.`, "");
  L.push(`**Gate: ${pass ? "PASS" : "INSUFFICIENT"}**`, "");

  // 3. effect
  L.push("## 3. FOLLOW rate per arm x stratum", "");
  if (!pass) L.push("Gate is INSUFFICIENT, so no effect is reported. The table below is descriptive only.", "");
  L.push("| arm | stratum | n | follow | contradict | ignore | undetermined | follow rate [Wilson 95%] |", "|---|---|---:|---:|---:|---:|---:|---|");
  const strataRows = (arm, strat) => rows.filter((r) => r.arm === arm && r.command === strat && r.outcome !== "NA" && r.outcome !== "ENTRY_GONE");
  const line = (arm, strat, rs) => {
    const c = (o) => rs.filter((r) => r.outcome === o).length;
    const det = rs.filter((r) => DET.has(r.outcome)).length;
    L.push(`| ${arm} | ${strat} | ${rs.length} | ${c("FOLLOW")} | ${c("CONTRADICT")} | ${c("IGNORE")} | ${c("UNDETERMINED")} | ${rateCell(c("FOLLOW"), det)} |`);
  };
  const pooled = {};
  for (const arm of ["A", "B"]) {
    for (const s of sharedStrata) line(arm, s, strataRows(arm, s));
    const all = sharedStrata.flatMap((s) => strataRows(arm, s));
    line(arm, "pooled (shared)", all);
    pooled[arm] = { k: all.filter((r) => r.outcome === "FOLLOW").length, n: all.filter((r) => DET.has(r.outcome)).length };
  }
  L.push("", "Follow rate denominators are determinate-scored fires (FOLLOW + CONTRADICT + IGNORE).", "");
  L.push("Rule 2.2b tokens per scored entry (from store text; REQUIRE before the first negation cue, FORBID after it):", "");
  for (const t of tokenInfo) {
    if (t.gone) { L.push(`- entry ${t.id}: ENTRY_GONE`); continue; }
    const f = (arr) => arr.map((x) => `${x.kind}:${x.tok.replace(/`/g, "")}`).join(" ; ") || "none";
    L.push(`- entry ${t.id} (${t.key}): REQUIRE [${f(t.require)}]; FORBID [${f(t.forbid)}]`);
  }
  L.push("");
  {
    const b299 = rows.filter((r) => r.arm === "B" && r.wb_entry === 299 && sharedStrata.includes(r.command));
    const k = b299.filter((r) => r.outcome === "FOLLOW").length, n = b299.filter((r) => DET.has(r.outcome)).length;
    const c = b299.filter((r) => r.outcome === "CONTRADICT").length;
    L.push(`Same-entry comparison (Arm B restricted to fires whose would-have-been entry is 299, shared strata; same tokens as Arm A): n = ${b299.length}, determinate ${n}, FOLLOW ${k}, CONTRADICT ${c}, follow rate ${rateCell(k, n)}; Arm A pooled ${rateCell(pooled.A.k, pooled.A.n)}.`, "");
  }
  if (pass) {
    const eff = pooled.A.k / pooled.A.n - pooled.B.k / pooled.B.n;
    L.push(`Effect FOLLOW_A - FOLLOW_B (pooled, shared strata): ${(100 * eff).toFixed(1)} percentage points.`);
    L.push("Caveat (design 3.3): Arm B's entries scored below the relevance floor, so they are less relevant by construction; the effect is an upper bound on the injection effect and is confounded with relevance.", "");
  }

  // 4. entry 299
  const A299 = rows.filter((r) => r.arm === "A" && r.class_299);
  const B299 = rows.filter((r) => r.arm === "B" && r.class_299);
  const cc = count(A299, (r) => r.class_299);
  const nC = cc.get("COMPLIANT") ?? 0, nV = cc.get("VIOLATING") ?? 0, nN = cc.get("NOT_APPLICABLE") ?? 0, n299 = A299.length;
  L.push("## 4. Entry 299 (pipe-to-tail-masks-exit-code)", "");
  L.push(`Arm A anchors classified: ${n299} (injected fires with an anchor).`, "");
  L.push("| class | n | share [Wilson 95%] |", "|---|---:|---|");
  for (const [k, v] of [["COMPLIANT", nC], ["VIOLATING", nV], ["NOT_APPLICABLE", nN]]) L.push(`| ${k} | ${v} | ${rateCell(v, n299)} |`);
  L.push("", `Precision of the trigger on 299 (injection landed on a command that made the mistake): ${rateCell(nV, n299)}.`, "");
  L.push("Reasons: " + [...count(A299, (r) => `${r.class_299}/${r.reason_299}`).entries()].sort().map(([k, v]) => `${k} ${v}`).join(", ") + ".", "");
  const fuc = count(A299.filter((r) => r.followup_299), (r) => r.followup_299);
  const nFU = A299.filter((r) => r.followup_299).length;
  L.push("VIOLATING anchors: next Bash command within 20 tool calls that pipes into a trimmer and reads a status:", "");
  L.push("| follow-up | n | share [Wilson 95%] |", "|---|---:|---|");
  for (const k of ["FOLLOW", "REPEAT", "NONE"]) L.push(`| ${k} | ${fuc.get(k) ?? 0} | ${rateCell(fuc.get(k) ?? 0, nFU)} |`);
  const fr = (fuc.get("FOLLOW") ?? 0), rp = (fuc.get("REPEAT") ?? 0);
  L.push("", `Among VIOLATING anchors with a qualifying follow-up (FOLLOW + REPEAT = ${fr + rp}), FOLLOW share: ${rateCell(fr, fr + rp)}.`, "");
  {
    const bc = count(B299, (r) => r.class_299);
    const bf = count(B299.filter((r) => r.followup_299), (r) => r.followup_299);
    const bfr = bf.get("FOLLOW") ?? 0, brp = bf.get("REPEAT") ?? 0;
    L.push(`Uninjected baseline (Arm B anchors, same classifier): ${B299.length} classified; COMPLIANT ${bc.get("COMPLIANT") ?? 0}, VIOLATING ${bc.get("VIOLATING") ?? 0}, NOT_APPLICABLE ${bc.get("NOT_APPLICABLE") ?? 0}.`);
    L.push(`Baseline VIOLATING follow-up: FOLLOW ${bfr}, REPEAT ${brp}, NONE ${bf.get("NONE") ?? 0}; FOLLOW share of FOLLOW + REPEAT: ${rateCell(bfr, bfr + brp)}.`, "");
  }
  const bySess = new Map();
  for (const r of A299) { if (!bySess.has(r.session_uuid)) bySess.set(r.session_uuid, []); bySess.get(r.session_uuid).push(r); }
  const multiS = [...bySess.values()].filter((v) => v.length >= 2);
  const first = multiS.map((v) => v[0]), later = multiS.flatMap((v) => v.slice(1));
  const cls = (arr, k) => arr.filter((r) => r.class_299 === k).length;
  L.push(`Within-session comparison: ${multiS.length} sessions with 2 or more classified injections.`, "");
  L.push("| injection | n | COMPLIANT | VIOLATING | NOT_APPLICABLE | VIOLATING share [Wilson 95%] |", "|---|---:|---:|---:|---:|---|");
  for (const [name, arr] of [["first in session", first], ["later in session", later]]) {
    L.push(`| ${name} | ${arr.length} | ${cls(arr, "COMPLIANT")} | ${cls(arr, "VIOLATING")} | ${cls(arr, "NOT_APPLICABLE")} | ${rateCell(cls(arr, "VIOLATING"), arr.length)} |`);
  }
  const firstV = multiS.filter((v) => v[0].class_299 === "VIOLATING");
  const laterVAgain = firstV.filter((v) => v.slice(1).some((r) => r.class_299 === "VIOLATING")).length;
  L.push("", `Sessions whose first injection landed on a VIOLATING command: ${firstV.length}; of those, sessions with a later VIOLATING injected anchor: ${laterVAgain}.`, "");

  L.push("Classifier self-check (fixed strings, run before the analysis):", "");
  for (const l of check.lines) L.push(`- ${l}`);
  L.push("");

  // Section 5 is the operator's reading of the numbers above; the script leaves the slot.
  L.push("## 5. Answer to D-148", "", "(operator-written from the numbers above)", "");
  L.push("## 6. Limits", "");
  L.push("- C3: Arm B's would-have-been entry is scored against the store as snapshotted, not as it stood at fire time.");
  L.push("- C4: Cursor fires (and any session without a Claude Code transcript) have no transcript and are NO_TRANSCRIPT.");
  L.push("- C7: rule 2.2b is token matching. Its tokens are listed in section 3; a common word in an entry's action decides most outcomes.");
  L.push("- Subagent transcripts (in a session's subagents directory) are not read; a subagent's Bash call fires under the parent session and may anchor as NO_ANCHOR or to a nearby main-thread call.");
  L.push("- Next act is the first tool_use after the anchor's tool_result and hook attachment (not merely after the anchor), so calls issued in the same model response as the anchor, which could not have seen the injection, are skipped.");
  L.push("- The 299 classifier counts a grep-as-test read (pipe into grep, then $?) as VIOLATING, by the brief's definition, though grep's own status is sometimes the intended signal.");
  L.push("- The within-session drop is not controlled: the first injection in a session is selected by being first.");
  const aRows = rows.filter((r) => r.arm === "A"), bRows = rows.filter((r) => r.arm === "B");
  const inferred = aRows.filter((r) => r.anchor_source === "ANCHOR_INFERRED").length;
  const anchoredA = aRows.filter((r) => r.anchor_tool_use_id).length;
  L.push(`- ANCHOR_INFERRED share of anchored Arm A fires: ${inferred}/${anchoredA} (${pct(inferred / anchoredA)}).`);
  for (const [name, rs] of [["Arm A", aRows], ["Arm B", bRows], ["all fires", rows]]) {
    const nt = rs.filter((r) => !r.has_transcript).length;
    L.push(`- NO_TRANSCRIPT share, ${name}: ${nt}/${rs.length} (${pct(nt / rs.length)}).`);
  }
  L.push(`- Distinct anchor commands queried for Arm B: ${queryCache.size}.`);
  L.push("");
  return L.join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
