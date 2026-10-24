import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

// T-301: the heavy-suite run prints its owner, lease and census, so a reader need not open suite-run-meta.json.
const TSX = createRequire(import.meta.url).resolve("tsx/cli");
const CLI = join(import.meta.dirname, "../src/cli-suite-run.ts");

function presence(state: string) {
  return { agents: [{ name: "forge", seat: { seatState: state } }] };
}

/** process.env without the owner seams, so a row cannot inherit them. */
function baseEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith("SUITE_") || k === "MACHINE_LEASE_PS1" || k === "OPEN_BRAIN_CONTROLLED_RERUN") delete env[k];
  }
  return env;
}

function run(opts: { samples: unknown[]; ownerPid?: string; env?: NodeJS.ProcessEnv }) {
  const dir = mkdtempSync(join(tmpdir(), "t301-"));
  const census = join(dir, "presence.json");
  writeFileSync(census, JSON.stringify({ samples: opts.samples }));
  const r = spawnSync(
    process.execPath,
    [TSX, CLI, "--seat", "cursor-builder", "--owner-pid", opts.ownerPid ?? "100", "--meta", join(dir, "meta.json")],
    {
      encoding: "utf8",
      cwd: dir,
      env: {
        ...baseEnv(),
        SUITE_CENSUS_FIXTURE: census,
        SUITE_DRY_RUN: "1",
        SUITE_LEASE_EXIT: "0",
        SUITE_LEASE_RELEASE_EXIT: "0",
        ...(opts.env ?? {}),
      },
    },
  );
  rmSync(dir, { recursive: true, force: true });
  return r;
}

const lines = (stdout: string) => stdout.split(/\r?\n/);

describe("T-301: the suite run prints owner, lease and census", () => {
  it("L1: a dry run names the owner, the lease take and release, and an idle census", () => {
    const r = run({ samples: [presence("idle"), presence("idle")] });
    expect(r.status, r.stderr).toBe(0);
    expect(lines(r.stdout)).toContain("suite owner: pid 100 (flag)");
    expect(lines(r.stdout)).toContain("suite lease: taken (take exit 0, release exit 0)");
    expect(lines(r.stdout)).toContain("suite census: available, busy SIA: none");
  }, 60_000);

  it("L2: a busy census names the busy seat, and the line prints before the refusal", () => {
    const r = run({ samples: [presence("working"), presence("working")] });
    expect(r.status, r.stdout).toBe(2);
    expect(lines(r.stdout)).toContain("suite census: available, busy SIA: forge");
  }, 60_000);

  it("L3: an unavailable census prints its reason", () => {
    const r = run({ samples: [presence("idle")] });
    expect(r.status, r.stdout).toBe(2);
    expect(lines(r.stdout)).toContain("suite census: census unavailable: fixture has fewer than two samples");
  }, 60_000);

  it("L4: no owner prints the reason, and the lease is refused with no take or release", () => {
    const r = run({ samples: [presence("idle"), presence("idle")], ownerPid: "abc" });
    expect(r.status, r.stdout).toBe(2);
    expect(lines(r.stdout)).toContain("suite owner: none (--owner-pid abc is not a pid)");
    expect(lines(r.stdout)).toContain("suite lease: refused (take exit none, release exit none)");
  }, 60_000);

  it("L5: a lease the owner already holds is neither taken nor released", () => {
    const r = run({
      samples: [presence("idle"), presence("idle")],
      env: { SUITE_LEASE_STATUS_EXIT: "10", SUITE_LEASE_STATUS_OUT: "held pid=100 seat=cursor-builder" },
    });
    expect(r.status, r.stderr).toBe(0);
    expect(lines(r.stdout)).toContain("suite lease: held-by-owner (take exit none, release exit none)");
  }, 60_000);
});
