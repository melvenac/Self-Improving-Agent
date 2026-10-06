import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { main } from "../../src/harness/cli.js";

const ROOT = join(import.meta.dirname, "../../..");
const SAMPLE = join(ROOT, "docs/loops/jev-calibration-2/inputs/038-qa264-pr371.G_done-request.json");
const RUNLIST = join(ROOT, "docs/loops/jev-calibration-2/runlist.json");
const POLICY = join(ROOT, "open-brain/src/harness/policies/developer-done-cal2-r2.json");

describe("JEV-CAL-2 DEV r2 F1 — frozen shadow-done live uses global fetch via CLI", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    vi.unstubAllGlobals();
    delete process.env.TYPESAFE_API_KEY;
  });

  it("harness shadow-done --request --mode live calls fetch without an injected fetchImpl", async () => {
    const recordsDir = mkdtempSync(join(tmpdir(), "cal2-f1-"));
    dirs.push(recordsDir);
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ model: "jev-1.13.0", answers: { touches_out_of_scope: { noul: 0.1 } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    process.env.TYPESAFE_API_KEY = "test-key-not-logged";

    const code = await main([
      "shadow-done",
      "--request",
      SAMPLE,
      "--policy",
      POLICY,
      "--phase",
      "dev",
      "--case-id",
      "qa264-pr371",
      "--runlist",
      RUNLIST,
      "--mode",
      "live",
      "--records",
      recordsDir,
      "--repo",
      ROOT,
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(code).toBe(0);
  });
});
