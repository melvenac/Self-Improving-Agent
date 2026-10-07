// QA 289 wrapper: run argv[2..] with temp/state redirected under C:/qa-tmp/qa289.
// Usage: node C:/qa-tmp/qa289/run.mjs <cwd> <cmd> [args...]
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const R = "C:/qa-tmp/qa289";
for (const d of ["tmp", "state", "vault", "home"]) mkdirSync(`${R}/${d}`, { recursive: true });
export const QA_ENV = {
  ...process.env,
  TEMP: "C:\\qa-tmp\\qa289\\tmp",
  TMP: "C:\\qa-tmp\\qa289\\tmp",
  TMPDIR: "C:/qa-tmp/qa289/tmp",
  KNOWLEDGE_V2_DB: process.env.QA_DB || `${R}/kb.db`,
  OPEN_BRAIN_SCORE_HISTORY: `${R}/state/score-history.jsonl`,
  OPEN_BRAIN_SHADOW_LOG: `${R}/state/shadow-recall.jsonl`,
  OPEN_BRAIN_ACTIVE_SESSION: process.env.QA_ACTIVE || `${R}/state/active-session.json`,
  OPEN_BRAIN_VAULT_DIR: `${R}/vault`,
  npm_config_cache: `${R}/npm-cache`,
};
if (process.argv[1]?.replace(/\\/g, "/").endsWith("qa289/run.mjs") && process.argv.length > 3) {
  const [cwd, cmd, ...args] = process.argv.slice(2);
  const r = spawnSync(cmd, args, { cwd, env: QA_ENV, stdio: "inherit", shell: process.platform === "win32" });
  process.exit(r.status ?? 1);
}
