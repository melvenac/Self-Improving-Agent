// T-298 item (4): an OFF usage level prints one true line where every greeting printed "not checked".
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describeUsage } from "../../../src/pipelines/session-start/briefing.js";

function withUsage(body: string, fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "ob-t298s3-"));
  try {
    mkdirSync(join(root, ".agents"), { recursive: true });
    const p = join(root, "slots.json");
    writeFileSync(p, body);
    writeFileSync(join(root, ".agents", "AGENT.local.md"), ["---", "name: X", "role: planner", `usage_file: ${p}`, "---", ""].join("\n"));
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}

describe("T-298 step 3", () => {
  it("U1: usageLevel OFF, as a string or as {level}, prints one short true line", () => {
    withUsage('{"usageLevel": "OFF"}', (root) => expect(describeUsage(root, {})).toBe("Usage: OFF → no usage gate (restrictions lifted)"));
    withUsage('{"usageLevel": {"level": "OFF", "sevenDayPct": 99}}', (root) => expect(describeUsage(root, {})).toBe("Usage: OFF → no usage gate (restrictions lifted)"));
  });

  it("U2: the other levels are unchanged", () => {
    withUsage('{"usageLevel": "GREEN"}', (root) => expect(describeUsage(root, {}).startsWith("Usage: GREEN")).toBe(true));
    withUsage("{}", (root) => expect(describeUsage(root, {}).startsWith("Usage: not checked (")).toBe(true));
  });
});
