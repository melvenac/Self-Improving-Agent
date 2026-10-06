import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  FrozenWireTransport,
  assertRunlistPhaseGuards,
  readCal2Input,
  reportCal2RequestSizes,
  runShadowDoneFrozen,
  validateCal2InputWrapper,
} from "../../src/harness/cal2-frozen.js";
const ROOT = join(import.meta.dirname, "../../..");
const CAL2 = join(ROOT, "docs/loops/jev-calibration-2");
const RUNLIST = join(CAL2, "runlist.json");
const POLICY = join(ROOT, "open-brain/src/harness/policies/developer-done-cal2-r2.json");
const SAMPLE = join(CAL2, "inputs/002-qa250-t-222.G_done-request.json");

describe("jev-calibration-2 runner (frozen wire)", () => {
  it("dry-run sends the request field byte-for-byte", async () => {
    const { wireBody } = readCal2Input(SAMPLE);
    const transport = new FrozenWireTransport(wireBody, "dry-run", {});
    const dir = mkdtempSync(join(tmpdir(), "cal2-run-"));
    try {
      const result = await runShadowDoneFrozen({
        repoRoot: ROOT,
        inputPath: SAMPLE,
        policyPath: POLICY,
        phase: "dev",
        phaseDeclared: true,
        caseId: "qa250-t-222",
        runlistPath: RUNLIST,
        mode: "dry-run",
        recordsDir: dir,
        transport,
        at: new Date("2026-01-01T00:00:00.000Z"),
      });
      expect(result.exitCode).toBe(0);
      expect(transport.sentBodies).toHaveLength(1);
      expect(Buffer.compare(transport.sentBodies[0]!, wireBody)).toBe(0);
      const record = JSON.parse(readFileSync(result.recordPath, "utf-8")) as { mode: string; sent: boolean };
      expect(record.mode).toBe("dry-run");
      expect(record.sent).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a label smuggled into the request object", () => {
    const wrapper = JSON.parse(readFileSync(SAMPLE, "utf-8")) as Record<string, unknown>;
    const req = wrapper.request as Record<string, unknown>;
    req.label = "ACCEPT";
    expect(() => validateCal2InputWrapper(wrapper)).toThrow(/label/);
  });

  it("phase guards refuse a dev row run as heldout", () => {
    expect(() =>
      assertRunlistPhaseGuards(
        {
          repoRoot: ROOT,
          inputPath: SAMPLE,
          policyPath: POLICY,
          phase: "heldout",
          phaseDeclared: true,
          caseId: "qa250-t-222",
          runlistPath: RUNLIST,
          mode: "dry-run",
        },
        "docs/loops/jev-calibration-2/inputs/002-qa250-t-222.G_done-request.json",
        "open-brain/src/harness/policies/developer-done-cal2-r2.json",
      ),
    ).toThrow(/phase/);
  });

  it("held-out rows require phaseDeclared", () => {
    const runlist = JSON.parse(readFileSync(RUNLIST, "utf-8")) as {
      phases: { heldout: { case_id: string; input: string; policy: string }[] };
    };
    const row = runlist.phases.heldout[0]!;
    expect(() =>
      assertRunlistPhaseGuards(
        {
          repoRoot: ROOT,
          inputPath: join(ROOT, row.input),
          policyPath: join(ROOT, row.policy),
          phase: "heldout",
          caseId: row.case_id,
          runlistPath: RUNLIST,
          mode: "dry-run",
        },
        row.input,
        row.policy,
      ),
    ).toThrow(/explicit --phase heldout/);
  });

  it("reports request size distribution over frozen inputs (all under 90 KB ceiling)", () => {
    const stats = reportCal2RequestSizes(ROOT, "docs/loops/jev-calibration-2/inputs");
    expect(stats.n).toBe(87);
    expect(stats.max).toBeLessThanOrEqual(90_000);
  });
});
