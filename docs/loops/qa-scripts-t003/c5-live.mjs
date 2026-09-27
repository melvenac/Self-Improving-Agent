// QA 142 check 4: a real headless claude with the candidate's hooks and server, in a scratch config, across /clear.
// Drives stream-json input one message at a time: each message is sent only after the previous one's `result`.
// The store override variables are set on claude itself, so its hooks and its server both write scratch stores only;
// --setting-sources local keeps the machine's own (real) SIA hooks out. usage: node c5-live.mjs <live-dir> <out.jsonl>
import { spawn } from "node:child_process";
import { createWriteStream, readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [L, OUT] = process.argv.slice(2);
const store = join(L, "store");
const env = {
  ...process.env, KNOWLEDGE_V2_DB: join(store, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(store, "active-session.json"),
  OPEN_BRAIN_VAULT_DIR: join(store, "vault"), OPEN_BRAIN_SCORE_HISTORY: join(store, "score.jsonl"),
  OPEN_BRAIN_SHADOW_LOG: join(store, "shadow.jsonl"), OPEN_BRAIN_IDE: "claude",
};
const ask = "Call the tool mcp__open-brain__ob_stats once, then mcp__open-brain__ob_set_session once with no arguments. Reply with only the 'Session proof' line of ob_stats and the first line of ob_set_session, verbatim.";
const msgs = [ask, "/clear", ask];
const out = createWriteStream(OUT);
const byPid = () => (existsSync(join(store, "by-pid")) ? readdirSync(join(store, "by-pid")).map((f) => `${f}=${JSON.parse(readFileSync(join(store, "by-pid", f), "utf8")).session_id}`).join(",") || "(empty)" : "(no dir)");
const claude = spawn("claude", ["-p", "--model", "claude-haiku-4-5-20251001", "--setting-sources", "local", "--settings", join(L, "live-settings.json"),
  "--strict-mcp-config", "--mcp-config", join(L, "live-mcp.json"), "--allowedTools", "mcp__open-brain__ob_stats,mcp__open-brain__ob_set_session",
  "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"], { cwd: join(L, "proj"), env, shell: true, stdio: ["pipe", "pipe", "pipe"] });
claude.stderr.on("data", (d) => out.write(JSON.stringify({ type: "qa_stderr", text: String(d) }) + "\n"));
let i = 0, buf = "";
const send = () => {
  if (i >= msgs.length) { out.write(JSON.stringify({ type: "qa_note", text: `by-pid before stdin close: ${byPid()}` }) + "\n"); claude.stdin.end(); return; }
  out.write(JSON.stringify({ type: "qa_note", text: `sending #${i}: ${msgs[i].slice(0, 20)}; by-pid now: ${byPid()}` }) + "\n");
  claude.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: msgs[i++] } }) + "\n");
};
claude.stdout.on("data", (d) => {
  buf += d; let k;
  while ((k = buf.indexOf("\n")) >= 0) {
    const l = buf.slice(0, k); buf = buf.slice(k + 1); out.write(l + "\n");
    try { if (JSON.parse(l).type === "result") setTimeout(send, 1500); } catch { /* not json */ }
  }
});
const timer = setTimeout(() => { out.write(JSON.stringify({ type: "qa_note", text: "TIMEOUT: killed" }) + "\n"); claude.kill(); }, 360_000);
claude.on("exit", (code) => { clearTimeout(timer); out.write(JSON.stringify({ type: "qa_note", text: `claude exit ${code}; by-pid after exit: ${byPid()}` }) + "\n"); out.end(); });
send();
