// QA 237 oracle check: run each spelling the hook allowed in the REAL shell (Git Bash / Windows PowerShell 5.1)
// inside a scratch tree, and record whether a file under open-brain/src was actually written. Scratch only:
// C:/qa-scratch/qa241-q237-shelltest. Proves the probe rows' expectations are the shell's behaviour, not a guess.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const T = "C:/qa-scratch/qa241-q237-shelltest";
const BASH = "C:/Program Files/Git/bin/bash.exe";
const enc = (s) => Buffer.from(s, "utf16le").toString("base64");
const NL = "\n";

function fresh() {
  rmSync(T, { recursive: true, force: true });
  mkdirSync(join(T, "open-brain", "src"), { recursive: true });
  writeFileSync(join(T, "a.ts"), "a\n");
  writeFileSync(join(T, "a.txt"), "a\n");
}
const written = () => readdirSync(join(T, "open-brain", "src"));

const rows = [
  ["bash", "keyword then", `if true; then cp a.ts open-brain/src/x.ts; fi`],
  ["bash", "keyword do", `for f in a; do cp a.ts open-brain/src/x.ts; done`],
  ["bash", "keyword !", `! cp a.ts open-brain/src/x.ts`],
  ["bash", "timeout 5 cp", `timeout 5 cp a.ts open-brain/src/x.ts`],
  ["bash", "find -exec cp", `find . -maxdepth 1 -name a.ts -exec cp {} open-brain/src/x.ts \\;`],
  ["bash", "cp -tDIR", `cp -topen-brain/src a.ts`],
  ["bash", "cp -vt DIR", `cp -vt open-brain/src a.ts`],
  ["bash", "cp --target DIR", `cp --target open-brain/src a.ts`],
  ["bash", "backslash-newline in target", `echo x > open-brain/sr\\${NL}c/x.ts`],
  ["bash", "backslash-newline between words", `cp a.ts \\${NL}open-brain/src/x.ts`],
  ["bash", "comment fake heredoc", `echo hi # <<EOF${NL}cp a.ts open-brain/src/x.ts${NL}EOF`],
  ["bash", "heredoc to bash", `bash <<'EOF'${NL}echo x > open-brain/src/x.ts${NL}EOF`],
  ["bash", "pipe to sh", `echo 'echo x > open-brain/src/x.ts' | sh`],
  ["bash", "sed w", `sed -n 'w open-brain/src/x.ts' a.txt`],
  ["bash", "commented-out write (expect NO write)", `echo x # > open-brain/src/x.ts`],
  ["bash", "depth-5 bash -c", `bash -c "bash -c 'bash -c \\"bash -c \\\\\\"bash -c \\\\\\\\\\\\\\"echo x > open-brain/src/x.ts\\\\\\\\\\\\\\"\\\\\\"\\"'"`],
  ["ps", "New-Item -Type File", `New-Item -Type File open-brain/src/x.ts | Out-Null`],
  ["ps", "Set-Content -EA", `Set-Content -EA SilentlyContinue open-brain/src/x.ts x`],
  ["ps", "Set-Content -OutVariable", `Set-Content -OutVariable o open-brain/src/x.ts x`],
  ["ps", "Copy-Item -EA 0", `Copy-Item -EA 0 a.ts open-brain/src/x.ts`],
  ["ps", "Set-Content x -LP", `Set-Content x -LP open-brain/src/x.ts`],
  ["ps", "Set-Content -Path (Join-Path)", `Set-Content -Path (Join-Path open-brain src/x.ts) -Value x`],
  ["ps", "splat array", `$a = 'open-brain/src/x.ts','x'; Set-Content @a`],
  ["ps", "splat hashtable New-Object", `$h = New-Object Hashtable; $h.Path = 'open-brain/src/x.ts'; $h.Value = 'x'; Set-Content @h`],
  ["ps", "<##> block comment", `<##> Set-Content open-brain/src/x.ts x`],
  ["ps", "[scriptblock]::Create", `[scriptblock]::Create('Set-Content open-brain/src/x.ts x').Invoke()`],
  ["ps", "powershell positional", `powershell -NoProfile Set-Content open-brain/src/x.ts x`],
  ["ps", "powershell -EncodedCommand", `powershell -NoProfile -EncodedCommand ${enc("Set-Content open-brain/src/x.ts x")}`],
  ["ps", "[IO.File]::WriteAllText", `[IO.File]::WriteAllText((Join-Path (Get-Location) 'open-brain/src/x.ts'), 'x')`],
];

const out = {};
for (const [sh, id, cmd] of rows) {
  fresh();
  const r = sh === "bash"
    ? spawnSync(BASH, ["-c", cmd], { cwd: T, encoding: "utf8", timeout: 60000 })
    : spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], { cwd: T, encoding: "utf8", timeout: 60000 });
  const w = written();
  out[id] = { shell: sh, command: cmd, wroteUnderSrc: w, exit: r.status };
  console.log(`${w.length ? "WROTE " + w.join(",") : "no write"}  [${sh}] ${id}`);
}
// gh: the shell drops `#2` as a comment, so gh receives `pr merge` with no number (merges the CURRENT branch's PR).
const g = spawnSync(BASH, ["-c", `printf '[%s]' gh pr merge #2`], { encoding: "utf8" });
out["gh pr merge #2 argv"] = { argvSeenByProgram: g.stdout };
console.log(`argv for 'gh pr merge #2': ${g.stdout}`);
const p = spawnSync("powershell.exe", ["-NoProfile", "-Command", `function gh { $args -join '|' }; gh pr merge #2`], { encoding: "utf8" });
out["PS gh pr merge #2 argv"] = { argvSeenByProgram: p.stdout.trim() };
console.log(`PS argv for 'gh pr merge #2': ${p.stdout.trim()}`);
// git: an inline -c alias runs the aliased subcommand.
rmSync(T, { recursive: true, force: true });
mkdirSync(T, { recursive: true });
const gitc = (...a) => spawnSync("git", a, { cwd: T, encoding: "utf8" });
gitc("init", "-q", "-b", "master");
gitc("-c", "user.name=q", "-c", "user.email=q@q", "commit", "-q", "--allow-empty", "-m", "base");
gitc("branch", "feature");
gitc("checkout", "-q", "feature");
gitc("-c", "user.name=q", "-c", "user.email=q@q", "commit", "-q", "--allow-empty", "-m", "on feature");
gitc("checkout", "-q", "master");
const m = spawnSync(BASH, ["-c", `git -c user.name=q -c user.email=q@q -c alias.m=merge m --no-edit feature`], { cwd: T, encoding: "utf8" });
const log = gitc("log", "--oneline", "-1").stdout.trim();
out["git -c alias.m=merge m feature"] = { exit: m.status, masterTipAfter: log };
console.log(`git -c alias.m=merge m feature -> exit ${m.status}, master tip: ${log}`);
writeFileSync(process.argv[2] ?? "C:/qa-scratch/qa241-q237-shelltest-out.json", JSON.stringify(out, null, 1));
