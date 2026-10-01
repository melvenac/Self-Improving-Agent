/**
 * Slice four, G2 — the key (S4-3a.1, S4-3b.1, ruling 6).
 *
 * Nothing here reaches the network: every `fetch` is a fake, and the global `fetch` is replaced
 * with one that fails the test if it is touched.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  GateUnavailable,
  JEV_ENDPOINT,
  JEV_KEY_VAR,
  JEV_MIN_MODEL,
  JevTransport,
  PLAN_GATE_QUESTIONS,
  jevModelAtLeast,
  type GatePayload,
} from "../../src/harness/gate.js";
import { BriefPlanGateError, runBriefPlanGate } from "../../src/harness/brief-plan-gate.js";
import { harnessEnv, hostileFetch, makeCanary, scanForCanary, scanKnownPositive, type SeenRequest } from "./s4-canary.js";

const TSX = resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const CLI = resolve(__dirname, "../../src/harness/cli.ts");

const payload = (): GatePayload => ({
  gate: "plan",
  loop: "15-canary",
  model: "jev-latest",
  questions: PLAN_GATE_QUESTIONS,
  context: { plan: { objective: "o" } },
});

describe("G2 — the key", { timeout: 120_000 }, () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = (() => {
      throw new Error("a test in this file must not reach the network");
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /* S4-3a.1 ------------------------------------------------------------- */

  it("A1 exactly one request, to JEV_ENDPOINT, with the canary as the Bearer token", async () => {
    const canary = makeCanary();
    const seen: SeenRequest[] = [];
    const env = harnessEnv({ [JEV_KEY_VAR]: canary });
    await new JevTransport({ env, fetchImpl: hostileFetch(200, seen) }).dispatch(payload());
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe(JEV_ENDPOINT);
    expect(JEV_ENDPOINT).toBe("https://api.typesafe.ai/v1/systemone");
    expect(seen[0]!.authorization).toBe(`Bearer ${canary}`);
    expect(seen[0]!.method).toBe("POST");
  });

  it("A2 the same call with the variable deleted makes zero requests and throws GateUnavailable", async () => {
    const canary = makeCanary();
    // The pair: with the variable it makes one request, without it none. Comparing the two is what
    // proves the deletion changed something (G-044), not "I assumed it was unset".
    const withKey: SeenRequest[] = [];
    const without: SeenRequest[] = [];
    const env = harnessEnv({ [JEV_KEY_VAR]: canary });
    await new JevTransport({ env, fetchImpl: hostileFetch(200, withKey) }).dispatch(payload());
    const deleted = { ...env };
    delete deleted[JEV_KEY_VAR];
    expect(JEV_KEY_VAR in deleted).toBe(false);
    await expect(new JevTransport({ env: deleted, fetchImpl: hostileFetch(200, without) }).dispatch(payload())).rejects.toBeInstanceOf(
      GateUnavailable,
    );
    expect(withKey).toHaveLength(1);
    expect(without).toHaveLength(0);
  });

  it("A3 the version comparator: numeric, field by field, and an unreported version fails", () => {
    const table: [unknown, boolean][] = [
      ["jev-1.13.0", true],
      ["jev-1.13.1", true],
      ["jev-1.14.0", true],
      ["jev-2.0.0", true],
      ["jev-1.12.9", false],
      ["jev-1.9.0", false], // a string comparison would rank this above 1.13.0
      ["jev-0.99.99", false],
      [null, false],
      [undefined, false],
      ["jev-latest", false],
      ["gpt-4", false],
      ["jev-1.13", false],
      ["jev-1.13.0-beta", false],
      ["", false],
      [113, false],
    ];
    for (const [v, want] of table) expect(jevModelAtLeast(v), JSON.stringify(v)).toBe(want);
    expect(JEV_MIN_MODEL).toBe("jev-1.13.0");
    expect(jevModelAtLeast("jev-1.13.0", "jev-1.14.0")).toBe(false);
  });
});

/* ------------------------------------------------------------------------- *
 * S4-3b.1 — the key reaches nothing else, by construction (runBriefPlanGate)
 * ------------------------------------------------------------------------- */

function writePlanFixture(dir: string): string {
  writeFileSync(join(dir, "c-brief.md"), "# canary brief\n\nBuild a thing.\n");
  const dt = join(dir, "c-brief.D_t.json");
  writeFileSync(
    dt,
    JSON.stringify({
      loop: "15-canary",
      objective: "Build a thing.",
      tasks: ["build"],
      out_of_scope: ["other"],
      preserve: ["the suite"],
      acceptance: [{ id: "A1", observable: "a file exists", type: "blackbox" }],
      repair_targets: ["a known gap"],
      new_capability: "the thing",
    }),
  );
  return dt;
}

describe("S4-3b.1 — the key reaches nothing else: runBriefPlanGate", { timeout: 120_000 }, () => {
  // The tripwire matters most here: against a source that ignores the injected fetch, the canary
  // would otherwise be sent to the real endpoint. It must fail the test instead of making a call.
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = (() => {
      throw new Error("a test in this file must not reach the network");
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("K0 the scan can fail: a canary planted in a temp file is found exactly once", () => {
    expect(scanKnownPositive(makeCanary())).toBe(1);
  });

  for (const status of [200, 422] as const) {
    it(`K1 a hostile fake that echoes the Authorization header as a ${status} leaves the canary in no output`, async () => {
      const canary = makeCanary();
      const dir = mkdtempSync(join(tmpdir(), "s4g2-"));
      const dt = writePlanFixture(dir);
      const ledger = join(dir, "attempts.jsonl");
      const seen: SeenRequest[] = [];
      const logged: string[] = [];
      let thrown = "";
      try {
        await runBriefPlanGate({
          dtPath: dt,
          repoRoot: dir,
          mode: "live",
          env: harnessEnv({ [JEV_KEY_VAR]: canary }),
          fetchImpl: hostileFetch(status, seen),
          ledgerPath: ledger,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BriefPlanGateError);
        thrown = `${(err as Error).message}\n${JSON.stringify(err, Object.getOwnPropertyNames(err))}`;
      }
      // The call happened, and it carried the canary: the echo is real, so a clean scan means something.
      expect(seen).toHaveLength(1);
      expect(seen[0]!.authorization).toBe(`Bearer ${canary}`);
      const scan = scanForCanary(canary, { dirs: [dir], strings: { thrown, logged: logged.join("\n") } });
      expect(scan.filesRead, "the scan read no files").toBeGreaterThanOrEqual(4); // brief, D_t, ledger, record
      expect(scan.stringsRead).toBe(2);
      expect(scan.hits, `the canary reached: ${scan.where.join(", ")}`).toBe(0);
      if (status === 422) expect(thrown).not.toBe("");
    });
  }

  for (const status of [200, 422] as const) {
    it(`K3 at the transport itself, a ${status} that echoes the Authorization header leaves the canary out of the answer's error, message, detail and fields`, async () => {
      const canary = makeCanary();
      const seen: SeenRequest[] = [];
      const env = harnessEnv({ [JEV_KEY_VAR]: canary });
      // The record writer redacts too, so a mutant that drops the transport's own redaction is
      // hidden from the record-level tests above. This one looks at the transport's output directly.
      let surfaced = "";
      try {
        const a = await new JevTransport({ env, fetchImpl: hostileFetch(status, seen) }).dispatch(payload());
        surfaced = `${a.note} ${a.resolvedModel ?? ""}`;
      } catch (err) {
        const e = err as { message: string; detail?: string; fields?: string[] };
        surfaced = `${e.message} ${e.detail ?? ""} ${(e.fields ?? []).join(" ")}`;
      }
      expect(seen).toHaveLength(1);
      expect(surfaced.length).toBeGreaterThan(20);
      if (status === 422) expect(surfaced).toContain("REDACTED");
      expect(surfaced).not.toContain(canary);
    });
  }

  it("K2 the spawned CLI, with a constructed env that holds the canary, prints and writes none of it", () => {
    const canary = makeCanary();
    const dir = mkdtempSync(join(tmpdir(), "s4g2-cli-"));
    const dt = writePlanFixture(dir);
    // Dry run on purpose: the CLI has no endpoint override, so a live call from here would reach
    // the real service. What this proves is that the printed payload, the record and the streams
    // never carry a key that is in the child's environment.
    const r = spawnSync(process.execPath, [TSX, CLI, "plan-gate", dt, "--mode", "dry-run", "--repo", dir], {
      cwd: dir,
      encoding: "utf-8",
      shell: false,
      timeout: 120_000,
      env: harnessEnv({ [JEV_KEY_VAR]: canary }),
    });
    if (r.error) throw r.error;
    expect(r.status, `${r.stderr}\n${r.stdout}`).toBe(0);
    const scan = scanForCanary(canary, { dirs: [dir], strings: { stdout: r.stdout ?? "", stderr: r.stderr ?? "" } });
    expect(scan.filesRead).toBeGreaterThanOrEqual(3); // brief, D_t, record
    expect(scan.hits, `the canary reached: ${scan.where.join(", ")}`).toBe(0);
  });
});

/* ------------------------------------------------------------------------- *
 * Ruling 6 — t195-plan-gate.test.ts's harness() helper takes a constructed env
 * ------------------------------------------------------------------------- */

/** Whether `source` spreads the whole process environment into a child's env (the G-044 shape). */
export function spreadsProcessEnv(source: string): boolean {
  return /\.\.\.\s*process\.env\b/.test(source);
}

describe("ruling 6 — the t195 helper never spreads process.env", { timeout: 120_000 }, () => {
  it("E1 the scan is shown to fire on the old shape and to stay quiet on the new one", () => {
    expect(spreadsProcessEnv("env: { ...process.env, ...env },")).toBe(true);
    expect(spreadsProcessEnv("env: harnessEnv(env),")).toBe(false);
  });

  it("E2 t195-plan-gate.test.ts does not spread process.env, and uses the constructed env", () => {
    const text = readFileSync(resolve(__dirname, "t195-plan-gate.test.ts"), "utf-8");
    expect(text.length).toBeGreaterThan(1000);
    expect(spreadsProcessEnv(text)).toBe(false);
    expect(text).toContain("harnessEnv(");
  });

  it("E3 harnessEnv omits a key that is in the real environment", () => {
    const canary = makeCanary();
    const before = process.env[JEV_KEY_VAR];
    process.env[JEV_KEY_VAR] = canary;
    try {
      const env = harnessEnv();
      expect(JEV_KEY_VAR in env).toBe(false);
      expect(JSON.stringify(env)).not.toContain(canary);
      expect(process.env[JEV_KEY_VAR], "the precondition: the key really is in this process").toBe(canary);
    } finally {
      if (before === undefined) delete process.env[JEV_KEY_VAR];
      else process.env[JEV_KEY_VAR] = before;
    }
  });
});
