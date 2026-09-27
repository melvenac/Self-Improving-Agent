// QA 142 check 3: the REAL hook binaries and a REAL server process, with this node process as the stand-in claude.
// Hooks get CLAUDE_PID = this pid (what the host sets for hooks); the server is spawned by this process (ppid = this).
// Compares the full install (SessionStart + SessionEnd) with an old install (SessionStart only) across /clear.
// usage: node c4-hooks.mjs <build-root> <scratch-dir> <label>
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S, LABEL = "?"] = process.argv.slice(2);
const STORE = join(S, "c4-store"), HOMEDIR = join(S, "c4-home"), PROJ = join(S, "c4-proj");
for (const d of [STORE, HOMEDIR, PROJ]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }
const ENV = {
  ...process.env, KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "active-session.json"),
  OPEN_BRAIN_VAULT_DIR: join(STORE, "vault"), OPEN_BRAIN_SCORE_HISTORY: join(STORE, "score.jsonl"),
  OPEN_BRAIN_SHADOW_LOG: join(STORE, "shadow.jsonl"), OPEN_BRAIN_IDE: "claude", HOME: HOMEDIR, USERPROFILE: HOMEDIR,
  CLAUDE_PID: String(process.pid),
};
const sdk = (p) => import(pathToFileURL(join(CAND, "open-brain/node_modules/@modelcontextprotocol/sdk/dist/esm", p)).href);
const { Client } = await sdk("client/index.js");
const { StdioClientTransport } = await sdk("client/stdio.js");
const BY = join(STORE, "by-pid");
const hook = (file, payload) => {
  try {
    const out = execFileSync("node", [join(CAND, "open-brain/build", file)], { cwd: PROJ, env: ENV, input: JSON.stringify({ cwd: PROJ, ...payload }), encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 120_000 });
    return out.split("\n").filter((l) => /proof/i.test(l)).join(" | ");
  } catch (e) { return `EXIT ${e.status}: ${(e.stdout || "").split("\n").filter((l) => /proof/i.test(l)).join(" | ")}`; }
};
const t = new StdioClientTransport({ command: "node", args: [join(CAND, "open-brain/build/server.js")], env: ENV, cwd: PROJ, stderr: "ignore" });
const c = new Client({ name: "qa142-hooks", version: "0" });
await c.connect(t);
const proof = async () => { const r = await c.callTool({ name: "ob_stats", arguments: {} }); return r.content[0].text.split("\n").find((l) => /Session proof/.test(l)) ?? "(no proof line)"; };
const files = () => (existsSync(BY) ? readdirSync(BY).join(",") : "(no dir)");
const A = "aaaaaaaa-0000-4000-8000-00000000000a", B = "bbbbbbbb-0000-4000-8000-00000000000b", C = "cccccccc-0000-4000-8000-00000000000c";
let fails = 0;
const verdict = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? "HOLDS " : "BROKEN"}  ${n}${d ? "\n        " + d : ""}`); };
console.log(`# c4-hooks on ${LABEL}; stand-in claude ${process.pid}`);

console.log("## full install: SessionStart + SessionEnd");
console.log(`  start(A): ${hook("cli-bootstrap.js", { session_id: A, source: "startup", hook_event_name: "SessionStart" })}`);
let p = await proof(); verdict("H1 after SessionStart(A) the server proves A", p.includes(A), p);
console.log(`  end(A):   ${hook("cli-session-end.js", { session_id: A, reason: "clear", hook_event_name: "SessionEnd" })}`);
console.log(`  start(B): ${hook("cli-bootstrap.js", { session_id: B, source: "clear", hook_event_name: "SessionStart" })}`);
p = await proof(); verdict("H2 /clear: the same server now proves B", p.includes(B), p);
console.log(`  start(C) BEFORE end(B) (reversed order): ${hook("cli-bootstrap.js", { session_id: C, source: "clear", hook_event_name: "SessionStart" })}`);
console.log(`  end(B):   ${hook("cli-session-end.js", { session_id: B, reason: "clear", hook_event_name: "SessionEnd" })}`);
p = await proof(); verdict("H3 reversed order: SessionEnd(B) keeps C's proof", p.includes(C), p);
console.log(`  end(C):   ${hook("cli-session-end.js", { session_id: C, reason: "clear", hook_event_name: "SessionEnd" })}   (then SessionStart FAILS: not run)`);
p = await proof(); verdict("H4 /clear with a failed SessionStart: NONE, not C", /NONE/.test(p), p);
console.log(`  subagent start: ${hook("cli-bootstrap.js", { session_id: A, agent_id: "sub-1", hook_event_name: "SessionStart" })}`);
p = await proof(); verdict("H5 a subagent's SessionStart writes no proof", /NONE/.test(p), p);
console.log(`  exit end(A) on an absent file: ${hook("cli-session-end.js", { session_id: A, reason: "exit", hook_event_name: "SessionEnd" })}`);

console.log("## old install: SessionStart only (SessionEnd never runs)");
rmSync(BY, { recursive: true, force: true });
console.log(`  start(A): ${hook("cli-bootstrap.js", { session_id: A, source: "startup", hook_event_name: "SessionStart" })}`);
console.log(`  start(B): ${hook("cli-bootstrap.js", { session_id: B, source: "clear", hook_event_name: "SessionStart" })}`);
p = await proof(); verdict("O1 old install, /clear with SessionStart working: B (SessionStart alone suffices)", p.includes(B), p);
console.log("  /clear again, SessionStart FAILS (not run), no SessionEnd registered");
p = await proof();
console.log(`LIMIT   O2 old install + failed SessionStart: the server still proves ${p.includes(B) ? "B, the PREVIOUS session (stale adoption)" : "?"}\n        ${p}`);
console.log("  claude exits (no SessionEnd): leftover proof files:", files());
await c.close();
console.log(`\n${fails} BROKEN`);
process.exit(0);
