// QA 241, R6-P0 generator. Built from the r6 dispatch's REFUSED and ACCEPTED lists, not from Forge's generator.
// Each refused construct is placed at a write target, a git subcommand, a gh subcommand, and a wrapper position.
// Every refused case must come back `not statically parseable: <construct>` (the P0 prefix). Every accepted case
// must NOT be refused by P0 — it is then judged by P1-P3, and we record that decision. Drives the real built CLI.
// Usage: node gen-p0.mjs <out.json>
import { writeFileSync } from "node:fs";
import { makeFixture, runAll, bash, pwsh } from "./qa237/lib.mjs";

const FX = makeFixture("C:/qa-scratch/qa241-p0-fx");
const P0 = /^Planner hook: denied — not statically parseable: /;

// ---- Bash refused constructs: [fragment, construct-name-substring]
// fragments refused ANYWHERE in a word (quote-internal / word-char constructs), placed in every position
const BASH_REFUSED = [
  ["x\\y", "backslash"], ["a\\ b", "backslash"], ["\\~x", "backslash"],
  ["$x", "$"], ["${x}", "$"], ["$(id)", "$"], ["`id`", "backtick"], ["$'a'", "$"], ["a(b)", "parenthesis"],
  ["(ls)", "parenthesis"], ["a{b,c}", "brace"], ["*.ts", "glob"], ["a?b", "glob"], ["a[1]", "glob"],
  ["~/x", "tilde"], ["\"$x\"", "$ inside double quotes"], ["\"`id`\"", "backtick inside double quotes"],
  ["\"a\\b\"", "backslash"],
];
// reserved words etc. are refused ONLY in command position; command-position placements only
const BASH_REFUSED_CMDPOS = [
  ["if", "reserved word"], ["then", "reserved word"], ["for", "reserved word"], ["while", "reserved word"],
  ["do", "reserved word"], ["done", "reserved word"], ["case", "reserved word"], ["esac", "reserved word"],
  ["!", "reserved word"], ["time", "reserved word"], ["function", "reserved word"], ["until", "reserved word"],
  ["select", "reserved word"], ["coproc", "reserved word"], ["{", "brace"], ["#cmt", "comment"],
];
// Bash refused whole-command shapes (operators, redirects, wrappers, shells, inline code, sed, aliases)
const BASH_REFUSED_CMD = [
  ["ls\nwc", "newline"], ["ls &", "background"], ["ls |& wc", "|& pipe"], ["ls >| f", ">| redirect"],
  ["ls >(cat)", "process substitution"], ["ls >& f", ">& redirect"], ["ls &>> f", "&>> redirect"],
  ["cat <(ls)", "process substitution or fd redirect"], ["ls 3> f", "file-descriptor redirect"],
  ["ls ;; ", ";; (case terminator)"], ["cat <<EOF", "heredoc or here-string"], ["cat <<<x", "heredoc or here-string"],
  ["timeout 5 ls", "wrapper, shell or code-running command (timeout)"], ["sudo ls", "(sudo)"],
  ["nice ls", "(nice)"], ["xargs wc", "(xargs)"], ["eval ls", "(eval)"], ["exec ls", "(exec)"],
  ["source f", "(source)"], [". f", "(.)"], ["watch ls", "(watch)"], ["stdbuf -o0 ls", "(stdbuf)"],
  ["env -u X ls", "wrapper with options (env -u)"], ["env -C d ls", "wrapper with options (env -C)"],
  ["command -v ls", "wrapper with options (command -v)"], ["nohup -x ls", "wrapper with options (nohup -x)"],
  ["echo x | sh", "sh is only parseable"], ["echo x | bash", "bash is only parseable"],
  ["bash -lc 'ls'", "bash is only parseable"], ["sh file.sh", "sh is only parseable"],
  ["node -e 'x'", "inline code (node -e"], ["node --eval 'x'", "inline code (node --eval"],
  ["python -c 'x'", "inline code (python -c"], ["perl -e 'x'", "inline code (perl -e"],
  ["ruby -e 'x'", "inline code (ruby -e"], ["php -r 'x'", "inline code (php -r"],
  ["find . -exec rm {} ;", "find -exec"], ["awk -i inplace 'x' f", "awk -i"],
  ["sed -n 'w out' f", "sed w"], ["sed -e 's/a/b/w out' f", "sed w"], ["sed 's/a/b/e' f", "sed e"],
  ["sed -f s.sed f", "sed -f"], ["sed --file=s.sed f", "sed -f"],
  ["git st", "git alias or external subcommand (st)"], ["git lg", "git alias"],
  ["gh co 5", "gh alias or extension command (co)"], ["gh alias set x y", "gh alias"], ["gh extension list", "gh extension"],
  ["powershell -c ls", "(powershell)"], ["pwsh -c ls", "(pwsh)"], ["cmd /c dir", "(cmd)"],
];
// Positions a refused fragment is dropped into (write target, git sub, gh sub, wrapper, operator rhs)
const bashPositions = (frag) => [
  `echo x > ${frag}`,
  `cp a.ts ${frag}`,
  `git ${frag} feature`,
  `gh pr ${frag} 2`,
  `env ${frag} ls`,
  `ls && ${frag}`,
  `tee ${frag} < a.ts`,
];

// ---- PowerShell refused constructs
const PS_REFUSED = [
  ["$x", "$"], ["$env:TEMP", "$"], ["@a", "@ (splat"], ["@{a=1}", "@ (splat"], ["(gi x)", "parenthesis"],
  ["$(gi x)", "$"], ["{ ls }", "script block or brace"], ["FileSystem::C:/x", "provider path (::)"],
  ["C:foo", "drive-relative path"], ["[int]::x", "[ ] (type literal"], ["a*b", "wildcard"], ["a?b", "wildcard"],
  ["`n", "backtick"], ["~/x", "tilde"], ["#c", "comment"], ["\"$x\"", "$ inside a PowerShell double-quoted"],
  ["\"a`nb\"", "backtick inside a PowerShell double-quoted"],
];
const PS_REFUSED_CMD = [
  ["Invoke-Expression 'ls'", "code-running or unknown command (Invoke-Expression)"],
  ["iex 'ls'", "code-running or unknown command (iex)"],
  ["Invoke-Command { ls }", "script block or brace"],
  ["Start-Process ls", "code-running or unknown command (Start-Process)"],
  ["saps ls", "code-running or unknown command (saps)"],
  ["powershell -c ls", "code-running or unknown command (powershell)"],
  ["pwsh -c ls", "code-running or unknown command (pwsh)"],
  ["iwr http://x", "code-running or unknown command (iwr)"],
  ["curl http://x", "code-running or unknown command (curl)"],
  ["Add-Type -Path x", "code-running or unknown command (Add-Type)"],
  ["New-Object X", "code-running or unknown command (New-Object)"],
  ["Import-Module m", "code-running or unknown command (Import-Module)"],
  ["Set-Alias a b", "code-running or unknown command (Set-Alias)"],
  ["ForEach-Object { ls }", "script block or brace"],
  ["Where-Object { $_ }", "script block or brace"],
  ["ls\nls", "newline"], ["ls || ls", "|| (PowerShell 7"], ["ls && ls", "&& (PowerShell 7"],
  ["& ls", "& call of anything but gh"], ["ls; & cat x", "& call of anything but gh"],
  ["<# c #> ls", "< (redirect, block comment or here-string)"],
  ["Microsoft.PowerShell.Management\\Get-Item x", "module-qualified cmdlet"],
  ["Set-Content -Bogus x y", "unknown parameter -Bogus for set-content"],
  ["Set-Content -ErrorAction 0 y x", "unknown parameter -ErrorAction for set-content"],
  ["Set-Content -EA 0 y x", "unknown parameter -EA for set-content"],
  ["Set-Content -OutVariable o y x", "unknown parameter -OutVariable for set-content"],
  ["Get-ChildItem -F", "ambiguous parameter -F for get-childitem"],
  ["Export-Csv -Path x", "unknown cmdlet (Export-Csv)"],
  ["Get-Foo x", "unknown cmdlet (Get-Foo)"],
];
const psPositions = (frag) => [
  `Set-Content ${frag} -Value x`,
  `Copy-Item a.txt ${frag}`,
  `git ${frag} feature`,
  `gh pr ${frag} 2`,
  `${frag} | Out-Null`,
];
const cmdPos = (frag) => [`${frag} feature`, `env ${frag} ls`, `${frag} a.ts`];

// ---- Accepted grammar (must NOT be refused by P0; then judged by P1-P3)
const BASH_ACCEPTED = [
  "ls", "ls -la", "git status", "git log --oneline -5", "git diff HEAD", "git add -A", "git commit -m 'msg'",
  "git commit -F docs/loops/m.txt", "git fetch origin", "git pull", "git branch -a", "git show HEAD",
  "git rev-parse HEAD", "git push origin loop/x", "git push origin qa/t194-r6-y", "gh pr list", "gh pr view 5",
  "gh pr checkout 5", "gh pr comment 5 --body hi", "gh pr diff 5", "gh run list", "gh run view 123",
  "gh api repos/x/y", "cat README.md", "head -5 README.md", "tail -5 README.md", "wc -l README.md",
  "grep foo README.md", "diff a.txt b.txt", "echo hi", "echo hi > C:/qa-tmp/o.txt", "echo hi >> C:/qa-tmp/o.txt",
  "cat a.txt | wc -l", "ls -la | head -5", "git status && git log --oneline -3", "ls; wc -l README.md",
  "ls | grep x || echo none", "git commit -m 'a > b; c'", "git commit -m \"plain text\"", "NODE_ENV=test npm test",
  "GIT_PAGER=cat git log", "cp a.txt C:/qa-tmp/b.txt", "mv a.txt C:/qa-tmp/b.txt", "tee C:/qa-tmp/o.txt < a.txt",
  "env ls", "command ls", "nohup ls", "sh -c 'ls'", "sh -c 'git status'", "ls 2> C:/qa-tmp/e.txt",
  "ls > C:/qa-tmp/o.txt 2>&1", "ls &> C:/qa-tmp/o.txt", "git -c user.name=q status", "npm test", "npm run build",
  "npx tsc --noEmit", "node build/x.js", "sed -i 's/a/b/' C:/qa-tmp/o.txt", "sed 's/a/b/' a.txt",
  "gh pr merge 2", "gh pr merge 2 --squash", "gh pr merge '#7'", "gh pr merge --squash 2",
  "git tag v1", "git merge feature", "git push --force origin loop/x", "install a.txt C:/qa-tmp/b.txt",
  "git status -s", "git log -p", "git log --stat", "git diff --cached", "git show --stat HEAD",
  "git blame README.md", "git stash list", "git remote -v", "git config --get user.name", "git reflog",
  "git ls-files docs", "git rev-list --count HEAD", "git describe --tags", "git shortlog -s",
  "gh pr status", "gh pr ready 5", "gh issue list", "gh issue view 3", "gh repo view", "gh workflow list",
  "gh run watch 123", "cat docs/loops/x.md", "sort README.md", "uniq a.txt", "cut -f1 a.txt",
  "sed 's/a/b/' README.md", "awk '{print}' README.md", "comm a.txt b.txt", "ls docs", "pwd", "whoami",
  "git commit --amend -m 'x'", "git fetch --all", "git pull --rebase", "git branch -d feature",
  "git checkout README.md", "git restore README.md", "echo done > C:/qa-tmp/d.txt", "true && echo ok",
];
const PS_ACCEPTED = [
  "Get-ChildItem", "Get-ChildItem docs", "Get-ChildItem -Recurse docs", "Get-Content README.md",
  "Get-Content README.md -TotalCount 5", "Get-Content -Path README.md", "Test-Path README.md",
  "Select-String foo README.md", "Get-Item README.md", "Write-Output hi", "Write-Host hi",
  "Set-Content C:/qa-tmp/o.txt -Value x", "Set-Content -Path C:/qa-tmp/o.txt -Value x",
  "Set-Content -LiteralPath C:/qa-tmp/o.txt x", "Add-Content C:/qa-tmp/o.txt -Value x",
  "Out-File -FilePath C:/qa-tmp/o.txt", "New-Item -Path C:/qa-tmp/o.txt -ItemType File",
  "Copy-Item a.txt C:/qa-tmp/b.txt", "Move-Item a.txt C:/qa-tmp/b.txt", "Remove-Item C:/qa-tmp/o.txt",
  "Get-ChildItem docs | Select-Object -First 5", "Get-Content README.md | Measure-Object -Line",
  "Write-Output x > C:/qa-tmp/o.txt", "Write-Output x >> C:/qa-tmp/o.txt", "Set-Content -Path:C:/qa-tmp/o.txt -Value x",
  "git status", "git log", "gh pr list", "gh pr merge 2", "git push origin loop/x", "& gh pr list",
  "Set-Content C:/qa-tmp/o.txt -Value 'a,b'", "Sort-Object",
  "Get-Date -Format yyyy", "Get-Location", "Set-Content $null",
  "Get-Content README.md -Tail 5", "Get-Content -LiteralPath README.md", "Get-Item -Path README.md",
  "Test-Path -Path README.md", "Get-ChildItem -File docs", "Get-ChildItem -Directory", "Get-ChildItem -Depth 2 docs",
  "Select-String -Pattern foo README.md", "Write-Output x | Out-Null", "Measure-Object -Line",
  "Set-Content C:/qa-tmp/o.txt x -Force", "Add-Content -Path C:/qa-tmp/o.txt -Value x -NoNewline",
  "Out-File -FilePath C:/qa-tmp/o.txt -Append", "New-Item -Path C:/qa-tmp/d -ItemType Directory",
  "Copy-Item -Path a.txt -Destination C:/qa-tmp/b.txt", "Move-Item -Path a.txt -Destination C:/qa-tmp/b.txt",
  "Remove-Item -Path C:/qa-tmp/o.txt -Force", "Clear-Content C:/qa-tmp/o.txt", "Rename-Item a.txt b.txt",
  "git fetch origin", "git log --oneline", "gh pr view 5", "gh run list", "git push origin docs/x",
  "Set-Content -Path C:/qa-tmp/o.txt -Value x -Encoding utf8", "Tee-Object -FilePath C:/qa-tmp/o.txt",
  "Get-Content README.md | Select-Object -First 3", "Get-ChildItem | Sort-Object -Property Name",
];

const cases = [];
let id = 0;
const add = (sh, command, kind, construct) => cases.push({ id: id++, sh, command, kind, construct, payload: (sh === "ps" ? pwsh : bash)(command, FX) });
for (const [frag, name] of BASH_REFUSED) for (const command of bashPositions(frag)) add("bash", command, "refused", name);
for (const [frag, name] of BASH_REFUSED_CMDPOS) for (const command of cmdPos(frag)) add("bash", command, "refused", name);
for (const [command, name] of BASH_REFUSED_CMD) add("bash", command, "refused", name);
for (const [frag, name] of PS_REFUSED) for (const command of psPositions(frag)) add("ps", command, "refused", name);
for (const [command, name] of PS_REFUSED_CMD) add("ps", command, "refused", name);
for (const command of BASH_ACCEPTED) add("bash", command, "accepted", null);
for (const command of PS_ACCEPTED) add("ps", command, "accepted", null);

const res = await runAll(cases, 4, undefined, FX);
let refusedTotal = 0, refusedOk = 0, refusedWrongName = [], acceptedTotal = 0, acceptedP0 = [];
const byDecision = {};
for (const r of res) {
  const isP0 = P0.test(r.reason);
  if (r.kind === "refused") {
    refusedTotal++;
    if (isP0 && (r.construct === null || r.reason.includes(r.construct))) refusedOk++;
    else if (isP0) refusedWrongName.push({ command: r.command, want: r.construct, reason: r.reason.slice(40, 150) });
    else refusedWrongName.push({ command: r.command, want: r.construct, decision: r.decision, reason: r.reason.slice(0, 150) });
  } else {
    acceptedTotal++;
    byDecision[r.decision] = (byDecision[r.decision] || 0) + 1;
    if (isP0) acceptedP0.push({ command: r.command, reason: r.reason.slice(0, 140) });
  }
}
const summary = { refusedTotal, refusedOk, refusedNotP0orWrongName: refusedWrongName.length, acceptedTotal, acceptedWronglyRefusedByP0: acceptedP0.length, acceptedDecisions: byDecision };
console.log(JSON.stringify(summary, null, 1));
if (refusedWrongName.length) { console.log("\n-- refused cases that were NOT P0 / wrong construct:"); for (const f of refusedWrongName) console.log("  ", JSON.stringify(f)); }
if (acceptedP0.length) { console.log("\n-- accepted cases WRONGLY refused by P0:"); for (const f of acceptedP0) console.log("  ", JSON.stringify(f)); }
writeFileSync(process.argv[2], JSON.stringify({ summary, refusedWrongName, acceptedP0, all: res.map(({ payload, ...r }) => ({ ...r, reason: r.reason.slice(0, 160) })) }, null, 1));
