// QA 144: is each surviving mutant equivalent? Runs the same three behaviours against a build (the candidate, or a
// mutant's). Scratch record: the fixture state from the build's own tests, in a temp dir; stores in scratch.
// usage: node survivors.mjs <open-brain root of the build> <scratch-dir>
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
const rec = (root) => JSON.parse(readFileSync(join(root, ".agents/state.json"), "utf8"));
const seed = (root, id, note, by) => { const s = rec(root); const t = s.tasks.find((x) => x.id === id); t.note = note; t.note_by = by; writeFileSync(join(root, ".agents/state.json"), JSON.stringify(s, null, 2) + "\n"); };
const A = "uuid-A", B = "uuid-B";
const w = (root, uuid, ops, dry) => W.applyStateOps(root, { session: 60, expected_revision: rec(root).revision, session_uuid: uuid, ops, dry_run: dry, render: false });

// S1 dry-run-hides-replace: does ob_state's DRY RUN print the REPLACED line?
{
  const root = fresh();
  seed(root, "T-009", "the session's own long note\nsecond line", ["t171-probe"]);
  await SV.handleSetSession({ session_id: "t171-probe", project_dir: root });
  const d = await SV.handleState({ project_root: root, session: 60, expected_revision: rec(root).revision, ops: [{ op: "update_task", id: "T-009", replace_note: "short" }], dry_run: true });
  const lines = d.content[0].text.split("\n");
  console.log(`S1 dry run of a replace through ob_state: ${lines[0]} | NOTE CHANGE lines: ${JSON.stringify(lines.filter((l) => l.startsWith("NOTE CHANGE")))}`);
}
// S2 removes-by-length: a LONGER rewrite that drops the old text
{
  const root = fresh();
  seed(root, "T-009", "decision: ship A", [A]);
  const r = w(root, A, [{ op: "update_task", id: "T-009", replace_note: "decision reversed: ship B instead, see D-099" }]);
  console.log(`S2 own 16-char note rewritten to a longer text without it: ${JSON.stringify(r.note_changes)}`);
}
// S3 superset-foreign-unflagged: B replaces A's note with a superset, no flag; then removes A's text, no flag
{
  const root = fresh();
  seed(root, "T-009", "A's finding.", [A]);
  const r1 = w(root, B, [{ op: "update_task", id: "T-009", replace_note: "A's finding. B's addition." }]);
  const by = rec(root).tasks.find((t) => t.id === "T-009").note_by;
  const r2 = w(root, B, [{ op: "update_task", id: "T-009", replace_note: "B's only." }]);
  console.log(`S3 B superset-replaces A's note, no flag: ${r1.ok ? "ACCEPTED " + JSON.stringify(r1.note_changes) : "refused: " + r1.error.slice(0, 80)}; note_by ${JSON.stringify(by)}`);
  console.log(`   then B replaces it, no flag: ${r2.ok ? "ACCEPTED " + JSON.stringify(r2.note_changes) : "refused: " + r2.error.slice(0, 80)}`);
}
