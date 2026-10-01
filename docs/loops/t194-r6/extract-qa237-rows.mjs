// Extracts every case QA 237's probe scripts and generators feed to the hook, into qa237-rows.json, WITHOUT running the
// hook or touching the disk. Each script is loaded against a stand-in lib.mjs whose runAll() records its argument and stops
// the script; the scripts' own seeded generators therefore produce exactly the cases QA 237 ran.
//   node docs/loops/t194-r6/extract-qa237-rows.mjs <dir holding QA 237's scripts> [out.json]
// The scripts are read from origin/qa/t194-r5-report: docs/loops/qa-237/*.mjs (copy them into <dir> first).
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2];
const outFile = process.argv[3] ?? join(here, "qa237-rows.json");
if (!src) throw new Error("usage: node extract-qa237-rows.mjs <dir with QA 237 scripts> [out.json]");

const work = join(process.env.TEMP ?? "/tmp", "qa237-extract");
mkdirSync(work, { recursive: true });
const FX = "C:/qa-scratch/qa237-fx";
writeFileSync(
  join(work, "lib.mjs"),
  `
export const FX = ${JSON.stringify(FX)};
export const BUILD = "unused";
export const NOHOME = "unused";
export const makeFixture = () => FX;
export class Captured extends Error { constructor(cases) { super("captured"); this.cases = cases; } }
export const runAll = async (cases) => { throw new Captured(cases); };
export const cli = async () => ({ decision: "allow", reason: "" });
export const bash = (command, cwd = FX) => ({ tool_name: "Bash", tool_input: { command }, cwd });
export const pwsh = (command, cwd = FX) => ({ tool_name: "PowerShell", tool_input: { command }, cwd });
export const write = (file_path, cwd = FX) => ({ tool_name: "Write", tool_input: { file_path, content: "x" }, cwd });
export const edit = (file_path, cwd = FX) => ({ tool_name: "Edit", tool_input: { file_path, old_string: "a", new_string: "b" }, cwd });
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
`,
);

const files = ["probe-holes", "probe-holes2", "gen-p1", "gen-p2", "gen-p2b", "gen-p3", "fail-closed"];
const rows = [];
for (const f of files) {
  // the scripts import ./lib.mjs by relative path, so each runs from the work dir
  const text = readFileSync(join(src, `${f}.mjs`), "utf8").replace(/^\uFEFF/, "");
  writeFileSync(join(work, `${f}.mjs`), text);
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
    const input = p.tool_input;
    rows.push({
      source: f,
      id: String(c.id ?? ""),
      tool: p.tool_name,
      command: input.command ?? null,
      file_path: input.file_path ?? null,
      cwd: String(p.cwd).startsWith(FX) ? String(p.cwd).slice(FX.length).replace(/^\//, "") : p.cwd,
      expect: c.expect ?? c.want ?? c.exp ?? null,
      extra: Object.fromEntries(Object.entries(c).filter(([k]) => !["id", "payload", "expect", "want", "exp"].includes(k))),
    });
  }
}
writeFileSync(outFile, `${JSON.stringify(rows, null, 1)}\n`);
const by = {};
for (const r of rows) by[r.source] = (by[r.source] ?? 0) + 1;
console.log(`wrote ${rows.length} rows to ${outFile}`, by);
