// QA 134 check 1/2/3 (T-179 round 2): attack the NEW rule. D1 is closed only if nothing a caller supplies can order,
// age or drop another session's entry. Runs against the candidate's build on a scratch clone whose record is SIA's
// rev 132 migrated to v3 by the candidate (c1-proj, made by c1-attack.mjs). Every write goes to scratch.
// usage: node c1r2-attack.mjs <cand-root> <scratch-dir>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S] = process.argv.slice(2);
const ROOT = join(S, "c1r2-proj");
const STORE = join(S, "c1r2-store");
process.env.KNOWLEDGE_V2_DB = join(STORE, "k.db");
process.env.OPEN_BRAIN_ACTIVE_SESSION = join(STORE, "active-session.json");
process.env.OPEN_BRAIN_VAULT_DIR = join(STORE, "vault");
process.env.OPEN_BRAIN_SCORE_HISTORY = join(STORE, "score.jsonl");
process.env.OPEN_BRAIN_SHADOW_LOG = join(STORE, "shadow.jsonl");
process.env.OPEN_BRAIN_IDE = "claude";

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ID = ["-c", "user.name=qa134", "-c", "user.email=qa134@x"];
rmSync(ROOT, { recursive: true, force: true });
execFileSync("git", ["clone", "-q", "--shared", join(S, "c1-proj"), ROOT]);
mkdirSync(STORE, { recursive: true });
const imp = (p) => import(pathToFileURL(join(CAND, "open-brain/build", p)).href);
const W = await imp("shared/state-writer.js");
const SC = await imp("shared/state-schema.js");
const SV = await imp("server.js");

const BASE = git(ROOT, "rev-parse", "HEAD");
const reset = () => { git(ROOT, "reset", "-q", "--hard", BASE); git(ROOT, "clean", "-fdq"); rmSync(process.env.OPEN_BRAIN_ACTIVE_SESSION, { force: true }); };
const rec = () => JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const H = (seat, text) => ({ op: "set_handoff", seat, pick_up: text, watch_out: [], open_questions: [], ...(seat === "planner" ? { loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } } : {}) });
const write = (o) => W.applyStateOps(ROOT, { expected_revision: rec().revision, render: true, ...o });
const must = (r) => { if (!r.ok) throw new Error("setup write refused: " + r.error); return r; };
const hs = () => rec().handoffs.map((h) => `${h.seat}@${h.session}[${h.checkout ?? "legacy"}]fr=${h.first_rev}`).join(" | ");
const ss = () => rec().sessions.map((x) => `${x.n}:${x.uuid ? x.uuid.slice(0, 8) : "null"}:${x.checkout ?? "legacy"}:fr=${x.first_rev}`).join(" | ");
let fails = 0;
const verdict = (name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "HOLDS " : "BROKEN"}  ${name}${detail ? "\n        " + detail : ""}`); };
const show = (r) => (r.ok ? `ok rev ${r.revision_before}->${r.revision_after}${r.superseded.length ? " superseded=" + r.superseded.join(";") : ""}${r.dropped_task_ids.length ? " dropped=" + r.dropped_task_ids.join(",") : ""}` : `REFUSED: ${r.error}`);
const text = (r) => r.content.map((c) => c.text).join(" / ").replace(/\s+/g, " ").slice(0, 300);

// ---------- R1: can a caller influence first_rev or closed_rev? ----------
reset();
{
  const before = rec().revision;
  const r = write({ session: 300, session_uuid: U(300), checkout: "sia-builder", first_rev: 1, firstRev: 1, closed_rev: 1, rev: 1, ops: [H("developer", "extra option keys")] });
  const s = rec().sessions.find((x) => x.uuid === U(300)), h = rec().handoffs.find((x) => x.session_uuid === U(300));
  verdict("R1a extra writer OPTIONS first_rev/firstRev/closed_rev/rev are ignored: first_rev = the file's revision + 1",
    r.ok && s.first_rev === before + 1 && h.first_rev === before + 1, `${show(r)}; session fr=${s?.first_rev} handoff fr=${h?.first_rev}, file rev before ${before}`);
  for (const [name, op] of [["set_handoff+first_rev", { ...H("developer", "x"), first_rev: 1 }], ["close_task+closed_rev", { op: "close_task", id: "T-001", closed_rev: 1 }],
    ["open_task+closed_rev", { op: "open_task", title: "t", priority: "P2", closed_rev: 1 }], ["reopen_task+closed_rev", { op: "reopen_task", id: "T-001", note: "n", closed_rev: 1 }]]) {
    const r2 = write({ session: 300, session_uuid: U(300), checkout: "sia-builder", ops: [op] });
    verdict(`R1b op ${name} is refused`, !r2.ok && /Unrecognized key/.test(r2.error), show(r2));
  }
  // A recorded session writing again, with ANOTHER number and much later, keeps its first_rev.
  for (let i = 0; i < 3; i++) must(write({ session: 310 + i, session_uuid: U(310 + i), checkout: "sia-qa", ops: [{ op: "add_gap", what: `g${i}`, evidence: "e", recommended_update: "u" }] }));
  const r3 = write({ session: 9999, session_uuid: U(300), checkout: "sia-builder", ops: [H("developer", "later, renumbered")] });
  const s3 = rec().sessions.find((x) => x.uuid === U(300));
  verdict("R1c a recorded session writing later under another number keeps its first_rev (not restamped)", r3.ok && s3.first_rev === before + 1 && s3.n === 300, `${show(r3)}; fr=${s3.first_rev} n=${s3.n}`);
  // expected_revision is not a lever: a mismatched one is refused, never used.
  const r4 = W.applyStateOps(ROOT, { expected_revision: 5, session: 301, session_uuid: U(301), checkout: "sia-builder", ops: [H("developer", "x")] });
  verdict("R1d expected_revision other than the file's is refused (first_rev cannot come from it)", !r4.ok && /revision mismatch/.test(r4.error), show(r4));
  // dry run then real write: the dry run records nothing.
  const rv = rec().revision;
  W.applyStateOps(ROOT, { expected_revision: rv, session: 302, session_uuid: U(302), checkout: "sia-infra", dry_run: true, ops: [H("developer", "dry")] });
  const r5 = write({ session: 302, session_uuid: U(302), checkout: "sia-infra", ops: [H("developer", "real")] });
  verdict("R1e a dry run first does not fix a session's first_rev", rec().sessions.find((x) => x.uuid === U(302)).first_rev === rv + 1, show(r5));
}
// closed_rev: set by the writer at close, cleared at reopen, re-set (later) at a re-close. It can only move LATER.
reset();
{
  must(write({ session: 320, session_uuid: U(320), checkout: "sia-builder", ops: [{ op: "open_task", id: "T-9101", title: "x", priority: "P2" }] }));
  const r1 = write({ session: 320, session_uuid: U(320), checkout: "sia-builder", ops: [{ op: "close_task", id: "T-9101" }] });
  const c1 = rec().tasks.find((t) => t.id === "T-9101").closed_rev;
  const r2 = write({ session: 321, session_uuid: U(321), checkout: "sia-qa", ops: [{ op: "reopen_task", id: "T-9101", note: "again" }] });
  const c2 = rec().tasks.find((t) => t.id === "T-9101").closed_rev;
  const r3 = write({ session: 5, session_uuid: U(322), checkout: "sia-qa", ops: [{ op: "close_task", id: "T-9101" }] });
  const c3 = rec().tasks.find((t) => t.id === "T-9101").closed_rev;
  verdict("R1f closed_rev = the closing write's revision; reopen clears it; a re-close (numbered 5) sets the LATER revision",
    c1 === r1.revision_after && c2 === null && c3 === r3.revision_after && c3 > c1, `close ${show(r1)} cr=${c1}; reopen cr=${c2}; re-close ${show(r3)} cr=${c3}`);
  // The server door: handleState passes only its named args; an extra first_rev argument changes nothing.
  process.chdir(ROOT);
  await SV.handleSetSession({ session_id: U(330), project_dir: ROOT });
  const rv = rec().revision;
  const r4 = await SV.handleState({ project_root: ROOT, session: 330, expected_revision: rv, first_rev: 1, closed_rev: 1, session_uuid: U(1), checkout: "sia-builder", ops: [H("qa", "via the server with extra args")] });
  const s4 = rec().sessions.find((x) => x.uuid === U(330));
  verdict("R1g ob_state (server handler) with extra first_rev/closed_rev/session_uuid/checkout args: writer-assigned, registered uuid, checkout = root basename",
    s4 && s4.first_rev === rv + 1 && s4.checkout === "c1r2-proj" && !rec().sessions.some((x) => x.uuid === U(1)), `${text(r4)}; session ${JSON.stringify(s4)}`);
}

// ---------- R2: a wrong number on a DONE task (1124) ----------
reset();
{
  must(write({ session: 400, session_uuid: U(400), checkout: "sia-builder", ops: [
    { op: "open_task", id: "T-9201", title: "a", priority: "P2" }, { op: "open_task", id: "T-9202", title: "b", priority: "P2" }] }));
  must(write({ session: 400, session_uuid: U(400), checkout: "sia-builder", ops: [{ op: "close_task", id: "T-9201" }, { op: "close_task", id: "T-9202" }] }));
  const doneBefore = rec().tasks.filter((t) => t.status === "done").map((t) => `${t.id}(cr=${t.closed_rev})`);
  const r = write({ session: 1124, session_uuid: U(401), checkout: "sia-infra", ops: [{ op: "add_gap", what: "1124", evidence: "e", recommended_update: "u" }] });
  const doneAfter = rec().tasks.filter((t) => t.status === "done").map((t) => `${t.id}(cr=${t.closed_rev})`);
  verdict("R2a ONE write numbered 1124 drops no done task", r.ok && r.dropped_task_ids.length === 0 && doneAfter.length === doneBefore.length,
    `${show(r)}; done before ${doneBefore.join(",")}; after ${doneAfter.join(",")}`);
  const ru = write({ session: 99999, session_uuid: null, ops: [{ op: "add_gap", what: "anon", evidence: "e", recommended_update: "u" }] });
  verdict("R2b an unattributed write numbered 99999 drops no done task", ru.ok && ru.dropped_task_ids.length === 0, show(ru));
  const r2 = write({ session: 2, session_uuid: U(402), checkout: "sia-qa", ops: [{ op: "add_gap", what: "2", evidence: "e", recommended_update: "u" }] });
  verdict("R2c a SECOND distinct session (numbered 2) still drops none (2 < 3)", r2.ok && r2.dropped_task_ids.length === 0, show(r2));
  const r3 = write({ session: 403, session_uuid: U(403), checkout: "sia-qa", ops: [{ op: "add_gap", what: "3", evidence: "e", recommended_update: "u" }] });
  verdict("R2d the THIRD distinct session drops the two uncited done tasks T-9201/T-9202 (and the two legacy done tasks only if uncited)",
    r3.ok && ["T-9201", "T-9202"].every((id) => r3.dropped_task_ids.includes(id)), `${show(r3)} kept-cited=${r3.kept_cited_task_ids.join(",")}`);
  // The same session writing three times more ages nothing.
  reset();
  must(write({ session: 400, session_uuid: U(400), checkout: "sia-builder", ops: [{ op: "open_task", id: "T-9203", title: "c", priority: "P2" }] }));
  must(write({ session: 400, session_uuid: U(400), checkout: "sia-builder", ops: [{ op: "close_task", id: "T-9203" }] }));
  let dropped = [];
  for (const n of [1124, 5000, 1]) { const x = write({ session: n, session_uuid: U(404), checkout: "sia-qa", ops: [{ op: "add_gap", what: `x${n}`, evidence: "e", recommended_update: "u" }] }); dropped.push(...x.dropped_task_ids); }
  verdict("R2e ONE session writing 3 times, numbered 1124 / 5000 / 1, ages the done task by one session only", !dropped.includes("T-9203") && rec().tasks.some((t) => t.id === "T-9203"), `dropped: ${dropped.join(",") || "none"}`);
}

// ---------- R3: A2's gap of 11, A5's jump to 500, the real boundary (10 kept, 11 dropped), lastSession, newest ----------
reset();
{
  must(write({ session: 200, session_uuid: U(200), checkout: "sia-builder", ops: [H("developer", "first")] }));
  const r = write({ session: 211, session_uuid: U(211), checkout: "sia-builder", ops: [H("developer", "second, numbered 11 later")] });
  verdict("R3a A2: numbered 11 apart, nothing between: the first is KEPT (a number gap ages nothing)", r.ok && rec().handoffs.some((h) => h.session_uuid === U(200)), `${show(r)}; ${hs()}`);
}
reset();
{
  must(write({ session: 110, session_uuid: U(110), checkout: "sia-infra", ops: [H("developer", "infra")] }));
  must(write({ session: 111, session_uuid: U(111), checkout: "sia-builder", ops: [H("developer", "builder old")] }));
  must(write({ session: 115, session_uuid: U(115), checkout: "sia-builder", ops: [H("developer", "builder newer")] }));
  const r = write({ session: 500, session_uuid: U(500), checkout: "sia-qa", ops: [H("qa", "far future")] });
  const keyedGone = [U(110), U(111), U(115)].filter((u) => !rec().handoffs.some((h) => h.session_uuid === u));
  verdict("R3b A5: a jump to 500 drops no keyed entry (only the legacy qa@75 leaves, by R179-3)", r.ok && keyedGone.length === 0 && r.superseded.length === 1 && /legacy/.test(r.superseded[0]), `${show(r)}`);
}
for (const k of [10, 11]) {
  reset();
  must(write({ session: 600, session_uuid: U(600), checkout: "sia-builder", ops: [H("developer", "E, the old one")] }));
  must(write({ session: 601, session_uuid: U(601), checkout: "sia-builder", ops: [H("developer", "newer of the same instance")] }));
  // k-1 more distinct sessions (U(601) is already one after E), numbered BELOW E, some descending, in other checkouts.
  let last;
  for (let i = 0; i < k - 1; i++) last = must(write({ session: 50 - i, session_uuid: U(700 + i), checkout: "sia-qa", ops: [{ op: "add_gap", what: `s${i}`, evidence: "e", recommended_update: "u" }] }));
  const kept = rec().handoffs.some((h) => h.session_uuid === U(600));
  verdict(`R3c the real boundary: ${k} distinct sessions first-wrote after E (numbered 601, then 50 down to ${50 - (k - 2)}): E ${k <= 10 ? "kept" : "dropped"}`,
    kept === (k <= 10), `last write ${show(last)}; E present: ${kept}`);
}
reset();
{
  must(write({ session: 118, session_uuid: U(118), checkout: "sia-builder", ops: [H("developer", "Forge 118")] }));
  must(write({ session: 1124, session_uuid: U(124), checkout: "sia-builder", ops: [H("developer", "Forge 124 as 1124")] }));
  must(write({ session: 125, session_uuid: U(125), checkout: "sia-builder", ops: [H("developer", "Forge 125")] }));
  const st = rec();
  const last = SC.lastSession(st), newest = SC.newestHandoffPerInstance(st.handoffs).filter((h) => h.checkout === "sia-builder"), forSeat = SC.newestHandoffForSeat(st.handoffs, "developer");
  verdict("R3d after 1124 then 125: lastSession, newest per (seat,checkout) and newest for the seat are 125's (write order), not 1124's",
    last.uuid === U(125) && newest.length === 1 && newest[0].session_uuid === U(125) && forSeat.session_uuid === U(125),
    `last n=${last.n}; newest [sia-builder] n=${newest.map((h) => h.session).join(",")}; forSeat n=${forSeat.session}`);
  must(write({ session: 6, session_uuid: U(6), checkout: "sia-builder", ops: [H("developer", "local number 6")] }));
  const st2 = rec();
  verdict("R3e a later session numbered 6 (T-164 local number) is the newest and the last", SC.lastSession(st2).uuid === U(6) && SC.newestHandoffForSeat(st2.handoffs, "developer").session_uuid === U(6),
    `last n=${SC.lastSession(st2).n}`);
}

// ---------- R179-2: the different-checkout refusal, and where it is checked ----------
reset();
{
  process.chdir(ROOT);
  must(write({ session: 800, session_uuid: U(800), checkout: "sia-builder", ops: [H("developer", "victim in sia-builder")] }));
  await SV.handleSetSession({ session_id: U(801), project_dir: ROOT });
  const r1 = await SV.handleSetSession({ session_id: U(800), project_dir: ROOT });
  const r1b = await SV.handleState({ project_root: ROOT, session: 801, expected_revision: rec().revision, ops: [H("qa", "qa after the refused registration")] });
  const v1 = rec().handoffs.find((h) => h.session_uuid === U(800));
  verdict("P1 ob_set_session(a uuid recorded under ANOTHER checkout, project_dir = this root) is refused and the previous registration kept",
    r1.isError === true && /refused/.test(text(r1)) && rec().sessions.some((x) => x.uuid === U(801)) && v1.pick_up === "victim in sia-builder", `${text(r1)}`);

  // P2: the same uuid, registered with project_dir = a directory of this checkout that holds no record.
  const sub = join(ROOT, "open-brain");
  const r2 = await SV.handleSetSession({ session_id: U(800), project_dir: sub });
  const w2 = await SV.handleState({ project_root: ROOT, session: 801, expected_revision: rec().revision, ops: [H("developer", "P2: replaced from c1r2-proj")] });
  const v2 = rec().handoffs.find((h) => h.session_uuid === U(800));
  verdict("P2 registering the other checkout's uuid with project_dir = a SUBDIRECTORY (no record there), then ob_state on the root, cannot replace its handoff",
    v2?.pick_up === "victim in sia-builder", `set_session: ${text(r2).slice(0, 120)}\n        ob_state: ${text(w2).slice(0, 100)}\n        victim now: "${v2?.pick_up}" checkout ${v2?.checkout}`);
}
reset();
{
  // P3: project_dir = a directory whose BASENAME is the victim's checkout and whose record holds the victim (e.g. the victim's own worktree).
  process.chdir(ROOT);
  must(write({ session: 800, session_uuid: U(800), checkout: "sia-builder", ops: [H("developer", "victim in sia-builder")] }));
  const other = join(S, "p3", "sia-builder");
  rmSync(join(S, "p3"), { recursive: true, force: true });
  mkdirSync(join(other, ".agents"), { recursive: true });
  cpSync(join(ROOT, ".agents/state.json"), join(other, ".agents/state.json"));
  const r3 = await SV.handleSetSession({ session_id: U(800), project_dir: other });
  const w3 = await SV.handleState({ project_root: ROOT, session: 802, expected_revision: rec().revision, ops: [H("developer", "P3: replaced from c1r2-proj")] });
  const v3 = rec().handoffs.find((h) => h.session_uuid === U(800));
  verdict("P3 registering with project_dir = the victim's OWN checkout (basename matches), then ob_state on THIS root, cannot replace its handoff",
    v3?.pick_up === "victim in sia-builder", `set_session: ${text(r3).slice(0, 120)}\n        ob_state: ${text(w3).slice(0, 100)}\n        victim now: "${v3?.pick_up}" checkout ${v3?.checkout}`);
}
reset();
{
  // P4: no project_dir; the server's cwd is a subdirectory.
  must(write({ session: 800, session_uuid: U(800), checkout: "sia-builder", ops: [H("developer", "victim in sia-builder")] }));
  process.chdir(join(ROOT, "open-brain"));
  const r4 = await SV.handleSetSession({ session_id: U(800) });
  const w4 = await SV.handleState({ project_root: ROOT, session: 803, expected_revision: rec().revision, ops: [H("developer", "P4: replaced")] });
  const v4 = rec().handoffs.find((h) => h.session_uuid === U(800));
  verdict("P4 no project_dir, server cwd a subdirectory: the other checkout's uuid cannot be registered and used", v4?.pick_up === "victim in sia-builder",
    `set_session: ${text(r4).slice(0, 120)}\n        victim now: "${v4?.pick_up}" checkout ${v4?.checkout}`);
  process.chdir(ROOT);
}
reset();
{
  // P5: the LEGACY session record (planner@76, checkout null) is registerable anywhere (stated: null checkout is not checked).
  process.chdir(ROOT);
  const legacy = rec().sessions.find((x) => x.first_rev === null);
  const r5 = await SV.handleSetSession({ session_id: legacy.uuid, project_dir: ROOT });
  const w5 = await SV.handleState({ project_root: ROOT, session: 804, expected_revision: rec().revision, ops: [H("qa", "under the legacy uuid")] });
  const s5 = rec().sessions.find((x) => x.uuid === legacy.uuid);
  console.log(`INFO  P5 registering the legacy session uuid (${legacy.uuid.slice(0, 8)}, n ${legacy.n}, checkout null): ${r5.isError ? "refused" : "accepted"}; after one write its record is n ${s5.n}, checkout ${s5.checkout}, seat ${s5.seat}, first_rev ${s5.first_rev}; legacy planner handoff still present: ${rec().handoffs.some((h) => h.first_rev === null && h.seat === "planner")}`);
}

// ---------- R179-3: legacy handoffs leave on their seat's first keyed handoff; legacy SESSION records never ----------
reset();
{
  const legacyBefore = rec().handoffs.filter((h) => h.first_rev === null).map((h) => `${h.seat}@${h.session}`);
  const r1 = write({ session: 900, session_uuid: U(900), checkout: "sia-qa", ops: [{ op: "add_gap", what: "no handoff", evidence: "e", recommended_update: "u" }] });
  const r2 = write({ session: 901, session_uuid: U(901), checkout: "sia-qa", ops: [H("qa", "first keyed qa")] });
  const after2 = rec().handoffs.filter((h) => h.first_rev === null).map((h) => `${h.seat}@${h.session}`);
  verdict("L1 a write with no set_handoff removes no legacy handoff; qa's first keyed handoff removes qa@75 only",
    r1.superseded.length === 0 && r2.superseded.length === 1 && /qa@75|legacy, session 75/.test(r2.superseded[0]) && after2.length === legacyBefore.length - 1 && !after2.includes("qa@75"),
    `before ${legacyBefore.join(",")}; r1 ${show(r1)}; r2 ${show(r2)}; after ${after2.join(",")}`);
  for (let i = 0; i < 12; i++) must(write({ session: 910 + i, session_uuid: U(910 + i), checkout: `co-${i}`, ops: [H("planner", `planner ${i}`)] }));
  const legacySession = rec().sessions.filter((x) => x.first_rev === null);
  verdict("L2 after 13+ keyed sessions (12 planner, in 12 checkouts), the legacy SESSION record (planner, n 76) is still there", legacySession.length === 1 && legacySession[0].n === 76,
    `legacy sessions: ${legacySession.map((x) => `${x.n}:${x.seat}`).join(",")}; ${rec().sessions.length} sessions`);
}
console.log(`\n${fails} BROKEN`);
