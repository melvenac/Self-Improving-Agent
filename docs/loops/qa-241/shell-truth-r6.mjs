// QA 241: real-shell truth for every probe row the r6 hook ALLOWS where the property may require a deny.
// Runs each command in REAL Windows PowerShell 5.1 (from a UTF-8-with-BOM .ps1 file, so the Unicode survives) or REAL
// Git Bash (`bash -c`, as Claude Code runs it), with cwd C:/qa-scratch/qa241-shell, and records whether the file
// open-brain/src/x.ts (or the stated check) was created. Argv rows run a node argv printer in place of gh/git, which
// receives exactly what gh/git would. Writes only under C:/qa-scratch/qa241-shell and C:/qa-tmp.
// Usage: node shell-truth-r6.mjs <out.json>
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const S = "C:/qa-scratch/qa241-shell";
const BASH = "C:/Program Files/Git/bin/bash.exe";
const T = "open-brain/src/x.ts";
const NBSP = "\u00a0", EN = "\u2013", EM = "\u2014", LSQ = "\u2018", RSQ = "\u2019", LDQ = "\u201c", RDQ = "\u201d", IDSP = "\u3000";
writeFileSync("C:/qa-tmp/qa241-argv.js", "console.log(JSON.stringify(process.argv.slice(2)))\n");
const ARGV = "node C:/qa-tmp/qa241-argv.js";

function reset() {
  rmSync(S, { recursive: true, force: true });
  for (const d of ["open-brain/src", ".git"]) mkdirSync(join(S, d), { recursive: true });
  writeFileSync(join(S, "a.ts"), "a\n");
  writeFileSync(join(S, "README.md"), "r\n");
  writeFileSync("C:/qa-tmp/a.txt", "a\n");
}
function ps(cmd) {
  const f = "C:/qa-tmp/qa241-truth.ps1";
  writeFileSync(f, "\ufeff" + cmd + "\n", "utf8");
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", f], { cwd: S, encoding: "utf8", timeout: 60000 });
}
function sh(cmd) {
  return spawnSync(BASH, ["-c", cmd], { cwd: S, encoding: "utf8", timeout: 60000, env: { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" } });
}
const rows = [
  ["ps", `Set-Content${NBSP}${T} x`, T],
  ["ps", `Copy-Item C:/qa-tmp/a.txt${NBSP}${T}`, T],
  ["ps", `Set-Content${IDSP}${T} x`, T],
  ["ps", `Set-Content ${EN}Value x ${T}`, T],
  ["ps", `Set-Content ${EM}Value x ${T}`, T],
  ["ps", `Set-Content ${EN}EA 0 ${T} x`, T],
  ["ps", `Set-Content ${LSQ}${T}${RSQ} x`, T],
  ["ps", `Set-Content ${LDQ}${T}${RDQ} x`, T],
  ["ps", `New-Item -Name ${T} -ItemType File`, T],
  ["ps-cwd-src", `New-Item -Name x.ts -ItemType File`, T],
  ["ps-argv", `${ARGV} pr ${LDQ}merge${RDQ} 2`, null],
  ["ps-argv", `${ARGV} pr ${LSQ}merge${RSQ} 2`, null],
  ["bash", `node --eval="require('fs').writeFileSync('${T}','x')"`, T],
  ["bash", `node -e"require('fs').writeFileSync('${T}','x')"`, T],
  ["bash", `python -c"open('${T}','w').write('x')"`, T],
  ["bash", `python -Ic "open('${T}','w').write('x')"`, T],
  ["bash", `perl -e'open(F,">${T}")'`, T],
  ["bash", `ruby -e'File.write("${T}","x")'`, T],
  ["bash", `awk 'BEGIN{print "x" > "${T}"}'`, T],
  ["bash", `awk 'BEGIN{system("echo x > ${T}")}'`, T],
  ["bash", `trap 'echo x > ${T}' EXIT`, T],
  ["bash", `mapfile -C 'echo x > ${T};:' -c 1 < README.md`, T],
  ["bash", `sort -o ${T} README.md`, T],
  ["bash", `find . -maxdepth 0 -fprint ${T}`, T],
  ["bash-git", `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=remote.origin.url GIT_CONFIG_VALUE_0=https://github.com/evil/x git remote get-url origin`, null],
  ["bash-git", `GIT_CONFIG_PARAMETERS="'remote.origin.url'='https://github.com/evil/x'" git remote get-url origin`, null],
];
const out = [];
for (const [kind, cmd, file] of rows) {
  reset();
  if (kind === "bash-git") {
    rmSync(join(S, ".git"), { recursive: true, force: true });
    spawnSync("git", ["init", "-q"], { cwd: S });
    spawnSync("git", ["remote", "add", "origin", "https://github.com/melvenac/Self-Improving-Agent.git"], { cwd: S });
  }
  const r = kind.startsWith("ps") ? ps(kind === "ps-cwd-src" ? `Set-Location open-brain/src; ${cmd}` : cmd) : sh(cmd);
  const written = file ? existsSync(join(S, file)) : null;
  const stdout = (r.stdout ?? "").trim().slice(0, 300);
  const row = { kind, command: cmd, written, stdout, stderr: (r.stderr ?? "").trim().slice(0, 200), status: r.status };
  out.push(row);
  console.log(`${kind.padEnd(10)} written=${String(written).padEnd(5)} status=${r.status} ${JSON.stringify(cmd)}${stdout ? "  stdout=" + stdout.slice(0, 120) : ""}${!written && file ? "  stderr=" + row.stderr.slice(0, 120) : ""}`);
}
// the probe rows ran with cwd open-brain/src only for ps-cwd-src (written check is at <S>/open-brain/src/x.ts)
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
