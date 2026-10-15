import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// T-168 / D-156: no default seat. The runner works it out from the checkout, or refuses naming --seat.
const TSX = createRequire(import.meta.url).resolve("tsx/cli");
const CLI = join(import.meta.dirname, "../src/cli-suite-run.ts");

function presence(name: string) {
  return { agents: [{ name, seat: { seatState: "idle" } }] };
}

function fixtures(dir: string) {
  const census = join(dir, "presence.json");
  const vitestJson = join(dir, "vitest.json");
  writeFileSync(census, JSON.stringify({ samples: [presence("forge"), presence("forge")] }));
  writeFileSync(vitestJson, JSON.stringify({ numPassedTests: 1, numFailedTests: 0 }));
  return { census, vitestJson };
}

/** process.env without the owner seams, so a row cannot inherit them. */
function baseEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith("SUITE_") || k === "MACHINE_LEASE_PS1" || k === "OPEN_BRAIN_CONTROLLED_RERUN") delete env[k];
  }
  return env;
}

const SEAT_MAP = {
  seats: {
    planner: { checkout: "sia-planner", role: "planner", agent: "Atlas", hub_name: "atlas", runtime: "claude-code", host: "desktop", model: "m" },
    builder: { checkout: "sia-builder", role: "developer", agent: "Builder", hub_name: "cursor-builder", runtime: "cursor", host: "qa-pc", model: "m" },
    qa: { checkout: "sia-qa", role: "qa", agent: "Probe", runtime: "claude-code", host: "qa-pc", model: "m" },
  },
  seatless_checkouts: { "Self-Improving-Agent": "main checkout carries no seat" },
};

/** `<root>/<checkout>/open-brain`, with the map at `<root>/<checkout>/.agents/SYSTEM/hub-partner-seats.json`. */
function checkoutCwd(root: string, checkout: string): string {
  const system = join(root, checkout, ".agents", "SYSTEM");
  mkdirSync(system, { recursive: true });
  writeFileSync(join(system, "hub-partner-seats.json"), JSON.stringify(SEAT_MAP, null, 2));
  const cwd = join(root, checkout, "open-brain");
  mkdirSync(cwd, { recursive: true });
  return cwd;
}

function hasMapAbove(dir: string): boolean {
  for (let d = dir; ; d = dirname(d)) {
    if (existsSync(join(d, ".agents", "SYSTEM", "hub-partner-seats.json"))) return true;
    if (dirname(d) === d) return false;
  }
}

function run(opts: { checkout?: string; args?: string[]; env?: NodeJS.ProcessEnv }) {
  const root = mkdtempSync(join(tmpdir(), "t168-seat-"));
  const out = mkdtempSync(join(tmpdir(), "t168-seat-out-"));
  if (opts.checkout === undefined && hasMapAbove(root)) {
    throw new Error("BLOCKED T-168R a seat map above %TEMP%");
  }
  const cwd = opts.checkout === undefined ? root : checkoutCwd(root, opts.checkout);
  const { census } = fixtures(out);
  const meta = join(out, "meta.json");
  const r = spawnSync(process.execPath, [TSX, CLI, ...(opts.args ?? []), "--owner-pid", "100", "--meta", meta], {
    encoding: "utf8",
    cwd,
    env: {
      ...baseEnv(),
      SUITE_CENSUS_FIXTURE: census,
      SUITE_DRY_RUN: "1",
      SUITE_LEASE_EXIT: "0",
      SUITE_LEASE_STATUS_EXIT: "0",
      SUITE_LEASE_RELEASE_EXIT: "0",
      ...(opts.env ?? {}),
    },
  });
  const metaWritten = existsSync(meta);
  const written = metaWritten ? JSON.parse(readFileSync(meta, "utf8")) : null;
  rmSync(root, { recursive: true, force: true });
  rmSync(out, { recursive: true, force: true });
  return { r, metaWritten, written };
}

describe("T-168 suite seat from the checkout, or a refusal naming --seat (D-156)", () => {
  it("S1: checkout sia-builder resolves to its hub name cursor-builder", () => {
    const { r, written } = run({ checkout: "sia-builder" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("suite seat: cursor-builder (checkout sia-builder)");
    expect(written?.seat).toBe("cursor-builder");
  }, 60_000);

  it("S2: checkout sia-planner resolves to atlas", () => {
    const { r, written } = run({ checkout: "sia-planner" });
    expect(r.status, r.stderr).toBe(0);
    expect(written?.seat).toBe("atlas");
  }, 60_000);

  it("S3: a checkout not in the map refuses naming --seat and writes no meta", () => {
    const { r, metaWritten } = run({ checkout: "oneoff-x" });
    expect(r.status, r.stdout).toBe(2);
    expect(r.stderr).toContain("checkout oneoff-x is not in .agents/SYSTEM/hub-partner-seats.json");
    expect(r.stderr).toContain("--seat");
    expect(metaWritten).toBe(false);
  }, 60_000);

  it("S4: no map at or above cwd refuses naming --seat and writes no meta", () => {
    const { r, metaWritten } = run({});
    expect(r.status, r.stdout).toBe(2);
    expect(r.stderr).toContain("no .agents/SYSTEM/hub-partner-seats.json at or above");
    expect(r.stderr).toContain("--seat");
    expect(metaWritten).toBe(false);
  }, 60_000);

  it("S5: a seat with no hub_name refuses naming --seat and writes no meta", () => {
    const { r, metaWritten } = run({ checkout: "sia-qa" });
    expect(r.status, r.stdout).toBe(2);
    expect(r.stderr).toContain("seat qa (checkout sia-qa) has no hub_name");
    expect(r.stderr).toContain("--seat");
    expect(metaWritten).toBe(false);
  }, 60_000);

  it("S6: a seatless checkout refuses naming --seat and writes no meta", () => {
    const { r, metaWritten } = run({ checkout: "Self-Improving-Agent" });
    expect(r.status, r.stdout).toBe(2);
    expect(r.stderr).toContain("is seatless: main checkout carries no seat");
    expect(r.stderr).toContain("--seat");
    expect(metaWritten).toBe(false);
  }, 60_000);

  it("S7: --seat wins over the checkout", () => {
    const { r, written } = run({ checkout: "sia-builder", args: ["--seat", "forge"] });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("suite seat: forge (--seat)");
    expect(written?.seat).toBe("forge");
  }, 60_000);

  it("S8: SUITE_SEAT names the seat where no map is found", () => {
    const { r, written } = run({ env: { SUITE_SEAT: "cursor-infra" } });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("suite seat: cursor-infra (SUITE_SEAT)");
    expect(written?.seat).toBe("cursor-infra");
  }, 60_000);

  it("S9: the runner carries no default seat", () => {
    expect(readFileSync(CLI, "utf8")).not.toContain('?? "cursor-builder"');
  });
});
