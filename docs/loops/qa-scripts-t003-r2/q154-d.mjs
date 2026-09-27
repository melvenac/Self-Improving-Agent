// QA 154: D1, D2, D3, D4 and D5 in shapes stronger than the rows that pin them.
//  A (in-process ob_start): the OTHER session proved itself and ran /start first, so its log CARRIES its id and its
//    transcript is the newest. This server then starts with no proof. QA 142's P7b had both sessions unproven.
//  B (a REAL server process over stdio, this node process as the stand-in claude): ob_end exactly as end.md calls it
//    (entry_ratings only; no session_id, no recalled_entry_ids), before and after /clear, and with no proof.
//  C (the REAL hook binary): the proof block's ide against --ide, OPEN_BRAIN_IDE and cursor_version.
// Scratch stores and a scratch HOME only. usage: node q154-d.mjs <build-root> <scratch-dir> <label>
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S, LABEL = "?"] = process.argv.slice(2);
const STORE = join(S, "d-store"), HOMEDIR = join(S, "d-home"), ROOT = join(S, "d-proj");
for (const d of [STORE, HOMEDIR, ROOT]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }
const ENV = {
  KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "active-session.json"),
  OPEN_BRAIN_VAULT_DIR: join(STORE, "vault"), OPEN_BRAIN_SCORE_HISTORY: join(STORE, "score.jsonl"),
  OPEN_BRAIN_SHADOW_LOG: join(STORE, "shadow.jsonl"), OPEN_BRAIN_IDE: "claude", HOME: HOMEDIR, USERPROFILE: HOMEDIR,
};
Object.assign(process.env, ENV);
const B_ = (p) => pathToFileURL(join(CAND, "open-brain/build", p)).href;
const PS = await import(B_("shared/process-session.js"));
const SD = await import(B_("pipelines/session-start/session-discovery.js"));
const DIR = PS.byPidDir(ENV.OPEN_BRAIN_ACTIVE_SESSION);
let fails = 0;
const verdict = (n, ok, d) => { if (!ok) fails++; console.log(`${ok ? "HOLDS " : "BROKEN"}  ${n}${d ? "\n        " + d : ""}`); };
const pick = (t, re) => t.split("\n").filter((l) => re.test(l)).join(" / ");
console.log(`# q154-d on ${LABEL}`);

// ---------- A: D1 ----------
{
  let n = 0;
  const fresh = async () => import(B_("server.js") + `?qd-${++n}`);
  const PP = process.ppid, PST = PS.processStartTime(PP);
  const prove = (id) => PS.writeProcessSession(DIR, { session_id: id, claude_pid: PP, proc_start: PST, ide: "claude", written_at: new Date().toISOString() });
  const OTHER = "0be70be7-dddd-4eee-8fff-000000000be7";
  // Where discovery looks (deriveProjectKey), and QA 142's spelling of it, so the transcript is found either way.
  for (const key of new Set([SD.deriveProjectKey(ROOT), ROOT.replace(/[:\\/]/g, "-")])) {
    mkdirSync(join(HOMEDIR, ".claude", "projects", key), { recursive: true });
    writeFileSync(join(HOMEDIR, ".claude", "projects", key, `${OTHER}.jsonl`), "{}\n");
  }
  const SESS = join(ROOT, ".agents", "SESSIONS");
  mkdirSync(SESS, { recursive: true });
  process.chdir(ROOT);
  prove(OTHER);
  const o = await (await fresh()).handleStart({ project_root: ROOT });
  console.log(`INFO    A0 the OTHER session (proved) ran ob_start: ${pick(o.content[0].text, /^Session #|^Session ID/)}`);
  rmSync(DIR, { recursive: true, force: true });
  const discovered = SD.discoverSessionUuid(ROOT, HOMEDIR);
  console.log(`INFO    A0 discovery, asked directly, would return: ${discovered}`);
  const r = (await (await fresh()).handleStart({ project_root: ROOT })).content[0].text;
  const logs = readdirSync(SESS).sort();
  const mine = logs.filter((f) => f !== "Session_1.md").map((f) => readFileSync(join(SESS, f), "utf8")).join("\n");
  verdict("A1 no proof: ob_start prints 'Session ID: none — <reason>', does not reuse the other session's log, and stamps no id",
    /Session ID: none — \S/.test(r) && !r.includes(OTHER) && !/reused/.test(r) && !mine.includes(OTHER) && !/Session ID:/.test(mine) && readFileSync(join(SESS, "Session_1.md"), "utf8").includes(OTHER),
    `${pick(r, /^Session #|^Session ID|^Log:/)}\n        logs: ${logs.join(", ")}; the other session's Session_1.md still carries its own id: ${readFileSync(join(SESS, "Session_1.md"), "utf8").includes(OTHER)}`);
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, `${PP}.json`), "null");
  const rn = (await (await fresh()).handleStart({ project_root: ROOT })).content[0].text;
  verdict("A2 a proof holding JSON null: ob_start names it ('not a session record') and discovers nothing", /Session ID: none — .*not a session record/.test(rn) && !rn.includes(OTHER), pick(rn, /^Session ID/));
  rmSync(DIR, { recursive: true, force: true });
  rmSync(SESS, { recursive: true, force: true });
  const rs = (await (await fresh()).handleStart({ project_root: ROOT })).content[0].text;
  verdict("A3 no SESSIONS dir (the skipped-log branch): 'Session ID: none — <reason>' there too", /Session ID: none — \S/.test(rs) && !rs.includes(OTHER), pick(rs, /^Session log|^Session ID/));
  mkdirSync(SESS, { recursive: true });
  const SELF = "5e1f5e1f-aaaa-4bbb-8ccc-000000005e1f";
  prove(SELF);
  const rp = (await (await fresh()).handleStart({ project_root: ROOT })).content[0].text;
  verdict("A4 control: with a proof, ob_start stamps the proven id", rp.includes(`Session ID: ${SELF}`) && !rp.includes(OTHER), pick(rp, /^Session #|^Session ID/));
  rmSync(DIR, { recursive: true, force: true });
  process.chdir(S);
}

// ---------- B: D3 (and D2/D4 over the wire) through a real server process ----------
{
  rmSync(STORE, { recursive: true, force: true }); mkdirSync(STORE, { recursive: true });
  const sdk = (p) => import(pathToFileURL(join(CAND, "open-brain/node_modules/@modelcontextprotocol/sdk/dist/esm", p)).href);
  const { Client } = await sdk("client/index.js");
  const { StdioClientTransport } = await sdk("client/stdio.js");
  const Database = (await import(pathToFileURL(join(CAND, "open-brain/node_modules/better-sqlite3/lib/index.js")).href)).default;
  const ME = process.pid, MYSTART = PS.processStartTime(ME);
  const prove = (id) => PS.writeProcessSession(DIR, { session_id: id, claude_pid: ME, proc_start: MYSTART, ide: "claude", written_at: new Date().toISOString() });
  const PROJ = join(S, "d-srv-proj"); rmSync(PROJ, { recursive: true, force: true }); mkdirSync(PROJ, { recursive: true });
  const t = new StdioClientTransport({ command: "node", args: [join(CAND, "open-brain/build/server.js")], env: { ...process.env, ...ENV }, cwd: PROJ, stderr: "ignore" });
  const c = new Client({ name: "qa154-claude-standin", version: "0" });
  await c.connect(t);
  const call = async (name, args = {}) => { try { const r = await c.callTool({ name, arguments: args }); return { err: !!r.isError, text: r.content.map((x) => x.text).join("\n") }; } catch (e) { return { err: true, text: "PROTOCOL ERROR " + e.message }; } };
  const rows = (sql) => { const d = new Database(ENV.KNOWLEDGE_V2_DB, { readonly: true }); try { return d.prepare(sql).all(); } finally { d.close(); } };
  const fb = () => rows("select session_uuid s, knowledge_id k, rating r, rating_origin o, rating_method m from feedback_log order by id");
  const A = "a1540000-0000-4000-8000-0000000000a1", Bz = "b1540000-0000-4000-8000-0000000000b1";
  await call("ob_store", { content: "qa154 the harbour pilot's tide table", key: "qa154-d3-one" });
  await call("ob_store", { content: "qa154 the orchard keeper's frost log", key: "qa154-d3-two" });
  const id1 = rows("select id from knowledge_index where key='qa154-d3-one'")[0].id, id2 = rows("select id from knowledge_index where key='qa154-d3-two'")[0].id;

  prove(A);
  await call("ob_recall", { queries: ["harbour pilot tide table"], trigger: "explicit" });
  const listed = await call("ob_recalled");
  const endA = await call("ob_end", { project_root: PROJ, entry_ratings: { [id1]: "helpful" }, session_summary: "qa154 d3 A" });
  const fA = fb();
  verdict("B1 end.md's call (entry_ratings only): the entry ob_recalled lists is rated, and the rating reaches feedback_log under the PROVEN id",
    listed.text.includes("qa154-d3-one") && /Recalled ids: 1 from recall-log/.test(endA.text) && fA.length === 1 && fA[0].s === A && fA[0].k === id1 && fA[0].o === "recall-log",
    `ob_recalled: ${pick(listed.text, /Recalled|qa154/)}\n        ob_end: ${pick(endA.text, /Recalled ids|Feedback/)}\n        feedback_log: ${JSON.stringify(fA)}`);

  // /clear: A's proof removed, B's written; the SAME server process. B recalls id2 only, then rates both.
  PS.removeProcessSession(DIR, ME, A); prove(Bz);
  await call("ob_recall", { queries: ["orchard keeper frost log"], trigger: "explicit" });
  const endB = await call("ob_end", { project_root: PROJ, entry_ratings: { [id1]: "harmful", [id2]: "neutral" }, session_summary: "qa154 d3 B" });
  const fB = fb().slice(fA.length);
  verdict("B2 after /clear the same server's ob_end resolves the NEW session's recalls: id2 rated under B; id1 (A's recall) not rated",
    fB.length === 1 && fB[0].s === Bz && fB[0].k === id2 && /Recalled ids: 1 from recall-log/.test(endB.text),
    `ob_end: ${pick(endB.text, /Recalled ids|Feedback/)}\n        new feedback_log rows: ${JSON.stringify(fB)}`);

  const endNamed = await call("ob_end", { project_root: PROJ, session_id: Bz, entry_ratings: { [id2]: "helpful" }, session_summary: "qa154 d3 named", dry_run: true });
  console.log(`INFO    B3 control: ob_end naming the proven id gives the same resolution: ${pick(endNamed.text, /Recalled ids|Feedback/)}`);

  rmSync(DIR, { recursive: true, force: true });
  const before = fb().length;
  const endNone = await call("ob_end", { project_root: PROJ, entry_ratings: { [id2]: "helpful" }, session_summary: "qa154 d3 none" });
  verdict("B4 no proof: ob_end (end.md's call) writes no feedback_log row and does not error", !endNone.err && fb().length === before,
    `ob_end: ${pick(endNone.text, /Recalled ids|Feedback|refused|error/)}`);

  const fbNone = await call("ob_feedback", { id: id1, rating: "neutral" });
  verdict("B5 (D4) no proof: ob_feedback says NOT LOGGED with the reason, and writes no row", /NOT LOGGED: this server cannot prove its session — \S/.test(fbNone.text) && fb().length === before, pick(fbNone.text, /NOT LOGGED|Feedback recorded/));

  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, `${ME}.json`), "null");
  const rec2 = await call("ob_recall", { queries: ["harbour pilot tide table"], trigger: "explicit" });
  const st2 = await call("ob_state", { project_root: PROJ, session: 1, expected_revision: 0, ops: [] });
  const fb2 = await call("ob_feedback", { id: id1, rating: "neutral" });
  verdict("B6 (D2) a JSON null proof: ob_recall returns results with a named NOT LOGGED, and no 'FTS search error'",
    !rec2.err && rec2.text.includes("qa154-d3-one") && /not a session record/.test(rec2.text) && !/FTS search error/.test(rec2.text), pick(rec2.text, /NOT LOGGED|FTS/));
  verdict("B7 (D2/D4) a JSON null proof: ob_feedback names it", /NOT LOGGED: .*not a session record/.test(fb2.text), pick(fb2.text, /NOT LOGGED/));
  console.log(`INFO    B8 a JSON null proof, ob_state on a project with no record: ${st2.err ? "error: " : ""}${st2.text.split("\n")[0].slice(0, 200)}`);
  rmSync(DIR, { recursive: true, force: true });
  await c.close();
}

// ---------- C: D5, the real hook binary ----------
{
  const PROJ = join(S, "d-hook-proj"); rmSync(PROJ, { recursive: true, force: true }); mkdirSync(join(PROJ, ".agents"), { recursive: true });
  const ID = "c0c0c0c0-0000-4000-8000-00000000c0c0";
  const run = (label, flags, payloadExtra, envExtra) => {
    rmSync(DIR, { recursive: true, force: true });
    let out;
    try {
      out = execFileSync("node", [join(CAND, "open-brain/build/cli-bootstrap.js"), ...flags], {
        cwd: PROJ, env: { ...process.env, ...ENV, CLAUDE_PID: String(process.pid), ...envExtra },
        input: JSON.stringify({ cwd: PROJ, session_id: ID, hook_event_name: "SessionStart", source: "startup", ...payloadExtra }),
        encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 120_000,
      });
    } catch (e) { out = `EXIT ${e.status} ${e.stdout || ""}`; }
    const files = existsSync(DIR) ? readdirSync(DIR) : [];
    return { line: pick(out, /Session proof/), files };
  };
  const c1 = run("c1", ["--ide", "cursor"], {}, {});
  verdict("C1 --ide cursor, inherited CLAUDE_PID, no cursor_version: NO Claude proof", c1.files.length === 0 && /NOT written: this host is not Claude Code/.test(c1.line), `${c1.line} ; files: ${c1.files.join(",") || "none"}`);
  const c2 = run("c2", ["--ide", "Cursor"], {}, {});
  verdict("C2 --ide Cursor (capitalised): NO Claude proof", c2.files.length === 0, `${c2.line} ; files: ${c2.files.join(",") || "none"}`);
  const c3 = run("c3", [], { cursor_version: "1.0" }, {});
  verdict("C3 no flag, payload cursor_version: NO proof (payload wins)", c3.files.length === 0, `${c3.line} ; files: ${c3.files.join(",") || "none"}`);
  const c4 = run("c4", ["--ide", "claude"], { cursor_version: "1.0" }, {});
  verdict("C4 --ide claude but payload cursor_version: NO proof (payload wins over the flag)", c4.files.length === 0, `${c4.line} ; files: ${c4.files.join(",") || "none"}`);
  const c5 = run("c5", [], {}, { OPEN_BRAIN_IDE: "cursor" });
  console.log(`INFO    C5 no flag, OPEN_BRAIN_IDE=cursor, no cursor_version: ${c5.line} ; files: ${c5.files.join(",") || "none"}`);
  const c6 = run("c6", [], {}, {});
  verdict("C6 control: no flag, OPEN_BRAIN_IDE=claude, no cursor_version: the Claude proof IS written", c6.files.length === 1 && /Session proof written/.test(c6.line), `${c6.line} ; files: ${c6.files.join(",") || "none"}`);
  rmSync(DIR, { recursive: true, force: true });
}

console.log(`\n${fails} BROKEN`);
process.exit(0);
