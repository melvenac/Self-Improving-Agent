import { readFileSync, existsSync, openSync, closeSync, copyFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const [path, share = "None", access = "Read", mode = "Open"] = process.argv.slice(2);
const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", new URL("./hold.ps1", import.meta.url).pathname.slice(1), "-Path", path, "-Share", share, "-Access", access, "-Mode", mode, "-Seconds", "8"], { stdio: "inherit" });
const t0 = Date.now();
while (!existsSync(path + ".held")) { if (Date.now() - t0 > 20000) { console.log("no hold"); process.exit(2); } Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); }
console.log(readFileSync(path + ".held", "utf8").trim());
try { const b = readFileSync(path); console.log(`node readFileSync: OK ${b.length} bytes`); } catch (e) { console.log(`node readFileSync: ${e.code} ${e.message}`); }
try { copyFileSync(path, path + ".copy"); console.log("node copyFileSync: OK"); } catch (e) { console.log(`node copyFileSync: ${e.code}`); }
const r = spawnSync("powershell.exe", ["-NoProfile", "-Command", `try { $t=[IO.File]::ReadAllText('${path}'); "ps ReadAllText: OK $($t.Length)" } catch { "ps ReadAllText: $($_.Exception.InnerException.Message)$($_.Exception.Message)" }`], { encoding: "utf8" });
console.log(r.stdout.trim());
ps.on("exit", () => console.log("hold released"));
