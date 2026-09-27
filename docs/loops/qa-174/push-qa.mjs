#!/usr/bin/env node
// QA 174's only route to the remote: push ONE of its own branches, fast-forward only, and read it back.
// Refuses any branch outside qa/loop-15-slice-3-a13-spot-*, any extra argument (so no --force), and a read-back
// that disagrees with the local ref. Usage: node docs/loops/qa-174/push-qa.mjs <branch>
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const refuse = (why, code = 2) => { console.error(`push-qa: REFUSED: ${why}`); process.exit(code); };

if (args.length !== 1) refuse(`expected exactly one argument, got ${args.length}`);
const branch = args[0];
if (!/^qa\/loop-15-slice-3-a13-spot-[a-z0-9][a-z0-9._-]*$/.test(branch)) {
  refuse(`'${branch}' is not a qa/loop-15-slice-3-a13-spot-* branch`);
}

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();

let local;
try { local = git("rev-parse", "--verify", `refs/heads/${branch}`); }
catch { refuse(`no local branch refs/heads/${branch}`); }

try {
  // A plain refspec with no '+' is fast-forward only: git itself refuses a rewrite.
  execFileSync("git", ["push", "origin", `refs/heads/${branch}:refs/heads/${branch}`], { stdio: "inherit" });
} catch (e) {
  refuse(`git push exited ${e.status ?? "without a code"}`, 1);
}

const line = git("ls-remote", "origin", `refs/heads/${branch}`);
const remote = line.split(/\s+/)[0] ?? "";
if (remote !== local) refuse(`read-back mismatch: local ${local}, remote '${remote || "absent"}'`, 1);
console.log(`push-qa: pushed and read back: ${branch} ${local}`);
