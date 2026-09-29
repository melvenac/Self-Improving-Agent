import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  describeHubPresence,
  formatPartnerLine,
  HUB_PARTNER_SEATS_REL,
  type PresenceAgent,
} from "../../../src/pipelines/session-start/hub-presence.js";

function partnerSeatsFixture(root: string): void {
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  cpSync(
    join(import.meta.dirname, "../../../../.agents/SYSTEM/hub-partner-seats.json"),
    join(root, HUB_PARTNER_SEATS_REL),
  );
}

describe("T-198 hub presence at /start", () => {
  let root: string;
  let server: Server | undefined;
  let hubUrl = "";

  afterEach(async () => {
    if (server) await new Promise<void>((r) => server!.close(() => r()));
    server = undefined;
    if (root) rmSync(root, { recursive: true, force: true });
  });

  function startHub(body: unknown, status = 200): Promise<void> {
    return new Promise((resolve) => {
      server = createServer((_req, res) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
      });
      server.listen(0, "127.0.0.1", () => {
        const addr = server!.address();
        if (addr && typeof addr === "object") hubUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  }

  const atlasIdentity = { name: "Atlas", role: "planner", partner: "Forge" };

  it("PR-1 prints polling when pollingNow is true", async () => {
    root = mkdtempSync(join(tmpdir(), "t198-pr1-"));
    partnerSeatsFixture(root);
    await startHub({
      agents: [
        {
          name: "grok",
          rooms: [{ sessionId: "k57frxw0ptb8tadmqdwy0khhks8ey006", unread: 0, pollingNow: true, pollAgeMs: 1000 }],
        },
        { name: "cursor-infra", rooms: [{ sessionId: "k5702788wctxj75begyt4x2k5x8f6mav", unread: 0, pollingNow: false, pollAgeMs: 0 }] },
        { name: "cursor-builder", rooms: [{ sessionId: "k57098epn7qz32vt0cazfjpbes8f6kdq", unread: 0, pollingNow: false, pollAgeMs: 0 }] },
      ],
    });
    const block = await describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "vitest",
      hubUrl,
    });
    expect(block.lines.join("\n")).toContain("grok: polling");
  });

  it("PR-2 prints unread count and age when not polling", async () => {
    root = mkdtempSync(join(tmpdir(), "t198-pr2-"));
    partnerSeatsFixture(root);
    await startHub({
      agents: [
        {
          name: "cursor-infra",
          rooms: [{ sessionId: "k5702788wctxj75begyt4x2k5x8f6mav", unread: 3, pollingNow: false, pollAgeMs: 270_000 }],
        },
        { name: "grok", rooms: [{ sessionId: "k57frxw0ptb8tadmqdwy0khhks8ey006", unread: 0, pollingNow: false, pollAgeMs: 0 }] },
        { name: "cursor-builder", rooms: [{ sessionId: "k57098epn7qz32vt0cazfjpbes8f6kdq", unread: 0, pollingNow: false, pollAgeMs: 0 }] },
      ],
    });
    const block = await describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "vitest",
      hubUrl,
    });
    expect(block.lines.join("\n")).toContain("cursor-infra: not polling, 3 unread since 5m");
  });

  it("PR-3 prints UNKNOWN on hub unreachable", async () => {
    root = mkdtempSync(join(tmpdir(), "t198-pr3-"));
    partnerSeatsFixture(root);
    const block = await describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "vitest",
      hubUrl: "http://127.0.0.1:1",
      timeoutMs: 500,
    });
    expect(block.lines).toEqual([expect.stringMatching(/^presence: UNKNOWN \(.+\)$/)]);
  });

  it("PR-3 prints UNKNOWN on non-2xx", async () => {
    root = mkdtempSync(join(tmpdir(), "t198-pr3b-"));
    partnerSeatsFixture(root);
    await startHub({ error: "nope" }, 503);
    const block = await describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "vitest",
      hubUrl,
    });
    expect(block.lines[0]).toBe("presence: UNKNOWN (HTTP 503)");
  });

  it("PR-3 prints UNKNOWN on malformed JSON", async () => {
    root = mkdtempSync(join(tmpdir(), "t198-pr3c-"));
    partnerSeatsFixture(root);
    await new Promise<void>((resolve) => {
      server = createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{not-json");
      });
      server.listen(0, "127.0.0.1", () => {
        const addr = server!.address();
        if (addr && typeof addr === "object") hubUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
    const block = await describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "vitest",
      hubUrl,
    });
    expect(block.lines[0]).toMatch(/^presence: UNKNOWN \(malformed body:/);
  });

  it("PR-4 prints absent when partner missing from roster", async () => {
    const agents: PresenceAgent[] = [
      { name: "grok", rooms: [{ sessionId: "k57frxw0ptb8tadmqdwy0khhks8ey006", unread: 0, pollingNow: true, pollAgeMs: 0 }] },
    ];
    expect(formatPartnerLine({ label: "cursor-builder", hub_as: "cursor-builder", session_id: "k57098epn7qz32vt0cazfjpbes8f6kdq" }, agents)).toBe(
      "cursor-builder: absent",
    );
  });

  it("PR-5 mutant swallowFetchErrors produces no UNKNOWN line", async () => {
    root = mkdtempSync(join(tmpdir(), "t198-pr5-"));
    partnerSeatsFixture(root);
    const block = await describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "vitest",
      hubUrl: "http://127.0.0.1:1",
      timeoutMs: 500,
      swallowFetchErrors: true,
    });
    expect(block.lines).toEqual([]);
  });

  it("PR-6 skips presence block when interim source file is absent", async () => {
    root = mkdtempSync(join(tmpdir(), "t198-pr6-"));
    const block = await describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "vitest",
      hubUrl: "http://127.0.0.1:1",
    });
    expect(block.lines).toEqual([]);
  });

  it("names the interim source and caller in the header", async () => {
    root = mkdtempSync(join(tmpdir(), "t198-src-"));
    partnerSeatsFixture(root);
    await startHub({ agents: [] });
    const block = await describeHubPresence({
      projectRoot: root,
      identity: atlasIdentity,
      callerLabel: "open-brain MCP server",
      hubUrl,
    });
    expect(block.lines[0]).toContain("open-brain MCP server");
    expect(block.lines[0]).toContain(HUB_PARTNER_SEATS_REL);
  });
});
