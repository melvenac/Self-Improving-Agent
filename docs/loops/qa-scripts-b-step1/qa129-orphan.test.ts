// QA 129 probe, not for commit: what happens to an awaited child when its test times out.
import { it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnAsync } from "./spawn-async.js";

const out = process.env.QA129_ORPHAN_DIR!;
const child = (tag: string) =>
  `require('fs').writeFileSync(${JSON.stringify(join(out, tag + ".pid"))}, String(process.pid)); ` +
  `setTimeout(() => require('fs').writeFileSync(${JSON.stringify(join(out, tag + ".done"))}, 'done'), 15000)`;
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

it("direct child: the test times out while awaiting it", async () => {
  await spawnAsync(process.execPath, ["-e", child("direct")]);
}, 2000);

it("shell child (the hook.test.ts shape): the test times out while awaiting it", async () => {
  await spawnAsync(`"${process.execPath}"`, ["-e", `"${child("shell").replace(/"/g, '\\"')}"`], { shell: true });
}, 2000);

it("the next test in the same file: are they still running?", async () => {
  await new Promise((r) => setTimeout(r, 1500));
  const report: Record<string, unknown> = {};
  for (const tag of ["direct", "shell"]) {
    const f = join(out, tag + ".pid");
    const pid = existsSync(f) ? Number(readFileSync(f, "utf8")) : -1;
    report[tag] = { pid, aliveDuringNextTest: pid > 0 && alive(pid) };
  }
  console.log("QA129_ORPHAN " + JSON.stringify(report));
  expect(true).toBe(true);
});
