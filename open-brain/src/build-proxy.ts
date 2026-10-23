#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Readable, Writable } from "node:stream";
import { readStampedCommit } from "./pipelines/session-start/serving-build.js";

/**
 * T-315 (D-161): a running session serves a rebuilt build without `/mcp reconnect`.
 *
 * Claude Code does not restart a stdio server that exits (10-20: every seat lost open-brain), and `claude -p` cannot
 * reconnect at all, so the connection to the host must never drop. Reloading in place does not work either: ESM caches
 * every module a re-imported entry reaches (docs/loops/t315-step0.md). So this proxy owns the host's stdio and runs the
 * real server (build/server.js) as a child. Before forwarding a host request it reads the build stamp; when the stamp is a
 * different commit and nothing is in flight, it starts a new child, replays the host's `initialize` and `initialized` to
 * it, queues what the host sends meanwhile, and stops the old one. A child that exits answers its in-flight requests with
 * an error and is started again on the next request.
 *
 * The stamp is written last by `postbuild`, and `prebuild` deletes build/, so a rebuild in progress reads as null and
 * never starts a swap. The proxy loads its whole module graph at start, and only node builtins and serving-build.js, so
 * deleting build/ under it is harmless; a change to THIS file still needs one reconnect.
 *
 * Session proof: the child's parent is this proxy, not claude. The child's environment names claude in
 * OPEN_BRAIN_HOST_PID and this proxy in OPEN_BRAIN_PROXY_PID; proofParentPid (shared/process-session.ts) uses the host
 * pid only when the proxy pid is the server's actual parent.
 */

export interface ProxyChild {
  readonly pid: number | undefined;
  send(line: string): void;
  kill(): void;
}

export interface ProxyChildHandlers {
  onLine(line: string): void;
  onExit(): void;
}

export interface BuildProxyOptions {
  /** The build stamp on disk now; null while a rebuild is in progress or the build is unstamped. */
  readStamp: () => string | null;
  spawnChild: (handlers: ProxyChildHandlers) => ProxyChild;
  toHost: (line: string) => void;
}

export interface BuildProxy {
  fromHost(line: string): void;
  /** The current child's pid (tests and logs). */
  childPid(): number | undefined;
  stop(): void;
}

type Id = string | number;
interface Message {
  id?: Id | null;
  method?: unknown;
  result?: unknown;
}

const PROXY_ID = "__open_brain_proxy__";
const idKey = (id: Id): string => JSON.stringify(id);

function parse(line: string): Message | null {
  try {
    const m = JSON.parse(line) as unknown;
    return m !== null && typeof m === "object" && !Array.isArray(m) ? (m as Message) : null;
  } catch {
    return null;
  }
}

const isRequest = (m: Message | null): m is Message & { id: Id; method: string } =>
  m !== null && typeof m.method === "string" && (typeof m.id === "string" || typeof m.id === "number");

interface Generation {
  child: ProxyChild;
  stamp: string | null;
  alive: boolean;
}

export function createBuildProxy(opts: BuildProxyOptions): BuildProxy {
  let initialize: string | null = null;
  let initialized: string | null = null;
  /** The last tools/list result the host saw, as JSON; null until the host asks. */
  let lastTools: string | null = null;
  const inFlight = new Map<string, { id: Id; method: string }>();
  let queue: string[] = [];
  let pendingInit: string | null = null;
  let pendingTools: string | null = null;
  let seq = 0;
  let stopped = false;

  const launch = (): Generation => {
    const gen: Generation = { child: undefined as unknown as ProxyChild, stamp: opts.readStamp(), alive: true };
    gen.child = opts.spawnChild({
      onLine: (line) => {
        if (gen === current) fromChild(line);
      },
      onExit: () => {
        if (!gen.alive) return;
        gen.alive = false;
        if (gen === current) childExited();
      },
    });
    return gen;
  };

  const errorTo = (id: Id, why: string): void => {
    opts.toHost(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message: `open-brain: ${why}. The next call starts the server again.` } }));
  };

  const childExited = (): void => {
    for (const r of inFlight.values()) errorTo(r.id, `the server process exited during ${r.method}`);
    inFlight.clear();
    if (pendingInit !== null) {
      // The new child died before answering the replayed initialize: answer what was queued, keep nothing.
      pendingInit = null;
      const q = queue;
      queue = [];
      for (const line of q) {
        const m = parse(line);
        if (isRequest(m)) errorTo(m.id, `the server process exited while starting the new build`);
      }
    }
    pendingTools = null;
  };

  const needsSwap = (): boolean => {
    if (!current.alive) return true;
    if (inFlight.size > 0) return false;
    const disk = opts.readStamp();
    return disk !== null && disk !== current.stamp;
  };

  const swap = (first: string): void => {
    queue.push(first);
    const old = current;
    current = launch();
    old.child.kill();
    if (initialize === null) {
      flush();
      return;
    }
    const replay = parse(initialize) ?? {};
    pendingInit = `${PROXY_ID}init-${++seq}`;
    current.child.send(JSON.stringify({ ...replay, id: pendingInit }));
  };

  const flush = (): void => {
    const q = queue;
    queue = [];
    for (const line of q) fromHost(line);
  };

  const fromChild = (line: string): void => {
    const m = parse(line);
    if (m !== null && m.method === undefined && (typeof m.id === "string" || typeof m.id === "number")) {
      if (m.id === pendingInit) {
        pendingInit = null;
        if (initialized !== null) current.child.send(initialized);
        if (lastTools !== null) {
          pendingTools = `${PROXY_ID}tools-${++seq}`;
          current.child.send(JSON.stringify({ jsonrpc: "2.0", id: pendingTools, method: "tools/list", params: {} }));
        }
        flush();
        return;
      }
      if (m.id === pendingTools) {
        pendingTools = null;
        const now = m.result === undefined ? null : JSON.stringify(m.result);
        if (now !== null && now !== lastTools) {
          lastTools = now;
          opts.toHost(JSON.stringify({ jsonrpc: "2.0", method: "notifications/tools/list_changed" }));
        }
        return;
      }
      const key = idKey(m.id);
      const r = inFlight.get(key);
      inFlight.delete(key);
      if (r?.method === "tools/list" && m.result !== undefined) lastTools = JSON.stringify(m.result);
    }
    opts.toHost(line);
  };

  const fromHost = (line: string): void => {
    if (stopped || line.trim() === "") return;
    if (pendingInit !== null) {
      queue.push(line);
      return;
    }
    const m = parse(line);
    if (isRequest(m)) {
      if (needsSwap()) {
        swap(line);
        return;
      }
      if (m.method === "initialize") initialize = line;
      inFlight.set(idKey(m.id), { id: m.id, method: m.method });
    } else if (m !== null && m.method === "notifications/initialized") {
      initialized = line;
    }
    current.child.send(line);
  };

  let current: Generation = launch();

  return {
    fromHost,
    childPid: () => current.child.pid,
    stop() {
      stopped = true;
      current.child.kill();
    },
  };
}

export interface BuildProxyIo {
  stdin: Readable;
  stdout: Writable;
  buildDir: string;
  /** The server to run; build/server.js by default. */
  serverPath?: string;
}

/** Wires the proxy to real streams and real child processes. */
export function runBuildProxy(io: BuildProxyIo): BuildProxy {
  const serverPath = io.serverPath ?? join(io.buildDir, "server.js");
  const proxy = createBuildProxy({
    readStamp: () => readStampedCommit(io.buildDir),
    toHost: (line) => {
      io.stdout.write(`${line}\n`);
    },
    spawnChild: (h) => {
      const child = spawn(process.execPath, [serverPath], {
        stdio: ["pipe", "pipe", "inherit"],
        windowsHide: true,
        env: { ...process.env, OPEN_BRAIN_PROXY_PID: String(process.pid), OPEN_BRAIN_HOST_PID: String(process.ppid) },
      });
      createInterface({ input: child.stdout }).on("line", (line) => h.onLine(line));
      child.on("exit", () => h.onExit());
      child.on("error", () => h.onExit());
      child.stdin.on("error", () => {});
      return {
        pid: child.pid,
        send: (line) => {
          if (!child.stdin.destroyed) child.stdin.write(`${line}\n`);
        },
        kill: () => {
          child.kill();
        },
      };
    },
  });
  createInterface({ input: io.stdin }).on("line", (line) => proxy.fromHost(line)).on("close", () => proxy.stop());
  return proxy;
}

const isDirectRun = process.argv[1]?.endsWith("build-proxy.js") || process.argv[1]?.endsWith("build-proxy.ts");
if (isDirectRun) {
  runBuildProxy({ stdin: process.stdin, stdout: process.stdout, buildDir: dirname(fileURLToPath(import.meta.url)) });
}
