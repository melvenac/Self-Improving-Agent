// QA 158 (T-171 r2): score T171-D1 and T171-D2 on a build (the candidate a78a883, or a mutant's).
// Scratch record: the build's own test fixture, in a temp dir under <scratch-dir>; every store in scratch.
// usage: node d-r2.mjs <open-brain root of a build> <scratch-dir>
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [OB, S] = process.argv.slice(2);
mkdirSync(S, { recursive: true });
const STORE = mkdtempSync(join(S, "store-"));
process.env.KNOWLEDGE_V2_DB = join(STORE, "k.db");
process.env.OPEN_BRAIN_ACTIVE_SESSION = join(STORE, "active-session.json");
process.env.OPEN_BRAIN_VAULT_DIR = join(STORE, "vault");
process.env.OPEN_BRAIN_SCORE_HISTORY = join(STORE, "score.jsonl");
process.env.OPEN_BRAIN_SHADOW_LOG = join(STORE, "shadow.jsonl");
process.env.OPEN_BRAIN_IDE = "claude";
const imp = (p) => import(pathToFileURL(join(OB, "build", p)).href);
const W = await imp("shared/state-writer.js");
const SV = await imp("server.js");

const fresh = () => {
  const root = mkdtempSync(join(S, "proj-"));
  cpSync(join(OB, "tests/fixtures"), root, { recursive: true });
  cpSync(join(OB, "tests/fixtures-state/state.json"), join(root, ".agents/state.json"));
  return root;
};
const SP = (root) => join(root, ".agents/state.json");
const rec = (root) => JSON.parse(readFileSync(SP(root), "utf8"));
const task = (root, id) => rec(root).tasks.find((t) => t.id === id);
const seed = (root, id, note, by) => { const s = rec(root); const t = s.tasks.find((x) => x.id === id); t.note = note; t.note_by = by; writeFileSync(SP(root), JSON.stringify(s, null, 2) + "\n"); };
const A = "uuid-A", B = "uuid-B";
const w = (root, uuid, ops, dry) => W.applyStateOps(root, { session: 60, expected_revision: rec(root).revision, session_uuid: uuid, ops, dry_run: dry, render: false });
const show = (r) => (r.ok ? `ok ${JSON.stringify(r.note_changes)}` : `REFUSED: ${r.error.slice(0, 150)}`);
const J = JSON.stringify;
let fails = 0;
const verdict = (name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "HOLDS " : "BROKEN"}  ${name}${detail ? "\n        " + String(detail).replace(/\n/g, "\n        ") : ""}`); };
const ID = "T-009";

// ================= T171-D1 =================
// D1a: QA 144's C2h shape: A writes; B supersets with the flag; B's next replace without the flag.
{
  const root = fresh();
  seed(root, ID, "A wrote this.", [A]);
  const r1 = w(root, B, [{ op: "update_task", id: ID, replace_note: "A wrote this. B added this.", replace_other_sessions: true }]);
  const by1 = task(root, ID).note_by;
  const r2 = w(root, B, [{ op: "update_task", id: ID, replace_note: "only B now." }]);
  const kept = task(root, ID).note;
  const r3 = w(root, B, [{ op: "update_task", id: ID, replace_note: "only B now.", replace_other_sessions: true }]);
  verdict("D1a C2h: B's flagged superset of A's note keeps A and adds B; B's next unflagged replace is refused naming A; with the flag it goes through and names A as removed",
    r1.ok && J(by1) === J([A, B]) && !r2.ok && r2.error.includes(A) && kept === "A wrote this. B added this." && r3.ok && (r3.note_changes[0] ?? "").includes(`text by other session(s) removed: ${A}`) && J(task(root, ID).note_by) === J([B]),
    `superset: ${show(r1)} note_by ${J(by1)}\nunflagged: ${show(r2)}\nflagged: ${show(r3)} note_by ${J(task(root, ID).note_by)}`);
}
// D1b: unrecorded (null) stays null; the next unflagged replace is refused as unrecorded.
{
  const root = fresh();
  seed(root, ID, "legacy text", null);
  const r1 = w(root, B, [{ op: "update_task", id: ID, replace_note: "legacy text, and B's", replace_other_sessions: true }]);
  const by1 = task(root, ID).note_by;
  const r2 = w(root, B, [{ op: "update_task", id: ID, replace_note: "B only" }]);
  verdict("D1b a flagged superset of an unrecorded (null) note stays null, and the next unflagged replace is refused as unrecorded",
    r1.ok && by1 === null && !r2.ok && /unrecorded session/.test(r2.error), `superset: ${show(r1)} note_by ${J(by1)}\nunflagged: ${show(r2)}`);
}
// D1c: the same through close_task, and through the ob_state door (write and dry run).
{
  const root = fresh();
  seed(root, ID, "A wrote this.", [A]);
  const r1 = w(root, B, [{ op: "close_task", id: ID, replace_note: "A wrote this. B closed it.", replace_other_sessions: true }]);
  verdict("D1c close_task: a flagged superset keeps A and adds B", r1.ok && J(task(root, ID).note_by) === J([A, B]), `${show(r1)} note_by ${J(task(root, ID).note_by)}`);
  const root2 = fresh();
  seed(root2, ID, "A wrote this.", [A]);
  await SV.handleSetSession({ session_id: B, project_dir: root2 });
  const ops = [{ op: "update_task", id: ID, replace_note: "A wrote this. B via door.", replace_other_sessions: true }];
  const d = await SV.handleState({ project_root: root2, session: 60, expected_revision: rec(root2).revision, ops, dry_run: true });
  const byDry = task(root2, ID).note_by;
  const x = await SV.handleState({ project_root: root2, session: 60, expected_revision: rec(root2).revision, ops });
  const nc = (r) => r.content[0].text.split("\n").filter((l) => l.startsWith("NOTE CHANGE"));
  const ops2 = [{ op: "update_task", id: ID, replace_note: "B via door only." }];
  const y = await SV.handleState({ project_root: root2, session: 60, expected_revision: rec(root2).revision, ops: ops2 });
  verdict("D1d through ob_state (registered B): dry run and write print the same line, the dry run leaves note_by, the write keeps [A, B], and B's next unflagged replace is refused",
    J(nc(d)) === J(nc(x)) && J(byDry) === J([A]) && J(task(root2, ID).note_by) === J([A, B]) && y.isError === true,
    `dry ${J(nc(d))}\nwrite ${J(nc(x))} note_by ${J(task(root2, ID).note_by)}\nnext unflagged: ${y.content[0].text.split("\n").slice(0, 1).join(" ").slice(0, 160)}`);
}
// D1e: the variants of "removes nothing": prepended, surrounded, identical, own, mixed, unregistered.
{
  const rows = [];
  const cases = [
    ["prepend", "A wrote this.", [A], B, "B's preface. A wrote this.", true, [A, B]],
    ["surround", "A wrote this.", [A], B, "(B) A wrote this. (B)", true, [A, B]],
    ["identical", "A wrote this.", [A], B, "A wrote this.", true, [A, B]],
    ["own superset", "B's own.", [B], B, "B's own. More.", false, [B]],
    ["mixed [A,B] by B", "A. — B.", [A, B], B, "A. — B. — B again.", true, [A, B]],
    ["unregistered superset of [A]", "A wrote this.", [A], null, "A wrote this. anon.", true, null],
    ["registered superset of empty", "", [], B, "fresh", false, [B]],
  ];
  let ok = true;
  for (const [label, old, by, u, text, flag, exp] of cases) {
    const root = fresh();
    seed(root, ID, old, by);
    const r = w(root, u, [{ op: "update_task", id: ID, replace_note: text, ...(flag ? { replace_other_sessions: true } : {}) }]);
    const got = task(root, ID).note_by;
    const good = r.ok && J(got) === J(exp) && (old === "" || /no text removed/.test(r.note_changes[0] ?? ""));
    if (!good) ok = false;
    rows.push(`${label}: ${show(r)} note_by ${J(by)} -> ${J(got)} (expected ${J(exp)})`);
  }
  verdict("D1e every replace that removes nothing (prepend, surround, identical, own, mixed, unregistered, from empty) keeps the prior authors and adds the writer; null/unregistered stays null", ok, rows.join("\n"));
}
// D1f: the ruling's boundary. A flagged replace that REMOVES some text but KEEPS another author's text resets
// note_by to the writer alone (by design of the ruling: only a no-removal replace keeps authors). Reported, not scored.
{
  const root = fresh();
  seed(root, ID, "A's finding. — B's first draft.", [A, B]);
  const r1 = w(root, B, [{ op: "update_task", id: ID, replace_note: "A's finding. — B's corrected draft.", replace_other_sessions: true }]);
  const by1 = task(root, ID).note_by;
  const r2 = w(root, B, [{ op: "update_task", id: ID, replace_note: "B only." }]);
  console.log(`INFO    D1f (outside the ruling) B's flagged edit that keeps A's text but changes its own: ${show(r1)} note_by -> ${J(by1)}\n        then B's unflagged replace: ${show(r2)}`);
  const root2 = fresh();
  const legacy = "Loop 1 gap 2: the three Claude Code copies moved together, and the session log names each one — A's addition";
  seed(root2, ID, legacy, null);
  const r3 = w(root2, B, [{ op: "update_task", id: ID, replace_note: legacy.replace("moved", "MOVED"), replace_other_sessions: true }]);
  const by3 = task(root2, ID).note_by;
  const r4 = w(root2, B, [{ op: "update_task", id: ID, replace_note: "B only." }]);
  console.log(`INFO    D1f' the T-171 workaround shape on an unrecorded note ("pass it back whole with the edit inside it", one word changed): ${show(r3)} note_by -> ${J(by3)}\n        then B's unflagged replace: ${show(r4)}`);
}

// ================= T171-D2 =================
const quoted = (line) => (line ?? "").match(/removed text begins: "(.*?)"(;|$)/)?.[1];
const d2 = (label, old, text, expectQuote) => {
  const root = fresh();
  seed(root, ID, old, [A]);
  const r = w(root, A, [{ op: "update_task", id: ID, replace_note: text }]);
  const line = r.note_changes?.[0] ?? "";
  const q = quoted(line);
  const oldBegan = /old text began:/.test(line);
  // "actually removed": the quoted text is not in the new note (quoted text of 0 chars counts as no quote).
  const removedText = q !== undefined && q !== "" && !text.includes(q);
  const firstMissingLine = old.split(/\r?\n/).find((ln) => !text.includes(ln));
  return { label, r, line, q, oldBegan, removedText, matchesExpect: expectQuote === undefined ? null : q === expectQuote, firstMissingLine };
};
const LONG1 = ("Session 78, planner: the finding and its evidence, " + "detail ".repeat(60) + "WORD " + "tail ".repeat(200)).slice(0, 881);
const rows = [
  // the dispatch's three, multi-line
  d2("prefix-keeping, multi-line", "kept line\ngone forever", "kept line", "gone forever"),
  d2("middle deletion, multi-line", "one\ntwo\nthree", "one\nthree", "two"),
  d2("one word changed, every line kept, multi-line", "alpha beta\ngamma delta\nepsilon", "alpha beta\ngamma DELTA\nepsilon", "gamma delta"),
  // the same three on SIA's real shape: one line, appends joined with " — "
  d2("prefix-keeping, one line (' — ' joins)", "first finding — second finding", "first finding", undefined),
  d2("middle deletion, one line", "one — two — three", "one — three", undefined),
  d2("one word changed, one line", "decision: ship A, then review", "decision: ship B, then review", undefined),
  // fallback: every old line is still somewhere in the new text, yet text was removed
  d2("duplicate line removed", "retry\nok\nretry", "retry\nok", undefined),
  d2("short line deleted that is a substring of a kept line", "one\nt\nthree", "one\nthree", undefined),
  d2("CRLF kept head", "kept\r\ngone", "kept", "gone"),
  // SIA's real shape at its real size: one line, 881 chars (the median of master rev 133's 70 notes), edits after char 120
  d2("prefix-keeping, one long line", LONG1, LONG1.slice(0, 600), undefined),
  d2("middle deletion, one long line", LONG1, LONG1.slice(0, 300) + LONG1.slice(500), undefined),
  d2("one word changed, one long line", LONG1, LONG1.replace("WORD", "CHANGED"), undefined),
];
for (const x of rows) {
  const verdictText = x.oldBegan ? "says 'old text began:'" : x.removedText ? "quotes text that is NOT in the new note" : "quotes text that IS STILL in the new note";
  console.log(`D2      ${x.label}: ${verdictText}${x.matchesExpect === null ? "" : x.matchesExpect ? " (the first missing line, as expected)" : " (NOT the expected line)"}\n        ${x.line}`);
}
const multi = rows.slice(0, 3).concat(rows[8]);
verdict("D2a the dispatch's three edits on multi-line notes (and CRLF): the REPLACED line quotes the first old line the new text does not contain, and that text is gone",
  multi.every((x) => x.matchesExpect && x.removedText), multi.map((x) => `${x.label}: ${J(x.q)}`).join("\n"));
const single = rows.slice(3, 6);
verdict("D2b the same three edits on a SHORT one-line note (under 120 chars): the quoted string, as printed, is not in the new note (the whole old line is quoted, so it begins with kept text)",
  single.every((x) => x.removedText || x.oldBegan), single.map((x) => `${x.label}: ${J(x.q)} still in new note: ${!x.removedText}`).join("\n"));
const fb = rows.slice(6, 8);
verdict("D2c the fallback (every old line still appears somewhere in the new text): the quote is removed text or 'old text began:'",
  fb.every((x) => x.removedText || x.oldBegan), fb.map((x) => `${x.label}: ${J(x.q)} still in new note: ${!x.removedText}`).join("\n"));

const lng = rows.slice(9, 12);
verdict("D2d the same three edits on SIA's real shape at its real size (one line of 881 chars, edit after char 120; QA 144's C4b): the quote is removed text or 'old text began:'",
  lng.every((x) => x.removedText || x.oldBegan), lng.map((x) => `${x.label}: ${J(x.q?.slice(0, 60))}... still in new note: ${!x.removedText}`).join("\n"));

console.log(`\n${fails} BROKEN`);
