import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { decideSuiteStart, readCensus, readKeyFile, resolveSeatKeyPath } from "../src/suite-census.js";
import { buildCiSuiteMeta, buildSuiteMeta, sidecarStillLive, vitestCountsFromJson } from "../src/suite-run-meta.js";
import { resolveOwnerFromAncestry } from "../src/suite-owner.js";

const TSX = createRequire(import.meta.url).resolve("tsx/cli");
const CLI = join(import.meta.dirname, "../src/cli-suite-run.ts");
const SIA = ["atlas", "cursor-builder", "forge", "cursor-infra"];
const HOST = 2147483002;
const HOST_CMD = String.raw`C:\AppData\Local\cursor-agent\versions\2026.10.01-e373342\index.js`;

function ancestry(rows: { pid: number; ppid: number; commandLine: string }[]): string {
  return JSON.stringify(rows);
}

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
        SUITE_ANCESTRY: ancestry([
          { pid: process.pid, ppid: HOST, commandLine: "node.exe tsx cli-suite-run.ts" },
          { pid: HOST, ppid: 1, commandLine: HOST_CMD },
        ]),
        SUITE_OWNER_FROM: String(process.pid),
      },
    });
    expect(r.status, r.stderr ?? "").toBe(0);
    const written = JSON.parse(readFileSync(meta, "utf8"));
    expect(written.seat).toBe("cursor-builder");
    expect(written.owner_pid).toBe(HOST);
    expect(written.owner_pid).not.toBe(process.pid);
    expect(written.owner_source).toBe("cursor-agent");
    expect(written.lease_take_exit).toBe(0);
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

  it("seat key path is A2A_KEY_DIR or ~/.a2a-hub/keys/<host>-<port>/<hub_name>.key", () => {
    expect(resolveSeatKeyPath({
      hubUrl: "http://100.124.212.87:4000",
      hubName: "cursor-builder",
      keyDir: "C:/keys",
    }).replace(/\\/g, "/")).toBe("C:/keys/100.124.212.87-4000/cursor-builder.key");
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

  const idleCensus = {
    source: "hub-presence" as const,
    timestamp: "t",
    available: true,
    reason: null,
    agents: [],
    busySia: [],
    samples: 2,
  };

  it("no ancestor refuses, and ppid is not the owner", () => {
    const wrapper = 10;
    const resolved = resolveOwnerFromAncestry(wrapper, [
      { pid: wrapper, ppid: 1, commandLine: "node.exe tsx cli-suite-run.ts" },
    ]);
    expect(resolved.pid).toBeNull();
    expect(resolved.source).toBe("none");
    expect(resolved.reason).toMatch(/no cursor-agent host/);
    const host = resolveOwnerFromAncestry(wrapper, [
      { pid: wrapper, ppid: HOST, commandLine: "node.exe tsx cli-suite-run.ts" },
      { pid: HOST, ppid: 1, commandLine: HOST_CMD },
    ]);
    expect(host.pid).toBe(HOST);
    expect(host.pid).not.toBe(wrapper);
  });

  it("claude.exe is the owner when the chain has no cursor-agent host", () => {
    const resolved = resolveOwnerFromAncestry(10, [
      { pid: 10, ppid: 30, commandLine: "node.exe tsx cli-suite-run.ts" },
      { pid: 30, ppid: 1, commandLine: String.raw`C:\Users\me\AppData\Local\claude.exe` },
    ]);
    expect(resolved).toMatchObject({ pid: 30, source: "claude.exe", reason: null });
  });

  it("lease exits 11 and 2 refuse", () => {
    expect(decideSuiteStart({ leaseExit: 11, census: idleCensus, controlledRerun: false }).refuse).toBe(true);
    expect(decideSuiteStart({ leaseExit: 2, census: idleCensus, controlledRerun: false }).why).toMatch(/exit 2/);
    expect(decideSuiteStart({ leaseExit: 0, census: idleCensus, controlledRerun: false }).refuse).toBe(false);
  });

  function runCli(dir: string, extra: Record<string, string>) {
    const fixture = join(dir, "presence.json");
    const vitestJson = join(dir, "vitest.json");
    const meta = join(dir, "suite-run-meta.json");
    writeFileSync(fixture, JSON.stringify({
      samples: [presence([{ name: "forge", seatState: "idle" }]), presence([{ name: "forge", seatState: "idle" }])],
    }));
    writeFileSync(vitestJson, JSON.stringify({ numPassedTests: 1, numFailedTests: 0 }));
    const r = spawnSync(process.execPath, [TSX, CLI, "--seat", "cursor-builder", "--meta", meta], {
      encoding: "utf8",
      cwd: dir,
      env: {
        ...process.env,
        SUITE_CENSUS_FIXTURE: fixture,
        SUITE_VITEST_JSON: vitestJson,
        SUITE_VITEST_EXIT: "0",
        ...extra,
      },
    });
    const written = existsSync(meta) ? JSON.parse(readFileSync(meta, "utf8")) : null;
    return { r, written };
  }

  it("cli: no ancestor refuses and does not run vitest", () => {
    const dir = mkdtempSync(join(tmpdir(), "t168-no-owner-"));
    const { r, written } = runCli(dir, {
      SUITE_ANCESTRY: ancestry([{ pid: process.pid, ppid: 1, commandLine: "node.exe tsx cli-suite-run.ts" }]),
      SUITE_OWNER_FROM: String(process.pid),
      SUITE_LEASE_EXIT: "0",
    });
    expect(r.status).toBe(2);
    expect(written.owner_pid).toBeNull();
    expect(written.owner_pid).not.toBe(process.pid);
    expect(written.owner_reason).toBe("no cursor-agent host and no claude.exe session in the ancestor chain");
    expect(written.vitest.exit_code).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it("cli: lease exits 11 and 2 refuse", () => {
    const dir = mkdtempSync(join(tmpdir(), "t168-lease-"));
    const eleven = runCli(dir, { SUITE_LEASE_EXIT: "11" });
    const withOwner = (code: string, metaName: string) => spawnSync(
      process.execPath,
      [TSX, CLI, "--owner-pid", "100", "--meta", join(dir, metaName)],
      {
        encoding: "utf8",
        cwd: dir,
        env: {
          ...process.env,
          SUITE_CENSUS_FIXTURE: join(dir, "presence.json"),
          SUITE_VITEST_JSON: join(dir, "vitest.json"),
          SUITE_LEASE_EXIT: code,
        },
      },
    );
    // runCli writes the fixtures. The owner-less call refuses before the lease code matters.
    expect(eleven.r.status).toBe(2);
    const m11run = withOwner("11", "m11.json");
    const m2run = withOwner("2", "m2.json");
    expect(m11run.status).toBe(2);
    expect(m2run.status).toBe(2);
    const m11 = JSON.parse(readFileSync(join(dir, "m11.json"), "utf8"));
    const m2 = JSON.parse(readFileSync(join(dir, "m2.json"), "utf8"));
    expect(m11.lease_take_exit).toBe(11);
    expect(m2.lease_take_exit).toBe(2);
    expect(m11.vitest.exit_code).toBeNull();
    expect(m2.vitest.exit_code).toBeNull();
    expect(m11.owner_pid).toBe(100);
    rmSync(dir, { recursive: true, force: true });
  });

  it("cli: a lease already held by the same owner runs without take", () => {
    const dir = mkdtempSync(join(tmpdir(), "t168-held-"));
    const { r, written } = runCli(dir, {
      SUITE_LEASE_STATUS_EXIT: "10",
      SUITE_LEASE_STATUS_OUT: "lease=held pid=100 started=t",
    });
    const owned = spawnSync(process.execPath, [TSX, CLI, "--owner-pid", "100", "--meta", join(dir, "held.json")], {
      encoding: "utf8",
      cwd: dir,
      env: {
        ...process.env,
        SUITE_CENSUS_FIXTURE: join(dir, "presence.json"),
        SUITE_VITEST_JSON: join(dir, "vitest.json"),
        SUITE_VITEST_EXIT: "0",
        SUITE_LEASE_STATUS_EXIT: "10",
        SUITE_LEASE_STATUS_OUT: "lease=held pid=100 started=t",
      },
    });
    expect(r.status).toBe(2);
    expect(owned.status).toBe(0);
    const held = JSON.parse(readFileSync(join(dir, "held.json"), "utf8"));
    expect(held.lease_status).toBe("held-by-owner");
    expect(held.lease_take_exit).toBeNull();
    expect(held.lease_release_exit).toBeNull();
    expect(held.vitest.exit_code).toBe(0);
    expect(written.owner_pid).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it("cli: a missing win32 helper refuses unless the opt-out is set", () => {
    const dir = mkdtempSync(join(tmpdir(), "t168-helper-"));
    runCli(dir, {});
    const missing = spawnSync(process.execPath, [TSX, CLI, "--owner-pid", "100", "--meta", join(dir, "miss.json")], {
      encoding: "utf8",
      cwd: dir,
      env: {
        ...process.env,
        SUITE_CENSUS_FIXTURE: join(dir, "presence.json"),
        SUITE_VITEST_JSON: join(dir, "vitest.json"),
        SUITE_LEASE_HELPER: "missing",
      },
    });
    const opted = spawnSync(process.execPath, [TSX, CLI, "--owner-pid", "100", "--meta", join(dir, "opt.json")], {
      encoding: "utf8",
      cwd: dir,
      env: {
        ...process.env,
        SUITE_CENSUS_FIXTURE: join(dir, "presence.json"),
        SUITE_VITEST_JSON: join(dir, "vitest.json"),
        SUITE_VITEST_EXIT: "0",
        SUITE_LEASE_HELPER: "missing",
        SUITE_LEASE_OPT_OUT: "1",
      },
    });
    expect(missing.status).toBe(2);
    const miss = JSON.parse(readFileSync(join(dir, "miss.json"), "utf8"));
    expect(miss.lease_status).toBe("missing-helper");
    expect(miss.vitest.exit_code).toBeNull();
    expect(opted.status).toBe(0);
    const opt = JSON.parse(readFileSync(join(dir, "opt.json"), "utf8"));
    expect(opt.lease_status).toBe("skipped");
    expect(opt.vitest.exit_code).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
