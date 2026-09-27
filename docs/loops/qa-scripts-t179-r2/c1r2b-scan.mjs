// QA 134 check 1b/3 (T-179 round 2): what does T163-2 (`state erasures`) see?
//  (a) R179-3: a legacy handoff leaving on its seat's first keyed handoff is EXPLAINED (not flagged);
//  (b) a legacy handoff removed by hand at v3 is FLAGGED (control);
//  (c) a hand edit that only rewrites a victim's first_rev (no removal) and the ob_state write that then drops it.
// Each step is COMMITTED in a scratch clone with full history, then the candidate's own CLI scans it.
// usage: node c1r2b-scan.mjs <cand-root> <scratch-dir>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S] = process.argv.slice(2);
const ROOT = join(S, "c1r2b-proj");
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ID = ["-c", "user.name=qa134", "-c", "user.email=qa134@x"];
rmSync(ROOT, { recursive: true, force: true });
execFileSync("git", ["clone", "-q", "--shared", join(S, "c1-proj"), ROOT], { stdio: "ignore" });
const W = await import(pathToFileURL(join(CAND, "open-brain/build/shared/state-writer.js")).href);
const rec = () => JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const U = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const H = (seat, text) => ({ op: "set_handoff", seat, pick_up: text, watch_out: [], open_questions: [] });
const step = (msg, o) => {
  const r = W.applyStateOps(ROOT, { expected_revision: rec().revision, ...o });
  if (!r.ok) throw new Error(r.error);
  git(...ID, "commit", "-qam", msg);
  console.log(`${git("rev-parse", "--short", "HEAD")} rev ${r.revision_after}: ${msg}${r.superseded.length ? " [superseded: " + r.superseded.join("; ") + "]" : ""}`);
};
const hand = (msg, f) => { const s = rec(); f(s); s.revision++; writeFileSync(join(ROOT, ".agents/state.json"), JSON.stringify(s, null, 2) + "\n"); git(...ID, "commit", "-qam", msg); console.log(`${git("rev-parse", "--short", "HEAD")} rev ${s.revision}: HAND EDIT: ${msg}`); };

step("(a) qa's first keyed handoff (R179-3: qa@75 legacy leaves)", { session: 140, session_uuid: U(140), checkout: "sia-qa", ops: [H("qa", "QA 140")] });
hand("(b) control: remove the legacy developer@74 handoff by hand", (s) => { s.handoffs = s.handoffs.filter((h) => !(h.first_rev === null && h.seat === "developer")); });
for (let i = 0; i < 12; i++) step(`filler session ${150 + i} (checkout co-${i})`, { session: 150 + i, session_uuid: U(150 + i), checkout: `co-${i}`, ops: [{ op: "add_gap", what: `f${i}`, evidence: "e", recommended_update: "u" }] });
step("victim S170 developer handoff (sia-builder)", { session: 170, session_uuid: U(170), checkout: "sia-builder", ops: [H("developer", "victim 170")] });
step("S171 developer handoff (sia-builder), newer of the same instance", { session: 171, session_uuid: U(171), checkout: "sia-builder", ops: [H("developer", "171")] });
hand("(c) rewrite victim S170's first_rev to 0 (handoff and session record); nothing removed", (s) => {
  for (const h of s.handoffs) if (h.session_uuid === U(170)) h.first_rev = 0;
  for (const x of s.sessions) if (x.uuid === U(170)) x.first_rev = 0;
});
step("(c) an ordinary ob_state write by a new session", { session: 172, session_uuid: U(172), checkout: "sia-qa", ops: [{ op: "add_gap", what: "ordinary", evidence: "e", recommended_update: "u" }] });
console.log(`victim S170 handoff present after: ${rec().handoffs.some((h) => h.session_uuid === U(170))}`);

console.log("\n--- state erasures (candidate CLI), lines at schema v3+ and the totals:");
let out = "";
try { out = execFileSync("node", [join(CAND, "open-brain/build/cli.js"), "state", "erasures", "."], { cwd: ROOT, encoding: "utf8" }); }
catch (e) { out = (e.stdout || "") + (e.stderr || "") + `\n(exit ${e.status})`; }
console.log(out.split("\n").filter((l) => /^Walked|^Erasures|exit|\[v3\+\]/.test(l)).join("\n"));
