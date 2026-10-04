import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentIdentity } from "./agent-identity.js";
import { formatHubSeatState } from "./hub-seat-state.js";
import { readSeatMapRows, resolveCheckoutSeat, runtimeByHubName, type HubRuntime } from "./seat-map.js";
import { RUNTIME_MISSING_IN_SEAT_MAP } from "./focus.js";

/** Interim until T-196; allowlisted at `.agents/SYSTEM/hub-partner-seats.json`. */
export const HUB_PARTNER_SEATS_REL = ".agents/SYSTEM/hub-partner-seats.json";

const DEFAULT_HUB_URL = "http://100.124.212.87:4000";
const PRESENCE_PATH = "/a2a/agents/presence";
/** Hub T-079: route reads only ?name=; we fetch the roster once and filter client-side. */
const FETCH_TIMEOUT_MS = 3_000;

export interface HubPartnerSeat {
  label: string;
  hub_as: string;
  session_id: string;
}

export interface HubPartnerSeatsFile {
  description?: string;
  readers: Record<string, { partners: HubPartnerSeat[] }>;
}

export interface PresenceRoom {
  sessionId: string;
  unread: number;
  pollingNow: boolean;
  /** A2A sends null for "no wait-poll seen in the window" (src/presence.ts, T-237). Absent is treated the same. */
  pollAgeMs?: number | null;
}

export interface PresenceSeatRow {
  seatState?: string;
}

export interface PresenceAgent {
  name: string;
  state?: string;
  rooms?: PresenceRoom[];
  seat?: PresenceSeatRow;
}

export interface PresenceBody {
  agents?: PresenceAgent[];
}

export interface HubPresenceOptions {
  projectRoot: string;
  identity: AgentIdentity | null;
  /** Which process performs the fetch — G-033: name it explicitly. */
  callerLabel: string;
  hubUrl?: string;
  /** Where per-agent key files live. Default: $A2A_KEY_DIR, else ~/.a2a-hub/keys (hub-key.mjs). */
  keyDir?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /** When true, fetch errors produce no UNKNOWN line (PR-5 mutant). */
  swallowFetchErrors?: boolean;
}

export interface HubPresenceBlock {
  lines: string[];
  sourceRel: string | null;
  charCount: number;
  /**
   * T-236 (c) / T-240: live state per hub name from THIS block's one roster fetch, for the SEATS line.
   * Present only when the roster was fetched and valid: no roster, no words, never a guess.
   */
  liveByHubName?: Readonly<Record<string, string>>;
}

/** A key shorter than this is refused, as hub-key.mjs does (KEY_FLOOR). */
const KEY_FLOOR = 32;

/** `<host>-<port>`, as hub-key.mjs names the per-hub key directory. */
export function hubIdForUrl(hubUrl: string): string {
  const u = new URL(hubUrl);
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  return `${u.hostname.toLowerCase()}-${port}`;
}

export function resolveOwnKey(
  hubUrl: string,
  keyName: string,
  keyDir: string,
): { ok: true; key: string } | { ok: false; reason: string } {
  const path = join(keyDir, hubIdForUrl(hubUrl), `${keyName}.key`);
  if (!existsSync(path)) return { ok: false, reason: `no hub key for ${keyName} at ${path}` };
  let key: string;
  try {
    key = readFileSync(path, "utf8").trim();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "read failed";
    return { ok: false, reason: `hub key for ${keyName} at ${path} is unreadable (${code})` };
  }
  if (key.length < KEY_FLOOR) {
    return { ok: false, reason: `hub key for ${keyName} at ${path} is shorter than ${KEY_FLOOR} characters` };
  }
  return { ok: true, key };
}

export function readHubPartnerSeats(projectRoot: string): { ok: true; data: HubPartnerSeatsFile; rel: string } | { ok: false; reason: string } {
  const rel = HUB_PARTNER_SEATS_REL;
  const abs = join(projectRoot, rel);
  if (!existsSync(abs)) return { ok: false, reason: `${rel} missing` };
  try {
    const data = JSON.parse(readFileSync(abs, "utf8")) as HubPartnerSeatsFile;
    if (!data.readers || typeof data.readers !== "object") {
      return { ok: false, reason: `${rel} has no readers map` };
    }
    return { ok: true, data, rel };
  } catch (err) {
    return { ok: false, reason: `${rel} unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function formatPollAge(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown age";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
  return `${Math.round(ms / 86_400_000)}d`;
}

function formatHubListenerLine(partner: HubPartnerSeat, agent: PresenceAgent): string {
  const room = agent.rooms?.find((r) => r.sessionId === partner.session_id);
  if (!room) return `${partner.label}: absent`;
  // The hub's pollingNow says a LISTENER process is polling this room. It does not say
  // the seat consumed the turn (QA 225). T-240: label as hub listener, not session presence.
  if (room.pollingNow) return `${partner.label}: hub listener: polling`;
  const unread = room.unread ?? 0;
  if (unread > 0) {
    if (typeof room.pollAgeMs !== "number") {
      return `${partner.label}: hub listener: not polling, ${unread} unread, no listener poll recorded`;
    }
    return `${partner.label}: hub listener: not polling, ${unread} unread since ${formatPollAge(room.pollAgeMs)}`;
  }
  return `${partner.label}: hub listener: not polling`;
}

function formatWakerSeatLine(partner: HubPartnerSeat, agent: PresenceAgent | undefined): string {
  if (!agent) return `${partner.label}: absent`;
  return `${partner.label}: ${formatHubSeatState(agent.seat?.seatState)}`;
}

export function formatPartnerLine(
  partner: HubPartnerSeat,
  agents: PresenceAgent[] | null,
  runtimeForHub: HubRuntime | undefined,
): string {
  if (runtimeForHub === "missing") return `${partner.label}: ${RUNTIME_MISSING_IN_SEAT_MAP}`;
  if (!agents) return `${partner.label}: absent`;
  const agent = agents.find((a) => a.name === partner.hub_as);
  if (!agent) return `${partner.label}: absent`;
  if (runtimeForHub === "cursor") return formatWakerSeatLine(partner, agent);
  return formatHubListenerLine(partner, agent);
}

/** Live state word(s) for SEATS from one agent row and the seat map runtime for that hub name. */
export function liveStateForHubAgent(runtime: HubRuntime | undefined, agent: PresenceAgent | undefined): string | null {
  if (runtime === "missing") return RUNTIME_MISSING_IN_SEAT_MAP;
  if (!agent) return "absent";
  if (runtime === "cursor") return formatHubSeatState(agent.seat?.seatState);
  const rooms = agent.rooms ?? [];
  if (!rooms.length) return "hub listener:absent";
  if (rooms.some((r) => r.pollingNow)) return "hub listener:polling";
  const unread = rooms.reduce((n, r) => n + (r.unread ?? 0), 0);
  if (unread > 0) return "hub listener:not polling";
  return "hub listener:not polling";
}

export function buildLiveByHubName(
  projectRoot: string,
  agents: PresenceAgent[],
): Record<string, string> {
  const map = readSeatMapRows(projectRoot);
  if (!map.ok) return {};
  const runtimes = runtimeByHubName(projectRoot) ?? {};
  const byName = new Map(agents.map((a) => [a.name, a]));
  const out: Record<string, string> = {};
  for (const row of Object.values(map.seats)) {
    if (typeof row.hub_name !== "string" || !row.hub_name.trim()) continue;
    const hub = row.hub_name.trim();
    const runtime = runtimes[hub];
    const live = liveStateForHubAgent(runtime, byName.get(hub));
    if (live) out[hub] = live;
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Validates every agent and room; a schema failure names the first offending path. */
function validateRoster(body: unknown): { ok: true; agents: PresenceAgent[] } | { ok: false; reason: string } {
  const bad = (path: string, why: string) => ({ ok: false as const, reason: `malformed body: ${path} ${why}` });
  if (!isObject(body) || !Array.isArray(body.agents)) return bad("agents", "is not an array");
  for (const [i, agent] of body.agents.entries()) {
    const at = `agents[${i}]`;
    if (!isObject(agent)) return bad(at, "is not an object");
    if (typeof agent.name !== "string") return bad(`${at}.name`, "is not a string");
    if (agent.seat !== undefined) {
      if (!isObject(agent.seat)) return bad(`${at}.seat`, "is not an object");
      if (agent.seat.seatState !== undefined && typeof agent.seat.seatState !== "string") {
        return bad(`${at}.seat.seatState`, "is not a string");
      }
    }
    if (agent.rooms === undefined) continue;
    if (!Array.isArray(agent.rooms)) return bad(`${at}.rooms`, "is not an array");
    for (const [j, room] of agent.rooms.entries()) {
      const rat = `${at}.rooms[${j}]`;
      if (!isObject(room)) return bad(rat, "is not an object");
      if (typeof room.sessionId !== "string") return bad(`${rat}.sessionId`, "is not a string");
      if (!Number.isInteger(room.unread) || (room.unread as number) < 0) return bad(`${rat}.unread`, "is not a non-negative integer");
      if (typeof room.pollingNow !== "boolean") return bad(`${rat}.pollingNow`, "is not a boolean");
      // T-237: null is A2A's "no wait-poll in the window" by design, so one such room must not make ALL presence UNKNOWN.
      if (room.pollAgeMs !== undefined && room.pollAgeMs !== null && (typeof room.pollAgeMs !== "number" || !Number.isFinite(room.pollAgeMs))) {
        return bad(`${rat}.pollAgeMs`, "is not a finite number or null");
      }
    }
  }
  return { ok: true, agents: body.agents as PresenceAgent[] };
}

function parsePresenceBody(text: string): { ok: true; agents: PresenceAgent[] } | { ok: false; reason: string } {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: `malformed body: ${err instanceof Error ? err.message : String(err)}` };
  }
  return validateRoster(body);
}

export async function fetchPresenceRoster(
  hubUrl: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
  agentKey: string,
): Promise<{ ok: true; agents: PresenceAgent[] } | { ok: false; reason: string }> {
  const url = `${hubUrl.replace(/\/+$/, "")}${PRESENCE_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: { "X-Agent-Key": agentKey, Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const text = await res.text();
    return parsePresenceBody(text);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, reason: `timeout after ${timeoutMs}ms` };
    }
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function describeHubPresence(opts: HubPresenceOptions): Promise<HubPresenceBlock> {
  const seatsFile = readHubPartnerSeats(opts.projectRoot);
  if (!seatsFile.ok) {
    if (seatsFile.reason.endsWith(" missing")) {
      return { lines: [], sourceRel: null, charCount: 0 };
    }
    const line = `presence: UNKNOWN (${seatsFile.reason})`;
    return { lines: [line], sourceRel: null, charCount: line.length };
  }

  // T-203: the seat is the CHECKOUT's, from the tracked map. AGENT.local.md is not consulted,
  // and a checkout the map does not list is said to be unknown, never guessed from an identity.
  const seat = resolveCheckoutSeat(opts.projectRoot);
  if (seat.kind === "seatless") {
    const line = `presence: none (${seat.reason})`;
    return { lines: [line], sourceRel: seatsFile.rel, charCount: line.length };
  }
  if (seat.kind === "unknown" || seat.kind === "unreadable") {
    const line = `presence: UNKNOWN (${seat.kind === "unknown" ? `seat unknown for checkout ${seat.checkout}` : seat.reason})`;
    return { lines: [line], sourceRel: seatsFile.rel, charCount: line.length };
  }
  if (seat.kind !== "seat" || !seat.hubName) {
    return { lines: [], sourceRel: seatsFile.rel, charCount: 0 };
  }

  const partners = seatsFile.data.readers[seat.hubName]?.partners;
  if (!partners?.length) {
    return { lines: [], sourceRel: seatsFile.rel, charCount: 0 };
  }

  const hubUrl = opts.hubUrl ?? process.env.HUB_URL ?? DEFAULT_HUB_URL;
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  // The seat's OWN key, or nothing: with no key the hub is not called and there is no
  // fallback to a shared default (turn 236). The path may be printed; the key never.
  const keyDir = opts.keyDir ?? process.env.A2A_KEY_DIR ?? join(homedir(), ".a2a-hub", "keys");
  const own = resolveOwnKey(hubUrl, seat.hubName, keyDir);
  if (!own.ok) {
    const line = `presence: UNKNOWN (${own.reason})`;
    return { lines: [line], sourceRel: seatsFile.rel, charCount: line.length };
  }
  const roster = await fetchPresenceRoster(hubUrl, fetchFn, timeoutMs, own.key);

  if (!roster.ok) {
    if (opts.swallowFetchErrors) {
      return { lines: [], sourceRel: seatsFile.rel, charCount: 0 };
    }
    const line = `presence: UNKNOWN (${roster.reason})`;
    return { lines: [line], sourceRel: seatsFile.rel, charCount: line.length };
  }

  const runtimes = runtimeByHubName(opts.projectRoot) ?? {};
  const partnerLines = partners.map((p) => formatPartnerLine(p, roster.agents, runtimes[p.hub_as]));
  const lines = [presenceHeader(opts.callerLabel, seatsFile.rel), ...partnerLines.map((l) => `  ${l}`)];
  const text = lines.join("\n");
  const liveByHubName = buildLiveByHubName(opts.projectRoot, roster.agents);
  return { lines, sourceRel: seatsFile.rel, charCount: text.length, liveByHubName };
}

function presenceHeader(callerLabel: string, sourceRel: string): string {
  return `Partner presence: hub listener activity, not proof the seat read a turn (${callerLabel}; source ${sourceRel}):`;
}

/**
 * Upper bound on the block's size, for the greeting-size check (QA 225 major 3). A
 * /sync check must not call the live hub, so this builds the WORST-CASE block from the
 * same seat file and formatter: every partner in the longest live form. The one-line
 * UNKNOWN form is not counted. Zero when no block would be printed.
 */
export function presenceBlockUpperBound(
  projectRoot: string,
  callerLabel = "open-brain MCP server",
): { chars: number; lines: string[] } {
  const seatsFile = readHubPartnerSeats(projectRoot);
  if (!seatsFile.ok) return { chars: 0, lines: [] };
  const seat = resolveCheckoutSeat(projectRoot);
  if (seat.kind !== "seat" || !seat.hubName) return { chars: 0, lines: [] };
  const partners = seatsFile.data.readers[seat.hubName]?.partners;
  if (!partners?.length) return { chars: 0, lines: [] };
  // QA 268 F1 (T-237): one fixed room stopped being the worst case when "no listener poll recorded" arrived, and a
  // bound that is not the longest form is not a bound. Each partner's line is the LONGEST over every room shape the
  // line renders: aged, unknown age (a negative age is valid input), no recorded poll (null or absent), polling, absent.
  const runtimes = runtimeByHubName(projectRoot) ?? {};
  const shapes: Array<PresenceAgent["rooms"]> = [
    [{ sessionId: "", unread: 999, pollingNow: false, pollAgeMs: 99 * 86_400_000 }],
    [{ sessionId: "", unread: 999, pollingNow: false, pollAgeMs: -1 }],
    [{ sessionId: "", unread: 999, pollingNow: false, pollAgeMs: null }],
    [{ sessionId: "", unread: 999, pollingNow: false }],
    [{ sessionId: "", unread: 0, pollingNow: true, pollAgeMs: 0 }],
    [],
  ];
  const longest = (p: HubPartnerSeat): string => {
    const runtime = runtimes[p.hub_as];
    const wakerCandidates = [
      formatPartnerLine(p, [{ name: p.hub_as, seat: { seatState: "owes_reply" }, rooms: [] }], "cursor"),
      formatPartnerLine(p, [{ name: p.hub_as, seat: { seatState: "state:unknown(mystery)" }, rooms: [] }], "cursor"),
      formatPartnerLine(p, [{ name: p.hub_as, rooms: [] }], "cursor"),
    ];
    const listenerCandidates = shapes.map((rooms) =>
      formatPartnerLine(p, [{ name: p.hub_as, rooms: (rooms ?? []).map((r) => ({ ...r, sessionId: p.session_id })) }], runtime === "cursor" ? "claude-code" : runtime),
    );
    return [...wakerCandidates, ...listenerCandidates, formatPartnerLine(p, null, runtime)].reduce((a, b) => (b.length > a.length ? b : a));
  };
  const lines = [presenceHeader(callerLabel, seatsFile.rel), ...partners.map((p) => `  ${longest(p)}`)];
  return { chars: lines.join("\n").length, lines };
}
