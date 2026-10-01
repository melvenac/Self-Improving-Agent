// Extracts every case QA 241's probe script and generator feed to the hook, into qa241-rows.json, WITHOUT running the hook or touching
// the disk (the method r6 used for QA 237's scripts). Each script is loaded against a stand-in qa237/lib.mjs whose runAll() records its
// argument and stops the script, so the scripts' own lists produce exactly the cases QA 241 ran.
//   node docs/loops/t194-r7/extract-qa241-rows.mjs <dir holding QA 241's scripts, with qa237/lib.mjs beside them> [out.json]
// The scripts are read from origin/qa/t194-r6-report: docs/loops/qa-241/{probe-r6,gen-p0}.mjs
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
const outFile = process.argv[3] ?? join(here, "qa241-rows.json");
if (!src) throw new Error("usage: node extract-qa241-rows.mjs <dir with QA 241 scripts> [out.json]");

const work = join(process.env.TEMP ?? "/tmp", "qa241-extract");
mkdirSync(join(work, "qa237"), { recursive: true });
writeFileSync(
  join(work, "qa237", "lib.mjs"),
  `
export class Captured extends Error { constructor(cases) { super("captured"); this.cases = cases; } }
export const makeFixture = (fx) => fx ?? "C:/qa-scratch/qa241-fx";
export const runAll = async (cases) => { throw new Captured(cases); };
export const cli = async () => ({ decision: "allow", reason: "" });
export const bash = (command, cwd) => ({ tool_name: "Bash", tool_input: { command }, cwd });
export const pwsh = (command, cwd) => ({ tool_name: "PowerShell", tool_input: { command }, cwd });
`,
);

const files = ["probe-r6", "gen-p0"];
const rows = [];
for (const f of files) {
  writeFileSync(join(work, `${f}.mjs`), readFileSync(join(src, `${f}.mjs`), "utf8").replace(/^\uFEFF/, ""));
}
for (const f of files) {
  let cases;
  try {
    await import(`${pathToFileURL(join(work, `${f}.mjs`)).href}?x=${Date.now()}`);
    throw new Error(`${f}: runAll was never reached`);
  } catch (e) {
    if (!e || !e.cases) throw e;
    cases = e.cases;
  }
  for (const c of cases) {
    const p = c.payload;
    const cwd = String(p.cwd);
    const m = cwd.match(/^C:\/qa-scratch\/qa241-[^/]+/i);
    rows.push({
      source: f,
      id: String(c.label ?? c.construct ?? c.id),
      tool: p.tool_name,
      command: p.tool_input.command,
      cwd: m ? cwd.slice(m[0].length).replace(/^\//, "") : cwd,
      expect: c.expect ?? null,
      kind: c.kind ?? null,
      construct: c.construct ?? null,
    });
  }
}
writeFileSync(outFile, `${JSON.stringify(rows, null, 1)}\n`);
const by = {};
for (const r of rows) by[r.source + "/" + (r.kind ?? r.expect)] = (by[r.source + "/" + (r.kind ?? r.expect)] ?? 0) + 1;
console.log(`wrote ${rows.length} rows to ${outFile}`, by);
