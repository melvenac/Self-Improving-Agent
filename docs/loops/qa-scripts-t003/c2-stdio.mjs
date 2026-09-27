// QA 142: the server as a REAL process. This node process plays "claude": it spawns the built server over stdio
// (the server's ppid is this process), writes the proof for its own pid the way the hook does, and drives the tools
// through the MCP client. Scratch stores only. usage: node c2-stdio.mjs <build-root> <scratch-dir> <label>
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S, LABEL = "?"] = process.argv.slice(2);
const STORE = join(S, "c2-store"), HOMEDIR = join(S, "c2-home"), PROJ = join(S, "c2-proj");
rmSync(STORE, { recursive: true, force: true }); rmSync(HOMEDIR, { recursive: true, force: true });
mkdirSync(STORE, { recursive: true }); mkdirSync(HOMEDIR, { recursive: true }); mkdirSync(PROJ, { recursive: true });
const ENV = {
  ...process.env, KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "active-session.json"),
  OPEN_BRAIN_VAULT_DIR: join(STORE, "vault"), OPEN_BRAIN_SCORE_HISTORY: join(STORE, "score.jsonl"),
  OPEN_BRAIN_SHADOW_LOG: join(STORE, "shadow.jsonl"), OPEN_BRAIN_IDE: "claude", HOME: HOMEDIR, USERPROFILE: HOMEDIR,
};
const sdk = (p) => import(pathToFileURL(join(CAND, "open-brain/node_modules/@modelcontextprotocol/sdk/dist/esm", p)).href);
const { Client } = await sdk("client/index.js");
const { StdioClientTransport } = await sdk("client/stdio.js");
const PS = await import(pathToFileURL(join(CAND, "open-brain/build/shared/process-session.js")).href);
const Database = (await import(pathToFileURL(join(CAND, "open-brain/node_modules/better-sqlite3/lib/index.js")).href)).default;
const DIR = PS.byPidDir(ENV.OPEN_BRAIN_ACTIVE_SESSION);
const ME = process.pid, MYSTART = PS.processStartTime(ME);
const prove = (id) => PS.writeProcessSession(DIR, { session_id: id, claude_pid: ME, proc_start: MYSTART, ide: "claude", written_at: new Date().toISOString() });
const U = (h) => `${h}aaaaaa-bbbb-4ccc-8ddd-eeeeeeeeee${h}`.slice(0, 36);

const t = new StdioClientTransport({ command: "node", args: [join(CAND, "open-brain/build/server.js")], env: ENV, cwd: PROJ, stderr: "ignore" });
const c = new Client({ name: "qa142-claude-standin", version: "0" });
await c.connect(t);
const call = async (name, args = {}) => { try { const r = await c.callTool({ name, arguments: args }); return { err: !!r.isError, text: r.content.map((x) => x.text).join("\n") }; } catch (e) { return { err: true, text: "PROTOCOL ERROR " + e.message }; } };
const line = (txt, re) => txt.split("\n").find((l) => re.test(l)) ?? "(no matching line)";
const db = () => new Database(ENV.KNOWLEDGE_V2_DB, { readonly: true });
const rows = (sql) => { const d = db(); try { return d.prepare(sql).all(); } finally { d.close(); } };
let fails = 0;
const verdict = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? "HOLDS " : "BROKEN"}  ${n}${d ? "\n        " + d : ""}`); };
console.log(`# c2-stdio on ${LABEL}; stand-in claude pid ${ME}, start ${MYSTART}`);

const st0 = await call("ob_stats");
console.log(`INFO    no proof yet: ${line(st0.text, /Session proof|self-registrations/)}`);
const stored = await call("ob_store", { content: "qa142 recall target: the lighthouse keeper's ledger", key: "qa142-target" });
const kid = Number((stored.text.match(/id:?\s*(\d+)/) ?? [])[1]);
console.log(`INFO    seeded entry ${kid}`);

// No proof: recall and feedback must say NOT LOGGED; nothing in the logs.
const r0 = await call("ob_recall", { queries: ["lighthouse ledger"], trigger: "explicit" });
const f0 = await call("ob_feedback", { id: kid, rating: "helpful" });
verdict("S1 no proof: ob_recall says NOT LOGGED with the reason", /NOT LOGGED/.test(r0.text), line(r0.text, /NOT LOGGED|lighthouse/));
verdict("S1b no proof: ob_feedback says NOT LOGGED (the handoff's claim)", /NOT LOGGED|not logged/i.test(f0.text), f0.text.replace(/\n/g, " / "));
verdict("S1c no proof: no recall_log / feedback_log rows", rows("select count(*) n from recall_log")[0].n === 0 && rows("select count(*) n from feedback_log")[0].n === 0);

// Proof A: this "claude" is session A.
const A = U("a"), B = U("b");
prove(A);
const st1 = await call("ob_stats");
verdict("S2 ob_stats names the proven session via THIS process as parent", line(st1.text, /Session proof/).includes(A) && line(st1.text, /Session proof/).includes(String(ME)), line(st1.text, /Session proof/));
await call("ob_recall", { queries: ["lighthouse ledger"], trigger: "explicit" });
await call("ob_feedback", { id: kid, rating: "helpful" });
const ch = await call("ob_store_chunk", { content: "qa142 chunk", key: "qa142-chunk" });
verdict("S2b recall_log and feedback_log rows under A; chunk linked to A", rows(`select session_uuid s from recall_log`).every((r) => r.s === A) && rows(`select session_uuid s from feedback_log`).every((r) => r.s === A) && rows("select count(*) n from recall_log")[0].n === 1 && ch.text.includes(A),
  JSON.stringify({ recall: rows("select session_uuid s from recall_log"), feedback: rows("select session_uuid s from feedback_log") }));

// /clear: SessionEnd removes A's, SessionStart writes B's. The server process is unchanged.
PS.removeProcessSession(DIR, ME, A); prove(B);
await call("ob_recall", { queries: ["lighthouse ledger"], trigger: "explicit" });
await call("ob_feedback", { id: kid, rating: "neutral" });
const rl = rows("select session_uuid s from recall_log order by id"), fl = rows("select session_uuid s from feedback_log order by id");
verdict("S3 after /clear (same server process) the next recall and feedback log under B", rl.at(-1)?.s === B && fl.at(-1)?.s === B, JSON.stringify({ rl, fl }));
const rd = await call("ob_recalled");
verdict("S3b ob_recalled reports B's recalls (1), not A's", /1\b/.test(line(rd.text, /recalled|entr/i)), rd.text.split("\n").slice(0, 3).join(" / "));

// ob_end with NO session_id while a proof exists: is anything logged under B, or unattributed?
const fb0 = rows("select count(*) n from feedback_log")[0].n;
const e1 = await call("ob_end", { project_root: PROJ, entry_ratings: { [kid]: "helpful" }, recalled_entry_ids: [kid], session_summary: "qa142" });
const fb1 = rows("select session_uuid s, rating_origin o, rating_method m from feedback_log order by id");
console.log(`INFO    S4 ob_end with no session_id while the proof names B: feedback_log rows ${fb0} -> ${fb1.length}; ${e1.err ? "ERROR " : ""}${line(e1.text, /Feedback|rated|Recalled ids/)}; rows: ${JSON.stringify(fb1)}`);

// A proof file holding JSON null (not a record).
writeFileSync(join(DIR, `${ME}.json`), "null");
const rn = await call("ob_recall", { queries: ["lighthouse ledger"], trigger: "explicit" });
const sn = await call("ob_stats");
verdict("S5 a proof holding JSON null: ob_recall still returns its results (a logging failure must never break a recall)", !rn.err && /qa142-target/.test(rn.text), rn.text.replace(/\n/g, " / ").slice(0, 400));
verdict("S5b a proof holding JSON null: ob_stats still answers", !sn.err, sn.text.split("\n").slice(0, 2).join(" / ").slice(0, 200));

rmSync(DIR, { recursive: true, force: true });
await c.close();
console.log(`\n${fails} BROKEN`);
process.exit(0);
