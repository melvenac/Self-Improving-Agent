// QA 125 check 1b: does T163-2's scan (`state erasures` / the record-erasure /sync check) see the check-1 breaks?
// Each attack is COMMITTED in a scratch clone (v3 record), then the candidate's own CLI scans the history.
// Also a control: a hand edit that deletes another session's handoff (the scan's stated target) must be flagged.
// usage: node c1b-scan.mjs <cand-root> <scratch-dir>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S] = process.argv.slice(2);
const ROOT = join(S, "c1b-proj");
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ID = ["-c", "user.name=qa125", "-c", "user.email=qa125@x"];
rmSync(ROOT, { recursive: true, force: true });
execFileSync("git", ["clone", "-q", "--shared", join(S, "c1-proj"), ROOT]);
// c1-proj's HEAD is 3c0bfdc + the migration commit, so this clone's history is the repo's full history + v3.
const W = await import(pathToFileURL(join(CAND, "open-brain/build/shared/state-writer.js")).href);
const rec = () => JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const H = (seat, text) => ({ op: "set_handoff", seat, pick_up: text, watch_out: [], open_questions: [] });
const step = (msg, o) => {
  const r = W.applyStateOps(ROOT, { expected_revision: rec().revision, ...o });
  if (!r.ok) throw new Error(r.error);
  git(...ID, "commit", "-qam", msg);
  console.log(`${git("rev-parse", "--short", "HEAD")} rev ${r.revision_after}: ${msg}${r.superseded.length ? " [superseded " + r.superseded.length + "]" : ""}`);
};
step("S118 developer handoff (sia-builder)", { session: 118, session_uuid: U(118), checkout: "sia-builder", ops: [H("developer", "Forge 118")] });
step("S120 qa handoff (sia-qa)", { session: 120, session_uuid: U(120), checkout: "sia-qa", ops: [H("qa", "QA 120")] });
step("S121 qa handoff (sia-qa)", { session: 121, session_uuid: U(121), checkout: "sia-qa", ops: [H("qa", "QA 121")] });
step("A6: S124 writes with a mistyped number 1124", { session: 1124, session_uuid: U(124), checkout: "sia-builder", ops: [H("developer", "Forge 124")] });
step("A7: a session registered as S121's uuid overwrites its handoff", { session: 125, session_uuid: U(121), checkout: "sia-qa", ops: [H("qa", "overwritten by an impostor")] });
// Control: the scan's stated target, a hand edit removing another session's entry at v3.
const s = rec(); s.handoffs = s.handoffs.filter((h) => h.session_uuid !== U(124)); s.revision++;
writeFileSync(join(ROOT, ".agents/state.json"), JSON.stringify(s, null, 2) + "\n");
git(...ID, "commit", "-qam", "control: hand edit removes S124's handoff");
console.log(`${git("rev-parse", "--short", "HEAD")} control: hand edit removes S124's handoff`);
console.log("\n--- state erasures (candidate CLI), v3+ lines only:");
let out = "";
try { out = execFileSync("node", [join(CAND, "open-brain/build/cli.js"), "state", "erasures", "."], { cwd: ROOT, encoding: "utf8" }); }
catch (e) { out = (e.stdout || "") + (e.stderr || "") + `\n(exit ${e.status})`; }
const lines = out.split("\n");
console.log(lines.filter((l) => /^Walked|^Erasures|exit/.test(l) || (/rev 13[3-9]|rev 14/.test(l) && !/\[legacy\]/.test(l))).join("\n"));
