import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { decideSuiteStart, readCensus, readKeyFile } from "../src/suite-census.js";
import { buildCiSuiteMeta, buildSuiteMeta, sidecarStillLive, vitestCountsFromJson } from "../src/suite-run-meta.js";

const TSX = createRequire(import.meta.url).resolve("tsx/cli");
const CLI = join(import.meta.dirname, "../src/cli-suite-run.ts");
const SIA = ["atlas", "cursor-builder", "forge", "cursor-infra"];

function presence(agents: { name: string; seatState: string }[]) {
  return { agents: agents.map((a) => ({ name: a.name, seat: { seatState: a.seatState } })) };
}

function fetchBodies(bodies: unknown[], status = 200): typeof fetch {
  let i = 0;
  return (async () => {
    const body = bodies[Math.min(i, bodies.length - 1)];
    i += 1;
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe("T-168 suite meta", () => {
  const keyDir = mkdtempSync(join(tmpdir(), "t168-key-"));
  const keyPath = join(keyDir, "seat.key");
  writeFileSync(keyPath, "k".repeat(40));

  it("R1 lease exit 10 refuses", () => {
    const census = {
      source: "hub-presence" as const,
      timestamp: "t",
      available: true,
      reason: null,
      agents: [],
      busySia: [],
      samples: 2,
    };
    expect(decideSuiteStart({ leaseExit: 10, census, controlledRerun: false })).toEqual({
      refuse: true,
      why: "lease held (exit 10)",
    });
  });

  it("R2 lease free meta carries seat and sha", () => {
    const meta = buildSuiteMeta({
      gitSha: "abc",
      seat: "cursor-builder",
      leaseExit: 0,
      census: {
        source: "hub-presence",
        timestamp: "t",
        available: true,
        reason: null,
        agents: [{ name: "forge", seatState: "idle" }],
        busySia: [],
        samples: 2,
      },
      vitest: { counts: { passed: 1, failed: 0, errors: 0 }, exitCode: 0 },
    });
    expect(meta.git_sha).toBe("abc");
    expect(meta.seat).toBe("cursor-builder");
    expect(meta.lease_status).toBe("taken");
    expect(meta.vitest.exit_code).toBe(0);
  });

  it("R3 foreign working seat is recorded and the run is not refused", async () => {
    const census = await readCensus({
      hubUrl: "http://hub",
      keyPath,
      siaSeatNames: SIA,
      gapMs: 0,
      fetchFn: fetchBodies([
        presence([{ name: "chisel", seatState: "working" }]),
        presence([{ name: "chisel", seatState: "working" }]),
      ]),
    });
    expect(census.available).toBe(true);
    expect(census.busySia).toEqual([]);
    expect(census.agents.map((a) => a.name)).toContain("chisel");
    expect(decideSuiteStart({ leaseExit: 0, census, controlledRerun: false }).refuse).toBe(false);
  });

  it("R4 controlled rerun refuses a busy SIA seat", async () => {
    const census = await readCensus({
      hubUrl: "http://hub",
      keyPath,
      siaSeatNames: SIA,
      gapMs: 0,
      fetchFn: fetchBodies([
        presence([{ name: "forge", seatState: "working" }]),
        presence([{ name: "forge", seatState: "idle" }]),
      ]),
    });
    expect(census.busySia).toContain("forge");
    expect(decideSuiteStart({ leaseExit: 0, census, controlledRerun: true }).refuse).toBe(true);
    expect(decideSuiteStart({ leaseExit: 0, census, controlledRerun: false }).refuse).toBe(false);
  });

  it("R5 a single empty sample is not idle; both empty is unavailable", async () => {
    const oneEmpty = await readCensus({
      hubUrl: "http://hub",
      keyPath,
      siaSeatNames: SIA,
      gapMs: 0,
      fetchFn: fetchBodies([presence([]), presence([{ name: "atlas", seatState: "idle" }])]),
    });
    expect(oneEmpty.available).toBe(true);
    expect(oneEmpty.reason).toBeNull();
    const bothEmpty = await readCensus({
      hubUrl: "http://hub",
      keyPath,
      siaSeatNames: SIA,
      gapMs: 0,
      fetchFn: fetchBodies([presence([]), presence([])]),
    });
    expect(bothEmpty.available).toBe(false);
    expect(bothEmpty.reason).toMatch(/not idle/);
  });

  it("R6 an expired sidecar is not live and is not an idle census", () => {
    expect(sidecarStillLive("2000-01-01T00:00:00.000Z", 60_000, Date.parse("2026-01-01T00:00:00.000Z"))).toBe(false);
    const census = {
      source: "hub-presence" as const,
      timestamp: "2000-01-01T00:00:00.000Z",
      available: false,
      reason: "census unavailable: sidecar expired",
      agents: [],
      busySia: [],
      samples: 0,
    };
    expect(decideSuiteStart({ leaseExit: 0, census, controlledRerun: false }).refuse).toBe(false);
    expect(census.available).toBe(false);
  });

  it("R7 cli writes the meta file", () => {
    const dir = mkdtempSync(join(tmpdir(), "t168-meta-"));
    const fixture = join(dir, "presence.json");
    const vitestJson = join(dir, "vitest.json");
    const meta = join(dir, "suite-run-meta.json");
    writeFileSync(
      fixture,
      JSON.stringify({
        samples: [
          presence([{ name: "forge", seatState: "idle" }]),
          presence([{ name: "forge", seatState: "idle" }]),
        ],
      }),
    );
    writeFileSync(vitestJson, JSON.stringify({ numPassedTests: 3, numFailedTests: 1, unhandledErrors: 0 }));
    const r = spawnSync(process.execPath, [TSX, CLI, "--seat", "cursor-builder", "--meta", meta], {
      encoding: "utf8",
      cwd: dir,
      env: {
        ...process.env,
        SUITE_CENSUS_FIXTURE: fixture,
        SUITE_LEASE_EXIT: "0",
        SUITE_VITEST_JSON: vitestJson,
        SUITE_VITEST_EXIT: "0",
      },
    });
    expect(r.status).toBe(0);
    const written = JSON.parse(readFileSync(meta, "utf8"));
    expect(written.seat).toBe("cursor-builder");
    expect(written.vitest).toEqual({ passed: 3, failed: 1, errors: 0, exit_code: 0 });
    expect(written.census.source).toBe("hub-presence");
    rmSync(dir, { recursive: true, force: true });
  });

  it("CI row has runner fields and unknown concurrent jobs without a token", () => {
    const meta = buildCiSuiteMeta({
      gitSha: "abc",
      runnerName: "tcm-2",
      runnerLabels: ["self-hosted", "Linux"],
      timestamp: "t",
      concurrentJobs: "unknown",
    });
    expect(meta.ci?.runner_name).toBe("tcm-2");
    expect(meta.ci?.runner_labels).toEqual(["self-hosted", "Linux"]);
    expect(meta.ci?.concurrent_jobs).toBe("unknown");
    expect(meta.census.reason).toMatch(/census unavailable/);
  });

  it("unreachable hub records unavailable, not idle", async () => {
    const census = await readCensus({
      hubUrl: "http://hub",
      keyPath,
      siaSeatNames: SIA,
      gapMs: 0,
      fetchFn: (async () => {
        throw new Error("connect ECONNREFUSED");
      }) as typeof fetch,
    });
    expect(census.available).toBe(false);
    expect(census.reason).toMatch(/census unavailable:/);
    expect(census.reason).not.toMatch(/idle$/);
  });

  it("a waker seat reporting working counts as busy", async () => {
    const census = await readCensus({
      hubUrl: "http://hub",
      keyPath,
      siaSeatNames: SIA,
      gapMs: 0,
      fetchFn: fetchBodies([
        presence([{ name: "cursor-builder-waker", seatState: "working" }]),
        presence([{ name: "cursor-builder-waker", seatState: "working" }]),
      ]),
    });
    expect(census.busySia).toContain("cursor-builder-waker");
  });

  it("mutant: no key is unavailable, never an idle census", () => {
    expect(readKeyFile(undefined).ok).toBe(false);
    expect(readKeyFile(undefined)).toMatchObject({ reason: expect.stringMatching(/census unavailable:/) });
  });

  it("mutant: a body without seat.seatState is unavailable", async () => {
    const census = await readCensus({
      hubUrl: "http://hub",
      keyPath,
      siaSeatNames: SIA,
      gapMs: 0,
      fetchFn: fetchBodies([
        { agents: [{ name: "forge", state: "idle" }] },
        { agents: [{ name: "forge", state: "idle" }] },
      ]),
    });
    expect(census.available).toBe(false);
    expect(census.reason).toMatch(/seat\.seatState/);
  });

  it("G-042: passed and failed counts are separate from exit_code", () => {
    const counts = vitestCountsFromJson({ numPassedTests: 1096, numFailedTests: 0 });
    const meta = buildSuiteMeta({
      gitSha: "abc",
      seat: "forge",
      leaseExit: 0,
      census: {
        source: "hub-presence",
        timestamp: "t",
        available: true,
        reason: null,
        agents: [],
        busySia: [],
        samples: 2,
      },
      vitest: { counts, exitCode: 1 },
    });
    expect(meta.vitest.failed).toBe(0);
    expect(meta.vitest.passed).toBe(1096);
    expect(meta.vitest.exit_code).toBe(1);
  });
});
