import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import * as net from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  describeHubPresence,
  formatPartnerLine,
  HUB_PARTNER_SEATS_REL,
  type PresenceAgent,
} from "../../../src/pipelines/session-start/hub-presence.js";

/**
 * T-198 r2. No test here opens a socket: every request goes through an injected
 * fetchFn, and a tripwire makes the global fetch and net.Socket.connect throw, so a
 * test that reaches for the network fails loudly instead of passing on a machine
 * with egress and failing on one without (QA 225 major 4, tcm).
 */
const HUB = "http://hub.test:4000";
const HUB_ID = "hub.test-4000";
const ATLAS_ROOM = "k57frxw0ptb8tadmqdwy0khhks8ey006";
const INFRA_ROOM = "k5702788wctxj75begyt4x2k5x8f6mav";
const BUILDER_ROOM = "k57098epn7qz32vt0cazfjpbes8f6kdq";
const KEY = `test-key-${"x".repeat(40)}`;

const atlasIdentity = { name: "Atlas", role: "planner", partner: "Forge" };
const forgeIdentity = { name: "Forge", role: "developer", partner: "Atlas" };

function partnerSeatsFixture(root: string): void {
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  cpSync(
    join(import.meta.dirname, "../../../../.agents/SYSTEM/hub-partner-seats.json"),
    join(root, HUB_PARTNER_SEATS_REL),
  );
}

interface Call {
  url: string;
  headers: Record<string, string>;
}

function fixtureFetch(body: unknown, status = 200): { fetchFn: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: { ...((init?.headers as Record<string, string>) ?? {}) } });
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { fetchFn, calls };
}

function roster(over: Partial<Record<"grok" | "cursor-infra" | "cursor-builder", unknown>> = {}) {
  const room = (sessionId: string, extra: Record<string, unknown> = {}) => ({
    sessionId, unread: 0, pollingNow: false, pollAgeMs: 0, ...extra,
  });
  return {
    agents: [
      { name: "grok", rooms: [over.grok ?? room(ATLAS_ROOM)] },
      { name: "cursor-infra", rooms: [over["cursor-infra"] ?? room(INFRA_ROOM)] },
      { name: "cursor-builder", rooms: [over["cursor-builder"] ?? room(BUILDER_ROOM)] },
    ],
  };
}

describe("T-198 hub presence at /start (r2)", () => {
  let root: string;
  let keyDir: string;

  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("no network in presence tests");
    });
    vi.spyOn(net.Socket.prototype, "connect").mockImplementation(() => {
      throw new Error("no network in presence tests");
    });
    root = mkdtempSync(join(tmpdir(), "t198-r2-"));
    keyDir = mkdtempSync(join(tmpdir(), "t198-keys-"));
    partnerSeatsFixture(root);
    writeKey("atlas", KEY);
    writeKey("forge", KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
    rmSync(keyDir, { recursive: true, force: true });
  });

  function writeKey(name: string, key: string): void {
    mkdirSync(join(keyDir, HUB_ID), { recursive: true });
    writeFileSync(join(keyDir, HUB_ID, `${name}.key`), key);
  }

  async function describe_(fetchFn: typeof fetch, extra: Record<string, unknown> = {}) {
    return describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "vitest",
      hubUrl: HUB,
      keyDir,
      fetchFn,
      ...extra,
    } as Parameters<typeof describeHubPresence>[0]);
  }

  it("the tripwire is armed: the global fetch and a socket connect both throw", async () => {
    expect(() => globalThis.fetch("http://hub.test:4000/")).toThrow(/no network in presence tests/);
    expect(() => new net.Socket().connect(1, "127.0.0.1")).toThrow(/no network in presence tests/);
  });

  it("PR-1 a seat with pollingNow true prints as LISTENER polling", async () => {
    const { fetchFn } = fixtureFetch(roster({ grok: { sessionId: ATLAS_ROOM, unread: 0, pollingNow: true, pollAgeMs: 1000 } }));
    const block = await describe_(fetchFn);
    expect(block.lines.join("\n")).toContain("grok: listener polling");
  });

  it("PR-2 a seat not polling prints the unread count and age, as a listener", async () => {
    const { fetchFn } = fixtureFetch(roster({ "cursor-infra": { sessionId: INFRA_ROOM, unread: 3, pollingNow: false, pollAgeMs: 270_000 } }));
    const block = await describe_(fetchFn);
    expect(block.lines.join("\n")).toContain("cursor-infra: listener not polling, 3 unread since 5m");
  });

  it("R1 wording: every partner line says listener or absent, none claims the seat read a turn, and the header says so", async () => {
    const { fetchFn } = fixtureFetch(roster({
      grok: { sessionId: ATLAS_ROOM, unread: 0, pollingNow: true, pollAgeMs: 1 },
      "cursor-infra": { sessionId: INFRA_ROOM, unread: 3, pollingNow: false, pollAgeMs: 270_000 },
    }));
    const block = await describe_(fetchFn);
    const partnerLines = block.lines.slice(1);
    expect(partnerLines.length).toBe(3);
    for (const line of partnerLines) {
      expect(line).toMatch(/^ {2}\S.*: (listener polling|listener not polling|absent)/);
      expect(line).not.toMatch(/seen|\bread\b|acknowledg/i);
    }
    expect(block.lines[0]).toContain("listener");
    expect(block.lines[0]).toMatch(/not proof|does not show/);
  });

  it("PR-3 hub unreachable prints ONE UNKNOWN line with its cause", async () => {
    const fetchFn = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const block = await describe_(fetchFn);
    expect(block.lines).toEqual(["presence: UNKNOWN (fetch failed)"]);
  });

  it("PR-3 a non-2xx response prints ONE UNKNOWN line naming the status", async () => {
    const { fetchFn } = fixtureFetch({ error: "down" }, 503);
    const block = await describe_(fetchFn);
    expect(block.lines).toEqual(["presence: UNKNOWN (HTTP 503)"]);
  });

  it("PR-3 a 403 (strict auth refusing the key) prints UNKNOWN, not nothing", async () => {
    const { fetchFn } = fixtureFetch({ error: "forbidden" }, 403);
    const block = await describe_(fetchFn);
    expect(block.lines).toEqual(["presence: UNKNOWN (HTTP 403)"]);
  });

  it("PR-3 a body that is not JSON prints ONE UNKNOWN line", async () => {
    const { fetchFn } = fixtureFetch("<html>not json</html>");
    const block = await describe_(fetchFn);
    expect(block.lines).toHaveLength(1);
    expect(block.lines[0]).toMatch(/^presence: UNKNOWN \(malformed body: /);
  });

  it("PR-3 a hub that accepts and never replies is bounded by the timeout and prints ONE UNKNOWN line", async () => {
    const fetchFn = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })) as unknown as typeof fetch;
    const started = Date.now();
    const block = await describe_(fetchFn, { timeoutMs: 50 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(block.lines).toEqual(["presence: UNKNOWN (timeout after 50ms)"]);
  });

  describe("R2 structurally malformed 200 bodies never escape the UNKNOWN contract", () => {
    const ok = { sessionId: ATLAS_ROOM, unread: 0, pollingNow: false, pollAgeMs: 0 };
    const cases: Array<[string, unknown, RegExp]> = [
      ["QA 225's probe: rooms is an object", { agents: [{ name: "grok", rooms: {} }] }, /agents\[0\]\.rooms/],
      ["an agent that is null", { agents: [null] }, /agents\[0\]/],
      ["an agent with a non-string name", { agents: [{ name: 7, rooms: [] }] }, /agents\[0\]\.name/],
      ["a room without a sessionId", { agents: [{ name: "grok", rooms: [{ unread: 0, pollingNow: false }] }] }, /agents\[0\]\.rooms\[0\]\.sessionId/],
      ["unread as a string", { agents: [{ name: "grok", rooms: [{ ...ok, unread: "3" }] }] }, /agents\[0\]\.rooms\[0\]\.unread/],
      ["pollingNow as a string", { agents: [{ name: "grok", rooms: [{ ...ok, pollingNow: "yes" }] }] }, /agents\[0\]\.rooms\[0\]\.pollingNow/],
      ["a bad agent AFTER a good one", { agents: [{ name: "grok", rooms: [ok] }, { name: "x", rooms: 5 }] }, /agents\[1\]\.rooms/],
    ];
    it.each(cases)("%s prints one UNKNOWN line naming the path", async (_label, body, path) => {
      const { fetchFn } = fixtureFetch(body);
      const block = await describe_(fetchFn);
      expect(block.lines).toHaveLength(1);
      expect(block.lines[0]).toMatch(/^presence: UNKNOWN \(malformed body: /);
      expect(block.lines[0]).toMatch(path);
    });
  });

  it("PR-4 a partner absent from the roster prints as absent, not skipped", async () => {
    const { fetchFn } = fixtureFetch({ agents: [] });
    const block = await describe_(fetchFn);
    expect(block.lines.join("\n")).toContain("grok: absent");
    expect(formatPartnerLine({ label: "grok", hub_as: "grok", session_id: ATLAS_ROOM }, [] as PresenceAgent[])).toBe("grok: absent");
  });

  it("PR-5 mutant swallowFetchErrors produces no UNKNOWN line", async () => {
    const fetchFn = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const block = await describe_(fetchFn, { swallowFetchErrors: true });
    expect(block.lines).toEqual([]);
  });

  it("PR-6 skips the presence block when the interim source file is absent", async () => {
    rmSync(join(root, HUB_PARTNER_SEATS_REL));
    const { fetchFn, calls } = fixtureFetch(roster());
    const block = await describe_(fetchFn);
    expect(block.lines).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("names the interim source and the calling process in the header", async () => {
    const { fetchFn } = fixtureFetch({ agents: [] });
    const block = await describe_(fetchFn, { callerLabel: "open-brain MCP server" });
    expect(block.lines[0]).toContain("open-brain MCP server");
    expect(block.lines[0]).toContain(HUB_PARTNER_SEATS_REL);
  });

  describe("R5 the request carries the seat's OWN key, never a shared default", () => {
    it("sends the key from <keyDir>/<hub-id>/<name>.key in X-Agent-Key, and the key never appears in the output", async () => {
      const { fetchFn, calls } = fixtureFetch(roster());
      const block = await describe_(fetchFn);
      expect(calls).toHaveLength(1);
      expect(calls[0].headers["X-Agent-Key"]).toBe(KEY);
      expect(calls[0].url).toBe(`${HUB}/a2a/agents/presence`);
      expect(block.lines.join("\n")).not.toContain(KEY);
      expect(calls[0].headers["X-Agent-Key"]).not.toBe("dev-key");
    });

    it("the key name is the reader's identity lowercased, separate from the readers-map name: Forge reads with forge.key", async () => {
      writeKey("atlas", `atlas-${"a".repeat(40)}`);
      writeKey("forge", `forge-${"f".repeat(40)}`);
      const { fetchFn, calls } = fixtureFetch({ agents: [] });
      const block = await describeHubPresence({
        projectRoot: root, identity: forgeIdentity, callerLabel: "vitest", hubUrl: HUB, keyDir, fetchFn,
      } as Parameters<typeof describeHubPresence>[0]);
      expect(calls).toHaveLength(1);
      expect(calls[0].headers["X-Agent-Key"]).toBe(`forge-${"f".repeat(40)}`);
      expect(block.lines.join("\n")).toContain("Atlas: absent");
    });

    it("no key file prints UNKNOWN naming the missing key and the path, and NEVER calls the hub", async () => {
      rmSync(join(keyDir, HUB_ID, "atlas.key"));
      const { fetchFn, calls } = fixtureFetch(roster());
      const block = await describe_(fetchFn);
      expect(calls).toHaveLength(0);
      expect(block.lines).toHaveLength(1);
      expect(block.lines[0]).toMatch(/^presence: UNKNOWN \(no hub key for atlas at .*atlas\.key\)$/);
    });

    it("an unreadable key (a directory where the file should be) prints UNKNOWN and never calls the hub", async () => {
      rmSync(join(keyDir, HUB_ID, "atlas.key"));
      mkdirSync(join(keyDir, HUB_ID, "atlas.key"));
      const { fetchFn, calls } = fixtureFetch(roster());
      const block = await describe_(fetchFn);
      expect(calls).toHaveLength(0);
      expect(block.lines).toHaveLength(1);
      expect(block.lines[0]).toMatch(/^presence: UNKNOWN \(hub key for atlas at .* is unreadable/);
    });

    it("a key under the 32-character floor prints UNKNOWN, never sends it, and never echoes it", async () => {
      writeKey("atlas", "short-secret");
      const { fetchFn, calls } = fixtureFetch(roster());
      const block = await describe_(fetchFn);
      expect(calls).toHaveLength(0);
      expect(block.lines).toHaveLength(1);
      expect(block.lines[0]).toMatch(/^presence: UNKNOWN \(hub key for atlas at .* is shorter than 32 characters\)$/);
      expect(block.lines[0]).not.toContain("short-secret");
    });

    it("an identity whose key file exists under another name does not fall back to it: forge has no key, grok.key is not borrowed", async () => {
      rmSync(join(keyDir, HUB_ID, "forge.key"));
      writeKey("grok", `grok-${"g".repeat(40)}`);
      const { fetchFn, calls } = fixtureFetch({ agents: [] });
      const block = await describeHubPresence({
        projectRoot: root, identity: forgeIdentity, callerLabel: "vitest", hubUrl: HUB, keyDir, fetchFn,
      } as Parameters<typeof describeHubPresence>[0]);
      expect(calls).toHaveLength(0);
      expect(block.lines[0]).toMatch(/^presence: UNKNOWN \(no hub key for forge at /);
    });
  });
});
