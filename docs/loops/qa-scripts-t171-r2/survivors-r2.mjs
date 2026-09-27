// QA 158 (T-171 r2): is each of my surviving mutants equivalent? The same five behaviours against a build (the
// candidate a78a883, or a mutant's). Scratch record: the build's own test fixture in a temp dir; stores in scratch.
// usage: node survivors-r2.mjs <build dir (holds the compiled build/)> <open-brain root for tests/fixtures> <scratch-dir>
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [BUILD, OB, S] = process.argv.slice(2);
mkdirSync(S, { recursive: true });
const STORE = mkdtempSync(join(S, "store-"));
process.env.KNOWLEDGE_V2_DB = join(STORE, "k.db");
process.env.OPEN_BRAIN_ACTIVE_SESSION = join(STORE, "active-session.json");
process.env.OPEN_BRAIN_VAULT_DIR = join(STORE, "vault");
process.env.OPEN_BRAIN_SCORE_HISTORY = join(STORE, "score.jsonl");
process.env.OPEN_BRAIN_SHADOW_LOG = join(STORE, "shadow.jsonl");
process.env.OPEN_BRAIN_IDE = "claude";
const imp = (p) => import(pathToFileURL(join(BUILD, "build", p)).href);
const W = await imp("shared/state-writer.js");
const SV = await imp("server.js");

const fresh = () => {
  const root = mkdtempSync(join(S, "proj-"));
  cpSync(join(OB, "tests/fixtures"), root, { recursive: true });
  cpSync(join(OB, "tests/fixtures-state/state.json"), join(root, ".agents/state.json"));
  return root;
};
const rec = (root) => JSON.parse(readFileSync(join(root, ".agents/state.json"), "utf8"));
const task = (root, id) => rec(root).tasks.find((t) => t.id === id);
const seed = (root, id, note, by) => { const s = rec(root); const t = s.tasks.find((x) => x.id === id); t.note = note; t.note_by = by; writeFileSync(join(root, ".agents/state.json"), JSON.stringify(s, null, 2) + "\n"); };
const A = "uuid-A", B = "uuid-B";
const w = (root, uuid, ops, dry) => W.applyStateOps(root, { session: 60, expected_revision: rec(root).revision, session_uuid: uuid, ops, dry_run: dry, render: false });
const show = (r) => (r.ok ? `ACCEPTED ${JSON.stringify(r.note_changes)}` : `refused: ${r.error.slice(0, 100)}`);
const ID = "T-009";

// S1 d1-superset-prefix-only: B PREPENDS to A's note (flag), then replaces it without the flag.
{
  const root = fresh();
  seed(root, ID, "A's finding.", [A]);
  const r1 = w(root, B, [{ op: "update_task", id: ID, replace_note: "B's preface. A's finding.", replace_other_sessions: true }]);
  const by = task(root, ID).note_by;
  const r2 = w(root, B, [{ op: "update_task", id: ID, replace_note: "B's only." }]);
  console.log(`S1 B prepends to A's note (flag): ${show(r1)}; note_by ${JSON.stringify(by)}\n   then B replaces it, no flag: ${show(r2)}`);
}
// S2 d1-unregistered-superset-keeps-nonempty: an unregistered write supersets A's note; then A replaces it without the flag.
{
  const root = fresh();
  seed(root, ID, "A's finding.", [A]);
  const r1 = w(root, null, [{ op: "update_task", id: ID, replace_note: "A's finding. Unknown writer's addition.", replace_other_sessions: true }]);
  const by = task(root, ID).note_by;
  const r2 = w(root, A, [{ op: "update_task", id: ID, replace_note: "A's only." }]);
  console.log(`S2 unregistered superset of A's note (flag): ${show(r1)}; note_by ${JSON.stringify(by)}\n   then A replaces it, no flag: ${show(r2)}`);
}
// S3 d2-kept-by-prefix: a kept SECOND line before the first removed one.
{
  const root = fresh();
  seed(root, ID, "intro\nkept second line\ngone third line", [A]);
  const r = w(root, A, [{ op: "update_task", id: ID, replace_note: "intro\nkept second line" }]);
  console.log(`S3 own note "intro / kept second line / gone third line" -> first two lines: ${show(r)}`);
}
// S4 dry-run-hides-foreign-replace: ob_state's dry run of a flagged replace of another session's note.
{
  const root = fresh();
  seed(root, ID, "A's long finding\nsecond line", [A]);
  await SV.handleSetSession({ session_id: B, project_dir: root });
  const ops = [{ op: "update_task", id: ID, replace_note: "short", replace_other_sessions: true }];
  const d = await SV.handleState({ project_root: root, session: 60, expected_revision: rec(root).revision, ops, dry_run: true });
  const x = await SV.handleState({ project_root: root, session: 60, expected_revision: rec(root).revision, ops });
  const nc = (r) => JSON.stringify(r.content[0].text.split("\n").filter((l) => l.startsWith("NOTE CHANGE")));
  console.log(`S4 B's flagged replace of A's note through ob_state: dry run ${d.content[0].text.split("\n")[0]} NOTE CHANGE ${nc(d)}\n   the write: NOTE CHANGE ${nc(x)}`);
}
// S5 removes-by-head: the session's own 881-char note truncated to its first 300 chars.
{
  const root = fresh();
  const LONG = ("Own long note: " + "detail ".repeat(200)).slice(0, 881);
  seed(root, ID, LONG, [A]);
  const r = w(root, A, [{ op: "update_task", id: ID, replace_note: LONG.slice(0, 300) }]);
  console.log(`S5 own 881-char note truncated to 300 chars: ${show(r)}`);
}
