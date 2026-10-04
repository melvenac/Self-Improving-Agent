/**
 * T-168 census for a heavy suite. Reads A2A hub presence. Does not import
 * session-start/hub-presence.ts (QA 275).
 *
 * Contract (atlas s161, hub v1.17 seat state): GET {hub}/a2a/agents/presence
 * with header X-Agent-Key. Busy is agents[].seat.seatState === "working",
 * including a waker seat. No key, unreachable hub, or a body without
 * seat.seatState is "census unavailable: …", never idle.
 */

import { readFileSync, existsSync } from "node:fs";

const KEY_FLOOR = 32;
const PRESENCE_PATH = "/a2a/agents/presence";

export interface CensusAgent {
  name: string;
  seatState: string;
}

export interface CensusResult {
  source: "hub-presence";
  timestamp: string;
  available: boolean;
  /** Set when available is false. Always starts with "census unavailable:". */
  reason: string | null;
  agents: CensusAgent[];
  /** SIA names (and their -waker siblings) whose seatState is working. */
  busySia: string[];
  samples: number;
}

export interface ReadCensusOptions {
  hubUrl: string;
  keyPath: string | undefined;
  siaSeatNames: readonly string[];
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** Delay between the two samples. Tests pass 0. */
  gapMs?: number;
  now?: () => string;
}

function unavailable(reason: string, timestamp: string, samples: number): CensusResult {
  const text = reason.startsWith("census unavailable:") ? reason : `census unavailable: ${reason}`;
  return {
    source: "hub-presence",
    timestamp,
    available: false,
    reason: text,
    agents: [],
    busySia: [],
    samples,
  };
}

export function readKeyFile(keyPath: string | undefined): { ok: true; key: string } | { ok: false; reason: string } {
  if (!keyPath || !keyPath.trim()) return { ok: false, reason: "census unavailable: no key path" };
  if (!existsSync(keyPath)) return { ok: false, reason: `census unavailable: key file missing (${keyPath})` };
  let key: string;
  try {
    key = readFileSync(keyPath, "utf8").trim();
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `census unavailable: key unreadable (${code})` };
  }
  if (key.length < KEY_FLOOR) return { ok: false, reason: "census unavailable: key shorter than 32 characters" };
  return { ok: true, key };
}

/** Pull seat.seatState. A body that only has the older top-level `state` field is unrecognized. */
export function agentsFromPresenceBody(body: unknown): { ok: true; agents: CensusAgent[] } | { ok: false; reason: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "census unavailable: presence body is not an object" };
  }
  const agents = (body as { agents?: unknown }).agents;
  if (!Array.isArray(agents)) return { ok: false, reason: "census unavailable: presence body has no agents array" };
  if (agents.length === 0) return { ok: true, agents: [] };
  const out: CensusAgent[] = [];
  let sawSeatState = false;
  for (const row of agents) {
    if (row === null || typeof row !== "object") continue;
    const name = (row as { name?: unknown }).name;
    const seat = (row as { seat?: { seatState?: unknown } }).seat;
    const seatState = seat && typeof seat.seatState === "string" ? seat.seatState : undefined;
    if (seatState) sawSeatState = true;
    if (typeof name === "string" && seatState) out.push({ name, seatState });
  }
  if (!sawSeatState) return { ok: false, reason: "census unavailable: presence body has no seat.seatState" };
  return { ok: true, agents: out };
}

function siaBusy(agents: CensusAgent[], siaSeatNames: readonly string[]): string[] {
  const sia = new Set(siaSeatNames);
  const busy: string[] = [];
  for (const agent of agents) {
    if (agent.seatState !== "working") continue;
    const wakerOf = agent.name.endsWith("-waker") ? agent.name.slice(0, -"-waker".length) : null;
    const isSia = sia.has(agent.name) || (wakerOf !== null && sia.has(wakerOf));
    const isWaker = agent.name.endsWith("-waker");
    if (isSia || isWaker) busy.push(agent.name);
  }
  return [...new Set(busy)];
}

function mergeAgents(a: CensusAgent[], b: CensusAgent[]): CensusAgent[] {
  const byName = new Map<string, CensusAgent>();
  for (const row of [...a, ...b]) {
    const prev = byName.get(row.name);
    if (!prev || row.seatState === "working") byName.set(row.name, row);
  }
  return [...byName.values()];
}

async function oneSample(
  hubUrl: string,
  key: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<{ ok: true; agents: CensusAgent[] } | { ok: false; reason: string }> {
  const url = `${hubUrl.replace(/\/$/, "")}${PRESENCE_PATH}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { headers: { "X-Agent-Key": key }, signal: ctrl.signal });
    if (!res.ok) return { ok: false, reason: `census unavailable: HTTP ${res.status}` };
    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      return { ok: false, reason: `census unavailable: presence body is not JSON (${err instanceof Error ? err.message : String(err)})` };
    }
    return agentsFromPresenceBody(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `census unavailable: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function readCensus(opts: ReadCensusOptions): Promise<CensusResult> {
  const timestamp = (opts.now ?? (() => new Date().toISOString()))();
  const key = readKeyFile(opts.keyPath);
  if (!key.ok) return unavailable(key.reason, timestamp, 0);
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 3_000;
  const gapMs = opts.gapMs ?? 400;
  const first = await oneSample(opts.hubUrl, key.key, fetchFn, timeoutMs);
  if (gapMs > 0) await new Promise((r) => setTimeout(r, gapMs));
  const second = await oneSample(opts.hubUrl, key.key, fetchFn, timeoutMs);

  if (!first.ok && !second.ok) return unavailable(`${first.reason}; second sample: ${second.reason}`, timestamp, 2);
  const agentsA = first.ok ? first.agents : [];
  const agentsB = second.ok ? second.agents : [];
  if (agentsA.length === 0 && agentsB.length === 0) {
    return unavailable("census unavailable: empty roster on both samples (not idle)", timestamp, 2);
  }
  const agents = mergeAgents(agentsA, agentsB);
  return {
    source: "hub-presence",
    timestamp,
    available: true,
    reason: null,
    agents,
    busySia: siaBusy(agents, opts.siaSeatNames),
    samples: 2,
  };
}

export interface SuiteDecision {
  refuse: boolean;
  why: string | null;
}

/**
 * D-034: record by default. Refuse only on lease exit 10, or on
 * OPEN_BRAIN_CONTROLLED_RERUN when any SIA seat (or its waker) is working.
 * An unavailable census is not idle: a controlled rerun refuses; a normal run does not.
 */
export function decideSuiteStart(input: {
  leaseExit: number | null;
  census: CensusResult;
  controlledRerun: boolean;
}): SuiteDecision {
  if (input.leaseExit === 10) return { refuse: true, why: "lease held (exit 10)" };
  if (input.controlledRerun && !input.census.available) {
    return { refuse: true, why: input.census.reason ?? "census unavailable: unknown" };
  }
  if (input.controlledRerun && input.census.busySia.length > 0) {
    return { refuse: true, why: `controlled rerun: busy SIA seat ${input.census.busySia.join(", ")}` };
  }
  return { refuse: false, why: null };
}
