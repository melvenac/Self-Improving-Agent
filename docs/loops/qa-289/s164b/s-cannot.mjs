// QA 289 row 5 / Q10: cannot-check paths, ob_end and SessionEnd. Usage: node s-cannot.mjs <scenario>
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { freshDir, oldLayout, newLayout, transcript, prove, unprove, server, hook, commit, git, iso, H, R, show, pick } from "./lib.mjs";

const sc = process.argv[2];
const UUID = "28900000-0000-4000-8000-0000000000e1";
const CSE = "01QA289cannotCheckCCCCCCC";
const db = `${R}/db/cannot-${sc}.db`;
const dir = freshDir(`cannot-${sc}`);
const NP = "C:\\Windows\\System32;C:\\Windows;C:\\Windows\\System32\\WindowsPowerShell\\v1.0;C:\\Windows\\System32\\wbem";
const NOGIT = { PATH: NP, Path: NP };
const head = (r) => ({ isError: r.isError, text: r.text.split("\n").slice(0, 4).join("\n") });
const hk = (label, payload, extra = {}) => {
  const h = hook(dir, { hook_event_name: "SessionEnd", ...payload }, db, extra);
  show(`${label}: SessionEnd exit ${h.status}`, pick(h.out, /^\[session-end\] (HANDOFF|WORK AFTER|work-after|handoff check|session proof)/).join("\n"));
};

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
} else if (sc === "notranscript") {
  oldLayout(dir);
  await prove(UUID, undefined);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE); git(dir, "tag", "v9.0.0");
  const s = await server(dir, db);
  show("no transcript: ob_end (work exists, next-session untouched)", head(await s.call("ob_end", { session_summary: "x" }))); await s.close();
  hk("no transcript", { session_id: UUID });
} else if (sc === "badstate") {
  newLayout(dir);
  writeFileSync(join(dir, ".agents/state.json"), "{ not json");
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  const s = await server(dir, db);
  show("unreadable state.json: ob_end", head(await s.call("ob_end", { session_summary: "x" })));
  show("unreadable state.json: ob_end record_ok", head(await s.call("ob_end", { session_summary: "x", record_ok: "state unreadable" }))); await s.close();
  commit(dir, iso(2 * 60e3), "src/after.ts", "a\n", CSE, "after");
  hk("unreadable state.json", { session_id: UUID, transcript_path: tr });
} else if (sc === "noproof") {
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE);
  await unprove();
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  const s = await server(dir, db);
  show("no proven session (Cursor shape): ob_end", head(await s.call("ob_end", { session_summary: "x" }))); await s.close();
  hk("no session id (Cursor shape)", { transcript_path: tr });
}
