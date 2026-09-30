import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentIdentity } from "./agent-identity.js";

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
  pollAgeMs?: number;
}

export interface PresenceAgent {
  name: string;
  state?: string;
  rooms?: PresenceRoom[];
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
}

/** A key shorter than this is refused, as hub-key.mjs does (KEY_FLOOR). */
const KEY_FLOOR = 32;

/**
 * The name of THIS seat's own key file: the reader's identity, lowercased. It is not
 * the readers-map name (`hubAsForIdentity`): Forge is looked up under `grok` there,
 * and grok.key belongs to another seat, so it must never be borrowed.
 */
export function keyNameForIdentity(identity: AgentIdentity): string {
  return identity.name.trim().toLowerCase().replace(/\s+/g, "-");
}

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

function hubAsForIdentity(identity: AgentIdentity): string {
  if (identity.name === "Forge" && identity.role === "developer") return "grok";
  if (identity.name === "Atlas" && identity.role === "planner") return "atlas";
  return identity.name.trim().toLowerCase().replace(/\s+/g, "-");
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

export function formatPartnerLine(partner: HubPartnerSeat, agents: PresenceAgent[] | null): string {
  if (!agents) return `${partner.label}: absent`;
  const agent = agents.find((a) => a.name === partner.hub_as);
  if (!agent) return `${partner.label}: absent`;
  const room = agent.rooms?.find((r) => r.sessionId === partner.session_id);
  if (!room) return `${partner.label}: absent`;
  // The hub's pollingNow says a LISTENER process is polling this room. It does not say
  // the seat consumed the turn (QA 225), so every line says "listener".
  if (room.pollingNow) return `${partner.label}: listener polling`;
  const unread = room.unread ?? 0;
  if (unread > 0) {
    const age = formatPollAge(room.pollAgeMs ?? 0);
    return `${partner.label}: listener not polling, ${unread} unread since ${age}`;
  }
  return `${partner.label}: listener not polling`;
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
    if (agent.rooms === undefined) continue;
    if (!Array.isArray(agent.rooms)) return bad(`${at}.rooms`, "is not an array");
    for (const [j, room] of agent.rooms.entries()) {
      const rat = `${at}.rooms[${j}]`;
      if (!isObject(room)) return bad(rat, "is not an object");
      if (typeof room.sessionId !== "string") return bad(`${rat}.sessionId`, "is not a string");
      if (!Number.isInteger(room.unread) || (room.unread as number) < 0) return bad(`${rat}.unread`, "is not a non-negative integer");
      if (typeof room.pollingNow !== "boolean") return bad(`${rat}.pollingNow`, "is not a boolean");
      if (room.pollAgeMs !== undefined && (typeof room.pollAgeMs !== "number" || !Number.isFinite(room.pollAgeMs))) {
        return bad(`${rat}.pollAgeMs`, "is not a finite number");
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

  if (!opts.identity) {
    return { lines: [], sourceRel: seatsFile.rel, charCount: 0 };
  }

  const readerHubAs = hubAsForIdentity(opts.identity);
  const partners = seatsFile.data.readers[readerHubAs]?.partners;
  if (!partners?.length) {
    return { lines: [], sourceRel: seatsFile.rel, charCount: 0 };
  }

  const hubUrl = opts.hubUrl ?? process.env.HUB_URL ?? DEFAULT_HUB_URL;
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  // The seat's OWN key, or nothing: with no key the hub is not called and there is no
  // fallback to a shared default (turn 236). The path may be printed; the key never.
  const keyDir = opts.keyDir ?? process.env.A2A_KEY_DIR ?? join(homedir(), ".a2a-hub", "keys");
  const own = resolveOwnKey(hubUrl, keyNameForIdentity(opts.identity), keyDir);
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

  const lines = [presenceHeader(opts.callerLabel, seatsFile.rel), ...partners.map((p) => `  ${formatPartnerLine(p, roster.agents)}`)];
  const text = lines.join("\n");
  return { lines, sourceRel: seatsFile.rel, charCount: text.length };
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
  identity: AgentIdentity | null,
  callerLabel = "open-brain MCP server",
): { chars: number; lines: string[] } {
  const seatsFile = readHubPartnerSeats(projectRoot);
  if (!seatsFile.ok || !identity) return { chars: 0, lines: [] };
  const partners = seatsFile.data.readers[hubAsForIdentity(identity)]?.partners;
  if (!partners?.length) return { chars: 0, lines: [] };
  const worst: PresenceAgent[] = partners.map((p) => ({
    name: p.hub_as,
    rooms: [{ sessionId: p.session_id, unread: 999, pollingNow: false, pollAgeMs: 99 * 86_400_000 }],
  }));
  const lines = [presenceHeader(callerLabel, seatsFile.rel), ...partners.map((p) => `  ${formatPartnerLine(p, worst)}`)];
  return { chars: lines.join("\n").length, lines };
}
