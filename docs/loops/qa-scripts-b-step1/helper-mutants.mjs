// QA 129: mutants of open-brain/tests/spawn-async.ts, each run against tests/spawn-async.test.ts.
// Usage (from open-brain/): node <this> ; restores the file after each mutant.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const FILE = "tests/spawn-async.ts";
const orig = readFileSync(FILE, "utf8");

const mutants = [
  ["D1 stderr hardcoded ''", [["stderr: Buffer.concat(err).toString('utf-8'),", "stderr: '',"]]],
  ["D2 spawnSync-backed body", [
    ["import { spawn, type SpawnOptions } from 'node:child_process';", "import { spawn, spawnSync, type SpawnOptions } from 'node:child_process';"],
    ["  const { input, ...rest } = options;\n  return new Promise((resolve) => {",
     "  const { input, ...rest } = options;\n  { const s = spawnSync(command, args, { ...rest, input: input ?? '', encoding: 'utf-8' } as any);\n    return Promise.resolve({ status: s.status, signal: s.signal, stdout: s.stdout ?? '', stderr: s.stderr ?? '', ...(s.error ? { error: s.error } : {}) }); }\n  return new Promise((resolve) => {"]]],
  ["D3 execAsync never throws", [["  if (r.error || r.status !== 0) {", "  if (false) {"]]],
  ["Q1 signal dropped", [["        signal,\n", "        signal: null,\n"]]],
  ["Q2 settle on 'exit' not 'close'", [["child.on('close', (status, signal) => {", "child.on('exit', (status, signal) => {"]]],
  ["Q3 execAsync lets a signal-killed child pass", [["  if (r.error || r.status !== 0) {", "  if (r.error || (r.status ?? 0) !== 0) {"]]],
  ["Q4 input ignored", [["child.stdin!.end(input ?? '');", "child.stdin!.end('');"]]],
  ["Q5 start error not settled", [["      if (child.pid === undefined) resolve(", "      if (false) resolve("]]],
  ["Q6 status hardcoded 0", [["      resolve({\n        status,\n", "      resolve({\n        status: 0,\n"]]],
  ["Q7 error dropped on a started child", [["        ...(startError ? { error: startError } : {}),\n", ""]]],
];

const results = [];
try {
  for (const [name, edits] of mutants) {
    let src = orig;
    for (const [from, to] of edits) {
      if (!src.includes(from)) throw new Error(`${name}: anchor not found: ${from}`);
      src = src.replace(from, to);
    }
    writeFileSync(FILE, src);
    const r = spawnSync("npx", ["vitest", "run", "tests/spawn-async.test.ts", "--testTimeout=10000"], { encoding: "utf8", shell: true });
    const text = (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, "");
    const tests = (text.match(/Tests\s+(.*)/) || [])[1] || "?";
    const failed = [...text.matchAll(/(?:×|✗|FAIL)\s+.*?spawnAsync > ([^\n]+)/g)].map((m) => m[1].trim());
    results.push(`${name}: exit=${r.status} Tests ${tests.trim()}${failed.length ? " | red: " + [...new Set(failed)].join(" / ") : ""}`);
    console.log(results.at(-1));
  }
} finally {
  writeFileSync(FILE, orig);
}
