// QA 293 (copied from QA 292's s164e script, re-rooted to C:/qa-tmp/qa293; see below). QA 292 driver library: real MCP server (stdio), real SessionEnd hook, real SessionStart greeting.
// Copied from QA 291's docs/loops/qa-291/s164d/lib.mjs. Changes: root C:/qa-tmp/qa293; OB defaults to the qa293-pr489
// tree; storeFiles() lists each store file with its line count; storeDir() returns the per-project store directory.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

export const R = "C:/qa-tmp/qa293";
export const OB = process.env.QA_OB || "C:/qa-scratch/qa293-pr489/open-brain";
const imp = (p) => import(pathToFileURL(join(OB, p)).href);
for (const d of ["tmp", "state", "vault", "home", "repos", "db"]) mkdirSync(`${R}/${d}`, { recursive: true });

// QA_WIN=1: spaced repo path, CRLF files, core.autocrlf=true, backslash project_root / transcript_path / CLAUDE_PROJECT_DIR.
export const WIN = process.env.QA_WIN === "1";
if (WIN) process.env.QA_AUTOCRLF = "true";
export const EOL = WIN ? "\r\n" : "\n";
export const bs = (p) => (WIN ? p.replace(/\//g, "\\") : p);
const crlf = (s) => (WIN && typeof s === "string" ? s.replace(/\r?\n/g, "\r\n") : s);
export const ACTIVE = `${R}/state/active-session.json`;
export function env(db, extra = {}) {
  return {
    ...process.env,
    TEMP: "C:\\qa-tmp\\qa293\\tmp", TMP: "C:\\qa-tmp\\qa293\\tmp", TMPDIR: "C:/qa-tmp/qa293/tmp",
    HOME: `${R}/home`, USERPROFILE: "C:\\qa-tmp\\qa293\\home",
    KNOWLEDGE_V2_DB: db,
    OPEN_BRAIN_SCORE_HISTORY: `${R}/state/score-history.jsonl`,
    OPEN_BRAIN_SHADOW_LOG: `${R}/state/shadow-recall.jsonl`,
    OPEN_BRAIN_ACTIVE_SESSION: ACTIVE,
    OPEN_BRAIN_VAULT_DIR: `${R}/vault`,
    CLAUDE_CODE_SESSION_ID: "", // this headless QA session's own id must not leak into a fixture hook
    ...extra,
  };
}
/** A fresh db directory per scenario: the END-FIX store lives beside the db. */
export function freshDb(name) {
  const d = `${R}/db/${name}`;
  rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  return `${d}/kb.db`;
}
Object.assign(process.env, env(`${R}/db/default/kb.db`));

export const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString();
export const H = 3600_000;

export function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
/** only: null → `git add -A`; an array → stage only those paths (the file itself is always staged). */
export function commit(dir, when, file, body, trailerId /* cse id or null */, msg = file, only = null) {
  mkdirSync(join(dir, file, ".."), { recursive: true });
  writeFileSync(join(dir, file), crlf(body));
  if (only) git(dir, "add", "--", file, ...only); else git(dir, "add", "-A");
  const m = ["-m", msg];
  if (trailerId) m.push("-m", `Claude-Session: https://claude.ai/code/session_${trailerId}`);
  execFileSync("git", ["-c", "user.email=qa@example.com", "-c", "user.name=QA", "-c", `core.autocrlf=${process.env.QA_AUTOCRLF ?? "false"}`, "commit", "-q", ...m],
    { cwd: dir, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });
  return git(dir, "rev-parse", "HEAD");
}
export function freshDir(name) {
  const dir = join(R, "repos", ...(WIN ? ["win space"] : []), name).replace(/\\/g, "/");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}
/** Old layout: prose files, no state.json. eol: "\n" or "\r\n". */
export function oldLayout(dir, { eol = EOL, when = iso(-30 * 24 * H), gitInit = true } = {}) {
  if (gitInit) git(dir, "init", "-q", "-b", "master");
  if (gitInit && WIN) git(dir, "config", "core.autocrlf", "true");
  mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(dir, ".agents", "TASKS"), { recursive: true });
  const L = (s) => s.split("\n").join(eol);
  writeFileSync(join(dir, ".agents", "SESSIONS", "next-session.md"), L("# Next session\nSession 36, v0.13.1\n"));
  writeFileSync(join(dir, ".agents", "SYSTEM", "SUMMARY.md"), L("# Summary\nv0.13.1\n"));
  writeFileSync(join(dir, ".agents", "TASKS", "task.md"), L("# Tasks\n"));
  writeFileSync(join(dir, ".agents", "TASKS", "INBOX.md"), L("# Inbox\n"));
  writeFileSync(join(dir, "package.json"), L(JSON.stringify({ name: "w", version: "0.13.1" }, null, 2) + "\n"));
  if (gitInit) commit(dir, when, "README.md", L("base\n"), null, "base");
}
export function newLayout(dir, opts = {}) {
  oldLayout(dir, opts);
  writeFileSync(join(dir, ".agents", "state.json"), readFileSync(join(OB, "tests", "fixtures-state", "state.json")));
  if (opts.gitInit !== false) commit(dir, opts.when ?? iso(-30 * 24 * H), ".agents/state.json", readFileSync(join(dir, ".agents", "state.json"), "utf8"), null, "state");
}
export function transcript(dir, startIso, cse, eol = EOL) {
  const p = join(dir, "..", `${dir.split("/").pop()}.transcript.jsonl`);
  writeFileSync(p, [`{"timestamp":"${startIso}"}`, `{"type":"bridge-session","bridgeSessionId":"cse_${cse}"}`, ""].join(eol));
  return bs(p);
}
/** Session proof for THIS process (the server's parent). */
export async function prove(uuid, transcriptPath) {
  const ps = await imp("build/shared/process-session.js");
  rmSync(ps.byPidDir(ACTIVE), { recursive: true, force: true });
  ps.writeProcessSession(ps.byPidDir(ACTIVE), {
    session_id: uuid, claude_pid: process.pid, proc_start: ps.processStartTime(process.pid), ide: "claude",
    written_at: new Date().toISOString(), ...(transcriptPath ? { transcript_path: transcriptPath } : {}),
  });
}
export async function unprove() {
  const ps = await imp("build/shared/process-session.js");
  rmSync(ps.byPidDir(ACTIVE), { recursive: true, force: true });
}
export async function server(cwd, db, extraEnv = {}) {
  const { Client } = await import(pathToFileURL(join(OB, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js")).href);
  const { StdioClientTransport } = await import(pathToFileURL(join(OB, "node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js")).href);
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(OB, "build", "server.js")], cwd, env: env(db, extraEnv), stderr: "pipe" });
  const client = new Client({ name: "qa293", version: "1" });
  await client.connect(transport);
  return {
    async call(name, args = {}) {
      if (WIN && ["ob_end", "ob_state"].includes(name) && !args.project_root) args = { project_root: bs(cwd), ...args };
      const r = await client.callTool({ name, arguments: args });
      return { isError: !!r.isError, text: r.content.map((c) => c.text).join("\n") };
    },
    close: () => client.close(),
  };
}
export function hook(dir, payload, db, extraEnv = {}) {
  const r = spawnSync(process.execPath, [join(OB, "build", "cli-session-end.js")], {
    cwd: dir, input: JSON.stringify(payload), encoding: "utf8", timeout: 120_000,
    env: env(db, { CLAUDE_PROJECT_DIR: bs(dir), ...extraEnv }),
  });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ? `\n[stderr]\n${r.stderr}` : "") };
}
export function greet(dir, sessionId, db) {
  const r = spawnSync(process.execPath, [join(OB, "build", "cli-bootstrap.js")], {
    cwd: dir, input: JSON.stringify({ session_id: sessionId, cwd: bs(dir), hook_event_name: "SessionStart", source: "startup" }),
    encoding: "utf8", timeout: 180_000,
    env: env(db, { CLAUDE_PROJECT_DIR: bs(dir), CLAUDE_PID: "" }),
  });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}
/** Every file in the out-of-repo END-FIX store beside this db: { key: { file: lines } }. */
export function storeFiles(db) {
  const root = join(dirname(db), "end-record");
  if (!existsSync(root)) return "(no end-record dir)";
  const out = {};
  for (const k of readdirSync(root)) {
    const o = {};
    for (const f of readdirSync(join(root, k))) o[f] = readFileSync(join(root, k, f), "utf8").split(/\r?\n/).filter((l) => l.trim()).length;
    out[k.slice(0, 12) + "…"] = o;
  }
  return out;
}
/** The store directory for a project, as the built code computes it (with this db). */
export async function storeDir(dir, db) {
  const prev = process.env.KNOWLEDGE_V2_DB;
  process.env.KNOWLEDGE_V2_DB = db;
  try { return (await imp("build/shared/end-record-store.js")).endRecordProjectDir(bs(dir)); }
  finally { process.env.KNOWLEDGE_V2_DB = prev; }
}
export const pick = (text, re) => text.split(/\r?\n/).filter((l) => re.test(l));
export function ls(dir, rel) { const p = join(dir, rel); return existsSync(p) ? readFileSync(p, "utf8") : null; }
export function show(label, v) { console.log(`--- ${label}\n${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`); }
