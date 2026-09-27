// QA 154: does an unattributed ob_state write (no proof) record nothing in sessions[] and say so? (end.md line 8)
// Needs the scratch clone q154-r2d1.mjs made. usage: node q154-says.mjs <build-root> <scratch-dir>
import { pathToFileURL } from "node:url"; import { join } from "node:path"; import { mkdirSync, rmSync } from "node:fs"; import { execFileSync } from "node:child_process";
const [CAND, S] = process.argv.slice(2); const ROOT = join(S, "c1r2-proj"); const STORE = join(S, "says-store");
rmSync(STORE, { recursive: true, force: true }); mkdirSync(STORE, { recursive: true });
Object.assign(process.env, { KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "a.json"), OPEN_BRAIN_VAULT_DIR: join(STORE, "v"), OPEN_BRAIN_SCORE_HISTORY: join(STORE, "s.jsonl"), OPEN_BRAIN_SHADOW_LOG: join(STORE, "sh.jsonl"), OPEN_BRAIN_IDE: "claude", HOME: join(S, "home"), USERPROFILE: join(S, "home") });
process.chdir(ROOT);
const SV = await import(pathToFileURL(join(CAND, "open-brain/build/server.js")).href);
const st = JSON.parse((await import("node:fs")).readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
const n0 = st.sessions.length;
const r = await SV.handleState({ project_root: ROOT, session: 5, expected_revision: st.revision, ops: [{ op: "add_decision", title: "qa154 unattributed", date: "2026-09-27", note: "n" }] });
const st2 = JSON.parse((await import("node:fs")).readFileSync(join(ROOT, ".agents/state.json"), "utf8"));
console.log(r.content[0].text); console.log(`sessions[] ${n0} -> ${st2.sessions.length}`);
execFileSync("git", ["checkout", "-q", "--", ".agents"], { cwd: ROOT }); execFileSync("git", ["clean", "-fdq", ".agents"], { cwd: ROOT });
