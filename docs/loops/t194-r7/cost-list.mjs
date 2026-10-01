// Prints, for each command a working planner is likely to type, what the r6 hook does with it and the refusal text.
// Runs against the BUILT hook (open-brain/build) in a throw-away fixture checkout; it never registers anything.
//   node docs/loops/t194-r7/cost-list.mjs > docs/loops/t194-r7/cost-list.txt
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { runPlannerHook } = await import(pathToFileURL(join(here, "../../../open-brain/build/planner-hook/run.js")).href);

const repo = mkdtempSync(join(tmpdir(), "r6-cost-"));
for (const d of [".agents/SYSTEM", "open-brain/src", "docs/loops", "scratch", ".git"]) mkdirSync(join(repo, d), { recursive: true });
writeFileSync(join(repo, "package.json"), "{}\n");
writeFileSync(join(repo, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\n---\n");
const NL = "\n";

const rows = [
  // [what the planner wanted, tool, command, the rewrite that works (or "")]
  ["run tests from a subdirectory and keep the log", "Bash", "cd docs && npm test > C:/qa-tmp/out.txt", "npm --prefix docs test > C:/qa-tmp/out.txt   (two commands in two calls also work)"],
  ["a timeout", "Bash", "timeout 60 npm test", "npm test   (set the limit on the tool call instead)"],
  ["a commit message from a heredoc", "Bash", `git commit -m "$(cat <<'EOF'${NL}fix: x${NL}EOF${NL})"`, "write the message to docs/loops/msg.txt with the Write tool, then git commit -F docs/loops/msg.txt"],
  ["a commit message with a variable", "Bash", 'git commit -m "fix: $TITLE"', "put the literal text in single quotes"],
  ["a multi-line command", "Bash", `git status${NL}git log --oneline -3`, "git status && git log --oneline -3"],
  ["a loop over files", "Bash", "for f in docs/loops/*.md; do wc -l $f; done", "one command per call, or a single wc -l with the files named"],
  ["a glob", "Bash", "ls docs/loops/*.md", "ls docs/loops"],
  ["tilde", "Bash", "cat ~/notes.txt", "the absolute path"],
  ["a trailing comment", "Bash", "git status # check first", "drop the comment"],
  ["a variable assignment then use", "Bash", "X=docs; ls $X", "ls docs"],
  ["command substitution", "Bash", "echo $(git rev-parse HEAD)", "run git rev-parse HEAD on its own"],
  ["xargs", "Bash", "git ls-files docs | xargs wc -l", "git ls-files docs, then wc -l with the names"],
  ["find -exec", "Bash", "find docs -name '*.md' -exec wc -l {} ';'", "find docs -name '*.md'"],
  ["sudo", "Bash", "sudo ls", "none (the planner seat does not need it)"],
  ["node -e", "Bash", "node -e 'console.log(1)'", "write a script file and run node on it"],
  ["a subshell", "Bash", "(cd docs; ls)", "ls docs"],
  ["a background job", "Bash", "npm test &", "run it in the foreground or with the tool's background option"],
  ["a gh alias", "Bash", "gh co 5", "gh pr checkout 5"],
  ["a git alias", "Bash", "git st", "git status"],
  ["a #N PR reference", "Bash", "gh pr merge #2", "gh pr merge '#2'  or  gh pr merge 2"],
  ["a foreign pull URL", "Bash", "gh pr merge https://github.com/other/repo/pull/3", "needs a grant; there is no no-grant spelling"],
  ["a git -c with a risky key", "Bash", "git -c core.pager=cat log", "git --no-pager log"],
  ["a PowerShell script block", "PowerShell", "Get-ChildItem docs | Where-Object { $_.Length -gt 10 }", "Get-ChildItem docs, then read the sizes"],
  ["a PowerShell variable", "PowerShell", "$f = 'docs'; Get-ChildItem $f", "Get-ChildItem docs"],
  ["a common parameter", "PowerShell", "Get-Content docs/loops/x.md -ErrorAction SilentlyContinue", "Get-Content docs/loops/x.md"],
  ["a cmdlet the hook has no table for", "PowerShell", "Get-Date | Export-Csv -Path docs/loops/d.csv", "Set-Content docs/loops/d.csv (Get-Date) is also refused; run Get-Date, then Set-Content with the text"],
  ["a sub-expression", "PowerShell", "Write-Output (Get-Date)", "Get-Date"],
  ["an environment variable", "PowerShell", "Set-Content $env:TEMP/x.txt hi", "the absolute path"],
  ["a wildcard", "PowerShell", "Remove-Item docs/loops/*.tmp", "Remove-Item with the names"],
  ["a block comment or a type literal", "PowerShell", "[System.IO.File]::ReadAllText('docs/loops/x.md')", "Get-Content docs/loops/x.md"],
  ["powershell from PowerShell", "PowerShell", "powershell -Command Get-Date", "Get-Date"],
  ["a cd and a write", "PowerShell", "Set-Location docs; Set-Content x.md hi", "Set-Content docs/x.md hi"],
  // ---- r7: characters (P0a) and command words (P0c), environment (P0d)
  ["a PowerShell commit message with an em dash", "PowerShell", "git commit -m 'fix — the thing'", "write the message to docs/loops/msg.txt with the Write tool, then git commit -F docs/loops/msg.txt"],
  ["a PowerShell path with an accented letter", "PowerShell", "Get-Content docs/loops/café.md", "name the file with ASCII letters, or read it with the Read tool"],
  ["curly quotes pasted into a PowerShell command", "PowerShell", "Write-Output “hello”", "straight quotes"],
  ["a Bash write to a non-ASCII file name", "Bash", "echo x > 'docs/loops/café.md'", "an ASCII file name (the target validator refuses non-ASCII even in quotes)"],
  ["a Bash word with a non-ASCII character outside quotes", "Bash", "echo café", "echo 'café'"],
  ["python", "Bash", "python script.py", "node script.js, or ask for the script to be run elsewhere"],
  ["awk", "Bash", "awk '{print $1}' README.md", "cut -d' ' -f1 README.md"],
  ["find", "Bash", "find docs -name x", "ls docs/loops"],
  ["sort", "Bash", "sort names.txt", "none; sort names.txt in a file you read with the Read tool"],
  ["xargs", "Bash", "git ls-files | xargs wc -l", "wc -l with the file names"],
  ["export", "Bash", "export FOO=1", "FOO=1 npm test   (an assignment in front of the command)"],
  ["chmod", "Bash", "chmod +x scripts/x.sh", "ask Aaron; chmod is not on the allow-list"],
  ["wget", "Bash", "wget https://x", "curl -s https://x   (read-only)"],
  ["curl writing a file", "Bash", "curl -o out.html https://x", "curl -s https://x > docs/loops/out.html"],
  ["node -e", "Bash", "node -e 'console.log(1)'", "write the code to docs/loops/x.js and run node docs/loops/x.js"],
  ["node with an option", "Bash", "node --version", "none (any option before the script is refused)"],
  ["a path as the command", "Bash", "./node_modules/.bin/vitest run", "npx vitest run"],
  ["git config through the environment", "Bash", "GIT_DIR=x git status", "git -C x status"],
  ["GH_REPO for a one-off repository", "Bash", "GH_REPO=o/x gh pr view 1", "gh pr view 1 --repo o/x"],
  ["rg --pre", "Bash", "rg --pre cat x y", "rg x y"],
  ["ssh with a config file", "Bash", "ssh -F cfg host ls", "ssh host ls"],
];

console.log("| Wanted | Command | Decision | Refusal (first 150 characters) | Rewrite that works |");
console.log("|---|---|---|---|---|");
for (const [what, tool, command, fix] of rows) {
  const r = runPlannerHook({ cwd: repo.replace(/\\/g, "/"), hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } });
  const reason = (r.reason ?? "").replace(/^Planner hook: denied — /, "").replace(/\s+/g, " ").slice(0, 150).replace(/\|/g, "\\|");
  const cmd = command.replace(/\n/g, "\\n").replace(/\|/g, "\\|");
  console.log(`| ${what} | \`${cmd}\` | ${r.decision} | ${reason} | ${fix.replace(/\|/g, "\\|")} |`);
}
rmSync(repo, { recursive: true, force: true });
