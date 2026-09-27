// QA 144 (T-171): attack "a note is never replaced silently" on the CANDIDATE's build.
// Scratch clone of the candidate whose record is origin/master's state.json (rev 133, v2), migrated to v3 by the
// candidate's own CLI. Every write goes to the scratch clone; every store is in scratch.
// usage: node c-attack.mjs <cand-root> <scratch-dir> <live-master.json>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S, LIVE] = process.argv.slice(2);
const ROOT = join(S, "t171-proj");
const STORE = join(S, "t171-store");
process.env.KNOWLEDGE_V2_DB = join(STORE, "k.db");
process.env.OPEN_BRAIN_ACTIVE_SESSION = join(STORE, "active-session.json");
process.env.OPEN_BRAIN_VAULT_DIR = join(STORE, "vault");
process.env.OPEN_BRAIN_SCORE_HISTORY = join(STORE, "score.jsonl");
process.env.OPEN_BRAIN_SHADOW_LOG = join(STORE, "shadow.jsonl");
process.env.OPEN_BRAIN_IDE = "claude";

const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ID = ["-c", "user.name=qa144", "-c", "user.email=qa144@x"];
let migrateOut = "";
if (!existsSync(ROOT)) {
  git(S, "clone", "-q", "--shared", CAND, ROOT);
  git(ROOT, "checkout", "-q", "--detach", "b371176");
  writeFileSync(join(ROOT, ".agents/state.json"), readFileSync(LIVE));
  migrateOut = execFileSync("node", [join(CAND, "open-brain/build/cli.js"), "state", "migrate", ".agents/state.json"], { cwd: ROOT, encoding: "utf8" });
  git(ROOT, ...ID, "commit", "-qam", "scratch: master rev 133 migrated to v3 by b371176");
}
mkdirSync(STORE, { recursive: true });
const imp = (p) => import(pathToFileURL(join(CAND, "open-brain/build", p)).href);
const W = await imp("shared/state-writer.js");
const SV = await imp("server.js");

const SP = join(ROOT, ".agents/state.json");
const reset = () => { git(ROOT, "checkout", "-q", "--", ".agents"); git(ROOT, "clean", "-fdq", ".agents"); rmSync(process.env.OPEN_BRAIN_ACTIVE_SESSION, { force: true }); };
const bytes = () => readFileSync(SP, "utf8");
const rec = () => JSON.parse(bytes());
const task = (id) => rec().tasks.find((t) => t.id === id);
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = U(1), B = U(2), C = U(3);
const write = (o) => W.applyStateOps(ROOT, { expected_revision: rec().revision, session: 300, checkout: "sia-qa", render: false, ...o });
/** Dry run, then the write: returns both, and whether the dry run left the bytes alone and reported identically. */
const dw = (o) => {
  const b0 = bytes();
  const d = write({ ...o, dry_run: true });
  const dryUntouched = bytes() === b0;
  const w = write(o);
  return { d, w, dryUntouched, same: JSON.stringify(d.note_changes) === JSON.stringify(w.note_changes) && d.ok === w.ok };
};
let fails = 0;
const verdict = (name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "HOLDS " : "BROKEN"}  ${name}${detail ? "\n        " + String(detail).replace(/\n/g, "\n        ") : ""}`); };
const show = (r) => (r.ok ? `ok rev ${r.revision_before}->${r.revision_after} note_changes=${JSON.stringify(r.note_changes)}` : `REFUSED: ${r.error}`);
const setNote = (id, note, by) => { const s = rec(); const t = s.tasks.find((x) => x.id === id); t.note = note; t.note_by = by; writeFileSync(SP, JSON.stringify(s, null, 2) + "\n"); };

console.log(`candidate build: ${git(CAND, "rev-parse", "HEAD")}; scratch ${ROOT} @ ${git(ROOT, "rev-parse", "--short", "HEAD")}`);
if (migrateOut) console.log("migrate output:\n  " + migrateOut.trim().split("\n").join("\n  "));

// ---- C0: the migration of SIA's own record ----
reset();
{
  const s = rec();
  const nonEmpty = s.tasks.filter((t) => t.note !== "");
  verdict(`C0 master rev 133 migrates to v3; every one of its ${nonEmpty.length} non-empty notes (of ${s.tasks.length} tasks) gets note_by null`,
    s.schema_version === 3 && nonEmpty.every((t) => t.note_by === null) && s.tasks.filter((t) => t.note === "").every((t) => Array.isArray(t.note_by) && t.note_by.length === 0),
    `schema_version ${s.schema_version}, revision ${s.revision}, note_by values: ${JSON.stringify([...new Set(s.tasks.map((t) => JSON.stringify(t.note_by)))])}`);
}
const openIds = rec().tasks.filter((t) => t.status !== "done").map((t) => t.id);
const doneIds = rec().tasks.filter((t) => t.status === "done").map((t) => t.id);
const T169 = rec().tasks.find((t) => t.id === "T-169");
const OPEN = openIds.find((id) => id !== "T-169");
console.log(`open tasks ${openIds.length}, done ${doneIds.length}; T-169 ${T169 ? `${T169.status}, note ${T169.note.length} chars` : "absent"}; working task ${OPEN}`);

// ---- C1: nothing replaces a note silently ----
reset();
for (const [op, extra] of [["update_task", { status: "in_progress" }], ["close_task", {}]]) {
  for (const dry of [true, false]) {
    const b0 = bytes();
    const r = write({ session_uuid: A, dry_run: dry, ops: [{ op, id: OPEN, ...extra, note: "meant as an addition" }] });
    verdict(`C1a bare \`note\` on ${op}${dry ? " (dry run)" : ""} is refused by name, naming append_note and replace_note, nothing written`,
      !r.ok && /`note` is retired on/.test(r.error) && /append_note/.test(r.error) && /replace_note/.test(r.error) && bytes() === b0, show(r));
  }
  const b0 = bytes();
  const r2 = write({ session_uuid: A, ops: [{ op, id: OPEN, note: "x", append_note: "y" }] });
  verdict(`C1b ${op} with note AND append_note is refused by the retired name first`, !r2.ok && /`note` is retired/.test(r2.error) && bytes() === b0, show(r2));
  for (const alias of ["notes", "Note", "new_note", "set_note", "note_text", "text"]) {
    const r3 = write({ session_uuid: A, ops: [{ op, id: OPEN, [alias]: "x" }] });
    if (r3.ok) verdict(`C1c ${op} with unknown field '${alias}' is refused (strict), not ignored`, false, show(r3));
  }
  verdict(`C1c ${op}: six near-miss field names (notes, Note, new_note, set_note, note_text, text) all refused as unrecognized`, true);
}

// Every op kind, with a note-free argument set, leaves every other task's note byte-identical.
reset();
{
  const notesBefore = JSON.stringify(rec().tasks.map((t) => [t.id, t.note, t.note_by]));
  const ops = [
    { op: "update_task", id: OPEN, title: "renamed by qa144", priority: "P1", status: "blocked" },
    { op: "add_verified", claim: "qa144 probe", evidence: [{ type: "file", path: "README.md", observation: "exists" }] },
    { op: "add_gap", what: "qa144 gap", evidence: "e", recommended_update: "r" },
    { op: "add_decision", title: "qa144 decision", date: "2026-09-26", note: "decision note, not a task note" },
    { op: "set_objective", text: "qa144 objective" },
    { op: "set_handoff", seat: "qa", pick_up: "p", watch_out: [], open_questions: [] },
  ];
  const r = write({ session_uuid: A, ops });
  const after = rec().tasks.map((t) => [t.id, t.note, t.note_by]).filter(([id]) => id !== OPEN);
  const beforeArr = JSON.parse(notesBefore).filter(([id]) => id !== OPEN);
  const t = task(OPEN);
  const orig = JSON.parse(notesBefore).find(([id]) => id === OPEN);
  verdict("C1d six non-note ops (update_task title/priority/status, add_verified, add_gap, add_decision, set_objective, set_handoff) change no task note and report no note change",
    r.ok && JSON.stringify(after) === JSON.stringify(beforeArr) && t.note === orig[1] && JSON.stringify(t.note_by) === JSON.stringify(orig[2]) && r.note_changes.length === 0, show(r));
}

// append_note never removes text, dry run and write identical, on legacy / own / foreign / empty / odd notes.
reset();
{
  const cases = [
    ["legacy (null)", null, null],
    ["own", "own text", [A]],
    ["foreign", "other's text", [B]],
    ["mixed", "both", [B, A]],
    ["ends with the join", "trailing — ", [B]],
    ["multiline+unicode", "line1\r\nline2 ✓ \u{1F600}", [B]],
  ];
  let allOk = true; const lines = [];
  for (const [label, text, by] of cases) {
    reset();
    if (text !== null) setNote(OPEN, text, by);
    const old = task(OPEN).note, oldBy = task(OPEN).note_by;
    for (const op of ["update_task", "close_task"]) {
      reset(); if (text !== null) setNote(OPEN, text, by);
      const { d, w, dryUntouched, same } = dw({ session_uuid: A, ops: [{ op, id: OPEN, append_note: "ADDED" }] });
      const n = task(OPEN);
      const expBy = oldBy === null ? null : oldBy.includes(A) ? oldBy : [...oldBy, A];
      const ok = w.ok && n.note === `${old} — ADDED` && n.note.startsWith(old) && dryUntouched && same && w.note_changes.length === 1 && /APPENDED: \+\d+ chars \(\d+ -> \d+\)/.test(w.note_changes[0])
        && JSON.stringify(n.note_by) === JSON.stringify(expBy);
      if (!ok) allOk = false;
      lines.push(`${label} ${op}: ${w.note_changes[0]} note_by ${JSON.stringify(oldBy)} -> ${JSON.stringify(n.note_by)} dry==write ${same} dry-untouched ${dryUntouched}`);
    }
  }
  verdict("C1e append_note (update_task and close_task) keeps every character, reports sizes identically in dry run and write, and keys note_by (null stays null)", allOk, lines.join("\n"));
  reset();
  const r = write({ session_uuid: A, ops: [{ op: "update_task", id: OPEN, append_note: "" }] });
  verdict("C1f append_note \"\" is refused (nothing to add)", !r.ok, show(r));
}

// reopen_task and open_task report; an atomic refusal reports nothing.
reset();
{
  const done = doneIds[0];
  const before = task(done).note;
  const { w, same, dryUntouched } = dw({ session_uuid: A, ops: [{ op: "reopen_task", id: done, note: "regressed" }] });
  verdict(`C1g reopen_task ${done} appends and reports it, dry run identical`, w.ok && task(done).note === `${before} — regressed` && same && dryUntouched && /APPENDED/.test(w.note_changes[0] ?? ""), show(w));
  reset();
  const o = dw({ session_uuid: A, ops: [{ op: "open_task", title: "t", priority: "P2", note: "why" }] });
  verdict("C1h open_task with a note reports SET, dry run identical", o.w.ok && o.same && /note SET: 0 -> 3 chars/.test(o.w.note_changes[0] ?? ""), show(o.w));
  reset();
  const b0 = bytes();
  const m = write({ session_uuid: A, ops: [{ op: "update_task", id: OPEN, append_note: "kept?" }, { op: "update_task", id: "T-99999", append_note: "x" }] });
  verdict("C1i a batch whose second op is refused writes nothing and reports no note change", !m.ok && bytes() === b0 && m.note_changes.length === 0, show(m));
}

// ---- C2: note_by ----
reset();
{
  const bad = [
    { op: "update_task", id: OPEN, note_by: [A] },
    { op: "update_task", id: OPEN, append_note: "x", note_by: [A] },
    { op: "close_task", id: OPEN, replace_note: "x", note_by: [A] },
    { op: "open_task", title: "t", priority: "P2", note: "x", note_by: [B] },
    { op: "reopen_task", id: doneIds[0], note: "x", note_by: [A] },
    { op: "update_task", id: OPEN, replace_note: "x", replace_other_sessions: false },
    { op: "update_task", id: OPEN, replace_note: "x", replace_other_sessions: "true" },
    { op: "update_task", id: OPEN, append_note: "x", replace_other_sessions: true },
  ];
  const b0 = bytes();
  const out = bad.map((op) => { const r = write({ session_uuid: A, ops: [op] }); return `${JSON.stringify(op).slice(0, 110)} -> ${r.ok ? "ACCEPTED" : "refused: " + r.error.slice(0, 110)}`; });
  verdict("C2a no op can set note_by, and replace_other_sessions accepts only literal true with a replace_note", out.every((l) => l.includes("-> refused")) && bytes() === b0, out.join("\n"));
}
// the server door: extra arguments cannot carry an author either
reset();
{
  await SV.handleSetSession({ session_id: A, project_dir: ROOT });
  const r = await SV.handleState({ project_root: ROOT, session: 300, expected_revision: rec().revision, ops: [{ op: "update_task", id: OPEN, append_note: "via door" }], note_by: [B], session_uuid: B });
  const n = task(OPEN);
  verdict("C2b through ob_state, extra arguments (note_by, session_uuid) are ignored: the append is keyed to the REGISTERED session only (legacy note stays null)",
    !r.isError && n.note_by === null && n.note.endsWith("via door"), r.content[0].text.split("\n").filter((l) => /NOTE CHANGE|refused|applied/.test(l)).join(" | "));
  reset();
  setNote(OPEN, "A's text", [A]);
  await SV.handleSetSession({ session_id: B, project_dir: ROOT });
  await SV.handleState({ project_root: ROOT, session: 301, expected_revision: rec().revision, ops: [{ op: "update_task", id: OPEN, append_note: "B's" }], session_uuid: A });
  verdict("C2c an append adds the writer's (registered) uuid: [A] + B -> [A, B]", JSON.stringify(task(OPEN).note_by) === JSON.stringify([A, B]), JSON.stringify(task(OPEN).note_by));
}
// null behaves as foreign for a registered writer; the flag unlocks it and the report says 'unrecorded'
reset();
{
  const b0 = bytes();
  const r = write({ session_uuid: A, ops: [{ op: "update_task", id: OPEN, replace_note: "new" }] });
  verdict("C2d a migrated (null) note: replace_note without the flag is refused, nothing written", !r.ok && /unrecorded session/.test(r.error) && bytes() === b0, show(r));
  const { w, same, dryUntouched } = dw({ session_uuid: A, ops: [{ op: "update_task", id: OPEN, replace_note: "new", replace_other_sessions: true }] });
  verdict("C2e with replace_other_sessions: true it replaces; the report (dry run identical) names 'unrecorded'; note_by becomes [writer]",
    w.ok && same && dryUntouched && /text by other session\(s\) removed: unrecorded/.test(w.note_changes[0] ?? "") && JSON.stringify(task(OPEN).note_by) === JSON.stringify([A]), show(w));
}
// the schema rule, on every path that can reach the writer
{
  const shapes = [
    ["non-empty note, note_by []", "x", []],
    ["empty note, note_by null", "", null],
    ["empty note, note_by [A]", "", [A]],
    ["note_by [\"\"]", "x", [""]],
    ["note_by a string", "x", A],
  ];
  const out = [];
  for (const [label, note, by] of shapes) {
    reset(); setNote(OPEN, note, by);
    const b0 = bytes();
    const r = write({ session_uuid: A, ops: [{ op: "add_gap", what: "w", evidence: "e", recommended_update: "r" }] });
    out.push(`${label}: ${r.ok ? "LOADED AND WRITTEN" : "refused: " + r.error.slice(0, 120)}${bytes() === b0 ? "" : " (bytes changed)"}`);
  }
  reset();
  { const s = rec(); delete s.tasks.find((x) => x.id === OPEN).note_by; writeFileSync(SP, JSON.stringify(s, null, 2) + "\n"); }
  const rm = write({ session_uuid: A, ops: [{ op: "add_gap", what: "w", evidence: "e", recommended_update: "r" }] });
  out.push(`note_by key absent: ${rm.ok ? "LOADED AND WRITTEN" : "refused: " + rm.error.slice(0, 120)}`);
  verdict("C2f a hand-edited record that breaks the note_by rule (or omits the key) is refused at load by the writer", out.every((l) => l.includes("refused")), out.join("\n"));
  // every op path's result satisfies the rule
  reset();
  const opsPaths = [
    [{ op: "open_task", title: "empty", priority: "P2", note: "" }],
    [{ op: "open_task", title: "unreg", priority: "P2", note: "u" }],
    [{ op: "update_task", id: OPEN, replace_note: "", replace_other_sessions: true }],
  ];
  const res = [];
  for (const [i, ops] of opsPaths.entries()) {
    reset();
    const r = write({ session_uuid: i === 1 ? null : A, ops });
    const s = rec();
    const bad = s.tasks.filter((t) => (t.note === "") !== (Array.isArray(t.note_by) && t.note_by.length === 0));
    res.push(`${JSON.stringify(ops[0]).slice(0, 80)} ${i === 1 ? "(unregistered)" : ""} -> ${r.ok ? "ok" : "refused " + r.error.slice(0, 60)}; violations ${bad.length}; ` + (ops[0].op === "open_task" ? `new task note_by ${JSON.stringify(s.tasks[s.tasks.length - 1].note_by)}` : `note_by ${JSON.stringify(task(OPEN).note_by)}`));
  }
  verdict("C2g open_task with \"\" -> [], unregistered open_task -> null, replace to \"\" -> []: the rule holds after each", res.every((l) => l.includes("violations 0")), res.join("\n"));
}

// ---- C2h: authorship LAUNDERING — a superset replace (nothing removed) resets note_by to the writer alone ----
{
  const lines = [];
  // named author
  reset(); setNote(OPEN, "A wrote this.", [A]);
  const r1 = write({ session_uuid: B, ops: [{ op: "update_task", id: OPEN, replace_note: "A wrote this. B added this.", replace_other_sessions: true }] });
  lines.push(`B superset-replace of A's note (flag): ${show(r1)}; note_by now ${JSON.stringify(task(OPEN).note_by)}`);
  const r2 = write({ session_uuid: B, ops: [{ op: "update_task", id: OPEN, replace_note: "only B now." }] });
  lines.push(`B then replaces WITHOUT the flag: ${show(r2)}; note ${JSON.stringify(task(OPEN).note)}`);
  const laundered = r1.ok && r2.ok && !/other session/.test(r2.note_changes[0] ?? "");
  // legacy
  reset();
  const legacy = task(OPEN).note;
  const r3 = write({ session_uuid: B, ops: [{ op: "update_task", id: OPEN, replace_note: `${legacy}\nB's addition`, replace_other_sessions: true }] });
  const r4 = write({ session_uuid: B, ops: [{ op: "update_task", id: OPEN, replace_note: "gone" }] });
  lines.push(`legacy ${legacy.length}-char note: superset replace (flag): ${show(r3)}\n  then unflagged replace: ${show(r4)}`);
  verdict("C2h a flagged replace that removes NOTHING still drops the previous authors from note_by, so the next replace of their text needs no flag and names no other session",
    !(laundered && r3.ok && r4.ok), lines.join("\n"));
  // contrast: the same outcome through append_note keeps the authors
  reset(); setNote(OPEN, "A wrote this.", [A]);
  write({ session_uuid: B, ops: [{ op: "update_task", id: OPEN, append_note: "B added this." }] });
  const r5 = write({ session_uuid: B, ops: [{ op: "update_task", id: OPEN, replace_note: "only B now." }] });
  verdict("C2h' contrast: after append_note the same unflagged replace IS refused (A still keyed)", !r5.ok, show(r5));
}

// ---- C2i: ownership is a uuid; registration is the only proof (the R179-2 limit) ----
reset();
{
  setNote(OPEN, "A's note, A's session in this checkout", [A]);
  git(ROOT, ...ID, "commit", "-qam", "scratch: A's note");
  await SV.handleSetSession({ session_id: A, project_dir: ROOT });
  await SV.handleState({ project_root: ROOT, session: 310, expected_revision: rec().revision, ops: [{ op: "add_gap", what: "A writes", evidence: "e", recommended_update: "r" }] });
  const regB = await SV.handleSetSession({ session_id: A, project_dir: ROOT }); // B, in the same checkout, registers as A
  const r = await SV.handleState({ project_root: ROOT, session: 311, expected_revision: rec().revision, ops: [{ op: "update_task", id: OPEN, replace_note: "B's" }] });
  const txt = r.content[0].text;
  verdict("C2i (known limit, T-003) a second session in the SAME checkout that registers A's uuid replaces A's note with no flag; the report names no other session",
    true, `register: ${regB.isError ? "REFUSED" : "accepted"}; replace: ${txt.split("\n").filter((l) => /NOTE CHANGE|refused/.test(l)).join(" | ")}`);
  git(ROOT, "reset", "-q", "--hard", "HEAD~1");
}

// ---- C3: the server door; the stale /end shapes (R171-1) ----
reset();
{
  await SV.handleSetSession({ session_id: A, project_dir: ROOT });
  const stale = [
    ["close_task {id, note?}", { op: "close_task", id: OPEN, note: "finished" }],
    ["update_task {id, status?, priority?, title?, note?}", { op: "update_task", id: OPEN, status: "in_progress", note: "status note" }],
  ];
  for (const [label, op] of stale) {
    for (const dry of [true, false]) {
      const b0 = bytes();
      const r = await SV.handleState({ project_root: ROOT, session: 320, expected_revision: rec().revision, ops: [op], dry_run: dry });
      const t = r.content[0].text;
      verdict(`C3a R171-1: the stale global /end line \`${label}\`${dry ? " (dry run)" : ""} is refused through ob_state, the refusal names append_note and replace_note, and nothing is written`,
        r.isError && /append_note/.test(t) && /replace_note/.test(t) && /Nothing written/.test(t) && bytes() === b0, t.split("\n").slice(0, 3).join(" | "));
    }
  }
  const ops = [{ op: "update_task", id: OPEN, append_note: "door append" }];
  const d = await SV.handleState({ project_root: ROOT, session: 320, expected_revision: rec().revision, ops, dry_run: true });
  const w = await SV.handleState({ project_root: ROOT, session: 320, expected_revision: rec().revision, ops });
  const nd = d.content[0].text.split("\n").filter((l) => l.startsWith("NOTE CHANGE:"));
  const nw = w.content[0].text.split("\n").filter((l) => l.startsWith("NOTE CHANGE:"));
  verdict("C3b ob_state prints the same NOTE CHANGE lines in the dry run and the write", nd.length === 1 && JSON.stringify(nd) === JSON.stringify(nw), `dry: ${nd.join(" | ")}\n write: ${nw.join(" | ")}`);
  const ops2 = [{ op: "update_task", id: OPEN, replace_note: "door replace", replace_other_sessions: true }];
  const d2 = await SV.handleState({ project_root: ROOT, session: 320, expected_revision: rec().revision, ops: ops2, dry_run: true });
  const w2 = await SV.handleState({ project_root: ROOT, session: 320, expected_revision: rec().revision, ops: ops2 });
  const rd = d2.content[0].text.split("\n").filter((l) => l.startsWith("NOTE CHANGE:"));
  const rw = w2.content[0].text.split("\n").filter((l) => l.startsWith("NOTE CHANGE:"));
  verdict("C3c ... and for a flagged replace of a migrated note (the destructive case)", rd.length === 1 && JSON.stringify(rd) === JSON.stringify(rw) && /REPLACED/.test(rd[0]), `dry: ${rd.join(" | ")}\n write: ${rw.join(" | ")}`);
}

// ---- C4: the T-169 shape on SIA's own T-169 (or the longest open note) ----
{
  const target = (T169 && T169.status !== "done") ? "T-169" : rec().tasks.filter((t) => t.status !== "done").sort((a, b) => b.note.length - a.note.length)[0].id;
  reset();
  const LONG = task(target).note;
  const CORR = "Correction: README.md is rewritten too, not only PRD.md.";
  const lines = [`target ${target}, note ${LONG.length} chars, first line ${JSON.stringify(LONG.split(/\r?\n/)[0].slice(0, 60))}...`];
  const tries = [
    ["bare note", { op: "update_task", id: target, note: CORR }, A],
    ["replace_note, no flag", { op: "update_task", id: target, replace_note: CORR }, A],
    ["append_note", { op: "update_task", id: target, append_note: CORR }, A],
  ];
  let lost = false;
  for (const [label, op, u] of tries) {
    reset();
    const { d, w } = dw({ session_uuid: u, ops: [op] });
    const now = task(target).note;
    if (!now.includes(LONG) && w.ok && w.note_changes.length === 0) lost = true;
    lines.push(`${label}: dry ${d.ok ? JSON.stringify(d.note_changes) : "refused"}; write ${w.ok ? JSON.stringify(w.note_changes) : "refused: " + w.error.slice(0, 90)}; text kept ${now.includes(LONG)}`);
  }
  // the session's OWN long note, replaced: allowed, but told
  reset(); setNote(target, LONG, [A]);
  const own = dw({ session_uuid: A, ops: [{ op: "update_task", id: target, replace_note: CORR }] });
  lines.push(`own note, replace_note: dry ${JSON.stringify(own.d.note_changes)}; write ${JSON.stringify(own.w.note_changes)}`);
  if (own.w.ok && own.w.note_changes.length === 0) lost = true;
  // a prefix-keeping replace: the report's "removed text begins" quotes text that is KEPT
  reset(); setNote(target, LONG, [A]);
  const keptHead = LONG.slice(0, Math.min(200, LONG.length - 1));
  const pk = write({ session_uuid: A, ops: [{ op: "update_task", id: target, replace_note: `${keptHead} ${CORR}` }] });
  const quoted = (pk.note_changes[0] ?? "").match(/removed text begins: "(.*)"$/)?.[1] ?? "";
  lines.push(`own note, prefix-keeping replace: ${JSON.stringify(pk.note_changes)}; the quoted "removed" text is still in the new note: ${task(target).note.includes(quoted)}`);
  verdict("C4 T-169 shape: no path loses the long note without a NOTE CHANGE line (bare note refused; unflagged replace of migrated text refused; append keeps it; own replace reported)", !lost, lines.join("\n"));
  verdict("C4b the REPLACED line's \"removed text begins\" quotes the old note's first line even when that line is KEPT (prefix-keeping edit)", !(pk.ok && quoted && task(target).note.includes(quoted)), `quoted: ${JSON.stringify(quoted.slice(0, 90))}`);
}

reset();
console.log(`\n${fails} BROKEN`);
