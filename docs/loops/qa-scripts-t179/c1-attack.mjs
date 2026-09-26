// QA 125 check 1: try to erase another session's record, as an attacker (or a confused seat) would.
// Runs against the CANDIDATE's build, on a scratch clone whose record is this repository's rev 132, migrated to v3.
// Every write goes to the scratch clone. usage: node c1-attack.mjs <cand-root> <scratch-dir>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S] = process.argv.slice(2);
const ROOT = join(S, "c1-proj");
const STORE = join(S, "c1-store");
process.env.KNOWLEDGE_V2_DB = join(STORE, "k.db");
process.env.OPEN_BRAIN_ACTIVE_SESSION = join(STORE, "active-session.json");
process.env.OPEN_BRAIN_VAULT_DIR = join(STORE, "vault");
process.env.OPEN_BRAIN_SCORE_HISTORY = join(STORE, "score.jsonl");
process.env.OPEN_BRAIN_SHADOW_LOG = join(STORE, "shadow.jsonl");
process.env.OPEN_BRAIN_IDE = "claude";

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ID = ["-c", "user.name=qa125", "-c", "user.email=qa125@x"];
if (!existsSync(ROOT)) {
  git(S, "clone", "-q", "--shared", CAND, ROOT);
  git(ROOT, "checkout", "-q", "--detach", "3c0bfdc");
  writeFileSync(join(ROOT, ".agents/state.json"), readFileSync(join(S, "live-rev132.json")));
  execFileSync("node", [join(CAND, "open-brain/build/cli.js"), "state", "migrate", ".agents/state.json"], { cwd: ROOT, stdio: "ignore" });
  git(ROOT, ...ID, "commit", "-qam", "scratch: rev 132 migrated to v3");
}
mkdirSync(STORE, { recursive: true });
const imp = (p) => import(pathToFileURL(join(CAND, "open-brain/build", p)).href);
const W = await imp("shared/state-writer.js");
const SV = await imp("server.js");
const AS = await imp("shared/active-session.js");
const P = await imp("shared/paths.js");

const reset = () => { git(ROOT, "checkout", "-q", "--", ".agents"); git(ROOT, "clean", "-fdq", ".agents"); rmSync(process.env.OPEN_BRAIN_ACTIVE_SESSION, { force: true }); };
const rec = () => JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const H = (seat, text) => ({ op: "set_handoff", seat, pick_up: text, watch_out: [], open_questions: [], ...(seat === "planner" ? { loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } } : {}) });
const write = (o) => W.applyStateOps(ROOT, { expected_revision: rec().revision, render: true, ...o });
const hs = () => rec().handoffs.map((h) => `${h.seat}@${h.session}[${h.checkout ?? "legacy"}]${h.session_uuid ? ":" + h.session_uuid.slice(0, 8) : ""}="${h.pick_up.slice(0, 24)}"`).join(" | ");
const ss = () => rec().sessions.map((x) => `${x.n}:${x.uuid ? x.uuid.slice(0, 8) : "null"}:${x.seat}:${x.checkout ?? "legacy"}`).join(" | ");
let fails = 0;
const verdict = (name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "HOLDS" : "BROKEN"}  ${name}${detail ? "\n        " + detail : ""}`); };
const show = (r) => (r.ok ? `ok rev ${r.revision_before}->${r.revision_after}${r.superseded.length ? " superseded=" + r.superseded.join(";") : ""}${r.notes.filter((n) => !n.startsWith("retention KEPT")).map((n) => " NOTE " + n.slice(0, 120)).join("")}` : `REFUSED: ${r.error}`);

// A1: the writing session's uuid is not an op argument (nor is checkout, nor any alias).
reset();
for (const extra of [{ session_uuid: U(1) }, { uuid: U(1) }, { checkout: "sia-infra" }, { session: 5 }, { sessionUuid: U(1) }]) {
  const r = write({ session: 200, session_uuid: U(2), checkout: "sia-qa", ops: [{ ...H("qa", "attacker"), ...extra }] });
  verdict(`A1 set_handoff carrying ${Object.keys(extra)[0]} is refused`, !r.ok, show(r));
}

// A2: two sessions of the same seat in the same checkout, 5 sessions apart and 11 apart.
for (const gap of [5, 10, 11]) {
  reset();
  const a = write({ session: 200, session_uuid: U(200), checkout: "sia-builder", ops: [H("developer", "first dev session")] });
  const b = write({ session: 200 + gap, session_uuid: U(201), checkout: "sia-builder", ops: [H("developer", "second dev session")] });
  const firstKept = rec().handoffs.some((h) => h.session_uuid === U(200));
  const legacyKept = rec().handoffs.some((h) => h.session_uuid === null && h.seat === "developer");
  const expectKept = gap <= 10;
  verdict(`A2 same seat+checkout, ${gap} sessions apart: first ${expectKept ? "survives" : "leaves by retention (ruled)"}; legacy developer@74 survives`,
    firstKept === expectKept && legacyKept, `a: ${show(a)}\n        b: ${show(b)}\n        handoffs: ${hs()}`);
}

// A3: no registered session.
reset();
{
  const r1 = write({ session: 300, session_uuid: null, ops: [H("qa", "anon")] });
  verdict("A3 set_handoff with no registered session refuses", !r1.ok, show(r1));
  const before = JSON.stringify(rec().handoffs) + JSON.stringify(rec().sessions);
  const r2 = write({ session: 9999, session_uuid: null, ops: [{ op: "add_gap", what: "anon gap", evidence: "x", recommended_update: "y" }] });
  const after = JSON.stringify(rec().handoffs) + JSON.stringify(rec().sessions);
  verdict("A3 an unattributed write (session 9999) leaves handoffs[] and sessions[] untouched", r2.ok && before === after, show(r2));
}

// A4: delete / update ops aimed at another uuid's entry.
reset();
write({ session: 200, session_uuid: U(200), checkout: "sia-builder", ops: [H("developer", "victim")] });
for (const op of [
  { op: "delete_handoff", session_uuid: U(200) }, { op: "remove_handoff", seat: "developer" }, { op: "update_handoff", session_uuid: U(200), pick_up: "x" },
  { op: "clear_handoffs" }, { op: "delete_session", uuid: U(200) }, { op: "end_session", n: 201, date: "2026-09-26", uuid: U(201) },
  { op: "set_handoff", seat: "developer", pick_up: "x", watch_out: [], open_questions: [], session_uuid: U(200) },
]) {
  const r = write({ session: 201, session_uuid: U(201), checkout: "sia-builder", ops: [op] });
  const victim = rec().handoffs.find((h) => h.session_uuid === U(200));
  verdict(`A4 ${op.op}${op.session_uuid ? " naming the victim's uuid" : ""} cannot touch the victim`, !r.ok && victim?.pick_up === "victim", show(r));
}

// A5: retention never drops the newest per (seat, checkout), however old; nor another checkout's; nor a legacy entry.
reset();
{
  write({ session: 110, session_uuid: U(110), checkout: "sia-infra", ops: [H("developer", "infra dev, old, only one")] });
  write({ session: 111, session_uuid: U(111), checkout: "sia-builder", ops: [H("developer", "builder dev old")] });
  write({ session: 115, session_uuid: U(115), checkout: "sia-builder", ops: [H("developer", "builder dev newer")] });
  const r = write({ session: 500, session_uuid: U(500), checkout: "sia-qa", ops: [H("qa", "far future qa")] });
  const has = (u) => rec().handoffs.some((h) => h.session_uuid === u);
  verdict("A5 newest per (seat,checkout) never dropped: infra@110 and builder@115 kept at newest 500; builder@111 dropped (ruled)",
    has(U(110)) && has(U(115)) && !has(U(111)) && rec().handoffs.filter((h) => h.session_uuid === null).length === 3, `${show(r)}\n        handoffs: ${hs()}`);
}

// A6: a WRONG session number. The number is caller-supplied for a session the record has not seen, and is not checked.
// (T-164: a seat's greeting number is local, e.g. Forge 124 greeted as 6.) Inflated: 1124 instead of 124.
reset();
{
  write({ session: 118, session_uuid: U(118), checkout: "sia-builder", ops: [H("developer", "Forge 118 handoff")] });
  write({ session: 120, session_uuid: U(120), checkout: "sia-qa", ops: [H("qa", "QA 120 handoff")] });
  write({ session: 121, session_uuid: U(121), checkout: "sia-qa", ops: [H("qa", "QA 121 handoff")] });
  const r = write({ session: 1124, session_uuid: U(124), checkout: "sia-builder", ops: [H("developer", "Forge 124, typo 1124")] });
  const gone = [U(118), U(120)].filter((u) => !rec().handoffs.some((h) => h.session_uuid === u));
  verdict("A6 one session's mistyped number (1124) removes no OTHER session's handoff", gone.length === 0,
    `${show(r)}\n        removed: ${gone.map((u) => u.slice(0, 8)).join(", ") || "none"}\n        handoffs: ${hs()}\n        sessions: ${ss()}`);
  const fix = write({ session: 124, session_uuid: U(124), checkout: "sia-builder", ops: [H("developer", "Forge 124 corrected")] });
  verdict("A6b the session can correct its number afterwards", rec().sessions.find((x) => x.uuid === U(124))?.n === 124, show(fix));
}
// A6c: deflated (the local greeting number, 6): the session's OWN new handoff is superseded in the write that makes it.
reset();
{
  write({ session: 118, session_uuid: U(118), checkout: "sia-builder", ops: [H("developer", "Forge 118 handoff")] });
  write({ session: 124, session_uuid: U(124), checkout: "sia-infra", ops: [H("developer", "infra 124")] });
  const r = write({ session: 6, session_uuid: U(6), checkout: "sia-builder", ops: [H("developer", "Forge, local number 6")] });
  const own = rec().handoffs.some((h) => h.session_uuid === U(6));
  verdict("A6c a session that passes its local greeting number (6) keeps its own new handoff", own, `${show(r)}\n        handoffs: ${hs()}`);
}

// A7: impersonation through ob_set_session: the uuid is not an op argument, but it IS a tool argument, and it is not checked.
reset();
{
  process.chdir(ROOT);
  await SV.handleSetSession({ session_id: U(700), project_dir: ROOT });
  let r = await SV.handleState({ project_root: ROOT, session: 700, expected_revision: rec().revision, ops: [H("developer", "victim session 700's handoff")] });
  const victimUuid = rec().handoffs.find((h) => h.pick_up.startsWith("victim"))?.session_uuid;
  // A different session reads the victim's uuid off the record (it is rendered nowhere, but it is in state.json) and registers as it.
  await SV.handleSetSession({ session_id: victimUuid, project_dir: ROOT });
  r = await SV.handleState({ project_root: ROOT, session: 701, expected_revision: rec().revision, ops: [H("developer", "attacker overwrote it")] });
  const victim = rec().handoffs.find((h) => h.session_uuid === victimUuid);
  verdict("A7 ob_set_session(victim uuid) + set_handoff cannot replace the victim's handoff", victim?.pick_up.startsWith("victim"),
    `${r.content[0].text.split("\n").slice(0, 3).join(" / ")}\n        victim entry now: "${victim?.pick_up}" session ${victim?.session}`);
}

// A8: T-003 x T-163. Two sessions in ONE checkout share the hook's slot (<project>::<ide>). A server whose in-memory
// registration is gone (a reconnect) self-registers from the slot, which now holds the OTHER session's uuid.
reset();
{
  const slotPath = process.env.OPEN_BRAIN_ACTIVE_SESSION;
  const key = AS.activeSessionKey(P.canonicalizeProjectDir(ROOT) || ROOT, "claude");
  const now = new Date().toISOString();
  // Session B started second in this checkout; its SessionStart hook wrote the slot.
  AS.writeActiveSession(slotPath, key, { uuid: U(801), project_dir: ROOT, source: "session_id", started_at: now, ide: "claude" });
  // Session B, in its own server, writes its handoff.
  W.applyStateOps(ROOT, { session: 801, expected_revision: rec().revision, session_uuid: U(801), checkout: "c1-proj", ops: [H("qa", "session B's handoff")] });
  // Session A's server was reconnected (fresh module state = a new process). It never called ob_set_session again.
  const fresh = await import(pathToFileURL(join(CAND, "open-brain/build/server.js")).href + "?reconnected");
  process.chdir(ROOT);
  const r = await fresh.handleState({ project_root: ROOT, session: 800, expected_revision: rec().revision, ops: [H("qa", "session A's handoff after a reconnect")] });
  const b = rec().handoffs.find((h) => h.session_uuid === U(801));
  verdict("A8 a reconnected server in the same checkout cannot overwrite the other session's handoff (T-003's slot)", b?.pick_up === "session B's handoff",
    `${r.content[0].text.split("\n").slice(0, 2).join(" / ")}\n        B's entry now: "${b?.pick_up}" (session ${b?.session})\n        handoffs: ${hs()}`);
}

// A9: /clear inside one Claude process: the MCP server survives, keeps the OLD registration, and the new session writes
// under it before it runs /start (which is what calls ob_set_session).
reset();
{
  process.chdir(ROOT);
  const srv = await import(pathToFileURL(join(CAND, "open-brain/build/server.js")).href + "?clear");
  await srv.handleSetSession({ session_id: U(901), project_dir: ROOT });
  await srv.handleState({ project_root: ROOT, session: 901, expected_revision: rec().revision, ops: [H("qa", "session 901's handoff, before /clear")] });
  // /clear: SessionEnd, then SessionStart writes the NEW uuid to the slot. The server process and its _activeSessionId remain.
  AS.writeActiveSession(process.env.OPEN_BRAIN_ACTIVE_SESSION, AS.activeSessionKey(P.canonicalizeProjectDir(ROOT) || ROOT, "claude"), { uuid: U(902), project_dir: ROOT, source: "session_id", started_at: new Date().toISOString(), ide: "claude" });
  const r = await srv.handleState({ project_root: ROOT, session: 902, expected_revision: rec().revision, ops: [H("qa", "session 902's handoff, after /clear, no /start")] });
  const old = rec().handoffs.find((h) => h.session_uuid === U(901));
  verdict("A9 after /clear, the new session's write does not replace the previous session's handoff", old?.pick_up.startsWith("session 901"),
    `${r.content[0].text.split("\n").slice(0, 2).join(" / ")}\n        901's entry now: "${old?.pick_up}" (session ${old?.session})`);
}

// A10: seat is an op argument. A qa session labels its handoff "developer" in a developer's checkout, with a number >10 ahead.
reset();
{
  write({ session: 118, session_uuid: U(118), checkout: "sia-builder", ops: [H("developer", "Forge 118 handoff")] });
  write({ session: 119, session_uuid: U(119), checkout: "sia-builder", ops: [H("developer", "Forge 119 handoff")] });
  const r = write({ session: 130, session_uuid: U(130), checkout: "sia-builder", seat: "qa", ops: [H("developer", "a qa session calling itself developer")] });
  const gone = !rec().handoffs.some((h) => h.session_uuid === U(118));
  verdict("A10 a session cannot supersede another seat's entries by naming that seat (seat is not checked against the checkout)", !gone,
    `${show(r)}\n        handoffs: ${hs()}`);
}

// A11: the STATE-class and note paths: one session's op replacing or removing what another session wrote.
reset();
{
  write({ session: 200, session_uuid: U(200), checkout: "sia-builder", ops: [
    { op: "open_task", id: "T-900", title: "victim task", priority: "P2", note: "victim's long note" },
    { op: "open_task", id: "T-901", title: "victim task 2", priority: "P2", note: "victim's second note" },
    { op: "add_gap", id: "G-900", what: "victim gap", evidence: "victim evidence", recommended_update: "victim update" }] });
  const r = write({ session: 201, session_uuid: U(201), checkout: "sia-infra", ops: [
    { op: "update_task", id: "T-900", note: "attacker" }, { op: "close_task", id: "T-901", note: "attacker close" },
    { op: "update_gap", id: "G-900", evidence: "attacker evidence" }] });
  const t = rec().tasks, g = rec().gaps.find((x) => x.id === "G-900");
  console.log(`INFO  A11 ${show(r)}\n        update_task T-900 note -> "${t.find((x) => x.id === "T-900").note}" (T-171)\n        close_task T-901 note -> "${t.find((x) => x.id === "T-901").note}"\n        update_gap G-900 evidence -> "${g.evidence}"`);
  const r2 = write({ session: 202, session_uuid: U(202), checkout: "sia-infra", ops: [{ op: "close_gap", id: "G-900" }] });
  console.log(`INFO  A11 close_gap on another session's gap: ${show(r2)}; G-900 present after: ${rec().gaps.some((x) => x.id === "G-900")}`);
}

// A12: a legacy entry has no op that removes it. It stays for ever (and so does its greeting line).
reset();
{
  for (let n = 0; n < 3; n++) write({ session: 200 + n * 20, session_uuid: U(200 + n * 20), checkout: "sia-qa", ops: [H("qa", `qa ${200 + n * 20}`)] });
  const legacyQa = rec().handoffs.find((h) => h.session_uuid === null && h.seat === "qa");
  console.log(`INFO  A12 after three qa writes 20 sessions apart, the legacy qa@75 is ${legacyQa ? "still present" : "gone"}; handoffs: ${hs()}`);
}
console.log(`\n${fails} BROKEN`);
