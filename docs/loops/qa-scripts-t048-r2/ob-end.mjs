// What MCP ob_end (server.ts handleEnd, NOT edited by the candidate) prints when a feedback_log write throws and a
// recalled row is gone. Env: HOME/USERPROFILE/KNOWLEDGE_V2_DB/OPEN_BRAIN_VAULT_DIR in scratch (set by the caller).
// Usage: node ob-end.mjs <openBrain> <projectDir>
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
const [ob, proj] = process.argv.slice(2);
mkdirSync(proj, { recursive: true });
const dbv2 = await import(pathToFileURL(join(ob, "build/db-v2.js")).href);
const db = dbv2.openV2Database(process.env.KNOWLEDGE_V2_DB);
const ids = ["gone", "refused", "fine", "unjudged"].map((key) => {
  dbv2.indexKnowledge(db, { vaultPath: `/vault/Experiences/qa/${key}.md`, key, tags: "qa", content: key });
  return db.prepare("SELECT id FROM knowledge_index WHERE key = ?").get(key).id;
});
db.prepare("DELETE FROM knowledge_index WHERE id = ?").run(ids[0]);
db.exec(`CREATE TRIGGER qa_fail BEFORE INSERT ON feedback_log WHEN NEW.knowledge_id = ${ids[1]} BEGIN SELECT RAISE(ABORT, 'qa157 trigger'); END;`);
db.close();
const server = await import(pathToFileURL(join(ob, "build/server.js")).href);
const r = await server.handleEnd({ project_root: proj, session_id: "qa157-obend", session_summary: "qa text", recalled_entry_ids: ids,
  entry_ratings: { [ids[1]]: "helpful", [ids[2]]: "helpful" } });
console.log(`ids gone=${ids[0]} refused=${ids[1]} fine=${ids[2]} unjudged=${ids[3]}`);
console.log(r.content[0].text.split("\n").filter((l) => /Summary|Recalled|Feedback|Invocations|error/i.test(l)).join("\n"));
process.exit(0);
