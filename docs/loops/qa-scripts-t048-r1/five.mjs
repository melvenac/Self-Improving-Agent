// QA 151: run the three checks that carry SILENT 1/20/26, 2 and 3 from a given build against a given root.
// Usage: node five.mjs <build dir> <root> [label]
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
const [build, root, label = ""] = process.argv.slice(2);
const m = await import(pathToFileURL(`${build}/pipelines/sync/checks.js`).href);
if (label) console.log(`== ${label}`);
for (const f of ["checkRetirements", "checkModuleBoundary", "checkTemplatePersonalNames"]) {
  try { const r = m[f](root); console.log(`${f} [${r.severity}] ${r.message}`); }
  catch (e) { console.log(`${f} THREW ${e.code ?? ""} ${e.message}`); }
}
