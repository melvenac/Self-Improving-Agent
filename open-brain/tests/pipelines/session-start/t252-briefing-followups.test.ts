/**
 * T-252 rows (docs/loops/t252-briefing-followups-brief.md): BRIEFING-FIX r2 F1-F4 and the verifiedAt guard.
 */
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { describeFleet, fleetFallback, fleetProjectKey, type FleetJson } from "../../../src/pipelines/session-start/fleet.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  tmps.push(d);
  return d;
}
function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function gitRepo(dir: string): void {
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  writeFileSync(join(dir, "marker"), "x");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
}
const now = new Date("2026-10-08T22:00:00.000Z");
const C190 = "c".repeat(190);
const seat = (name: string) => ({ name, project: "SIA" });

describe("T-252: BRIEFING-FIX r2 follow-ups", () => {
  it("T252-1 (F1): budget line says 'seats +K more' when seats exist but none fit, 'none' only when there are none", () => {
    const root = tmp("t252-1-");
    gitRepo(root);
    const fa = join(root, "a.json");
    const fb = join(root, "b.json");
    writeFileSync(fa, JSON.stringify({ coordinator: { name: C190 }, seats: [seat("a"), seat("b")] }));
    writeFileSync(fb, JSON.stringify({ coordinator: { name: C190 }, seats: [] }));
    const a = describeFleet(root, "SIA", { FLEET_JSON: fa }, now);
    const b = describeFleet(root, "SIA", { FLEET_JSON: fb }, now);
    expect(a.budget).toBe(`FLEET: coordinator ${C190} · hub ? · dashboard ? · seats +2 more (verified ?)`);
    expect(a.budget).not.toContain("none");
    expect(b.budget).toBe(`FLEET: coordinator ${C190} · hub ? · dashboard ? · seats none (verified ?)`);
  });

  it("T252-2 (F2, loop 1): fleetProjectKey skips a null projects[] entry before the repo match", () => {
    const root = tmp("t252-2-");
    gitRepo(root);
    const folder = root.split(/[/\\]/).pop()!;
    const fleet = { projects: [null, { name: "SIA", repo: folder }] } as unknown as FleetJson;
    expect(fleetProjectKey(root, "self-improving-agent", fleet)).toBe("SIA");
  });

  it("T252-3 (F2, loop 2): fleetProjectKey skips a null projects[] entry in the name match", () => {
    const root = tmp("t252-3-");
    gitRepo(root);
    const fleet = { projects: [null, { name: "SIA", repo: "no-such-folder" }] } as unknown as FleetJson;
    expect(fleetProjectKey(root, "sia", fleet)).toBe("SIA");
  });

  it("T252-4 (F2, end to end): projects:[null] does not hide the seats", () => {
    const root = tmp("t252-4-");
    gitRepo(root);
    const path = join(root, "f.json");
    writeFileSync(path, JSON.stringify({ projects: [null], seats: [seat("atlas-sia")] }));
    const r = describeFleet(root, "SIA", { FLEET_JSON: path }, now);
    expect(r.budget).toBe("FLEET: coordinator ? · hub ? · dashboard ? · seats atlas-sia (verified ?)");
    expect(r.legacy[3]).toBe("Seats (SIA): atlas-sia ? ?/? ? ?");
  });

  it("T252-5 (F3): a BF-F7-class input reaches describeFleet's catch and does not throw", () => {
    const root = tmp("t252-5-");
    gitRepo(root);
    const pb = join(root, "f.json");
    writeFileSync(pb, '{"seats":[]}');
    const call = () => describeFleet(root, null as unknown as string, { FLEET_JSON: pb }, now);
    expect(call).not.toThrow();
    const Lb = `FLEET: unavailable (${pb}: invalid shape: Cannot read properties of null (reading 'toLowerCase'))`;
    expect(call()).toEqual({ legacy: [Lb], budget: Lb });
  });

  it("T252-6 (F4): fleetFallback names the real default fleet.json path and never throws", () => {
    const root = tmp("t252-6-");
    const alt = join(root, "f.json");
    const L1 = `FLEET: unavailable (${join(homedir(), "Projects", "fleet", "fleet.json")}: invalid shape: boom)`;
    expect(fleetFallback(new Error("boom\nsecond"), {})).toEqual({ legacy: [L1], budget: L1 });
    expect(fleetFallback("str", { FLEET_JSON: alt }).budget).toBe(`FLEET: unavailable (${alt}: invalid shape: str)`);
    expect(() => fleetFallback(null, { FLEET_JSON: alt })).not.toThrow();
    expect(fleetFallback(null, { FLEET_JSON: alt }).budget).toBe(`FLEET: unavailable (${alt}: invalid shape: null)`);
  });

  it("T252-7 (F4): handleStart's fallback is wired to fleetFallback", () => {
    const src = readFileSync(join(import.meta.dirname, "../../../src/server.ts"), "utf8");
    expect(src).toContain("return fleetFallback(err, process.env);");
    expect(src).not.toContain('process.env.FLEET_JSON ?? "fleet.json"');
  });

  it("T252-8 (F2b): a non-primitive verifiedAt renders as unknown, not as FLEET: unavailable", () => {
    const root = tmp("t252-8-");
    gitRepo(root);
    const path = join(root, "f.json");
    writeFileSync(path, '{"verifiedAt":{"valueOf":0,"toString":0},"seats":[{"name":"atlas-sia","project":"SIA"}]}');
    const r = describeFleet(root, "SIA", { FLEET_JSON: path }, now);
    expect(r.budget).toBe("FLEET: coordinator ? · hub ? · dashboard ? · seats atlas-sia (verified ?)");
    expect(r.budget).not.toContain("FLEET: unavailable");
    expect(r.legacy).toEqual([
      "## Fleet (fleet.json, verified ?)",
      "Coordinator: ? · questions and Aaron's decisions go to ?",
      "Hub: ? ? · Dashboard: ? ?",
      "Seats (SIA): atlas-sia ? ?/? ? ?",
    ]);
  });
});
