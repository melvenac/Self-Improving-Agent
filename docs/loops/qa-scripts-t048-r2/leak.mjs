// Which function leaves a handle open on a garbage .db? Usage: node leak.mjs <openBrainDir> <dir>
import { pathToFileURL } from "node:url"; import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
const [ob, dir] = process.argv.slice(2);
const ss = await import(pathToFileURL(join(ob, "build/pipelines/session-end/session-summary.js")).href);
const tryDel = (f) => { try { rmSync(f); return "deletable"; } catch (e) { return "NOT deletable " + e.code; } };
for (const [name, fn] of [
  ["getSessionSummary(target)", (d) => ss.getSessionSummary("qa-target", d)],
  ["getSessionSummary(no id)", (d) => ss.getSessionSummary(undefined, d)],
  ["extractSessionSummary(garbage)", (d) => ss.extractSessionSummary(join(d, "bad.db"))],
]) {
  const d = join(dir, name.replace(/\W+/g, "_")); mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "bad.db"), "garbage bytes, not sqlite");
  let r; try { r = JSON.stringify(fn(d)); } catch (e) { r = "THREW " + e.message; }
  console.log(`${name}: ${r}; bad.db ${tryDel(join(d, "bad.db"))}`);
}
