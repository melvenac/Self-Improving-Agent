// QA 154: end.md step 3 says "Without a proof ob_recalled says why and lists nothing". The recalled-ids resolver still
// falls back to a .recalled-entries.json that names no session. No proof here; the file is planted by hand.
// usage: node q154-file-fallback.mjs <build-root> <scratch-dir>
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const [CAND, S] = process.argv.slice(2);
const STORE = join(S, "ff-store"), PROJ = join(S, "ff-proj");
for (const d of [STORE, PROJ]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }
Object.assign(process.env, { KNOWLEDGE_V2_DB: join(STORE, "k.db"), OPEN_BRAIN_ACTIVE_SESSION: join(STORE, "a.json"), OPEN_BRAIN_VAULT_DIR: join(STORE, "v"),
  OPEN_BRAIN_SCORE_HISTORY: join(STORE, "s.jsonl"), OPEN_BRAIN_SHADOW_LOG: join(STORE, "sh.jsonl"), OPEN_BRAIN_IDE: "claude", HOME: join(S, "ff-home"), USERPROFILE: join(S, "ff-home") });
process.chdir(PROJ);
const SV = await import(pathToFileURL(join(CAND, "open-brain/build/server.js")).href);
const Database = (await import(pathToFileURL(join(CAND, "open-brain/node_modules/better-sqlite3/lib/index.js")).href)).default;
await SV.handleStore?.({ content: "qa154 ff", key: "qa154-ff" });
const DB = await import(pathToFileURL(join(CAND, "open-brain/build/db-v2.js")).href);
const db = new Database(process.env.KNOWLEDGE_V2_DB); DB.initSchemaV2(db);
DB.indexKnowledge(db, { vaultPath: join(PROJ, "ff.md"), key: "qa154-ff2", content: "ff target", tags: "qa154", source: "manual" });
const id = db.prepare("select id from knowledge_index where key='qa154-ff2'").get().id;
const c0 = db.prepare("select helpful from knowledge_index where id=?").get(id).helpful; db.close();
writeFileSync(join(PROJ, ".recalled-entries.json"), JSON.stringify({ entries: [{ id }] }));
const e = await SV.handleEnd({ project_root: PROJ, entry_ratings: { [id]: "helpful" }, session_summary: "qa154 ff" });
const d2 = new Database(process.env.KNOWLEDGE_V2_DB, { readonly: true });
console.log(`no proof, a sessionless .recalled-entries.json naming entry ${id}:`);
console.log(`  ob_end: ${e.content[0].text.split("\n").filter((l) => /Recalled ids|Feedback/.test(l)).join(" /")}`);
console.log(`  helpful counter ${c0} -> ${d2.prepare("select helpful from knowledge_index where id=?").get(id).helpful}; feedback_log rows: ${d2.prepare("select count(*) n from feedback_log").get().n}`);
d2.close();
