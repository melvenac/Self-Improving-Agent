// node build.mjs <mutant> — archive A3 5010199's open-brain, apply the edits, assert each landed, run tsc.
// QA seat, record session 87; adapted from session 85's build.mjs. Scratchpad only.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const S = "C:/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/0a0b5075-ad5c-443e-9891-39b25fa14528/scratchpad/qa";
const REPO = "C:/Users/melve/Worktrees/sia-qa";
const SHA = "4c1287f4e4b3420909428ba8ce007e03b0daafc5";
const name = process.argv[2];
const { MUTANTS } = await import(pathToFileURL(join(S, "mutants-a5.mjs")).href);
const spec = MUTANTS[name];
if (!spec) { console.error(`unknown mutant ${name}`); process.exit(2); }
const edits = Array.isArray(spec) ? spec : spec.edits;
const ARCH = Array.isArray(spec) ? SHA : spec.sha;
console.log(`archiving ${ARCH}`);

const dir = join(S, "mut", name);
if (existsSync(dir)) { console.error(`${dir} exists; refusing to reuse`); process.exit(2); }
mkdirSync(dir, { recursive: true });
const tar = execFileSync("git", ["-C", REPO, "archive", ARCH, "open-brain"], { maxBuffer: 1 << 28 });
const x = spawnSync("tar", ["-x", "-C", dir.split("\\").join("/")], { input: tar });
if (x.status !== 0) { console.error(`tar exit ${x.status}: ${String(x.stderr).slice(0, 400)}`); process.exit(3); }
const ob = join(dir, "open-brain");
symlinkSync(join(REPO, "open-brain", "node_modules"), join(ob, "node_modules"), "junction");

const count = (s, f) => s.split(f).length - 1;
for (const e of edits) {
  const p = join(ob, e.file);
  const old = readFileSync(p, "utf-8");
  const n = count(old, e.find);
  if (n !== e.count) { console.error(`EDIT DID NOT LAND: ${e.file}: expected ${e.count} occurrence(s), found ${n}\n--- find ---\n${e.find}`); process.exit(3); }
  const want = old.split(e.find).join(e.replace);
  writeFileSync(p, want);
  const back = readFileSync(p, "utf-8");
  if (back !== want || back === old) { console.error(`EDIT READ-BACK MISMATCH: ${e.file}`); process.exit(3); }
  console.log(`landed: ${e.file} (${n}x)`);
}
const tsc = spawnSync(process.execPath, [join(REPO, "open-brain/node_modules/typescript/bin/tsc"), "--noEmit", "-p", join(ob, "tsconfig.json")], { cwd: ob, encoding: "utf-8" });
console.log(`TSC_EXIT=${tsc.status}`);
if (tsc.status !== 0) console.log((tsc.stdout + tsc.stderr).slice(0, 1500));
