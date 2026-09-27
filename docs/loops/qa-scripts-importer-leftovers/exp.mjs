import { readFileSync, existsSync, rmSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const [path, disable] = process.argv.slice(2);
rmSync(path + ".held", { force: true });
const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:/qa-scratch/il138/ebusy/hold.ps1", "-Path", path, "-Share", "None", "-Seconds", "12"], { stdio: "inherit" });
const t0 = Date.now();
while (!existsSync(path + ".held")) { if (Date.now() - t0 > 20000) { console.log("no hold"); process.exit(2); } Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); }
console.log(readFileSync(path + ".held", "utf8").trim());
try { readFileSync(path); console.log("parent node readFileSync: OK"); } catch (e) { console.log(`parent node readFileSync: ${e.code}`); }
const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:/qa-scratch/il138/ebusy/noprivread.ps1", "-Path", path, "-Disable", disable], { encoding: "utf8" });
console.log(r.stdout.trim(), r.stderr.trim());
