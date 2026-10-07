// QA 289 row 9 / Q12: Q1, Q3, Q6 with CRLF files, backslash paths and a repo path containing a space.
process.env.QA_AUTOCRLF = "true";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
const L = await import("./lib.mjs");
const { freshDir, oldLayout, newLayout, transcript, prove, server, hook, greet, commit, git, iso, H, R, show, pick, ls } = L;

const sc = process.argv[2];
const UUID = "28900000-0000-4000-8000-00000000c12a";
const CSE = "01QA289windowsCRLFspaceWW";
const NEXT = "28900000-0000-4000-8000-00000000c12b";
const db = `${R}/db/win-${sc}.db`;
const dir = freshDir(`win space/${sc}`);
const bs = (p) => p.replace(/\//g, "\\");
const crlf = (s) => s.split("\n").join("\r\n");
const notices = (g) => pick(g.out, /WORK AFTER|RECORD OK|HANDOFF MISSING|OLD LAYOUT|RECORD NOT/).join("\n") || "(none)";
const head = (r, n = 2) => ({ isError: r.isError, text: r.text.split("\n").slice(0, n).join("\n") });

if (sc === "q1") {
  oldLayout(dir, { eol: "\r\n" });
  const tr = transcript(dir, iso(-2 * H), CSE, "\r\n"); await prove(UUID, bs(tr));
  commit(dir, iso(-60 * 60e3), "src/a.ts", crlf("a\nb\n"), CSE); commit(dir, iso(-50 * 60e3), "src/b.ts", crlf("c\n"), CSE); git(dir, "tag", "v3.1.0");
  show("fixture", { dir: bs(dir), autocrlf: git(dir, "config", "--get", "core.autocrlf") || "(unset; commits pass -c core.autocrlf=true)", nextSessionHasCRLF: readFileSync(join(dir, ".agents/SESSIONS/next-session.md"), "utf8").includes("\r\n"), status: git(dir, "status", "--porcelain") || "(clean)" });
  const s = await server(dir, db);
  show("Q1 win: ob_end project_root backslash+space (expect refuse)", head(await s.call("ob_end", { project_root: bs(dir), session_summary: "w" }), 1));
  appendFileSync(join(dir, ".agents/SESSIONS/next-session.md"), "Session 37 shipped v3.1.0\r\n");
  show("Q1->Q2 win: after CRLF edit (expect close)", head(await s.call("ob_end", { project_root: bs(dir), session_summary: "w" })));
  await s.close();
} else if (sc === "q3") {
  newLayout(dir, { eol: "\r\n" });
  const tr = transcript(dir, iso(-2 * H), CSE, "\r\n"); await prove(UUID, bs(tr));
  commit(dir, iso(-60 * 60e3), "src/a.ts", crlf("a\n"), CSE);
  const s = await server(dir, db);
  show("Q3 win: ob_end (expect refuse)", head(await s.call("ob_end", { project_root: bs(dir), session_summary: "w" }), 1));
  const rev = JSON.parse(readFileSync(join(dir, ".agents/state.json"), "utf8")).revision;
  const st = await s.call("ob_state", { project_root: bs(dir), session: 37, expected_revision: rev, ops: [{ op: "set_handoff", seat: "developer", pick_up: "win", watch_out: [], open_questions: [] }] });
  show("Q3 win: ob_state set_handoff", st.text.split("\n").slice(0, 2).join("\n"));
  show("Q3 win: ob_end after set_handoff (expect close)", head(await s.call("ob_end", { project_root: bs(dir), session_summary: "w" }), 1));
  await s.close();
} else if (sc === "q6") {
  oldLayout(dir, { eol: "\r\n" });
  const tr = transcript(dir, iso(-2 * H), CSE, "\r\n"); await prove(UUID, bs(tr));
  commit(dir, iso(-60 * 60e3), "src/a.ts", crlf("a\n"), CSE);
  commit(dir, iso(-40 * 60e3), ".agents/SESSIONS/next-session.md", crlf("# Next\nSession 37\n"), CSE, "handoff");
  const s = await server(dir, db);
  show("Q6 win: ob_end (next-session committed, expect close)", head(await s.call("ob_end", { project_root: bs(dir), session_summary: "w" })));
  await s.close();
  show("stamp", ls(dir, ".agents/SESSIONS/.ob-end-stamp.json"));
  commit(dir, iso(2 * 60e3), "src/after.ts", crlf("x\n"), CSE, "after end");
  const h = hook(dir, { session_id: UUID, transcript_path: bs(tr), hook_event_name: "SessionEnd" }, db, { CLAUDE_PROJECT_DIR: bs(dir) });
  show(`Q6 win: SessionEnd exit ${h.status}`, pick(h.out, /^\[session-end\] (WORK AFTER|work-after|HANDOFF|handoff check)/).join("\n"));
  for (const n of [1, 2]) show(`Q6 win: greeting #${n}`, notices(greet(dir, NEXT, db)));
}
