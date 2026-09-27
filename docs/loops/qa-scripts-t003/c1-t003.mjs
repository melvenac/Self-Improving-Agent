// QA 142 check 1 + check 2: QA 125's A7/A8/A9 shapes, and attacks on the T-003 proof, run against a BUILD.
// Every write goes to a scratch clone and scratch stores (override env vars + scratch HOME/USERPROFILE).
// usage: node c1-t003.mjs <build-root> <scratch-dir> <label>
// <build-root> is a checkout whose open-brain/build is the code under test (candidate, base, or a mutant).
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S, LABEL = "?"] = process.argv.slice(2);
const ROOT = join(S, "c1-proj");
const STORE = join(S, "c1-store");
const HOMEDIR = join(S, "home");
process.env.KNOWLEDGE_V2_DB = join(STORE, "k.db");
process.env.OPEN_BRAIN_ACTIVE_SESSION = join(STORE, "active-session.json");
process.env.OPEN_BRAIN_VAULT_DIR = join(STORE, "vault");
process.env.OPEN_BRAIN_SCORE_HISTORY = join(STORE, "score.jsonl");
process.env.OPEN_BRAIN_SHADOW_LOG = join(STORE, "shadow.jsonl");
process.env.OPEN_BRAIN_IDE = "claude";
process.env.HOME = HOMEDIR;
process.env.USERPROFILE = HOMEDIR;
mkdirSync(HOMEDIR, { recursive: true });

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ID = ["-c", "user.name=qa142", "-c", "user.email=qa142@x"];
if (!existsSync(ROOT)) {
  git(S, "clone", "-q", "--shared", CAND, ROOT);
  git(ROOT, "checkout", "-q", "--detach", "706c029");
  writeFileSync(join(ROOT, ".agents/state.json"), readFileSync(join(S, "live-rev132.json")));
  execFileSync("node", [join(CAND, "open-brain/build/cli.js"), "state", "migrate", ".agents/state.json"], { cwd: ROOT, stdio: "ignore" });
  git(ROOT, ...ID, "commit", "-qam", "scratch: rev 132 migrated to v3");
}
rmSync(STORE, { recursive: true, force: true }); // a fresh store per run: ob_store_chunk keys are unique
mkdirSync(STORE, { recursive: true });
const imp = (p) => import(pathToFileURL(join(CAND, "open-brain/build", p)).href);
const W = await imp("shared/state-writer.js");
const AS = await imp("shared/active-session.js");
const P = await imp("shared/paths.js");
let PS = null;
try { PS = await imp("shared/process-session.js"); } catch { /* the base has no proof module */ }
let nth = 0;
const freshServer = async (tag) => import(pathToFileURL(join(CAND, "open-brain/build/server.js")).href + `?${tag}-${++nth}`);

const DIR = PS ? PS.byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION) : join(STORE, "by-pid");
const PPID = process.ppid;
const startOf = (pid) => (PS ? PS.processStartTime(pid) : null);
const MYSTART = startOf(PPID);
const prove = (id, over = {}) => {
  mkdirSync(DIR, { recursive: true });
  const proof = { session_id: id, claude_pid: PPID, proc_start: MYSTART, ide: "claude", written_at: new Date().toISOString(), ...over };
  const pid = over.file_pid ?? PPID; delete proof.file_pid;
  writeFileSync(join(DIR, `${pid}.json`), JSON.stringify(proof, null, 2) + "\n");
};
const unprove = () => rmSync(DIR, { recursive: true, force: true });

const reset = () => { git(ROOT, "checkout", "-q", "--", ".agents"); git(ROOT, "clean", "-fdq", ".agents"); rmSync(process.env.OPEN_BRAIN_ACTIVE_SESSION, { force: true }); unprove(); };
const rec = () => JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const H = (seat, text) => ({ op: "set_handoff", seat, pick_up: text, watch_out: [], open_questions: [], ...(seat === "planner" ? { loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } } : {}) });
const txt = (r) => r.content[0].text.split("\n").filter(Boolean).slice(0, 3).join(" / ").slice(0, 300);
const slot = (uuid) => AS.writeActiveSession(process.env.OPEN_BRAIN_ACTIVE_SESSION, AS.activeSessionKey(P.canonicalizeProjectDir(ROOT) || ROOT, "claude"), { uuid, project_dir: ROOT, source: "session_id", started_at: new Date().toISOString(), ide: "claude" });
const byUuid = (u) => rec().handoffs.find((h) => h.session_uuid === u);
let fails = 0;
const verdict = (name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "HOLDS " : "BROKEN"}  ${name}${detail ? "\n        " + detail : ""}`); };
console.log(`# c1-t003 on ${LABEL}; server parent (this node's ppid) ${PPID}, start ${MYSTART}; proof module ${PS ? "present" : "ABSENT"}`);
process.chdir(ROOT);

// ---- Check 1: QA 125's A7, A8, A9, same checkout ----
// A7: session 700 writes; a DIFFERENT session (its own proof: 701) registers as 700 and writes.
reset();
{
  prove(U(700));
  const srv = await freshServer("a7");
  await srv.handleSetSession({ session_id: U(700), project_dir: ROOT });
  await srv.handleState({ project_root: ROOT, session: 700, expected_revision: rec().revision, ops: [H("developer", "victim session 700's handoff")] });
  prove(U(701)); // the attacker's own session in this claude process (e.g. after /clear)
  const s = await srv.handleSetSession({ session_id: U(700), project_dir: ROOT });
  const r = await srv.handleState({ project_root: ROOT, session: 701, expected_revision: rec().revision, ops: [H("developer", "attacker overwrote it")] });
  const v = byUuid(U(700));
  verdict("A7 ob_set_session(victim uuid) is refused and set_handoff cannot replace the victim's handoff",
    v?.pick_up.startsWith("victim") && !!s.isError && byUuid(U(701))?.pick_up === "attacker overwrote it",
    `set_session: ${txt(s)}\n        state: ${txt(r)}\n        victim: "${v?.pick_up}"; 701's: "${byUuid(U(701))?.pick_up}"`);
  // A7b the attacker has NO proof at all and names the victim
  unprove();
  const s2 = await srv.handleSetSession({ session_id: U(700), project_dir: ROOT });
  const r2 = await srv.handleState({ project_root: ROOT, session: 702, expected_revision: rec().revision, ops: [H("developer", "attacker, no proof")] });
  verdict("A7b with no proof, ob_set_session(victim) is refused and set_handoff refuses", !!s2.isError && !!r2.isError && byUuid(U(700))?.pick_up.startsWith("victim"),
    `set_session: ${txt(s2)}\n        state: ${txt(r2)}`);
}

// A8: B started second (slot = B), B wrote. A's server reconnected (fresh module), never re-registered.
reset();
{
  slot(U(801));
  W.applyStateOps(ROOT, { session: 801, expected_revision: rec().revision, session_uuid: U(801), checkout: "c1-proj", ops: [H("qa", "session B's handoff")] });
  prove(U(800)); // A's claude wrote A's proof
  const fresh = await freshServer("a8");
  const r = await fresh.handleState({ project_root: ROOT, session: 800, expected_revision: rec().revision, ops: [H("qa", "session A's handoff after a reconnect")] });
  verdict("A8 a reconnected server lands A's write under A, not the slot's B", byUuid(U(801))?.pick_up === "session B's handoff" && byUuid(U(800))?.pick_up.startsWith("session A"),
    `${txt(r)}\n        B: "${byUuid(U(801))?.pick_up}"  A: "${byUuid(U(800))?.pick_up}"`);
  unprove();
  const fresh2 = await freshServer("a8b");
  const r2 = await fresh2.handleState({ project_root: ROOT, session: 800, expected_revision: rec().revision, ops: [H("qa", "A again, no proof")] });
  verdict("A8b no proof + a fresh slot naming B: set_handoff refuses, slot never adopted", !!r2.isError && byUuid(U(801))?.pick_up === "session B's handoff", txt(r2));
}

// A9: /clear. The server survives. SessionEnd(901) removes 901's proof; SessionStart writes 902's.
reset();
{
  const srv = await freshServer("a9");
  prove(U(901));
  await srv.handleSetSession({ session_id: U(901), project_dir: ROOT });
  await srv.handleState({ project_root: ROOT, session: 901, expected_revision: rec().revision, ops: [H("qa", "session 901's handoff, before /clear")] });
  if (PS) PS.removeProcessSession(DIR, PPID, U(901));
  prove(U(902)); slot(U(902));
  const r = await srv.handleState({ project_root: ROOT, session: 902, expected_revision: rec().revision, ops: [H("qa", "session 902's handoff, after /clear, no /start")] });
  verdict("A9 after /clear the new session's write goes under 902 and 901's handoff is intact",
    byUuid(U(901))?.pick_up.startsWith("session 901") && byUuid(U(902))?.pick_up.startsWith("session 902"), `${txt(r)}\n        901: "${byUuid(U(901))?.pick_up}"`);
  // A9b /clear with a FAILED SessionStart: SessionEnd removed 902's, nothing new.
  if (PS) PS.removeProcessSession(DIR, PPID, U(902)); else unprove();
  const r2 = await srv.handleState({ project_root: ROOT, session: 903, expected_revision: rec().revision, ops: [H("qa", "after a failed SessionStart")] });
  verdict("A9b /clear + failed SessionStart: the write refuses rather than landing under 902", !!r2.isError && byUuid(U(902))?.pick_up.startsWith("session 902"), txt(r2));
}

// ---- Check 2: attack the proof ----
// P1 a proof forged for ANOTHER claude pid (a live process), naming the attacker; our own proof names SELF.
reset();
{
  const other = spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 300));
  prove(U(1001));
  prove(U(1666), { claude_pid: other.pid, proc_start: startOf(other.pid), file_pid: other.pid });
  const srv = await freshServer("p1");
  const r = await srv.handleState({ project_root: ROOT, session: 1001, expected_revision: rec().revision, ops: [H("qa", "P1 self")] });
  verdict("P1 a proof forged under another live pid is ignored: the write is SELF's", byUuid(U(1001))?.pick_up === "P1 self" && !byUuid(U(1666)), txt(r));
  // P1b our own file, but its claude_pid field names the other process
  prove(U(1666), { claude_pid: other.pid, proc_start: startOf(other.pid) });
  const r2 = await srv.handleState({ project_root: ROOT, session: 1002, expected_revision: rec().revision, ops: [H("qa", "P1b")] });
  verdict("P1b our pid's file carrying another pid's claude_pid/proc_start: refuses", !!r2.isError && !byUuid(U(1666)), txt(r2));
  other.kill();
}
// P2 stale file after a failed SessionStart, with SessionEnd ALSO failed: the stated limit (both hooks fail).
reset();
{
  const srv = await freshServer("p2");
  prove(U(1101));
  await srv.handleState({ project_root: ROOT, session: 1101, expected_revision: rec().revision, ops: [H("qa", "1101 before /clear")] });
  // neither hook ran: the file still names 1101; the next session (1102) writes
  const r = await srv.handleState({ project_root: ROOT, session: 1102, expected_revision: rec().revision, ops: [H("qa", "1102 after /clear, both hooks failed")] });
  console.log(`LIMIT   P2 both hooks failed across /clear: the next session's write lands under ${byUuid(U(1101))?.pick_up.startsWith("1102") ? "1101 (STALE ADOPTION, the stated limit 1)" : "?"}\n        ${txt(r)}`);
}
// P3 PID reuse: matching pid, different start time.
reset();
{
  prove(U(1201), { proc_start: MYSTART ? MYSTART.replace(/\d$/, (d) => String((+d + 1) % 10)) : "win:1" });
  const srv = await freshServer("p3");
  const r = await srv.handleState({ project_root: ROOT, session: 1201, expected_revision: rec().revision, ops: [H("qa", "P3 reused")] });
  verdict("P3 a proof whose start time differs from the parent's (reused pid) refuses", !!r.isError && !byUuid(U(1201)), txt(r));
  // P3b the proof has no proc_start at all
  prove(U(1202), { proc_start: undefined });
  const r2 = await (await freshServer("p3b")).handleState({ project_root: ROOT, session: 1202, expected_revision: rec().revision, ops: [H("qa", "P3b")] });
  verdict("P3b a proof with no proc_start refuses", !!r2.isError && !byUuid(U(1202)), txt(r2));
  // P3c non-record JSON shapes
  for (const [name, body] of [["array", "[]"], ["null", "null"], ["string", '"x"'], ["number session_id", JSON.stringify({ session_id: 5, claude_pid: PPID, proc_start: MYSTART })], ["claude_pid as string", JSON.stringify({ session_id: U(1203), claude_pid: String(PPID), proc_start: MYSTART })]]) {
    mkdirSync(DIR, { recursive: true }); writeFileSync(join(DIR, `${PPID}.json`), body);
    let r3; try { r3 = await (await freshServer("p3c")).handleState({ project_root: ROOT, session: 1203, expected_revision: rec().revision, ops: [H("qa", "P3c " + name)] }); } catch (e) { r3 = { isError: true, content: [{ text: "THREW " + e.message }] }; }
    verdict(`P3c proof body ${name}: refuses without throwing`, !!r3.isError && !/THREW/.test(r3.content[0].text) && !rec().handoffs.some((h) => h.pick_up === "P3c " + name), txt(r3));
  }
}
// P4 nested: CLAUDE_PID in the server's env names ANOTHER live process that has a valid ATTACKER proof.
reset();
{
  const other = spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 300));
  prove(U(1301));
  prove(U(1666), { claude_pid: other.pid, proc_start: startOf(other.pid), file_pid: other.pid });
  const saved = process.env.CLAUDE_PID; process.env.CLAUDE_PID = String(other.pid);
  const srv = await freshServer("p4");
  const r = await srv.handleState({ project_root: ROOT, session: 1301, expected_revision: rec().revision, ops: [H("qa", "P4 nested")] });
  const st = await srv.handleSetSession({ project_dir: ROOT });
  if (saved === undefined) delete process.env.CLAUDE_PID; else process.env.CLAUDE_PID = saved;
  verdict("P4 nested: CLAUDE_PID names another claude with a valid proof; the server still uses its own parent", byUuid(U(1301))?.pick_up === "P4 nested" && !byUuid(U(1666)) && st.content[0].text.includes(U(1301)),
    `${txt(r)}\n        set_session: ${txt(st)}`);
  other.kill();
}
// P5 ob_set_session with an id that differs from the proof; ob_end and ob_store_chunk too.
reset();
{
  prove(U(1401));
  const srv = await freshServer("p5");
  const a = await srv.handleSetSession({ session_id: U(1499), project_dir: ROOT });
  const b = await srv.handleSetSession({ session_id: U(1401).toUpperCase(), project_dir: ROOT });
  const c = await srv.handleSetSession({ session_id: ` ${U(1401)} `, project_dir: ROOT });
  const d = await srv.handleSetSession({ session_id: U(1401), project_dir: ROOT });
  const e = await srv.handleSetSession({ session_id: "none", project_dir: ROOT });
  verdict("P5 ob_set_session(different id) refused naming both", !!a.isError && a.content[0].text.includes(U(1499)) && a.content[0].text.includes(U(1401)), txt(a));
  console.log(`INFO    P5 upper-case spelling of the proven id: ${b.isError ? "refused" : "accepted"}; padded: ${c.isError ? "refused" : "accepted"}; exact: ${d.isError ? "refused" : "accepted"}; "none": ${e.isError ? "refused" : "accepted"} (${txt(e)})`);
  const end = srv.handleEnd ? await srv.handleEnd({ project_root: ROOT, session_id: U(1499), dry_run: true }) : null;
  verdict("P5 ob_end(foreign id) refused", end && !!end.isError, end ? txt(end) : "no handleEnd export");
  if (srv.handleStoreChunk) {
    const ch = await srv.handleStoreChunk({ content: "x", key: "qa142-p5", session_id: U(1499) });
    const ch2 = await srv.handleStoreChunk({ content: "y", key: "qa142-p5b" });
    verdict("P5 ob_store_chunk(foreign id) refused; unnamed links the proven id", !!ch.isError && ch2.content[0].text.includes(`Session: ${U(1401)}`), `${txt(ch)}\n        unnamed: ${txt(ch2)}`);
  } else verdict("P5 ob_store_chunk(foreign id) refused", false, "no handleStoreChunk export (red by absence)");
}
// P6 two servers under one claude (two module instances, one parent): both prove the same session, the right one.
reset();
{
  prove(U(1501));
  const s1 = await freshServer("p6a"), s2 = await freshServer("p6b");
  const x = await s1.handleSetSession({ project_dir: ROOT }), y = await s2.handleSetSession({ project_dir: ROOT });
  verdict("P6 two servers under one claude both prove that claude's session", x.content[0].text.includes(U(1501)) && y.content[0].text.includes(U(1501)), `${txt(x)} || ${txt(y)}`);
  prove(U(1502)); // /clear
  const x2 = await s1.handleSetSession({ project_dir: ROOT }), y2 = await s2.handleSetSession({ project_dir: ROOT });
  verdict("P6b after /clear both servers move to the new session with no re-registration", x2.content[0].text.includes(U(1502)) && y2.content[0].text.includes(U(1502)), `${txt(x2)} || ${txt(y2)}`);
}
// P7 ob_start with NO proof: what session does it stamp? (a transcript in the scratch home names ANOTHER session)
reset();
{
  const key = ROOT.replace(/[:\\/]/g, "-");
  const pdir = join(HOMEDIR, ".claude", "projects", key);
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, `${U(1666)}.jsonl`), "{}\n");
  mkdirSync(join(ROOT, ".agents", "SESSIONS"), { recursive: true });
  const srv = await freshServer("p7");
  const r = srv.handleStart ? await srv.handleStart({ project_root: ROOT }) : null;
  const logs = existsSync(join(ROOT, ".agents", "SESSIONS")) ? readdirSync(join(ROOT, ".agents", "SESSIONS")) : [];
  const stamped = logs.map((f) => readFileSync(join(ROOT, ".agents", "SESSIONS", f), "utf8")).join("\n");
  const sidLine = r ? (r.content[0].text.split("\n").find((l) => l.includes("Session ID")) ?? "(no Session ID line)") : "no handleStart export";
  verdict("P7 ob_start with no proof does not stamp an unproven id (here: the newest transcript's, another session)", !stamped.includes(U(1666)) && !sidLine.includes(U(1666)),
    `${sidLine.trim()}\n        session logs written: ${logs.join(", ") || "none"}; contain the other session's id: ${stamped.includes(U(1666))}`);
  rmSync(join(HOMEDIR, ".claude", "projects"), { recursive: true, force: true });
}
console.log(`\n${fails} BROKEN`);
process.exit(0);
