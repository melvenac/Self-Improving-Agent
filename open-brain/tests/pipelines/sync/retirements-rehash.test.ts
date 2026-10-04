import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { runRetirementsRehashCli } from "../../../src/pipelines/sync/retirements-line-hash.js";

describe("sync --retirements-rehash (G-050)", () => {
  let root: string;

  afterEach(() => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  });

  it("dry run prints a diff and does not change retirements.json", () => {
    root = mkdtempSync(join(tmpdir(), "g050-rehash-"));
    mkdirSync(join(root, ".agents"), { recursive: true });
    const body = "`widgetizer` was cut in Loop 10";
    writeFileSync(join(root, "README.md"), body);
    const record = {
      historical: [".agents/retirements.json"],
      retirements: [
        {
          name: "widgetizer",
          pattern: "\\bwidgetizer\\b",
          event: "cut",
          ruled: "2026-09-15",
          allowed_referrers: [{ path: "README.md", class: "prose", why: "obituary" }],
        },
      ],
    };
    const recordPath = join(root, ".agents", "retirements.json");
    writeFileSync(recordPath, JSON.stringify(record));
    const before = createHash("sha256").update(readFileSync(recordPath)).digest("hex");
    const code = runRetirementsRehashCli(root, false);
    expect(code).toBe(0);
    const after = createHash("sha256").update(readFileSync(recordPath)).digest("hex");
    expect(after).toBe(before);
  });

  it("--write applies line_hashes", () => {
    root = mkdtempSync(join(tmpdir(), "g050-rehash-w-"));
    mkdirSync(join(root, ".agents"), { recursive: true });
    const body = "`widgetizer` was cut in Loop 10";
    writeFileSync(join(root, "README.md"), body);
    const record = {
      historical: [".agents/retirements.json"],
      retirements: [
        {
          name: "widgetizer",
          pattern: "\\bwidgetizer\\b",
          event: "cut",
          ruled: "2026-09-15",
          allowed_referrers: [{ path: "README.md", class: "prose", why: "obituary" }],
        },
      ],
    };
    const recordPath = join(root, ".agents", "retirements.json");
    writeFileSync(recordPath, JSON.stringify(record));
    expect(runRetirementsRehashCli(root, true)).toBe(0);
    const parsed = JSON.parse(readFileSync(recordPath, "utf8")) as {
      retirements: Array<{ allowed_referrers: Array<{ line_hashes?: string[] }> }>;
    };
    expect(parsed.retirements[0].allowed_referrers[0].line_hashes?.length).toBe(1);
  });
});
