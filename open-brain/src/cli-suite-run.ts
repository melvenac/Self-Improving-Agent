#!/usr/bin/env node
/**
 * T-168 heavy-suite wrapper. Takes the machine lease (Windows, when the helper
 * exists), reads hub presence twice, writes suite-run-meta.json, then runs
 * vitest. Refuses on lease exit 10, or when OPEN_BRAIN_CONTROLLED_RERUN=1 and
 * a SIA seat (or its waker) is working or the census is unavailable.
 *
 * Tests inject SUITE_CENSUS_FIXTURE (JSON file of two presence bodies),
 * SUITE_LEASE_EXIT, and SUITE_VITEST_JSON so this file does not call the hub
 * or powershell.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { agentsFromPresenceBody, decideSuiteStart, readCensus, resolveSeatKeyPath, type CensusResult } from "./suite-census.js";
import { buildSuiteMeta, vitestCountsFromJson } from "./suite-run-meta.js";

const SIA_SEATS = ["atlas", "cursor-builder", "forge", "cursor-infra", "cursor-qa"];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

function gitSha(): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  return (r.stdout ?? "").trim() || "unknown";
}

function leaseTake(ownerPid: string, seat: string): number | null {
  const forced = process.env.SUITE_LEASE_EXIT;
  if (forced !== undefined && forced !== "") return Number(forced);
  if (process.platform !== "win32") return null;
  const helper = process.env.MACHINE_LEASE_PS1 ?? join(homedir(), "machine-lease.ps1");
  if (!existsSync(helper)) return null;
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper, "take", "-OwnerPid", ownerPid, "-Seat", seat, "-TtlMinutes", "90"],
    { encoding: "utf8" },
  );
  return r.status ?? 1;
}

function leaseRelease(ownerPid: string): void {
  if (process.env.SUITE_LEASE_EXIT !== undefined) return;
  if (process.platform !== "win32") return;
  const helper = process.env.MACHINE_LEASE_PS1 ?? join(homedir(), "machine-lease.ps1");
  if (!existsSync(helper)) return;
  spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper, "release", "-OwnerPid", ownerPid],
    { encoding: "utf8" },
  );
}

async function censusFromEnv(hubUrl: string, keyPath: string | undefined): Promise<CensusResult> {
  const fixture = process.env.SUITE_CENSUS_FIXTURE;
  if (fixture) {
    const parsed = JSON.parse(readFileSync(fixture, "utf8")) as { samples?: unknown[] };
    const samples = parsed.samples ?? [];
    const stamped = new Date().toISOString();
    const parsedSamples = samples.map((body) => agentsFromPresenceBody(body));
    const failed = parsedSamples.find((s) => !s.ok);
    if (parsedSamples.length < 2) {
      return {
        source: "hub-presence",
        timestamp: stamped,
        available: false,
        reason: "census unavailable: fixture has fewer than two samples",
        agents: [],
        busySia: [],
        samples: parsedSamples.length,
      };
    }
    if (parsedSamples.every((s) => !s.ok)) {
      return {
        source: "hub-presence",
        timestamp: stamped,
        available: false,
        reason: failed && !failed.ok ? failed.reason : "census unavailable: fixture",
        agents: [],
        busySia: [],
        samples: 2,
      };
    }
    const agents = parsedSamples.flatMap((s) => (s.ok ? s.agents : []));
    if (agents.length === 0) {
      return {
        source: "hub-presence",
        timestamp: stamped,
        available: false,
        reason: "census unavailable: empty roster on both samples (not idle)",
        agents: [],
        busySia: [],
        samples: 2,
      };
    }
    const busySia = agents
      .filter((a) => a.seatState === "working")
      .map((a) => a.name)
      .filter((name) => SIA_SEATS.includes(name) || name.endsWith("-waker"));
    return { source: "hub-presence", timestamp: stamped, available: true, reason: null, agents, busySia: [...new Set(busySia)], samples: 2 };
  }
  return readCensus({ hubUrl, keyPath, siaSeatNames: SIA_SEATS, gapMs: 400 });
}

async function main(): Promise<void> {
  const seat = arg("--seat") ?? process.env.SUITE_SEAT ?? "cursor-builder";
  const hubUrl = arg("--hub") ?? process.env.HUB_URL ?? "http://100.124.212.87:4000";
  const keyPath = arg("--key") ?? process.env.SUITE_KEY_PATH ?? resolveSeatKeyPath({
    hubUrl,
    hubName: seat,
    keyDir: process.env.A2A_KEY_DIR,
  });
  const metaPath = arg("--meta") ?? join(process.cwd(), "suite-run-meta.json");
  const ownerPid = arg("--owner-pid") ?? String(process.ppid);
  const leaseExit = leaseTake(ownerPid, seat);
  let vitestExit: number | null = null;
  let counts = null as ReturnType<typeof vitestCountsFromJson> | null;
  try {
    const census = await censusFromEnv(hubUrl, keyPath);
    const controlled = process.env.OPEN_BRAIN_CONTROLLED_RERUN === "1";
    const decision = decideSuiteStart({ leaseExit, census, controlledRerun: controlled });
    if (!decision.refuse) {
      const vitestFixture = process.env.SUITE_VITEST_JSON;
      if (vitestFixture) {
        counts = vitestCountsFromJson(JSON.parse(readFileSync(vitestFixture, "utf8")));
        vitestExit = Number(process.env.SUITE_VITEST_EXIT ?? "0");
      } else if (process.env.SUITE_DRY_RUN === "1") {
        vitestExit = 0;
        counts = { passed: 0, failed: 0, errors: 0 };
      } else {
        const jsonOut = join(process.cwd(), "suite-vitest.json");
        const r = spawnSync("npx", ["vitest", "run", "--reporter=json", "--outputFile", jsonOut], {
          encoding: "utf8",
          shell: true,
          cwd: process.cwd(),
        });
        vitestExit = r.status ?? 1;
        if (existsSync(jsonOut)) counts = vitestCountsFromJson(JSON.parse(readFileSync(jsonOut, "utf8")));
      }
    }
    const meta = buildSuiteMeta({
      gitSha: gitSha(),
      seat,
      leaseExit,
      census,
      vitest: { counts, exitCode: vitestExit },
    });
    writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
    if (decision.refuse) {
      process.stderr.write(`${decision.why}\n`);
      process.exitCode = 2;
      return;
    }
    process.exitCode = vitestExit ?? 1;
  } finally {
    if (leaseExit === 0) leaseRelease(ownerPid);
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
