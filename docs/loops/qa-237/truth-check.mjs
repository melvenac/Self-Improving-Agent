// QA 237: replay every FAIL-OPEN generator disagreement in the REAL shell (Git Bash for Bash rows, Windows PowerShell
// 5.1 for PowerShell rows) against the fixture tree, and record whether the protected file really changed.
// Writes only inside C:/qa-scratch/qa237-fx (the fixture) and C:/qa-tmp. Usage: node truth-check.mjs <gen-out.json> <out.json>
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { FX } from "./lib.mjs";

const [IN, OUT] = process.argv.slice(2);
const j = JSON.parse(readFileSync(IN, "utf8"));
const BASH = "C:/Program Files/Git/bin/bash.exe";
const rows = j.disagreements.filter((d) => d.got === "allow" && d.expect !== "allow");
const res = [];
for (const d of rows) {
  const payload = d.cmd ? { tool: d.id.startsWith("ps") ? "ps" : "bash", cmd: d.cmd, cwd: d.cwdAbs } : null;
  let cmd, cwd, tool;
  if (payload) ({ cmd, cwd, tool } = payload);
  else { // gen-p1 rows: id is `bash <json> @cwd`
    const m = d.id.match(/^bash (".*") @(.*)$/s);
    if (!m) continue;
    cmd = JSON.parse(m[1]); cwd = m[2] === "." ? FX : `${FX}/${m[2]}`; tool = "bash";
  }
  const lands = d.landsAbs ?? (d.lands && d.lands !== "outside" && d.lands !== "(non-literal)" ? `${FX}/${d.lands}` : null);
  if (!lands || /^C:\/qa-tmp/i.test(lands) === false && !lands.toLowerCase().startsWith(FX.toLowerCase())) { res.push({ id: d.id, skipped: "lands outside the fixture" }); continue; }
  mkdirSync("C:/qa-tmp", { recursive: true });
  writeFileSync("C:/qa-tmp/src.txt", "src\n");
  mkdirSync(dirname(lands), { recursive: true });
  const removes = /\b(ri|del|rm|Remove-Item|move|mi|Move-Item)\b/.test(cmd) && /\bsrc\.txt\b/.test(cmd) === false;
  const seds = /\bsed\b/.test(cmd);
  if (removes || seds) writeFileSync(lands, "a\n"); else rmSync(lands, { force: true });
  const before = existsSync(lands) ? readFileSync(lands, "utf8") : null;
  mkdirSync(cwd, { recursive: true });
  const r = tool === "bash"
    ? spawnSync(BASH, ["-c", cmd], { cwd, encoding: "utf8", timeout: 60000 })
    : spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], { cwd, encoding: "utf8", timeout: 60000 });
  const after = existsSync(lands) ? readFileSync(lands, "utf8") : null;
  const changed = before !== after;
  res.push({ id: d.id, lands, changed, before, after, exit: r.status, stderr: (r.stderr || "").slice(0, 200) });
  rmSync(lands, { force: true });
  console.log(`${changed ? "WROTE" : "no-change"} ${d.id.slice(0, 150)}`);
}
const changed = res.filter((r) => r.changed).length;
console.log(`${changed}/${res.filter((r) => !r.skipped).length} fail-open rows changed the protected file in the real shell; ${res.filter((r) => r.skipped).length} skipped`);
writeFileSync(OUT, JSON.stringify({ changed, total: res.length, rows: res }, null, 1));
