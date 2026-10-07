// QA 291 #489 rows 4 (B1), 5 (B2), 8 (N1), 9 (N2, N3, N6) on the real ob_end / SessionEnd / greeting paths.
// Adapted from QA 289's s-rows.mjs. Usage: node s-rows.mjs <scenario>
import { writeFileSync, readFileSync, appendFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { EOL, WIN, bs, freshDir, freshDb, oldLayout, newLayout, transcript, prove, server, hook, greet, commit, git, iso, H, show, pick, storeFiles } from "./lib.mjs";

const sc = process.argv[2];
const UUID = "29100000-0000-4000-8000-0000000000c1";
const CSE = "01QA291rowsSessionDDDDDDD";
const NEXT = "29100000-0000-4000-8000-0000000000d1";
const db = freshDb(`${WIN ? "win-" : ""}rows-${sc}`);
const dir = freshDir(`rows-${sc}`);
const NOTICE = /WORK AFTER|RECORD OK|HANDOFF MISSING|OLD LAYOUT|RECORD NOT|UNATTRIBUTED/;
const notices = (g) => pick(g.out, NOTICE).join("\n") || "(none)";
const rev = () => JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8")).revision;
const first = (r, n = 3) => `${r.isError ? "[isError] " : ""}${r.text.split("\n").slice(0, n).join("\n")}`;
const status = () => git(dir, "status", "--short", "--untracked-files=all") || "(clean)";
const setHandoff = async (s, pick_up) => first(await s.call("ob_state", { session: 51, expected_revision: rev(), ops: [{ op: "set_handoff", seat: "developer", pick_up, watch_out: [], open_questions: [] }] }), 2);
const editNext = (line) => appendFileSync(join(dir, ".agents/SESSIONS/next-session.md"), `${line}${EOL}`);
/** SessionEnd, then two greetings; prints hook lines, both greetings' notices, git status and the store. */
const tail = async (s, tr, label) => {
  await s.close();
  const h = hook(dir, { session_id: UUID, transcript_path: tr, hook_event_name: "SessionEnd" }, db);
  show(`${label}: SessionEnd exit ${h.status}`, pick(h.out, /^\[session-end\] (HANDOFF|WORK AFTER|work-after|handoff check)/).join("\n"));
  if (WIN) show(`${label}: fixture`, { dir: bs(dir), autocrlf: git(dir, "config", "--get", "core.autocrlf"), transcript: tr, nextSessionCRLF: readFileSync(join(dir, ".agents/SESSIONS/next-session.md"), "utf8").includes("\r\n") });
  for (const n of [1, 2]) show(`${label}: greeting #${n} notices`, notices(greet(dir, NEXT, db)));
  show(`${label}: git status --short --untracked-files=all`, status());
  show(`${label}: out-of-repo store`, storeFiles(db));
};
const after = (paths = []) => commit(dir, iso(2 * 60e3), "src/after.ts", "after\n", CSE, "after end", paths);
const afterAll = () => commit(dir, iso(2 * 60e3), "src/after.ts", "after\n", CSE, "after end (git add -A)");

async function newStart() {
  newLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  return tr;
}
async function oldStart() {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  return tr;
}

// ---- Row 4 (B1): record update, ob_end, commit, SessionEnd. Expect WORK AFTER marker, printed once.
if (sc === "b1n-src" || sc === "b1n-all" || sc === "b1n-pre") {
  const tr = await newStart();
  const s = await server(dir, db);
  show("set_handoff (before ob_end)", await setHandoff(s, "B1 new"));
  if (sc === "b1n-pre") show("record committed before ob_end", commit(dir, iso(-10 * 60e3), "src/b.ts", "b\n", CSE, "record + b"));
  show("status at ob_end", status());
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  if (sc === "b1n-all") afterAll(); else after();
  show("committed after ob_end (files)", git(dir, "show", "--name-only", "--format=", "HEAD"));
  await tail(s, tr, sc);
} else if (sc === "b1o-src" || sc === "b1o-all" || sc === "b1o-pre") {
  const tr = await oldStart();
  if (sc === "b1o-pre") commit(dir, iso(-30 * 60e3), ".agents/SESSIONS/next-session.md", "# Next\nSession 37: did a\n", CSE, "record");
  else editNext("Session 37: did a");
  const s = await server(dir, db);
  show("status at ob_end", status());
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  if (sc === "b1o-all") afterAll(); else after();
  show("committed after ob_end (files)", git(dir, "show", "--name-only", "--format=", "HEAD"));
  await tail(s, tr, sc);
} else if (sc === "b1n-later") {
  // control: a record write AFTER ob_end clears the marker
  const tr = await newStart();
  const s = await server(dir, db);
  show("set_handoff (before ob_end)", await setHandoff(s, "B1 new"));
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  after();
  await new Promise((r) => setTimeout(r, 1100));
  show("set_handoff AFTER ob_end", await setHandoff(s, "after end, recorded"));
  await tail(s, tr, sc);
} else if (sc === "b1o-later") {
  const tr = await oldStart();
  editNext("Session 37: did a");
  const s = await server(dir, db);
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  after();
  await new Promise((r) => setTimeout(r, 1100));
  editNext("Session 37: also did after.ts after /end");
  await tail(s, tr, sc);
}
// ---- Row 5 (B2): a correct close, no work after. Expect no HANDOFF MISSING in the hook or the greeting.
else if (sc === "b2n" || sc === "b2n-c") {
  const tr = await newStart();
  const s = await server(dir, db);
  show("set_handoff", await setHandoff(s, "B2 new"));
  if (sc === "b2n-c") commit(dir, iso(-5 * 60e3), "src/b.ts", "b\n", CSE, "record");
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  await tail(s, tr, sc);
} else if (sc === "b2o" || sc === "b2o-c") {
  const tr = await oldStart();
  if (sc === "b2o-c") commit(dir, iso(-30 * 60e3), ".agents/SESSIONS/next-session.md", "# Next\nSession 37: did a\n", CSE, "record");
  else editNext("Session 37: did a");
  const s = await server(dir, db);
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  await tail(s, tr, sc);
} else if (sc === "q7") {
  newLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  git(dir, "checkout", "-q", "-b", "loop/qa291-seat");
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  commit(dir, iso(-50 * 60e3), "docs/loops/qa291-handoff.md", "# handoff\n", CSE, "handoff");
  const s = await server(dir, db);
  show("Q7 loop seat ob_end (no set_handoff)", first(await s.call("ob_end", { session_summary: "q7" })));
  await tail(s, tr, "q7");
} else if (sc === "loop-none") {
  newLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  git(dir, "checkout", "-q", "-b", "loop/qa291-seat");
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  const s = await server(dir, db);
  show("loop seat, no handoff of either kind: ob_end", first(await s.call("ob_end", { session_summary: "ln" })));
  show("ob_end record_ok", first(await s.call("ob_end", { session_summary: "ln", record_ok: "QA291 loop seat without handoff" })));
  await tail(s, tr, "loop-none (expect HANDOFF MISSING)");
}
// ---- Row 8 (N1)
else if (sc === "predirty") {
  oldLayout(dir);
  editNext("stale uncommitted line from session 35");
  const old = (Date.now() - 5 * 24 * H) / 1000; utimesSync(join(dir, ".agents/SESSIONS/next-session.md"), old, old);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE, "a", []); git(dir, "tag", "v2.0.0");
  const s = await server(dir, db);
  show("status", status());
  show("N1 predirty: ob_end (expect refuse)", first(await s.call("ob_end", { session_summary: "pd" }), 4));
  editNext("Session 37: did a (edited in this session)");
  show("N1 after an in-session edit: ob_end (expect close)", first(await s.call("ob_end", { session_summary: "pd" })));
  await s.close();
}
// ---- Row 9 (N2, N3, N6)
else if (sc === "n2") {
  const tr = await oldStart(); git(dir, "tag", "v1.0.1");
  const s = await server(dir, db);
  show("N2 refusal (expect OLD LAYOUT line too)", first(await s.call("ob_end", { session_summary: "n2" }), 4));
  show("N2 record_ok '   ' (N4, expect refuse)", first(await s.call("ob_end", { session_summary: "n2", record_ok: "   " })));
  show("N2 record_ok '' (M6, expect refuse)", first(await s.call("ob_end", { session_summary: "n2", record_ok: "" })));
  show("status after refusals", status());
  show("store after refusals", storeFiles(db));
  show("N2 record_ok 'x' closes", first(await s.call("ob_end", { session_summary: "n2", record_ok: "QA291 n2 reason" }), 4));
  after();
  await tail(s, tr, "n2 record_ok + work after (N6: record-ok and work-after markers)");
} else if (sc === "n3") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/u1.ts", "u\n", null, "untrailered 1");
  commit(dir, iso(-50 * 60e3), "src/u2.ts", "u\n", null, "untrailered 2");
  const s = await server(dir, db);
  show("N3 untrailered-only on master: ob_end", first(await s.call("ob_end", { session_summary: "n3" }), 5));
  await tail(s, tr, "n3");
} else if (sc === "n3m") {
  const tr = await oldStart();
  commit(dir, iso(-50 * 60e3), "src/u1.ts", "u\n", null, "untrailered 1");
  editNext("Session 37: did a");
  const s = await server(dir, db);
  show("N3 mixed (1 mine + 1 untrailered, record updated): ob_end", first(await s.call("ob_end", { session_summary: "n3m" }), 5));
  await tail(s, tr, "n3m");
}
