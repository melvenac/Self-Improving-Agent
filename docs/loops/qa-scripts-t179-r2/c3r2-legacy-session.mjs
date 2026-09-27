// QA 134: is the surviving mutant `erasure-legacy-session` equivalent? A hand edit at v3 removes the migrated LEGACY
// session record (the uuid the migration promised to keep), after the planner seat has written a keyed session.
// Scanned by the given build's `state erasures`. usage: node c3r2-legacy-session.mjs <build-root> <scratch-dir> <label>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [B, S, LABEL] = process.argv.slice(2);
const ROOT = join(S, `c3r2-${LABEL}`);
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const ID = ["-c", "user.name=qa134", "-c", "user.email=qa134@x"];
rmSync(ROOT, { recursive: true, force: true });
execFileSync("git", ["clone", "-q", "--shared", join(S, "c1-proj"), ROOT], { stdio: "ignore" });
const W = await import(pathToFileURL(join(B, "open-brain/build/shared/state-writer.js")).href);
const rec = () => JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const r = W.applyStateOps(ROOT, { expected_revision: rec().revision, session: 150, session_uuid: "00000150-0000-4000-8000-000000000150", checkout: "sia-planner",
  ops: [{ op: "set_handoff", seat: "planner", pick_up: "keyed planner 150", watch_out: [], open_questions: [], loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } }] });
if (!r.ok) throw new Error(r.error);
git(...ID, "commit", "-qam", "keyed planner session 150");
const s = rec(); const legacy = s.sessions.find((x) => x.first_rev === null);
s.sessions = s.sessions.filter((x) => x !== legacy); s.revision++;
writeFileSync(join(ROOT, ".agents/state.json"), JSON.stringify(s, null, 2) + "\n");
git(...ID, "commit", "-qam", "HAND EDIT: remove the legacy session record");
console.log(`${LABEL}: removed legacy session ${legacy.uuid} (n ${legacy.n}, ${legacy.seat}) by hand at rev ${s.revision}`);
let out = "";
try { out = execFileSync("node", [join(B, "open-brain/build/cli.js"), "state", "erasures", "."], { cwd: ROOT, encoding: "utf8" }); }
catch (e) { out = (e.stdout || "") + (e.stderr || "") + `\n(exit ${e.status})`; }
console.log(out.split("\n").filter((l) => /^Erasures|\[v3\+\]/.test(l)).join("\n"));
