// QA 292 rows 4 (R2) and 5 (R5, R7): cannot-check paths through ob_end, SessionEnd and the greeting.
// Adapted from QA 291's docs/loops/qa-291/s164d/s-cannot.mjs. Added: notranscript-new (new layout), badstate prints the
// whole hook output's state.json lines and two greetings, and every scenario lists the repo's untracked files.
// Usage: node s-cannot.mjs <nogit|norepo|notranscript|notranscript-new|badstate|badstate-nowork|noproof|noproof-new>
import { writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WIN, freshDir, freshDb, oldLayout, newLayout, transcript, prove, unprove, server, hook, greet, commit, git, iso, H, show, pick, storeFiles } from "./lib.mjs";

const sc = process.argv[2];
const UUID = "29200000-0000-4000-8000-0000000000e1";
const CSE = "01QA292cannotCheckEEEEEEE";
const db = freshDb(`${WIN ? "win-" : ""}cannot-${sc}`);
const dir = freshDir(`cannot-${sc}`);
const NP = "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0;C:\\Windows\\System32\\wbem";
const NOGIT = { PATH: NP, Path: NP };
const head = (r, n = 4) => `${r.isError ? "[isError] " : ""}${r.text.split("\n").slice(0, n).join("\n")}`;
const NOTICE = /WORK AFTER|RECORD OK|HANDOFF MISSING|OLD LAYOUT|RECORD NOT|unreadable|state\.json/;
const hk = (label, payload, extra = {}) => {
  const h = hook(dir, { hook_event_name: "SessionEnd", ...payload }, db, extra);
  show(`${label}: SessionEnd exit ${h.status}`, pick(h.out, /^\[session-end\] (HANDOFF|WORK AFTER|work-after|handoff check|session proof)|unreadable|state\.json/).join("\n"));
};
const greetings = () => { for (const n of [1, 2]) show(`greeting #${n} notices`, pick(greet(dir, `29200000-0000-4000-8000-0000000000e${n + 1}`, db).out, NOTICE).join("\n") || "(none)"); };
const untracked = () => { try { return git(dir, "status", "--short", "--untracked-files=all") || "(clean)"; } catch (e) { return `(git status failed: ${String(e.message).split("\n")[0]})`; } };

if (sc === "nogit") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE); git(dir, "tag", "v9.0.0");
  const s = await server(dir, db, NOGIT);
  show("no git: ob_end", head(await s.call("ob_end", { session_summary: "x" }))); await s.close();
  hk("no git", { session_id: UUID, transcript_path: tr }, NOGIT);
} else if (sc === "norepo") {
  oldLayout(dir, { gitInit: false });
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  const s = await server(dir, db);
  show("not a repository: ob_end", head(await s.call("ob_end", { session_summary: "x" }))); await s.close();
  hk("not a repository", { session_id: UUID, transcript_path: tr });
} else if (sc === "notranscript" || sc === "notranscript-new") {
  if (sc === "notranscript") oldLayout(dir); else newLayout(dir);
  await prove(UUID, undefined);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE); git(dir, "tag", "v9.0.0");
  const s = await server(dir, db);
  show("no transcript: ob_end (work exists, record untouched)", head(await s.call("ob_end", { session_summary: "x" }))); await s.close();
  commit(dir, iso(2 * 60e3), "src/after.ts", "a\n", CSE, "after", []);
  show("trailered commits after ob_end", git(dir, "log", "--format=%h %s | %(trailers:key=Claude-Session,valueonly)", "-1"));
  hk("no transcript (stamp present, 1 trailered commit after)", { session_id: UUID });
  greetings();
} else if (sc === "badstate" || sc === "badstate-nowork") {
  newLayout(dir);
  writeFileSync(join(dir, ".agents/state.json"), "{ not json");
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  if (sc === "badstate") commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE, "a", []);
  appendFileSync(join(dir, ".agents/SESSIONS/next-session.md"), "Session 37 edited (an old-layout record write)\n");
  const s = await server(dir, db);
  show(`unreadable state.json (${sc}), next-session.md edited: ob_end`, head(await s.call("ob_end", { session_summary: "x" })));
  show("unreadable state.json: ob_end record_ok", head(await s.call("ob_end", { session_summary: "x", record_ok: "state unreadable" }))); await s.close();
  commit(dir, iso(2 * 60e3), "src/after.ts", "a\n", CSE, "after", []);
  hk("unreadable state.json", { session_id: UUID, transcript_path: tr });
  greetings();
} else if (sc === "noproof" || sc === "noproof-new") {
  if (sc === "noproof") oldLayout(dir); else newLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE);
  await unprove();
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  const s = await server(dir, db);
  show("no proven session (Cursor shape): ob_end", head(await s.call("ob_end", { session_summary: "x" }))); await s.close();
  hk("no session id (Cursor shape)", { transcript_path: tr });
  greetings();
}
show("repo status --untracked-files=all", untracked());
show("store", storeFiles(db));
