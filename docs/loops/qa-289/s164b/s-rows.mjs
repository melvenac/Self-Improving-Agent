// QA 289 rows 3/6: Q2, Q3, Q5, Q6 (normal close), Q7, Q8, gitignored old layout. Usage: node s-rows.mjs <scenario>
import { writeFileSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { freshDir, oldLayout, newLayout, transcript, prove, server, hook, greet, commit, git, iso, H, R, show, pick, ls } from "./lib.mjs";

const sc = process.argv[2];
const UUID = "28900000-0000-4000-8000-0000000000c1";
const OTHER = "28900000-0000-4000-8000-0000000000ff";
const CSE = "01QA289rowsSessionBBBBBBB";
const NEXT = "28900000-0000-4000-8000-0000000000d1";
const db = `${R}/db/${sc}.db`;
const dir = freshDir(`rows-${sc}`);
const notices = (g) => pick(g.out, /WORK AFTER|RECORD OK|HANDOFF MISSING|OLD LAYOUT|RECORD NOT/).join("\n") || "(none)";
const rev = () => JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8")).revision;
const tail = async (s, tr, label) => {
  await s.close();
  const h = hook(dir, { session_id: UUID, transcript_path: tr, hook_event_name: "SessionEnd" }, db);
  show(`${label}: SessionEnd exit ${h.status}`, pick(h.out, /^\[session-end\] (HANDOFF|WORK AFTER|work-after|handoff check)/).join("\n"));
  const g = greet(dir, NEXT, db);
  show(`${label}: next greeting notices`, notices(g));
};

if (sc === "q2") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE); commit(dir, iso(-50 * 60e3), "src/b.ts", "b\n", CSE); git(dir, "tag", "v1.0.1");
  const s = await server(dir, db);
  show("Q2 ob_end before edit", await s.call("ob_end", { session_summary: "q2" }));
  appendFileSync(join(dir, ".agents/SESSIONS/next-session.md"), "Session 37: shipped a, b, v1.0.1\n");
  show("Q2 ob_end after uncommitted next-session.md edit", await s.call("ob_end", { session_summary: "q2" }));
  await tail(s, tr, "Q2 (correct close, uncommitted edit)");
} else if (sc === "q2after") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  appendFileSync(join(dir, ".agents/SESSIONS/next-session.md"), "Session 37: shipped a\n");
  const s = await server(dir, db);
  show("Q2after ob_end after uncommitted edit (expect close)", (await s.call("ob_end", { session_summary: "q2a" })).text.split("\n")[0]);
  // work after /end, committing ONLY the code file (next-session.md stays as it was at /end)
  writeFileSync(join(dir, "src/after.ts"), "after\n");
  git(dir, "add", "--", "src/after.ts");
  const { execFileSync } = await import("node:child_process");
  execFileSync("git", ["-c", "user.email=qa@example.com", "-c", "user.name=QA", "commit", "-q", "-m", "after end", "-m", `Claude-Session: https://claude.ai/code/session_${CSE}`], { cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: iso(2 * 60e3), GIT_COMMITTER_DATE: iso(2 * 60e3) } });
  show("Q2after status", git(dir, "status", "--porcelain"));
  await tail(s, tr, "Q2after + 1 commit after /end, next-session.md untouched since /end (expect WORK AFTER)");
} else if (sc === "q2c") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  commit(dir, iso(-40 * 60e3), ".agents/SESSIONS/next-session.md", "# Next\nSession 37\n", CSE, "handoff");
  const s = await server(dir, db);
  show("Q2c ob_end after COMMITTED next-session.md edit", await s.call("ob_end", { session_summary: "q2c" }));
  commit(dir, iso(2 * 60e3), "src/after.ts", "x\n", CSE, "after end");
  await tail(s, tr, "Q2c + 1 commit after /end (expect WORK AFTER)");
} else if (sc === "q3") {
  newLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  const s = await server(dir, db);
  show("Q3 ob_end, no set_handoff", await s.call("ob_end", { session_summary: "q3" }));
  // set_handoff for ANOTHER uuid written directly through the writer (the server refuses another uuid by design)
  const { applyStateOps } = await import("file:///C:/qa-scratch/qa289-pr489/open-brain/build/shared/state-writer.js");
  const w = applyStateOps(dir, { session: 50, expected_revision: rev(), session_uuid: OTHER, checkout: "qa", ops: [{ op: "set_handoff", seat: "developer", pick_up: "other seat", watch_out: [], open_questions: [] }] });
  show("Q3 set_handoff for OTHER uuid via writer", { ok: w.ok, error: w.error });
  show("Q3 ob_end after other-uuid handoff (expect still refuse)", await s.call("ob_end", { session_summary: "q3" }));
  const st = await s.call("ob_state", { session: 51, expected_revision: rev(), ops: [{ op: "set_handoff", seat: "developer", pick_up: "pick up Q3", watch_out: [], open_questions: [] }] });
  show("Q3 ob_state set_handoff (this server's proven session)", st.text.split("\n").slice(0, 4).join("\n"));
  show("Q3 handoffs in state.json", JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8")).handoffs.map((h) => h.session_uuid));
  show("Q3 ob_end after set_handoff (expect close)", (await s.call("ob_end", { session_summary: "q3" })).text.split("\n").slice(0, 3).join("\n"));
  commit(dir, iso(2 * 60e3), "src/after.ts", "x\n", CSE, "after end");
  await tail(s, tr, "Q3 + 1 commit after /end (Q6 on new layout: expect WORK AFTER)");
} else if (sc === "q5") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  const s = await server(dir, db);
  show("Q5 old layout reading session", (await s.call("ob_end", { session_summary: "read only" })).text.split("\n").slice(0, 4).join("\n"));
  await tail(s, tr, "Q5 old");
} else if (sc === "q5n") {
  newLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  const s = await server(dir, db);
  show("Q5 new layout reading session", (await s.call("ob_end", { session_summary: "read only" })).text.split("\n").slice(0, 3).join("\n"));
  await tail(s, tr, "Q5 new");
} else if (sc === "q7") {
  newLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  git(dir, "checkout", "-q", "-b", "loop/qa289-seat");
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  commit(dir, iso(-50 * 60e3), "docs/loops/qa289-handoff.md", "# handoff\n", CSE, "handoff");
  const s = await server(dir, db);
  show("Q7 loop seat ob_end (no set_handoff)", (await s.call("ob_end", { session_summary: "q7" })).text.split("\n").slice(0, 3).join("\n"));
  await tail(s, tr, "Q7");
} else if (sc === "q8") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/u1.ts", "u\n", null, "untrailered 1");
  commit(dir, iso(-50 * 60e3), "src/u2.ts", "u\n", null, "untrailered 2");
  const s = await server(dir, db);
  show("Q8 untrailered-only ob_end (expect close, unattributed reported)", (await s.call("ob_end", { session_summary: "q8" })).text.split("\n").slice(0, 4).join("\n"));
  await tail(s, tr, "Q8");
} else if (sc === "q8m") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/u1.ts", "u\n", null, "untrailered 1");
  commit(dir, iso(-50 * 60e3), "src/m1.ts", "m\n", CSE, "mine 1");
  const s = await server(dir, db);
  show("Q8 mixed ob_end (expect refuse: 1 mine, 1 unattributed)", await s.call("ob_end", { session_summary: "q8m" }));
  await s.close();
} else if (sc === "ignored") {
  // Old layout where .agents/ is gitignored (not tracked): edit next-session.md in the session.
  oldLayout(dir, { gitInit: false });
  git(dir, "init", "-q", "-b", "master");
  writeFileSync(join(dir, ".gitignore"), ".agents/\n");
  commit(dir, iso(-30 * 24 * H), "README.md", "base\n", null, "base");
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  appendFileSync(join(dir, ".agents/SESSIONS/next-session.md"), "Session 37: did a\n");
  show("ignored: git status of next-session.md", git(dir, "status", "--porcelain", "--ignored", "--", ".agents/SESSIONS/next-session.md"));
  const s = await server(dir, db);
  show("ignored: ob_end after editing next-session.md (expect close)", await s.call("ob_end", { session_summary: "ign" }));
  await s.close();
} else if (sc === "predirty") {
  // Old layout, next-session.md left dirty by a PREVIOUS session (before this one started); this session edits nothing.
  oldLayout(dir);
  appendFileSync(join(dir, ".agents/SESSIONS/next-session.md"), "stale uncommitted line from session 35\n");
  const { utimesSync } = await import("node:fs");
  const old = (Date.now() - 5 * 24 * H) / 1000; utimesSync(join(dir, ".agents/SESSIONS/next-session.md"), old, old);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE); git(dir, "tag", "v2.0.0");
  const s = await server(dir, db);
  show("predirty: ob_end (next-session.md dirty since 5 days, mtime 5 days old; expect refuse)", (await s.call("ob_end", { session_summary: "pd" })).text.split("\n").slice(0, 3).join("\n"));
  commit(dir, iso(2 * 60e3), "src/after.ts", "x\n", CSE, "after end");
  await tail(s, tr, "predirty + commit after /end");
}
