// node build12.mjs <mutant> [base] — QA 149 (QA 130 build11.mjs, repointed to A12 product 7200e1c). Nothing else changed.
// Asserts each edit's count against the base blob BEFORE archiving, archives, applies, asserts it landed and reads it
// back, then tsc --noEmit. Exit 3 = not applicable (reported, never skipped silently). `ARCH=<name>` archives unmutated.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const S = "C:/qa-scratch/qa149";
const REPO = "C:/Users/Aaron Melven/Worktrees/sia-qa";
const SHA = process.argv[3] ?? "7200e1cd2e5d4bcb67e3bae9bfcd112e1ede1f55";
const NM = join(S, "wt-a12/open-brain/node_modules");
const name = process.argv[2];
const arch = name.startsWith("ARCH=");
const spec = arch ? [] : (await import(pathToFileURL(join(S, "mutants-a12.mjs")).href)).MUTANTS[name];
if (!spec) { console.error(`unknown mutant ${name}`); process.exit(2); }
const count = (s, f) => s.split(f).length - 1;
for (const e of spec) {
  const old = execFileSync("git", ["-C", REPO, "show", `${SHA}:open-brain/${e.file}`], { encoding: "utf-8", maxBuffer: 1 << 26 });
  const n = count(old, e.find);
  if (n !== e.count) { console.error(`NOT APPLICABLE at ${SHA.slice(0, 7)}: ${e.file}: expected ${e.count}, found ${n}`); process.exit(3); }
}
const dir = arch ? join(S, "arch", name.slice(5)) : join(S, "mut", name);
if (existsSync(dir)) { console.error(`${dir} exists; refusing to reuse`); process.exit(2); }
mkdirSync(dir, { recursive: true });
const tar = execFileSync("git", ["-C", REPO, "archive", SHA, "open-brain"], { maxBuffer: 1 << 28 });
const x = spawnSync("tar", ["-x", "-C", dir.split("\\").join("/")], { input: tar });
if (x.status !== 0) { console.error(`tar exit ${x.status}`); process.exit(3); }
const ob = join(dir, "open-brain");
symlinkSync(NM, join(ob, "node_modules"), "junction");
for (const e of spec) {
  const p = join(ob, e.file);
  const old = readFileSync(p, "utf-8");
  const n = count(old, e.find);
  if (n !== e.count) { console.error(`EDIT DID NOT LAND: ${e.file}: expected ${e.count}, found ${n}`); process.exit(3); }
  const want = old.split(e.find).join(e.replace);
  writeFileSync(p, want);
  const back = readFileSync(p, "utf-8");
  if (back !== want || back === old) { console.error(`EDIT READ-BACK MISMATCH: ${e.file}`); process.exit(3); }
  console.log(`landed: ${e.file} (${n}x)`);
}
const tsc = spawnSync(process.execPath, [join(NM, "typescript/bin/tsc"), "--noEmit", "-p", join(ob, "tsconfig.json")], { cwd: ob, encoding: "utf-8" });
console.log(`TSC_EXIT=${tsc.status}`);
if (tsc.status !== 0) console.log((tsc.stdout + tsc.stderr).slice(0, 1500));
