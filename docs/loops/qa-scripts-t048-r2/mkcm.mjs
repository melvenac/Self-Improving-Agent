// Make a REAL context-mode session db with context-mode 1.0.169's own SessionDB (npm pack, unmodified).
// Usage: node mkcm.mjs <dbPath> <sessionId|-> <projectDir> <events: comma list of type:data | none>
//   sessionId "-" : construct the db (schema) but never call ensureSession (no session_meta row).
import { pathToFileURL } from "node:url";
const CM = "C:/qa-scratch/qa157/cm/package/build/session/db.js";
const { SessionDB } = await import(pathToFileURL(CM).href);
const [dbPath, sid, projectDir, evs = "none"] = process.argv.slice(2);
const s = new SessionDB({ dbPath });
if (sid !== "-") {
  s.ensureSession(sid, projectDir);
  if (evs !== "none") for (const e of evs.split(",")) {
    const [type, ...rest] = e.split(":");
    s.insertEvent(sid, { type, category: type, priority: 2, data: rest.join(":") }, "PostToolUse", { projectDir, source: "qa", confidence: 1 });
  }
}
s.close?.();
console.log(`mkcm: ${dbPath} session=${sid} events=${evs}`);
