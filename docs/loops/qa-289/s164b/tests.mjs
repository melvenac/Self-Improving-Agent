// QA 289: typecheck + one vitest run per test file, in a given open-brain tree.
// Usage: node tests.mjs <openBrainDir> [typecheck] [file ...]
import { spawnSync } from "node:child_process";
import { QA_ENV } from "./run.mjs";
const [ob, ...rest] = process.argv.slice(2);
const files = rest.filter((f) => f !== "typecheck");
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: ob, env: QA_ENV, encoding: "utf8", shell: true, maxBuffer: 64 << 20 });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
};
if (rest.includes("typecheck")) {
  for (const s of ["typecheck", "typecheck:tests"]) {
    const r = run("npm", ["run", s]);
    console.log(`[${s}] exit ${r.status}${r.status ? "\n" + r.out.slice(-3000) : ""}`);
  }
}
for (const f of files) {
  const r = run("npx", ["vitest", "run", f]);
  const strip = r.out.replace(/\x1b\[[0-9;]*m/g, "");
  const sum = strip.split(/\r?\n/).filter((l) => /Tests\s+\d|FAIL\s|AssertionError|Error:/.test(l)).slice(0, 12).join("\n");
  console.log(`[${f}] exit ${r.status}\n${sum}`);
}
