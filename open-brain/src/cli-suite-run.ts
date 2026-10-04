#!/usr/bin/env node
/**
 * T-168 heavy-suite wrapper. Resolves the D-119 owner, takes the machine lease
 * (Windows, when the helper exists), reads hub presence twice, writes
 * suite-run-meta.json, then runs vitest. Refuses when there is no owner and
 * no --owner-pid, on any lease take exit other than 0, or when
 * OPEN_BRAIN_CONTROLLED_RERUN=1 and a SIA seat (or its waker) is working or
 * the census is unavailable. Never uses process.ppid as the owner.
 *
 * Tests inject SUITE_CENSUS_FIXTURE (JSON file of two presence bodies),
 * SUITE_ANCESTRY (JSON ancestor rows), SUITE_OWNER_FROM (walk start for that table), SUITE_LEASE_EXIT, SUITE_LEASE_STATUS_EXIT,
 * SUITE_LEASE_HELPER=missing, SUITE_LEASE_OPT_OUT=1, and SUITE_VITEST_JSON so
 * this file does not call the hub or powershell.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { agentsFromPresenceBody, decideSuiteStart, readCensus, resolveSeatKeyPath, type CensusResult } from "./suite-census.js";
import { buildSuiteMeta, leaseStatusFromExit, vitestCountsFromJson } from "./suite-run-meta.js";
import {
  ownerFromFlag,
  resolveOwnerFromAncestry,
  unboundOwnerProbe,
  type AncestorRow,
  type ResolvedOwner,
} from "./suite-owner.js";

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

function helperPath(): string {
  return process.env.MACHINE_LEASE_PS1 ?? join(homedir(), "machine-lease.ps1");
}

function leaseTake(ownerPid: string, seat: string): number | null {
  const forced = process.env.SUITE_LEASE_EXIT;
  if (forced !== undefined && forced !== "") return Number(forced);
  if (process.platform !== "win32") return null;
  const helper = helperPath();
  if (!existsSync(helper)) return null;
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper, "take", "-OwnerPid", ownerPid, "-Seat", seat, "-TtlMinutes", "90"],
    { encoding: "utf8" },
  );
  return r.status ?? 1;
}

function leaseRelease(ownerPid: string): number | null {
  if (process.env.SUITE_LEASE_EXIT !== undefined && process.env.SUITE_LEASE_EXIT !== "") {
    const forced = process.env.SUITE_LEASE_RELEASE_EXIT;
    return forced !== undefined && forced !== "" ? Number(forced) : null;
  }
  if (process.platform !== "win32") return null;
  const helper = helperPath();
  if (!existsSync(helper)) return null;
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper, "release", "-OwnerPid", ownerPid],
    { encoding: "utf8" },
  );
  return r.status ?? 1;
}

function statusHeldByOwner(ownerPid: number): boolean {
  const forced = process.env.SUITE_LEASE_STATUS_EXIT;
  let code: number | null = null;
  let out = "";
  if (forced !== undefined && forced !== "") {
    code = Number(forced);
    out = process.env.SUITE_LEASE_STATUS_OUT ?? "";
  } else if (process.env.SUITE_LEASE_EXIT !== undefined && process.env.SUITE_LEASE_EXIT !== "") {
    return false;
  } else if (process.platform !== "win32" || !existsSync(helperPath())) {
    return false;
  } else {
    const r = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helperPath(), "status"],
      { encoding: "utf8" },
    );
    code = r.status;
    out = r.stdout ?? "";
  }
  if (code !== 10) return false;
  return new RegExp(`(?:^|\\s)pid=${ownerPid}(?:\\s|$)`).test(out);
}

function helperMissing(): boolean {
  if (process.env.SUITE_LEASE_HELPER === "missing") return true;
  if (process.env.SUITE_LEASE_EXIT !== undefined && process.env.SUITE_LEASE_EXIT !== "") return false;
  if (process.platform !== "win32") return false;
  return !existsSync(helperPath());
}

interface LeasePlan {
  takeExit: number | null;
  status: string;
  heldByOwner: boolean;
  refuseWhy: string | null;
}

function planLease(ownerPid: number, seat: string): LeasePlan {
  if (process.env.SUITE_LEASE_OPT_OUT === "1") {
    return { takeExit: null, status: "skipped", heldByOwner: false, refuseWhy: null };
  }
  if (helperMissing()) {
    return {
      takeExit: null,
      status: "missing-helper",
      heldByOwner: false,
      refuseWhy: "lease helper missing on win32; set SUITE_LEASE_OPT_OUT=1 to run without a lease",
    };
  }
  if (statusHeldByOwner(ownerPid)) {
    return { takeExit: null, status: "held-by-owner", heldByOwner: true, refuseWhy: null };
  }
  const takeExit = leaseTake(String(ownerPid), seat);
  if (takeExit !== null && takeExit !== 0) {
    return {
      takeExit,
      status: leaseStatusFromExit(takeExit),
      heldByOwner: false,
      refuseWhy: takeExit === 10 ? "lease held (exit 10)" : `lease take refused (exit ${takeExit})`,
    };
  }
  return { takeExit, status: leaseStatusFromExit(takeExit), heldByOwner: false, refuseWhy: null };
}

function resolveOwner(): ResolvedOwner {
  const flag = arg("--owner-pid");
  if (flag !== undefined) return ownerFromFlag(flag);
  const raw = process.env.SUITE_ANCESTRY;
  if (raw) {
    const parsed = JSON.parse(raw) as AncestorRow[];
    const startRaw = process.env.SUITE_OWNER_FROM;
    const start = startRaw !== undefined && startRaw !== "" ? Number(startRaw) : process.ppid;
    return resolveOwnerFromAncestry(start, Array.isArray(parsed) ? parsed : []);
  }
  return unboundOwnerProbe();
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
  const owner = resolveOwner();
  const lease: LeasePlan = owner.pid === null
    ? { takeExit: null, status: "refused", heldByOwner: false, refuseWhy: owner.reason }
    : planLease(owner.pid, seat);
  let vitestExit: number | null = null;
  let counts = null as ReturnType<typeof vitestCountsFromJson> | null;
  let census: CensusResult | undefined;
  let refused = owner.pid === null || lease.refuseWhy !== null;
  let decisionWhy = lease.refuseWhy ?? owner.reason;
  let releaseExit: number | null = null;
  try {
    census = await censusFromEnv(hubUrl, keyPath);
    const controlled = process.env.OPEN_BRAIN_CONTROLLED_RERUN === "1";
    if (!refused) {
      const decision = decideSuiteStart({ leaseExit: lease.takeExit, census, controlledRerun: controlled });
      refused = decision.refuse;
      decisionWhy = decision.why;
    }
    if (!refused) {
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
  } finally {
    if (owner.pid !== null && lease.takeExit === 0 && !lease.heldByOwner) {
      releaseExit = leaseRelease(String(owner.pid));
    }
  }
  if (!census) return;
  const meta = buildSuiteMeta({
    gitSha: gitSha(),
    seat,
    leaseExit: lease.takeExit,
    leaseStatus: lease.status,
    census,
    vitest: { counts, exitCode: vitestExit },
    ownerPid: owner.pid,
    ownerSource: owner.source,
    ownerReason: owner.reason ?? (refused ? decisionWhy : null),
    leaseTakeExit: lease.takeExit,
    leaseReleaseExit: releaseExit,
  });
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  if (refused) {
    process.stderr.write(`${decisionWhy ?? "refused"}\n`);
    process.exitCode = 2;
    return;
  }
  process.exitCode = vitestExit ?? 1;
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
