// QA 289 driver library: real MCP server (stdio), real SessionEnd hook, real SessionStart greeting.
// Everything under C:/qa-tmp/qa289. OB = the open-brain tree under test (QA_OB overrides).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const R = "C:/qa-tmp/qa289";
export const OB = process.env.QA_OB || "C:/qa-scratch/qa289-pr489/open-brain";
const imp = (p) => import(pathToFileURL(join(OB, p)).href);
for (const d of ["tmp", "state", "vault", "home", "repos", "db"]) mkdirSync(`${R}/${d}`, { recursive: true });

export const ACTIVE = `${R}/state/active-session.json`;
export function env(db, extra = {}) {
  return {
    ...process.env,
    TEMP: "C:\\qa-tmp\\qa289\\tmp", TMP: "C:\\qa-tmp\\qa289\\tmp", TMPDIR: "C:/qa-tmp/qa289/tmp",
    KNOWLEDGE_V2_DB: db,
    OPEN_BRAIN_SCORE_HISTORY: `${R}/state/score-history.jsonl`,
    OPEN_BRAIN_SHADOW_LOG: `${R}/state/shadow-recall.jsonl`,
    OPEN_BRAIN_ACTIVE_SESSION: ACTIVE,
    OPEN_BRAIN_VAULT_DIR: `${R}/vault`,
    CLAUDE_CODE_SESSION_ID: "", // this headless QA session's own id must not leak into a fixture hook
    ...extra,
  };
}
// Own process env too, so in-process imports (process-session) resolve to temp paths.
Object.assign(process.env, env(`${R}/db/default.db`));

export const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString();
export const H = 3600_000;

export function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
export function commit(dir, when, file, body, trailerId /* cse id or null */, msg = file) {
  mkdirSync(join(dir, file, ".."), { recursive: true });
  writeFileSync(join(dir, file), body);
  git(dir, "add", "-A");
  const m = ["-m", msg];
  if (trailerId) m.push("-m", `Claude-Session: https://claude.ai/code/session_${trailerId}`);
  execFileSync("git", ["-c", "user.email=qa@example.com", "-c", "user.name=QA", "-c", `core.autocrlf=${process.env.QA_AUTOCRLF ?? "false"}`, "commit", "-q", ...m],
    { cwd: dir, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } });
  return git(dir, "rev-parse", "HEAD");
}
export function freshDir(name) {
  const dir = join(R, "repos", name).replace(/\\/g, "/");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}
/** Old layout: prose files, no state.json. eol: "\n" or "\r\n". */
export function oldLayout(dir, { eol = "\n", when = iso(-30 * 24 * H), gitInit = true } = {}) {
  if (gitInit) git(dir, "init", "-q", "-b", "master");
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
export function transcript(dir, startIso, cse, eol = "\n") {
  const p = join(dir, "..", `${dir.split("/").pop()}.transcript.jsonl`);
  writeFileSync(p, [`{"timestamp":"${startIso}"}`, `{"type":"bridge-session","bridgeSessionId":"cse_${cse}"}`, ""].join(eol));
  return p;
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
  const client = new Client({ name: "qa289", version: "1" });
  await client.connect(transport);
  return {
    async call(name, args = {}) {
      const r = await client.callTool({ name, arguments: args });
      return { isError: !!r.isError, text: r.content.map((c) => c.text).join("\n") };
    },
    close: () => client.close(),
  };
}
export function hook(dir, payload, db, extraEnv = {}) {
  const r = spawnSync(process.execPath, [join(OB, "build", "cli-session-end.js")], {
    cwd: dir, input: JSON.stringify(payload), encoding: "utf8", timeout: 120_000,
    env: env(db, { CLAUDE_PROJECT_DIR: dir, ...extraEnv }),
  });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ? `\n[stderr]\n${r.stderr}` : "") };
}
export function greet(dir, sessionId, db) {
  const r = spawnSync(process.execPath, [join(OB, "build", "cli-bootstrap.js")], {
    cwd: dir, input: JSON.stringify({ session_id: sessionId, cwd: dir, hook_event_name: "SessionStart", source: "startup" }),
    encoding: "utf8", timeout: 180_000,
    env: env(db, { HOME: `${R}/home`, USERPROFILE: `${R}\\home`, CLAUDE_PROJECT_DIR: dir, CLAUDE_PID: "" }),
  });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}
export const pick = (text, re) => text.split(/\r?\n/).filter((l) => re.test(l));
export function ls(dir, rel) { const p = join(dir, rel); return existsSync(p) ? readFileSync(p, "utf8") : null; }
export function show(label, v) { console.log(`--- ${label}\n${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`); }
