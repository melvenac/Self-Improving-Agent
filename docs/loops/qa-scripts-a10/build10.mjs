// node build10.mjs <mutant> — QA 108: QA 104's build9.mjs rebased onto A10 4b7a5ae with mutants-a10.mjs.
// Asserts each edit's count against A10's blob BEFORE archiving, archives, applies, asserts it landed and reads it back,
// then tsc --noEmit. Exit 3 = not applicable (reported, never skipped silently).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const S = "C:/qa-scratch/qa108";
const REPO = "C:/Users/Aaron Melven/Worktrees/sia-qa";
const SHA = "4b7a5aebd9a17b0ce8e6ee99545f4f8f5784c90f";
const NM = join(S, "wt-a10/open-brain/node_modules");
const name = process.argv[2];
const { MUTANTS } = await import(pathToFileURL(join(S, "mutants-a10.mjs")).href);
const spec = MUTANTS[name];
if (!spec) { console.error(`unknown mutant ${name}`); process.exit(2); }
if (!Array.isArray(spec)) { console.error(`${name} pins ${spec.sha}; not rebased onto A10`); process.exit(2); }
const count = (s, f) => s.split(f).length - 1;
for (const e of spec) {
  const old = execFileSync("git", ["-C", REPO, "show", `${SHA}:open-brain/${e.file}`], { encoding: "utf-8", maxBuffer: 1 << 26 });
  const n = count(old, e.find);
  if (n !== e.count) { console.error(`NOT APPLICABLE at A10: ${e.file}: expected ${e.count}, found ${n}`); process.exit(3); }
}
const dir = join(S, "mut10", name);
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
