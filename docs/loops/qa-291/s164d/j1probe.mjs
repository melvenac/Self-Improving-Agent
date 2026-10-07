// QA 291 row 15 (J1): writeSummary on a fresh temp vault per date, through the built #499 head (QA_OB overrides).
import { mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const OB = process.env.QA_OB || "C:/qa-scratch/qa291-pr499/open-brain";
const { writeSummary } = await import(pathToFileURL(join(OB, "build/vault-writer.js")).href);
const today = new Date().toISOString().slice(0, 10);
const dates = ["2026-13-01", "2026-00-00", "2026-02-31", "../x", "../../escaped", "2026-10-07T00:00", "", " 2026-10-07", "2026-10-07\n",
  "2026-02-29", "2028-02-29", "0000-01-01", today];
let i = 0;
for (const date of dates) {
  const vault = `C:/qa-tmp/qa291/j1/v${i++}`;
  rmSync(vault, { recursive: true, force: true }); mkdirSync(vault, { recursive: true });
  let res;
  try { const p = writeSummary(vault, { sessionId: "s", project: "proj", date, model: "m", content: "x" }); res = `written: ${p?.replace(/\\/g, "/").replace(vault + "/", "")}`; }
  catch (e) { res = `${e.constructor.name}: ${e.message}`; }
  console.log(`${JSON.stringify(date).padEnd(22)} ${res} | Summaries/ created: ${existsSync(join(vault, "Summaries"))}`);
}
