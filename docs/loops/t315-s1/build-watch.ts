import { readStampedCommit } from "../pipelines/session-start/serving-build.js";

/**
 * T-315 (D-161): a running open-brain MCP server picks up a rebuilt build without `/mcp reconnect`.
 *
 * A stdio server keeps the modules it loaded for its whole life, so after a rebuild every seat served the old code until a
 * human reconnected. T-315 step 0 measured the host (Claude Code 2.1.296, docs/loops/t315-step0/): a stdio server that exits
 * is respawned before the next call, from the same command, so it loads the new build. Reloading in place was ruled out:
 * ESM never re-evaluates a module graph, and the open DB handle and native addon cannot be swapped inside one process.
 *
 * The watch reports a new build only when (a) this process loaded a stamped build, (b) the stamp on disk is a different
 * valid commit, and (c) no request is in flight. The stamp is written last by `postbuild`, so a rebuild in progress (build/
 * deleted, or not yet stamped) reads as null and is not a new build; a failed rebuild that restores its backup puts the old
 * stamp back. After reporting once, the watch stops.
 */
export interface BuildWatch {
  /** A request arrived. */
  begin(): void;
  /** A response was sent; checks the stamp at once when nothing else is in flight. */
  end(): void;
  /** Reads the stamp now. True when it reported a new build. */
  check(): boolean;
  stop(): void;
}

export interface BuildWatchOptions {
  buildDir: string;
  loaded: string | null;
  /** The idle poll. 0 disables it (tests). */
  intervalMs: number;
  onNewBuild: (commit: string) => void;
}

export function watchBuild(opts: BuildWatchOptions): BuildWatch {
  let inFlight = 0;
  let stopped = opts.loaded === null;
  const timer = opts.intervalMs > 0 && !stopped ? setInterval(() => watch.check(), opts.intervalMs) : null;
  timer?.unref();

  const watch: BuildWatch = {
    begin() {
      inFlight++;
    },
    end() {
      if (inFlight > 0) inFlight--;
      watch.check();
    },
    check() {
      if (stopped || inFlight > 0) return false;
      const onDisk = readStampedCommit(opts.buildDir);
      if (onDisk === null || onDisk === opts.loaded) return false;
      watch.stop();
      opts.onNewBuild(onDisk);
      return true;
    },
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  };
  return watch;
}

type Message = Record<string, unknown>;
interface WatchedTransport {
  onmessage?: (message: Message, extra?: unknown) => void;
  send: (message: Message, options?: unknown) => Promise<void>;
}

const isRequest = (m: Message): boolean => "method" in m && "id" in m;
const isResponse = (m: Message): boolean => "id" in m && !("method" in m) && ("result" in m || "error" in m);

/**
 * Counts the host's requests in flight on a CONNECTED transport (the protocol sets `onmessage` in `connect`). Notifications
 * carry no id and are not counted; a response to a request this server sent has no method and is not a request.
 */
export function attachBuildWatch(transport: object, watch: BuildWatch): void {
  const t = transport as WatchedTransport;
  const inner = t.onmessage;
  t.onmessage = (message, extra) => {
    if (isRequest(message)) watch.begin();
    inner?.(message, extra);
  };
  const send = t.send.bind(t);
  t.send = async (message, options) => {
    try {
      await send(message, options);
    } finally {
      if (isResponse(message)) watch.end();
    }
  };
}
