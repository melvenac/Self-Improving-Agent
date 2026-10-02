// QA 241: does a PowerShell redirect target that uses a provider path (::) or a drive-relative path reach a
// PROTECTED repo file, with the hook allowing it? And does real PS 5.1 write there? cwd is the fixture repo root.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeFixture, cli } from "./qa237/lib.mjs";

const FX = makeFixture("C:/qa-scratch/qa246-rpsr-fx");
const T = `${FX}/open-brain/src/x.ts`;
const abs = T.replace(/\//g, "\\");
const cases = [
  [`Write-Output x > FileSystem::${abs}`, "provider-path redirect to protected abs"],
  [`Write-Output x > Microsoft.PowerShell.Core\\FileSystem::${abs}`, "full provider redirect to protected abs"],
  [`Write-Output x >> FileSystem::${abs}`, "provider-path append redirect"],
  [`Set-Content FileSystem::${abs} -Value x`, "provider-path as Set-Content positional"],
  [`Write-Output x > C:open-brain/src/x.ts`, "drive-relative redirect (cwd on C:)"],
];
const S = "C:/qa-scratch/qa246-rpsr-shell";
function psReal(cmd, cwd) {
  const f = "C:/qa-tmp/qa246-rpsr.ps1";
  writeFileSync(f, "\ufeff" + cmd + "\n", "utf8");
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", f], { cwd, encoding: "utf8", timeout: 60000 });
}
for (const [cmd, label] of cases) {
  const hook = await cli({ hook_event_name: "PreToolUse", tool_name: "PowerShell", tool_input: { command: cmd }, cwd: FX }, undefined, FX);
  // real shell: fresh tree, cwd at its root so the relative/abs path lands in open-brain/src
  rmSync(S, { recursive: true, force: true });
  mkdirSync(join(S, "open-brain/src"), { recursive: true });
  const realCmd = cmd.replaceAll(FX, S).replaceAll(abs, `${S}/open-brain/src/x.ts`.replace(/\//g, "\\"));
  const r = psReal(realCmd, S);
  const wrote = existsSync(join(S, "open-brain/src/x.ts"));
  console.log(`${hook.decision === "allow" ? "ALLOW" : "deny "} hook | realWrote=${String(wrote).padEnd(5)} | ${label}\n     cmd=${cmd}\n     ${hook.decision === "allow" ? "" : "reason=" + hook.reason.slice(0, 120)}`);
}
