// QA 233: run a command with TEMP/TMP pointed at C:/qa-tmp, foreground, and print its exit code.
// Usage: node C:/qa-scratch/qa233-run.mjs <cwd> <cmd> [args...]
import { spawnSync } from "node:child_process";
const [cwd, cmd, ...args] = process.argv.slice(2);
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const r = spawnSync(cmd, args, { cwd, env, stdio: "inherit", shell: true });
console.log(`qa233-run: exit=${r.status}`);
process.exit(r.status ?? 1);
