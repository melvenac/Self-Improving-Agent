import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveCheckoutSeat } from "../../../src/pipelines/session-start/seat-map.js";
import { checkSeatIdentity } from "../../../src/pipelines/sync/seat-identity.js";

/**
 * T-203 (closes G-049). A seat is resolved by its CHECKOUT: the project-root
 * basename, as sessions[].checkout records it. The map is the seat file's `seats`
 * entries (checkout, role, agent, hub_name); AGENT.local.md is never consulted to
 * find the seat, only compared with it (S-4).
 */
const SEAT_FILE = join(import.meta.dirname, "../../../../.agents/SYSTEM/hub-partner-seats.json");
const parents: string[] = [];

function checkout(name: string, agent?: { name: string; role: string } | null, withMap = true): string {
  const parent = mkdtempSync(join(tmpdir(), "t203-map-"));
  parents.push(parent);
  const root = join(parent, name);
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  if (withMap) cpSync(SEAT_FILE, join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
  if (agent) {
    writeFileSync(join(root, ".agents", "AGENT.local.md"), `---\nname: ${agent.name}\nrole: ${agent.role}\npartner: Atlas\n---\n`);
  }
  return root;
}

afterEach(() => {
  for (const p of parents.splice(0)) rmSync(p, { recursive: true, force: true });
});

describe("T-203 S-1: the map resolves a checkout to seat, role, agent and hub name", () => {
  it.each([
    ["sia-planner", "planner", "planner", "Atlas", "atlas"],
    ["sia-builder", "builder", "developer", "Builder", "cursor-builder"],
    ["sia-infra", "infra", "developer", "Infra", "cursor-infra"],
    ["sia-forge", "forge", "developer", "Forge", "forge"],
  ])("%s is seat %s / %s / %s with hub name %s", (name, seat, role, agent, hubName) => {
    const r = resolveCheckoutSeat(checkout(name));
    expect(r).toEqual({ kind: "seat", checkout: name, seat, role, agent, hubName });
  });

  it.each([
    ["sia-qa", "qa", "Probe"],
    ["sia-research", "research", "Scout"],
  ])("%s is a mapped seat with NO hub name", (name, seat, agent) => {
    const r = resolveCheckoutSeat(checkout(name));
    expect(r.kind).toBe("seat");
    expect(r).toMatchObject({ checkout: name, seat, agent, hubName: null });
  });

  it("the main checkout is mapped explicitly as seatless, with its reason", () => {
    expect(resolveCheckoutSeat(checkout("Self-Improving-Agent"))).toEqual({
      kind: "seatless", checkout: "Self-Improving-Agent", reason: "main checkout carries no seat",
    });
  });

  it("a basename that is not listed is unknown, whatever its AGENT.local.md says", () => {
    const r = resolveCheckoutSeat(checkout("sia-scratch", { name: "Atlas", role: "planner" }));
    expect(r).toEqual({ kind: "unknown", checkout: "sia-scratch" });
  });

  it("no seat file at all is reported as no map, not as unknown", () => {
    expect(resolveCheckoutSeat(checkout("sia-planner", null, false)).kind).toBe("no-map");
  });

  it("an unparseable seat file is reported with its cause", () => {
    const root = checkout("sia-planner");
    writeFileSync(join(root, ".agents", "SYSTEM", "hub-partner-seats.json"), "{ not json");
    const r = resolveCheckoutSeat(root);
    expect(r.kind).toBe("unreadable");
    expect(JSON.stringify(r)).toMatch(/unreadable|Unexpected|JSON/);
  });
});

describe("T-203 S-4: /sync flags an AGENT.local.md that disagrees with the map for its checkout", () => {
  it("fires on sia-builder and sia-infra carrying Forge / developer, naming both values and the map file", () => {
    for (const [name, agent] of [["sia-builder", "Builder"], ["sia-infra", "Infra"]] as const) {
      const r = checkSeatIdentity(checkout(name, { name: "Forge", role: "developer" }));
      expect(r.name).toBe("seat-identity");
      expect(r.severity).toBe("issue");
      expect(r.message).toContain(`checkout ${name}`);
      expect(r.message).toContain("AGENT.local.md says name Forge, role developer");
      expect(r.message).toContain(`hub-partner-seats.json says name ${agent}, role developer`);
    }
  });

  it("passes when the identity matches the map", () => {
    const r = checkSeatIdentity(checkout("sia-builder", { name: "Builder", role: "developer" }));
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("sia-builder");
  });

  it("a matching name with the wrong role is also an issue", () => {
    const r = checkSeatIdentity(checkout("sia-planner", { name: "Atlas", role: "developer" }));
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("AGENT.local.md says name Atlas, role developer");
    expect(r.message).toContain("hub-partner-seats.json says name Atlas, role planner");
  });

  it("skips with the reason on the main checkout, on an unlisted checkout, with no AGENT.local.md, and with no map", () => {
    const main = checkSeatIdentity(checkout("Self-Improving-Agent", { name: "Atlas", role: "planner" }));
    expect(main.severity).toBe("skip");
    expect(main.message).toContain("main checkout carries no seat");
    const unlisted = checkSeatIdentity(checkout("sia-scratch", { name: "Atlas", role: "planner" }));
    expect(unlisted.severity).toBe("skip");
    expect(unlisted.message).toContain("seat unknown for checkout sia-scratch");
    const noAgent = checkSeatIdentity(checkout("sia-builder", null));
    expect(noAgent.severity).toBe("skip");
    expect(noAgent.message).toContain("no AGENT");
    const noMap = checkSeatIdentity(checkout("sia-builder", { name: "Forge", role: "developer" }, false));
    expect(noMap.severity).toBe("skip");
    expect(noMap.message).toMatch(/no seat map|hub-partner-seats\.json/);
  });
});
