// Checks that each rewrite recommended in cost-list.txt is accepted by the BUILT hook. Throw-away fixture; registers nothing.
//   node docs/loops/t194-r6/check-rewrites.mjs
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { runPlannerHook } = await import(pathToFileURL(join(here, "../../../open-brain/build/planner-hook/run.js")).href);
const repo = mkdtempSync(join(tmpdir(), "r6-rw-"));
for (const d of [".agents/SYSTEM", "open-brain/src", "docs/loops", ".git"]) mkdirSync(join(repo, d), { recursive: true });
writeFileSync(join(repo, "package.json"), "{}\n");
writeFileSync(join(repo, ".agents", "AGENT.local.md"), "---\nname: A\nrole: planner\n---\n");
let bad = 0;
for (const [tool, command] of [
  ["Bash", "npm --prefix docs test > C:/qa-tmp/out.txt"], ["Bash", "git commit -F docs/loops/msg.txt"], ["Bash", "git status && git log --oneline -3"],
  ["Bash", "ls docs/loops"], ["Bash", "git --no-pager log"], ["Bash", "git status"], ["Bash", "git rev-parse HEAD"], ["Bash", "cat /c/Users/x/notes.txt"],
  ["PowerShell", "Get-ChildItem docs"], ["PowerShell", "Get-Content docs/loops/x.md"], ["PowerShell", "Set-Content docs/x.md hi"],
  ["PowerShell", "Remove-Item docs/loops/a.tmp"], ["PowerShell", "Get-Date"],
]) {
  const r = runPlannerHook({ cwd: repo.replace(/\\/g, "/"), hook_event_name: "PreToolUse", tool_name: tool, tool_input: { command } });
  if (r.decision !== "allow") bad++;
  console.log(r.decision.padEnd(6), tool.padEnd(10), command);
}
rmSync(repo, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
