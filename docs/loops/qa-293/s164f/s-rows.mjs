// QA 293 (copied from QA 292's s164e script, re-rooted to C:/qa-tmp/qa293; see below). QA 292 #489 rows 3 (R1), 5 (R3, R4), 6 (B2, B4/N4, N1, N2, N6) on the real ob_end / SessionEnd / greeting paths.
// Adapted from QA 291's docs/loops/qa-291/s164d/s-rows.mjs. New scenarios: b1n-same / b1o-same (identical re-save after
// ob_end must NOT clear the marker), b1o-eol (the same text with the other line endings after ob_end), legacy (an old
// in-repo .missing-handoff.jsonl is shown once), and cap-* (R8: the .shown files stop at 200 lines).
// Usage: node s-rows.mjs <scenario>
import { writeFileSync, readFileSync, appendFileSync, utimesSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { OB, EOL, WIN, bs, freshDir, freshDb, oldLayout, newLayout, transcript, prove, server, hook, greet, commit, git, iso, H, show, pick, storeFiles, storeDir } from "./lib.mjs";

const sc = process.argv[2];
const UUID = "29200000-0000-4000-8000-0000000000c1";
const CSE = "01QA292rowsSessionDDDDDDD";
const NEXT = "29200000-0000-4000-8000-0000000000d1";
const db = freshDb(`${WIN ? "win-" : ""}rows-${sc}`);
const dir = freshDir(`rows-${sc}`);
const NOTICE = /WORK AFTER|RECORD OK|HANDOFF MISSING|OLD LAYOUT|RECORD NOT|UNATTRIBUTED/;
const notices = (g) => pick(g.out, NOTICE).join("\n") || "(none)";
const rev = () => JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8")).revision;
const first = (r, n = 3) => `${r.isError ? "[isError] " : ""}${r.text.split("\n").slice(0, n).join("\n")}`;
const status = () => git(dir, "status", "--short", "--untracked-files=all") || "(clean)";
const setHandoff = async (s, pick_up) => first(await s.call("ob_state", { session: 51, expected_revision: rev(), ops: [{ op: "set_handoff", seat: "developer", pick_up, watch_out: [], open_questions: [] }] }), 2);
const NEXT_REL = ".agents/SESSIONS/next-session.md";
const editNext = (line) => appendFileSync(join(dir, NEXT_REL), `${line}${EOL}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** SessionEnd, then two greetings; prints hook lines, both greetings' notices, git status and the store. */
const tail = async (s, tr, label) => {
  await s.close();
  const h = hook(dir, { session_id: UUID, transcript_path: tr, hook_event_name: "SessionEnd" }, db);
  show(`${label}: SessionEnd exit ${h.status}`, pick(h.out, /^\[session-end\] (HANDOFF|WORK AFTER|work-after|handoff check)/).join("\n"));
  if (WIN) show(`${label}: fixture`, { dir: bs(dir), autocrlf: git(dir, "config", "--get", "core.autocrlf"), transcript: tr, nextSessionCRLF: readFileSync(join(dir, NEXT_REL), "utf8").includes("\r\n") });
  for (const n of [1, 2]) show(`${label}: greeting #${n} notices`, notices(greet(dir, NEXT, db)));
  show(`${label}: git status --short --untracked-files=all`, status());
  show(`${label}: out-of-repo store (file: lines)`, storeFiles(db));
};
const after = (paths = []) => commit(dir, iso(2 * 60e3), "src/after.ts", "after\n", CSE, "after end", paths);
function execMerge() {
  execFileSync("git", ["-c", "user.email=qa@example.com", "-c", "user.name=QA", "merge", "-q", "--no-ff", "--no-edit", "other"],
    { cwd: dir, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_DATE: iso(90e3), GIT_COMMITTER_DATE: iso(90e3) } });
}
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

// ---- Row 3 (R1): record update, ob_end, commit, SessionEnd. Expect WORK AFTER marker, printed once.
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
  if (sc === "b1o-pre") commit(dir, iso(-30 * 60e3), NEXT_REL, "# Next\nSession 37: did a\n", CSE, "record");
  else editNext("Session 37: did a");
  const s = await server(dir, db);
  show("status at ob_end", status());
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  if (sc === "b1o-all") afterAll(); else after();
  show("committed after ob_end (files)", git(dir, "show", "--name-only", "--format=", "HEAD"));
  await tail(s, tr, sc);
} else if (sc === "b1n-later" || sc === "b1n-same") {
  // later: a real record write AFTER ob_end (content changed) clears the marker.
  // same: set_handoff re-saved with IDENTICAL content after ob_end must not clear it.
  const tr = await newStart();
  const s = await server(dir, db);
  show("set_handoff (before ob_end)", await setHandoff(s, "B1 new"));
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  afterAll();
  await sleep(1100);
  const r0 = rev();
  show(sc === "b1n-later" ? "set_handoff AFTER ob_end (new content)" : "set_handoff AFTER ob_end (identical content)",
    await setHandoff(s, sc === "b1n-later" ? "after end, recorded" : "B1 new"));
  const st = JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8"));
  show("revision before/after the re-save; this session's handoff", { before: r0, after: st.revision, handoffs: st.handoffs.map((h) => ({ session_uuid: h.session_uuid, pick_up: h.pick_up })) });
  await tail(s, tr, sc);
} else if (sc === "b1n-other" || sc === "b1n-pull") {
  // other: after ob_end, an ob_state write that does not touch this session's handoff (add_decision).
  // pull: after ob_end, a merge brings in another session's state.json revision (its own set_handoff); this session
  // records nothing after /end.
  const tr = await newStart();
  const s = await server(dir, db);
  show("set_handoff (before ob_end)", await setHandoff(s, "B1 new"));
  commit(dir, iso(-10 * 60e3), "src/b.ts", "b\n", CSE, "record + b");
  if (sc === "b1n-pull") {
    // the "remote" side: a branch off this commit where another session wrote the record
    git(dir, "branch", "other");
  }
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  after();
  await sleep(1100);
  const r0 = rev();
  if (sc === "b1n-other") {
    show("add_decision AFTER ob_end (handoff untouched)", first(await s.call("ob_state", { session: 51, expected_revision: rev(), ops: [{ op: "add_decision", title: "QA292 unrelated decision", date: "2026-10-08", note: "n" }] }), 2));
  } else {
    git(dir, "checkout", "-q", "other");
    const st = JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8"));
    st.revision += 1;
    st.decisions.push({ id: "D-9001", title: "another session's decision", date: "2026-10-08", note: "from the other branch" });
    commit(dir, iso(60e3), ".agents/state.json", JSON.stringify(st, null, 2) + "\n", "01QA292otherSessionZZZZZZ", "another session's record write");
    git(dir, "checkout", "-q", "master");
    execMerge();
  }
  const st = JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8"));
  show("revision before/after; this session's handoff", { before: r0, after: st.revision, mine: st.handoffs.filter((h) => h.session_uuid === UUID).map((h) => h.pick_up) });
  show("log since ob_end", git(dir, "log", "--format=%h %s", "-4"));
  await tail(s, tr, sc);
} else if (sc === "b1n-pullh" || sc === "b1n-otherh") {
  // QA 293 addition. Another session (OTHER, same seat "developer", another checkout) writes its OWN handoff and gets its
  // own sessions[] row, through the real writer (build/shared/state-writer.js applyStateOps), after this session's ob_end.
  // pullh: that write arrives by a merge from branch "other". otherh: it lands directly in the working tree (no merge).
  // This session records nothing after /end. Expect the WORK AFTER marker kept.
  const { applyStateOps } = await import(pathToFileURL(join(OB, "build", "shared", "state-writer.js")).href);
  const OTHER = "29300000-0000-4000-8000-0000000000a2";
  const tr = await newStart();
  const s = await server(dir, db);
  show("set_handoff (before ob_end)", await setHandoff(s, "B1 new"));
  commit(dir, iso(-10 * 60e3), "src/b.ts", "b\n", CSE, "record + b");
  if (sc === "b1n-pullh") git(dir, "branch", "other");
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  after();
  await sleep(1100);
  const r0 = rev();
  if (sc === "b1n-pullh") git(dir, "checkout", "-q", "other");
  const w = applyStateOps(dir, { session: 52, expected_revision: rev(), session_uuid: OTHER, checkout: "other-seat", today: "2026-10-08",
    ops: [{ op: "set_handoff", seat: "developer", pick_up: "another session's handoff", watch_out: [], open_questions: [] }] });
  show("another session's applyStateOps", { ok: w.ok, error: w.error });
  if (sc === "b1n-pullh") {
    commit(dir, iso(60e3), ".agents/state.json", readFileSync(join(dir, ".agents/state.json"), "utf8"), "01QA293otherSessionZZZZZZ", "another session's record write");
    git(dir, "checkout", "-q", "master");
    execMerge();
  }
  const st = JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8"));
  show("revision before/after; handoffs; sessions", { before: r0, after: st.revision,
    handoffs: st.handoffs.map((h) => `${h.session_uuid} ${h.seat} ${h.checkout} ${h.pick_up}`),
    sessions: st.sessions.map((x) => `${x.uuid} ${x.seat} ${x.checkout} n=${x.n} first_rev=${x.first_rev}`) });
  show("log", git(dir, "log", "--format=%h %s", "-4"));
  await tail(s, tr, sc);
} else if (sc === "b1o-eolr") {
  // QA 293 addition: next-session.md has the OTHER line endings from the platform's at ob_end (LF under --win, CRLF on
  // POSIX), then is flipped back to the platform's after ob_end. With b1o-eol this covers both directions on each run.
  const tr = await oldStart();
  editNext("Session 37: did a");
  const p = join(dir, NEXT_REL);
  const raw = readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  writeFileSync(p, WIN ? raw : raw.replace(/\n/g, "\r\n"));
  const s = await server(dir, db);
  const atEnd = readFileSync(p, "utf8");
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  afterAll();
  await sleep(1100);
  const before = readFileSync(p, "utf8");
  writeFileSync(p, WIN ? before.replace(/\r?\n/g, "\r\n") : before.replace(/\r\n/g, "\n"));
  const now = readFileSync(p, "utf8");
  show("next-session.md at ob_end / after", { crlfAtObEnd: atEnd.includes("\r\n"), crlfBeforeFlip: before.includes("\r\n"), crlfAfter: now.includes("\r\n"), bytesEqual: before === now, textEqualIgnoringEol: before.replace(/\r\n/g, "\n") === now.replace(/\r\n/g, "\n") });
  await tail(s, tr, sc);
} else if (sc === "b1o-later" || sc === "b1o-same" || sc === "b1o-eol") {
  const tr = await oldStart();
  editNext("Session 37: did a");
  const s = await server(dir, db);
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  afterAll();
  await sleep(1100);
  const p = join(dir, NEXT_REL);
  const before = readFileSync(p, "utf8");
  if (sc === "b1o-later") editNext("Session 37: also did after.ts after /end");
  else if (sc === "b1o-same") { writeFileSync(p, before); const t = Date.now() / 1000; utimesSync(p, t, t); }
  else writeFileSync(p, before.includes("\r\n") ? before.replace(/\r\n/g, "\n") : before.replace(/\n/g, "\r\n"));
  const now = readFileSync(p, "utf8");
  show("next-session.md after ob_end", { change: sc, crlfBefore: before.includes("\r\n"), crlfAfter: now.includes("\r\n"), bytesEqual: before === now, textEqualIgnoringEol: before.replace(/\r\n/g, "\n") === now.replace(/\r\n/g, "\n") });
  await tail(s, tr, sc);
}
// ---- Row 6 (B2): a correct close, no work after. Expect no HANDOFF MISSING in the hook or the greeting.
else if (sc === "b2n" || sc === "b2n-c") {
  const tr = await newStart();
  const s = await server(dir, db);
  show("set_handoff", await setHandoff(s, "B2 new"));
  if (sc === "b2n-c") commit(dir, iso(-5 * 60e3), "src/b.ts", "b\n", CSE, "record");
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  await tail(s, tr, sc);
} else if (sc === "b2o" || sc === "b2o-c") {
  const tr = await oldStart();
  if (sc === "b2o-c") commit(dir, iso(-30 * 60e3), NEXT_REL, "# Next\nSession 37: did a\n", CSE, "record");
  else editNext("Session 37: did a");
  const s = await server(dir, db);
  show("ob_end", first(await s.call("ob_end", { session_summary: sc })));
  await tail(s, tr, sc);
} else if (sc === "loop-none") {
  // R4: HANDOFF MISSING fires; its marker must not land in the repo.
  newLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  git(dir, "checkout", "-q", "-b", "loop/qa292-seat");
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  const s = await server(dir, db);
  show("loop seat, no handoff of either kind: ob_end", first(await s.call("ob_end", { session_summary: "ln" })));
  show("ob_end record_ok", first(await s.call("ob_end", { session_summary: "ln", record_ok: "QA292 loop seat without handoff" })));
  await tail(s, tr, "loop-none (expect HANDOFF MISSING)");
} else if (sc === "legacy") {
  // R4: an old in-repo .missing-handoff.jsonl (written by r2 or earlier) is still shown, once, and leaves the repo.
  oldLayout(dir);
  const leg = join(dir, ".agents/SESSIONS/.missing-handoff.jsonl");
  writeFileSync(leg, JSON.stringify({ at: iso(-H), session: "legacy-1", message: "HANDOFF MISSING: session legacy-1 committed 1 commit(s) on loop/old (QA292 legacy in-repo marker)", branches: ["loop/old"], commits: 1, since: iso(-2 * H) }) + "\n");
  show("status before greeting", status());
  for (const n of [1, 2]) show(`legacy: greeting #${n} notices`, notices(greet(dir, NEXT, db)));
  show("legacy: in-repo marker still present", existsSync(leg));
  show("legacy: git status --short --untracked-files=all", status());
  show("legacy: out-of-repo store (file: lines)", storeFiles(db));
}
// ---- R8: the .shown files stop at 200 lines. Pre-seed each .shown file with 250 lines, then fire each notice for real.
else if (sc === "cap") {
  const tr = await oldStart(); // old layout, 1 commit, record NOT updated
  const sd = await storeDir(dir, db);
  for (const f of [".record-ok.shown.jsonl", ".work-after-end.shown.jsonl", ".missing-handoff.shown.jsonl"]) {
    writeFileSync(join(sd, f), Array.from({ length: 250 }, (_, i) => JSON.stringify({ seed: i, f })).join("\n") + "\n");
  }
  show("cap: store before (file: lines)", storeFiles(db));
  git(dir, "checkout", "-q", "-b", "loop/qa292-cap"); // loop work with no handoff → HANDOFF MISSING too
  commit(dir, iso(-50 * 60e3), "src/b.ts", "b\n", CSE);
  const s = await server(dir, db);
  show("cap: ob_end record_ok", first(await s.call("ob_end", { session_summary: "cap", record_ok: "QA292 cap" }), 4));
  after();
  await tail(s, tr, "cap");
  const lastSeed = (f) => { const l = readFileSync(join(sd, f), "utf8").trim().split(/\r?\n/); return { lines: l.length, first: l[0].slice(0, 60), last: l.at(-1).slice(0, 80) }; };
  show("cap: each .shown file after one real firing", Object.fromEntries([".record-ok.shown.jsonl", ".work-after-end.shown.jsonl", ".missing-handoff.shown.jsonl"].map((f) => [f, lastSeed(f)])));
}
// ---- Row 6 (N1)
else if (sc === "predirty") {
  oldLayout(dir);
  editNext("stale uncommitted line from session 35");
  const old = (Date.now() - 5 * 24 * H) / 1000; utimesSync(join(dir, NEXT_REL), old, old);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE, "a", []); git(dir, "tag", "v2.0.0");
  const s = await server(dir, db);
  show("status", status());
  show("N1 predirty: ob_end (expect refuse)", first(await s.call("ob_end", { session_summary: "pd" }), 4));
  editNext("Session 37: did a (edited in this session)");
  show("N1 after an in-session edit: ob_end (expect close)", first(await s.call("ob_end", { session_summary: "pd" })));
  await s.close();
}
// ---- Row 5/6 (N2, N3, N4, N6)
else if (sc === "n2") {
  const tr = await oldStart(); git(dir, "tag", "v1.0.1");
  const s = await server(dir, db);
  show("N2 refusal (expect OLD LAYOUT line too)", first(await s.call("ob_end", { session_summary: "n2" }), 4));
  show("N2 record_ok '   ' (N4, expect refuse)", first(await s.call("ob_end", { session_summary: "n2", record_ok: "   " })));
  show("N2 record_ok '' (M6, expect refuse)", first(await s.call("ob_end", { session_summary: "n2", record_ok: "" })));
  show("status after refusals", status());
  show("store after refusals", storeFiles(db));
  show("N2 record_ok 'x' closes", first(await s.call("ob_end", { session_summary: "n2", record_ok: "QA292 n2 reason" }), 4));
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
