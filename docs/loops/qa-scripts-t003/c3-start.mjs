// QA 142: ob_start's session when the server has no proof, and a case-only difference in a claim.
// usage: node c3-start.mjs <build-root> <scratch-dir> <label>
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [CAND, S, LABEL = "?"] = process.argv.slice(2);
const STORE = join(S, "c3-store"), HOMEDIR = join(S, "c3-home"), ROOT = join(S, "c3-proj");
for (const d of [STORE, HOMEDIR, ROOT]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }
Object.assign(process.env, {
  KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "active-session.json"),
  OPEN_BRAIN_VAULT_DIR: join(STORE, "vault"), OPEN_BRAIN_SCORE_HISTORY: join(STORE, "score.jsonl"),
  OPEN_BRAIN_SHADOW_LOG: join(STORE, "shadow.jsonl"), OPEN_BRAIN_IDE: "claude", HOME: HOMEDIR, USERPROFILE: HOMEDIR,
});
const PS = await import(pathToFileURL(join(CAND, "open-brain/build/shared/process-session.js")).href);
let n = 0;
const fresh = async () => import(pathToFileURL(join(CAND, "open-brain/build/server.js")).href + `?c3-${++n}`);
const DIR = PS.byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION);
const prove = (id) => PS.writeProcessSession(DIR, { session_id: id, claude_pid: process.ppid, proc_start: PS.processStartTime(process.ppid), ide: "claude", written_at: new Date().toISOString() });
const SELF = "5e1f5e1f-aaaa-4bbb-8ccc-00000000self".replace("self", "5e1f");
const OTHER = "0be70be7-dddd-4eee-8fff-000000000be7";
console.log(`# c3-start on ${LABEL}`);

// The other session in this checkout: its transcript is the newest, and /start already made its log.
const key = ROOT.replace(/[:\\/]/g, "-");
const pdir = join(HOMEDIR, ".claude", "projects", key);
mkdirSync(pdir, { recursive: true });
writeFileSync(join(pdir, `${OTHER}.jsonl`), "{}\n");
mkdirSync(join(ROOT, ".agents", "SESSIONS"), { recursive: true });
process.chdir(ROOT);
const s0 = await (await fresh()).handleStart({ project_root: ROOT });
const logs0 = readdirSync(join(ROOT, ".agents", "SESSIONS"));
console.log(`INFO    the OTHER session's /start (no proof in this process): ${s0.content[0].text.split("\n").filter((l) => /Session (ID|log|number)|Session_/.test(l)).join(" / ")}; logs: ${logs0.join(", ")}`);

// Now THIS session starts with no proof (hook failed / wrapper / CLAUDE_PID unset).
const s1 = await (await fresh()).handleStart({ project_root: ROOT });
const t1 = s1.content[0].text.split("\n").filter((l) => /Session (ID|log|number)|Session_|reus/i.test(l)).join(" / ");
console.log(`${/0be70be7/.test(t1) ? "BROKEN" : "HOLDS "}  P7b a second session's ob_start with no proof does not take the other session's id or log\n        ${t1}`);

// With a proof, the transcript is ignored.
prove(SELF);
const s2 = await (await fresh()).handleStart({ project_root: ROOT });
const t2 = s2.content[0].text.split("\n").filter((l) => /Session (ID|log|number)|Session_|reus/i.test(l)).join(" / ");
console.log(`${t2.includes(SELF) && !/0be70be7/.test(t2) ? "HOLDS " : "BROKEN"}  P7c with a proof, ob_start stamps the proven id, not the newest transcript's\n        ${t2}`);

// A claim differing from the proof only in letter case.
const srv = await fresh();
const up = await srv.handleSetSession({ session_id: SELF.toUpperCase(), project_dir: ROOT });
console.log(`INFO    P5c a claim that is the proven id in upper case: ${up.isError ? "refused" : "accepted"} — ${up.content[0].text.slice(0, 160)}`);
rmSync(DIR, { recursive: true, force: true });
process.exit(0);
