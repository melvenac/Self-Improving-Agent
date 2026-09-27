// Two sessions of one project on one day, each with its own real context-mode db. Usage: node second-session.mjs <label> <openBrain> <dir>
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { mkdirSync, rmSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const [label, ob, dir] = process.argv.slice(2);
rmSync(dir, { recursive: true, force: true });
const sessions = join(dir, "sessions"), vault = join(dir, "vault");
mkdirSync(sessions, { recursive: true }); mkdirSync(vault, { recursive: true });
process.env.OPEN_BRAIN_VAULT_DIR = vault;
const mk = (f, sid, ev) => spawnSync(process.execPath, ["C:/qa-scratch/qa157/scripts/mkcm.mjs", join(sessions, f), sid, "C:/qa-proj", ev], { env: { ...process.env, NODE_NO_WARNINGS: "1" } });
mk("a.db", "morning", "user_prompt:morning work,decision:do A");
mk("b.db", "evening", "user_prompt:evening work,decision:do B");
const dbv2 = await import(pathToFileURL(join(ob, "build/db-v2.js")).href);
const se = await import(pathToFileURL(join(ob, "build/pipelines/session-end/index-v2.js")).href);
const ss = await import(pathToFileURL(join(ob, "build/pipelines/session-end/session-summary.js")).href);
for (const sid of ["morning", "evening"]) {
  const db = dbv2.openV2Database(join(dir, "k.db"));
  let res;
  if (label === "base") {
    // base ignores sessionsDir: self-generate here with its own extractor, then pass the text (same path the hook takes)
    const s = ss.extractSessionSummary(join(sessions, sid === "morning" ? "a.db" : "b.db"));
    res = se.sessionEndV2({ db, vaultDir: vault, agentsDir: dir, sessionId: sid, sessionSummary: s.summary, project: "qa-proj", recalledEntryIds: [], dryRun: false });
  } else {
    res = se.sessionEndV2({ db, vaultDir: vault, agentsDir: dir, sessionId: sid, sessionSummary: "", project: "qa-proj", recalledEntryIds: [], dryRun: false, sessionsDir: sessions });
  }
  const line = se.formatSessionEndLines ? se.formatSessionEndLines(res)[0] : `Summary: ${res.summary.written ? "written" : "skipped"}`;
  console.log(`[${label}] session ${sid}: ${JSON.stringify(res.summary)} -> "${line}"`);
  db.close();
}
console.log(`[${label}] vault/Summaries: ${readdirSync(join(vault, "Summaries")).join(", ")}`);
