// QA 154: QA 134's R1g with a REAL proof. The writer accepts the victim's uuid when the write says checkout
// "sia-builder" (q154-r2d1 W2), so a caller-supplied checkout on ob_state would bypass R2-D1. The server holds the
// victim's proof; ob_state is called with extra checkout/session_uuid arguments and with them inside an op.
// Needs the scratch clone q154-r2d1.mjs made. usage: node q154-r1g.mjs <build-root> <scratch-dir>
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const [CAND, S] = process.argv.slice(2);
const ROOT = join(S, "c1r2-proj"), STORE = join(S, "r1g-store");
rmSync(STORE, { recursive: true, force: true }); mkdirSync(STORE, { recursive: true });
Object.assign(process.env, { KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "a.json"), OPEN_BRAIN_VAULT_DIR: join(STORE, "v"),
  OPEN_BRAIN_SCORE_HISTORY: join(STORE, "s.jsonl"), OPEN_BRAIN_SHADOW_LOG: join(STORE, "sh.jsonl"), OPEN_BRAIN_IDE: "claude", HOME: join(S, "home"), USERPROFILE: join(S, "home") });
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });
git("checkout", "-q", "--", ".agents"); git("clean", "-fdq", ".agents");
const W = await import(pathToFileURL(join(CAND, "open-brain/build/shared/state-writer.js")).href);
const PS = await import(pathToFileURL(join(CAND, "open-brain/build/shared/process-session.js")).href);
const rec = () => JSON.parse(readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const V = "00000800-0000-4000-8000-000000000800";
const H = (t, extra = {}) => ({ op: "set_handoff", seat: "developer", pick_up: t, watch_out: [], open_questions: [], ...extra });
W.applyStateOps(ROOT, { session: 800, expected_revision: rec().revision, session_uuid: V, checkout: "sia-builder", render: false, ops: [H("victim in sia-builder")] });
PS.writeProcessSession(PS.byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION), { session_id: V, claude_pid: process.ppid, proc_start: PS.processStartTime(process.ppid), ide: "claude", written_at: new Date().toISOString() });
process.chdir(ROOT);
const SV = await import(pathToFileURL(join(CAND, "open-brain/build/server.js")).href);
let fails = 0;
const t = (r) => r.content[0].text.split("\n").slice(0, 2).join(" / ").slice(0, 220);
const a = await SV.handleState({ project_root: ROOT, session: 801, expected_revision: rec().revision, ops: [H("R1g: replaced")], checkout: "sia-builder", session_uuid: "00000999-0000-4000-8000-000000000999" });
const okA = a.isError === true && rec().handoffs.find((h) => h.session_uuid === V)?.pick_up === "victim in sia-builder";
if (!okA) fails++;
console.log(`${okA ? "HOLDS " : "BROKEN"}  R1g-p extra checkout "sia-builder" / session_uuid arguments to ob_state do not reach the writer\n        ${t(a)}`);
const b = await SV.handleState({ project_root: ROOT, session: 801, expected_revision: rec().revision, ops: [H("R1g: in op", { checkout: "sia-builder" })] });
const okB = b.isError === true && rec().handoffs.find((h) => h.session_uuid === V)?.pick_up === "victim in sia-builder";
if (!okB) fails++;
console.log(`${okB ? "HOLDS " : "BROKEN"}  R1g-p2 checkout inside an op is refused\n        ${t(b)}`);
git("checkout", "-q", "--", ".agents"); git("clean", "-fdq", ".agents");
rmSync(PS.byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION), { recursive: true, force: true });
console.log(`\n${fails} BROKEN`);
