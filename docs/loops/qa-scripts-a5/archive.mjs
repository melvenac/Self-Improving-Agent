// node archive.mjs <label> <sha> — git archive <sha>'s open-brain into arch/<label>, junction node_modules.
// QA seat, record session 87. Scratchpad only. Never rm -rf a copy while its node_modules junction exists.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync, lstatSync } from "node:fs";
import { join } from "node:path";

const S = "C:/Users/melve/AppData/Local/Temp/claude/C--Users-melve-Worktrees-sia-qa/0a0b5075-ad5c-443e-9891-39b25fa14528/scratchpad/qa";
const REPO = "C:/Users/melve/Worktrees/sia-qa";
const [label, sha] = process.argv.slice(2);
const dir = join(S, "arch", label);
if (existsSync(dir)) { console.error(`${dir} exists; refusing to reuse`); process.exit(2); }
mkdirSync(dir, { recursive: true });
const full = execFileSync("git", ["-C", REPO, "rev-parse", `${sha}^{commit}`], { encoding: "utf-8" }).trim();
const tar = execFileSync("git", ["-C", REPO, "archive", full, "open-brain"], { maxBuffer: 1 << 28 });
const x = spawnSync("tar", ["-x", "-C", dir.split("\\").join("/")], { input: tar });
if (x.status !== 0) { console.error(`tar exit ${x.status}: ${String(x.stderr).slice(0, 600)}`); process.exit(3); }
const ob = join(dir, "open-brain");
symlinkSync(join(REPO, "open-brain", "node_modules"), join(ob, "node_modules"), "junction");
console.log(`${label} = ${full} at ${ob}; node_modules link=${lstatSync(join(ob, "node_modules")).isSymbolicLink()}; configwatch=${existsSync(join(ob, "src/harness/configwatch.ts"))}`);
