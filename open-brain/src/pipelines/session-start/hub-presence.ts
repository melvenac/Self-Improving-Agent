import { existsSync, readFileSync } from "node:fs";
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
  if (room.pollingNow) return `${partner.label}: polling`;
  const unread = room.unread ?? 0;
  if (unread > 0) {
    const age = formatPollAge(room.pollAgeMs ?? 0);
    return `${partner.label}: not polling, ${unread} unread since ${age}`;
  }
  return `${partner.label}: not polling`;
}

function parsePresenceBody(text: string): { ok: true; body: PresenceBody } | { ok: false; reason: string } {
  try {
    const body = JSON.parse(text) as PresenceBody;
    if (!Array.isArray(body.agents)) return { ok: false, reason: "malformed body: agents[] missing" };
    return { ok: true, body };
  } catch (err) {
    return { ok: false, reason: `malformed body: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function fetchPresenceRoster(
  hubUrl: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<{ ok: true; agents: PresenceAgent[] } | { ok: false; reason: string }> {
  const url = `${hubUrl.replace(/\/+$/, "")}${PRESENCE_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: { "X-Agent-Key": "dev-key", Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const text = await res.text();
    const parsed = parsePresenceBody(text);
    if (!parsed.ok) return parsed;
    return { ok: true, agents: parsed.body.agents ?? [] };
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
  const roster = await fetchPresenceRoster(hubUrl, fetchFn, timeoutMs);

  if (!roster.ok) {
    const swallow = opts.swallowFetchErrors ?? true;
    if (swallow) {
      return { lines: [], sourceRel: seatsFile.rel, charCount: 0 };
    }
    const line = `presence: UNKNOWN (${roster.reason})`;
    return { lines: [line], sourceRel: seatsFile.rel, charCount: line.length };
  }

  const header = `Partner presence (${opts.callerLabel}; source ${seatsFile.rel}):`;
  const partnerLines = partners.map((p) => `  ${formatPartnerLine(p, roster.agents)}`);
  const lines = [header, ...partnerLines];
  const text = lines.join("\n");
  return { lines, sourceRel: seatsFile.rel, charCount: text.length };
}
