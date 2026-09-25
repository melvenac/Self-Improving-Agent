// node build6.mjs <mutant> — QA 92's build.mjs, rebased onto A6 dc35b24 with mutants-a6.mjs. QA record session 94.
// Archives the SHA, applies the edits, asserts each landed exactly the expected number of times and reads it back,
// runs tsc --noEmit. Exit 3 = the edit's text is not in A6 (reported as NOT APPLICABLE, never skipped silently).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const S = "C:/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/08650273-2511-4f23-8fbc-6b4796c2a257/scratchpad/qa";
const REPO = "C:/Users/melve/Worktrees/sia-qa";
const SHA = "dc35b24869e77d2b62729d12598fb50e5adcd24b";
const name = process.argv[2];
const { MUTANTS } = await import(pathToFileURL(join(S, "mutants-a6.mjs")).href);
const spec = MUTANTS[name];
if (!spec) { console.error(`unknown mutant ${name}`); process.exit(2); }
const edits = Array.isArray(spec) ? spec : spec.edits;
if (!Array.isArray(spec)) { console.error(`${name} pins ${spec.sha}; not rebased onto A6`); process.exit(2); }

const count = (s, f) => s.split(f).length - 1;
// Check applicability against the SHA's blobs BEFORE archiving anything.
for (const e of edits) {
  const old = execFileSync("git", ["-C", REPO, "show", `${SHA}:open-brain/${e.file}`], { encoding: "utf-8", maxBuffer: 1 << 26 });
  const n = count(old, e.find);
  if (n !== e.count) { console.error(`NOT APPLICABLE at A6: ${e.file}: expected ${e.count}, found ${n}`); process.exit(3); }
}
const dir = join(S, "mut6", name);
if (existsSync(dir)) { console.error(`${dir} exists; refusing to reuse`); process.exit(2); }
mkdirSync(dir, { recursive: true });
const tar = execFileSync("git", ["-C", REPO, "archive", SHA, "open-brain"], { maxBuffer: 1 << 28 });
const x = spawnSync("tar", ["-x", "-C", dir.split("\\").join("/")], { input: tar });
if (x.status !== 0) { console.error(`tar exit ${x.status}`); process.exit(3); }
const ob = join(dir, "open-brain");
symlinkSync(join(REPO, "open-brain", "node_modules"), join(ob, "node_modules"), "junction");
for (const e of edits) {
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
const tsc = spawnSync(process.execPath, [join(REPO, "open-brain/node_modules/typescript/bin/tsc"), "--noEmit", "-p", join(ob, "tsconfig.json")], { cwd: ob, encoding: "utf-8" });
console.log(`TSC_EXIT=${tsc.status}`);
if (tsc.status !== 0) console.log((tsc.stdout + tsc.stderr).slice(0, 1500));
