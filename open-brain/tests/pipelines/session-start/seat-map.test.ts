import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, readFileSync } from "node:fs";
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
    expect(r).toMatchObject({ kind: "seat", checkout: name, seat, role, agent, hubName });
    if (r.kind === "seat") {
      expect(r.runtime).toBeTruthy();
      expect(r.host).toBeTruthy();
      expect(r.model).toBeTruthy();
    }
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

  it("T-240 a seat row with no runtime is unreadable", () => {
    const root = checkout("sia-infra", null);
    const path = join(root, ".agents", "SYSTEM", "hub-partner-seats.json");
    const map = JSON.parse(readFileSync(path, "utf8"));
    delete map.seats.infra.runtime;
    writeFileSync(path, JSON.stringify(map));
    const r = resolveCheckoutSeat(root);
    expect(r.kind).toBe("unreadable");
    expect(r).toMatchObject({ reason: /runtime must be cursor or claude-code/ });
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

describe("T-213: the tracked map carries the rooms clark created (atlas, <hub_name>, <hub_name>-waker) and forge speaks as forge", () => {
  // Read straight from the tracked file: these are the values every seat's presence and hub-talk read.
  const map = JSON.parse(readFileSync(SEAT_FILE, "utf8")) as {
    seats: Record<string, { checkout: string; hub_name?: string; room?: string; dispatch?: { cursor?: { room?: string; hub_name?: string } } }>;
    readers: Record<string, { partners: { label: string; hub_as: string; session_id: string }[] }>;
  };
  const ROOMS = {
    infra: { checkout: "sia-infra", hub_name: "cursor-infra", room: "k57d92gqtjm9wpfs74ekbx9rns8fmy2f" },
    builder: { checkout: "sia-builder", hub_name: "cursor-builder", room: "k575sfwr9wcx3r8fw83g3bc00x8fmar3" },
    forge: { checkout: "sia-forge", hub_name: "forge", room: "k571z4ghp7nbp34djhecwnsk3n8fmhsf" },
  } as const;

  it.each(Object.entries(ROOMS))("seat %s: checkout, hub_name and dispatch.cursor.room, with no top-level room", (seat, want) => {
    const row = map.seats[seat]!;
    expect(row.checkout).toBe(want.checkout);
    expect(row.hub_name).toBe(want.hub_name);
    expect(row.dispatch?.cursor?.room).toBe(want.room);
    expect(row.room).toBeUndefined();
  });

  it.each(Object.entries(ROOMS))("seat %s: the atlas↔seat reader pair, both directions, on the seat's room", (_seat, want) => {
    const fromAtlas = map.readers.atlas!.partners.filter((p) => p.hub_as === want.hub_name);
    expect(fromAtlas).toEqual([{ label: want.hub_name, hub_as: want.hub_name, session_id: want.room }]);
    expect(map.readers[want.hub_name]?.partners).toEqual([{ label: "Atlas", hub_as: "atlas", session_id: want.room }]);
  });

  // T-242: the Grok bots are atlas's partners on their own rooms. They are not seats (no worktree, no waker) and not readers.
  const SESSION_ID = /^k[0-9a-z]{31}$/;
  const BOTS = [
    { label: "grok-sia-review", hub_as: "grok-sia-review", session_id: "k57c639j4wkyp3y3vhfxxytn1s8fsdx6" },
    { label: "grok-qa-sia", hub_as: "grok-qa-sia", session_id: "k573rrq0rz6p519xhh4p9mmyk98fsb55" },
  ] as const;

  it("T-242 SM-1 atlas reads both Grok bots, each exactly once, on its own room", () => {
    for (const bot of BOTS) {
      expect(map.readers.atlas!.partners.filter((p) => p.hub_as === bot.hub_as)).toEqual([bot]);
    }
  });

  it("T-242 SM-2 every partner row of every reader is well-formed, and atlas's partners are distinct", () => {
    for (const [reader, block] of Object.entries(map.readers)) {
      expect(block.partners.length, reader).toBeGreaterThan(0);
      for (const p of block.partners) {
        for (const field of [p.label, p.hub_as]) {
          expect(typeof field === "string" && field.length > 0 && field === field.trim(), `${reader}: ${JSON.stringify(p)}`).toBe(true);
        }
        expect(p.session_id, `${reader}: ${JSON.stringify(p)}`).toMatch(SESSION_ID);
      }
    }
    const atlas = map.readers.atlas!.partners;
    expect(new Set(atlas.map((p) => p.hub_as)).size).toBe(atlas.length);
    expect(new Set(atlas.map((p) => p.session_id)).size).toBe(atlas.length);
  });

  it("T-242 SM-3 no seat, reader or partner speaks as plain grok; every reader is a seat; the Grok bots are neither seats nor readers", () => {
    const seatHubNames = Object.values(map.seats)
      .flatMap((s) => [s.hub_name, s.dispatch?.cursor?.hub_name])
      .filter((n): n is string => typeof n === "string");
    expect(seatHubNames).not.toContain("grok");
    expect(Object.keys(map.readers)).not.toContain("grok");
    for (const [reader, block] of Object.entries(map.readers)) {
      expect(block.partners.map((p) => p.hub_as), reader).not.toContain("grok");
      expect(Object.values(map.seats).map((s) => s.hub_name), `reader ${reader} is a seat's hub_name`).toContain(reader);
    }
    for (const bot of BOTS) {
      expect(seatHubNames).not.toContain(bot.hub_as);
      expect(Object.keys(map.readers)).not.toContain(bot.hub_as);
    }
  });
});
