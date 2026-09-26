// QA 125 check 4 (T179-1): run the new end.md AS WRITTEN, through the real MCP server over stdio, in a scratch project,
// and show .agents/state.json (and every other file in the project) is byte-identical before and after.
// Steps as end.md orders them: (1) find lessons, (2) ob_recall the title, ob_store kind "event" with a MATCH key,
// read the row back, (3) ob_recalled then ob_end with ratings only for recalled/injected entries, (4) report.
// usage: node c4-end.mjs <cand-root> <project-root> <store-dir>
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, ROOT, STORE] = process.argv.slice(2);
mkdirSync(join(STORE, "vault"), { recursive: true });
const sdk = (p) => import(pathToFileURL(join(CAND, "open-brain/node_modules/@modelcontextprotocol/sdk/dist/esm", p)).href);
const { Client } = await sdk("client/index.js");
const { StdioClientTransport } = await sdk("client/stdio.js");

function snapshot(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(relative(dir, p).replaceAll("\\", "/"), createHash("sha256").update(readFileSync(p)).digest("hex"));
    }
  };
  walk(dir);
  return out;
}
const stateSha = () => createHash("sha256").update(readFileSync(join(ROOT, ".agents/state.json"))).digest("hex");

const env = { ...process.env, KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "as.json"),
  OPEN_BRAIN_VAULT_DIR: join(STORE, "vault"), OPEN_BRAIN_SCORE_HISTORY: join(STORE, "score.jsonl"), OPEN_BRAIN_SHADOW_LOG: join(STORE, "shadow.jsonl"), OPEN_BRAIN_IDE: "claude" };
const transport = new StdioClientTransport({ command: process.execPath, args: [join(CAND, "open-brain/build/server.js")], cwd: ROOT, env, stderr: "pipe" });
const client = new Client({ name: "qa125-end", version: "0" });
await client.connect(transport);
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content.map((c) => c.text).join("\n");
  console.log(`\n>> ${name} ${JSON.stringify(args).slice(0, 160)}\n${r.isError ? "[isError] " : ""}${text.slice(0, 600)}`);
  return { r, text };
};

const before = snapshot(ROOT); const shaBefore = stateSha();
console.log(`state.json sha256 before: ${shaBefore}; files snapshotted: ${before.size}`);

const SID = "c4c4c4c4-0000-4000-8000-000000000125";
// (no ob_set_session: a session that never ran /start and has no SessionStart hook)
// Step 1: one lesson from this QA session (a real one: MSYS path conversion broke a git show <ref>:<path>).
const title = "git show <ref>:<path> under Git Bash is mangled by MSYS path conversion";
// Step 2: recall the title first; then store with kind "event" and a MATCH key; read it back.
await call("ob_recall", { queries: [title], trigger: "explicit", project: ROOT });
const body = `[EXPERIENCE] ${title}\nMATCH: command: \`git show <ref>:<path>\`\nTRIGGER: running git show origin/x:path from Git Bash on Windows\nACTION: export MSYS_NO_PATHCONV=1 before the command, and pass C:/ paths, not /c/ paths, to node\nCONTEXT: QA 125 extracted the live record with git show origin/master:.agents/state.json and got "ambiguous argument 'origin\\\\master;.agents\\\\state.json'".`;
const st = await call("ob_store", { content: body, key: title, kind: "event", tags: ["git", "windows-paths"], scope: "project", project_dir: ROOT });
const id = Number((st.text.match(/#?(\d+)/) || [])[1]);
await call("ob_recall", { queries: ["MSYS path conversion"], trigger: "explicit", project: ROOT, verbose: true });
// Step 3: ob_recalled lists what was injected or recalled this session; rate only those.
const rec = await call("ob_recalled", {});
const ratedIds = [...rec.text.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
const ratings = Object.fromEntries(ratedIds.slice(0, 1).map((i) => [i, "helpful"]));
await call("ob_end", { project_root: ROOT, session_id: SID, session_summary: "QA 125 check 4: end.md run as written", entry_ratings: ratings });
await client.close();

const after = snapshot(ROOT); const shaAfter = stateSha();
console.log(`\nstate.json sha256 after:  ${shaAfter}  => ${shaBefore === shaAfter ? "BYTE-IDENTICAL" : "CHANGED"}`);
const changed = [...new Set([...before.keys(), ...after.keys()])].filter((k) => before.get(k) !== after.get(k));
console.log(`files in the project changed/added/removed by the run: ${changed.length ? changed.join(", ") : "none"}`);
console.log(`stored id parsed from ob_store: ${id}; ratings passed: ${JSON.stringify(ratings)}`);
