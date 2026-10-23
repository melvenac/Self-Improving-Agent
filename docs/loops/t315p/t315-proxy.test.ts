import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBuildProxy, runBuildProxy, type ProxyChild, type ProxyChildHandlers } from "../src/build-proxy.js";
import { byPidDir, processStartTime, proofParentPid, writeProcessSession } from "../src/shared/process-session.js";

/**
 * T-315 (D-161) proxy slice: the host's stdio connection survives a rebuild. P1-P6 drive createBuildProxy with fake
 * children and a stamp the test sets; P7 is the proof parent; P8 runs real child processes; P9 is the server's proof.
 */
const A = "a".repeat(40);
const B = "b".repeat(40);

interface Fake extends ProxyChild {
  sent: Record<string, unknown>[];
  killed: boolean;
  reply(id: unknown, result: unknown): void;
  exit(): void;
}

function harness() {
  let stamp: string | null = A;
  const kids: Fake[] = [];
  const host: Record<string, unknown>[] = [];
  const proxy = createBuildProxy({
    readStamp: () => stamp,
    toHost: (line) => host.push(JSON.parse(line)),
    spawnChild: (h: ProxyChildHandlers) => {
      const k: Fake = {
        pid: 1000 + kids.length,
        sent: [],
        killed: false,
        send: (line) => k.sent.push(JSON.parse(line)),
        kill: () => {
          k.killed = true;
        },
        reply: (id, result) => h.onLine(JSON.stringify({ jsonrpc: "2.0", id, result })),
        exit: () => h.onExit(),
      };
      kids.push(k);
      return k;
    },
  });
  const send = (m: Record<string, unknown>): void => proxy.fromHost(JSON.stringify({ jsonrpc: "2.0", ...m }));
  const init = (): void => {
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name: "host" } } });
    kids[0].reply(1, { serverInfo: { name: "open-brain" } });
    send({ method: "notifications/initialized" });
  };
  return { proxy, kids, host, send, init, setStamp: (s: string | null) => (stamp = s) };
}
const methods = (k: Fake): unknown[] => k.sent.map((m) => m.method ?? `reply:${String(m.id)}`);

describe("T-315 proxy: createBuildProxy", () => {
  it("P1: forwards the host's messages to one child and the child's replies back unchanged", () => {
    const h = harness();
    h.init();
    h.send({ id: 2, method: "tools/call", params: { name: "ob_stats" } });
    expect(h.kids).toHaveLength(1);
    expect(methods(h.kids[0])).toEqual(["initialize", "notifications/initialized", "tools/call"]);
    h.kids[0].reply(2, { content: [] });
    expect(h.host).toEqual([
      { jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "open-brain" } } },
      { jsonrpc: "2.0", id: 2, result: { content: [] } },
    ]);
  });

  it("P2: a new stamp starts a new child, replays initialize and initialized to it first, then the request; the host sees no replay", () => {
    const h = harness();
    h.init();
    h.setStamp(B);
    h.send({ id: 3, method: "tools/call", params: { name: "ob_start" } });
    expect(h.kids).toHaveLength(2);
    expect(h.kids[0].killed).toBe(true);
    const replay = h.kids[1].sent[0];
    expect(replay.method).toBe("initialize");
    expect(replay.params).toEqual({ protocolVersion: "2025-06-18", clientInfo: { name: "host" } });
    expect(replay.id).not.toBe(1);
    expect(methods(h.kids[1])).toEqual(["initialize"]);
    h.kids[1].reply(replay.id, { serverInfo: { name: "open-brain" } });
    expect(methods(h.kids[1])).toEqual(["initialize", "notifications/initialized", "tools/call"]);
    expect(h.host).toHaveLength(1);
    h.kids[1].reply(3, { content: [{ type: "text", text: "new build" }] });
    expect(h.host[1]).toEqual({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "new build" }] } });
    h.send({ id: 4, method: "tools/call", params: {} });
    expect(h.kids).toHaveLength(2);
    expect(h.proxy.childPid()).toBe(1001);
  });

  it("P3: no swap while a request is in flight; the first request after it is answered swaps", () => {
    const h = harness();
    h.init();
    h.send({ id: 2, method: "tools/call", params: {} });
    h.setStamp(B);
    h.send({ id: 3, method: "tools/call", params: {} });
    expect(h.kids).toHaveLength(1);
    expect(methods(h.kids[0]).slice(-2)).toEqual(["tools/call", "tools/call"]);
    h.kids[0].reply(2, {});
    h.kids[0].reply(3, {});
    h.send({ id: 4, method: "tools/call", params: {} });
    expect(h.kids).toHaveLength(2);
    expect(h.kids[0].killed).toBe(true);
  });

  it("P4: a rebuild in progress (no stamp) and the same stamp do not swap", () => {
    const h = harness();
    h.init();
    h.setStamp(null);
    h.send({ id: 2, method: "tools/call", params: {} });
    h.kids[0].reply(2, {});
    h.setStamp(A);
    h.send({ id: 3, method: "tools/call", params: {} });
    expect(h.kids).toHaveLength(1);
    expect(h.kids[0].killed).toBe(false);
  });

  it("P5: tools/list_changed reaches the host only when the new child's tool list differs from the one the host saw", () => {
    const h = harness();
    h.init();
    h.send({ id: 2, method: "tools/list", params: {} });
    h.kids[0].reply(2, { tools: [{ name: "ob_stats" }] });
    const swapTo = (stamp: string, tools: unknown): Record<string, unknown>[] => {
      const before = h.host.length;
      h.setStamp(stamp);
      h.send({ id: `c-${stamp[0]}`, method: "tools/call", params: {} });
      const kid = h.kids[h.kids.length - 1];
      kid.reply(kid.sent[0].id, {});
      const list = kid.sent.find((m) => m.method === "tools/list");
      expect(list).toBeDefined();
      kid.reply(list!.id, tools);
      kid.reply(`c-${stamp[0]}`, {});
      return h.host.slice(before).filter((m) => m.method !== undefined);
    };
    expect(swapTo(B, { tools: [{ name: "ob_stats" }] })).toEqual([]);
    expect(swapTo("c".repeat(40), { tools: [{ name: "ob_stats" }, { name: "ob_new" }] })).toEqual([
      { jsonrpc: "2.0", method: "notifications/tools/list_changed" },
    ]);
  });

  it("P6: a child that exits answers its in-flight request with an error; the next request starts a child with the replay", () => {
    const h = harness();
    h.init();
    h.send({ id: 2, method: "tools/call", params: {} });
    h.kids[0].exit();
    expect(h.host[1]).toMatchObject({ jsonrpc: "2.0", id: 2, error: { code: -32603 } });
    h.send({ id: 3, method: "tools/call", params: {} });
    expect(h.kids).toHaveLength(2);
    expect(methods(h.kids[1])).toEqual(["initialize"]);
    h.kids[1].reply(h.kids[1].sent[0].id, {});
    expect(methods(h.kids[1])).toEqual(["initialize", "notifications/initialized", "tools/call"]);
  });
});

describe("T-315 proxy: proofParentPid", () => {
  it("P7: the host pid counts only when the proxy pid is the actual parent", () => {
    expect(proofParentPid({ OPEN_BRAIN_PROXY_PID: "500", OPEN_BRAIN_HOST_PID: "400" }, 500)).toBe(400);
    expect(proofParentPid({ OPEN_BRAIN_PROXY_PID: "501", OPEN_BRAIN_HOST_PID: "400" }, 500)).toBe(500);
    expect(proofParentPid({ OPEN_BRAIN_HOST_PID: "400" }, 500)).toBe(500);
    expect(proofParentPid({ OPEN_BRAIN_PROXY_PID: "500", OPEN_BRAIN_HOST_PID: "" }, 500)).toBe(500);
    expect(proofParentPid({ OPEN_BRAIN_PROXY_PID: "500", OPEN_BRAIN_HOST_PID: "x" }, 500)).toBe(500);
    expect(proofParentPid({}, 500)).toBe(500);
  });
});

describe("T-315 proxy: real processes", { timeout: 60_000 }, () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("P8: the child runs with the proxy and host pids; a new stamp is served by a new process over the same streams", async () => {
    const dir = mkdtempSync(join(tmpdir(), "t315p-"));
    dirs.push(dir);
    const stamp = (c: string): void => writeFileSync(join(dir, "build-info.json"), JSON.stringify({ commit: c, builtAt: "t", reason: null }));
    stamp(A);
    const server = join(dir, "fake-server.mjs");
    writeFileSync(
      server,
      [
        'import { createInterface } from "node:readline";',
        'createInterface({ input: process.stdin }).on("line", (line) => {',
        "  const m = JSON.parse(line);",
        "  if (m.id === undefined) return;",
        "  const result = { pid: process.pid, ppid: process.ppid, proxy: process.env.OPEN_BRAIN_PROXY_PID, host: process.env.OPEN_BRAIN_HOST_PID };",
        '  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: m.id, result }) + "\\n");',
        "});",
      ].join("\n"),
    );
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const replies: Record<string, unknown>[] = [];
    let buf = "";
    stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        replies.push(JSON.parse(buf.slice(0, i)));
        buf = buf.slice(i + 1);
      }
    });
    const proxy = runBuildProxy({ stdin, stdout, buildDir: dir, serverPath: server });
    const call = async (id: number, method: string): Promise<{ pid: number; ppid: number; proxy: string; host: string }> => {
      stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params: {} })}\n`);
      await vi.waitFor(() => expect(replies.find((r) => r.id === id)).toBeDefined(), { timeout: 20_000, interval: 50 });
      return replies.find((r) => r.id === id)!.result as { pid: number; ppid: number; proxy: string; host: string };
    };
    try {
      const first = await call(1, "initialize");
      expect(first.ppid).toBe(process.pid);
      expect(first.proxy).toBe(String(process.pid));
      expect(first.host).toBe(String(process.ppid));
      const same = await call(2, "tools/call");
      expect(same.pid).toBe(first.pid);
      stamp(B);
      const next = await call(3, "tools/call");
      expect(next.pid).not.toBe(first.pid);
      expect(proxy.childPid()).toBe(next.pid);
      expect(replies.map((r) => r.id)).toEqual([1, 2, 3]);
    } finally {
      proxy.stop();
      stdin.end();
    }
  });
});

describe("T-315 proxy: the server's session proof", { timeout: 60_000 }, () => {
  const SELF = "00000315-0000-4000-8000-000000000315";
  const dir = () => byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!);
  let selfStart: string | null;
  beforeAll(() => {
    selfStart = processStartTime(process.pid);
  });
  afterEach(() => {
    delete process.env.OPEN_BRAIN_PROXY_PID;
    delete process.env.OPEN_BRAIN_HOST_PID;
    rmSync(join(dir(), `${process.pid}.json`), { force: true });
    rmSync(join(dir(), `${process.ppid}.json`), { force: true });
  });

  it("P9: under the proxy the server proves its session from the host's proof; an inherited host pid is not used", async () => {
    expect(selfStart).not.toBeNull();
    // This test process stands in for claude (the host), its parent for the proxy.
    writeProcessSession(dir(), { session_id: SELF, claude_pid: process.pid, proc_start: selfStart!, ide: "claude", written_at: new Date().toISOString() });
    rmSync(join(dir(), `${process.ppid}.json`), { force: true });
    process.env.OPEN_BRAIN_PROXY_PID = String(process.ppid);
    process.env.OPEN_BRAIN_HOST_PID = String(process.pid);
    vi.resetModules();
    const s = await import("../src/server.js");
    const reg = await s.handleSetSession({});
    expect(reg.isError).toBeUndefined();
    expect(reg.content[0].text).toContain(`Session registered: ${SELF}`);
    expect(reg.content[0].text).toContain(`[via process proof: parent ${process.pid}]`);
    process.env.OPEN_BRAIN_PROXY_PID = String(process.ppid + 1);
    vi.resetModules();
    const s2 = await import("../src/server.js");
    const refused = await s2.handleSetSession({});
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).not.toContain(`Session registered: ${SELF}`);
  });
});
