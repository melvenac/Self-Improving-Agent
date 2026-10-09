import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { chicagoStamp } from "./briefing.js";

export const FLEET_LINE_CHARS = 200;
const FLEET_STALE_HOURS = 24;

interface FleetSeat {
  name: string;
  project: string;
  kind: string;
  runtime: string;
  model: string;
  host: string;
  status: string;
}

export interface FleetJson {
  verifiedAt?: string;
  coordinator?: { name?: string };
  hub?: { version?: string; url?: string };
  dashboard?: { version?: string; url?: string };
  seats?: unknown;
  projects?: Array<{ name?: string; repo?: string }>;
}

function fleetPath(env: NodeJS.ProcessEnv): string {
  if (env.FLEET_JSON) return env.FLEET_JSON;
  return join(homedir(), "Projects", "fleet", "fleet.json");
}

function firstLine(err: unknown): string {
  const e = err as Error;
  return (e.message || String(err)).split("\n")[0]!;
}

function unavailable(path: string, reason: string): { legacy: string[]; budget: string } {
  const line = `FLEET: unavailable (${path}: ${reason})`;
  return { legacy: [line], budget: line };
}

function invalidShape(path: string, detail: string): { legacy: string[]; budget: string } {
  return unavailable(path, `invalid shape: ${detail}`);
}

function urlWithOptionalSlash(u: string | undefined): string {
  if (u === undefined || u === "") return "?";
  return u.endsWith("/") ? u : `${u}/`;
}

function vtag(v: unknown): string {
  if (typeof v !== "string" || v === "") return "?";
  if (v.startsWith("v") || v.startsWith("V")) return v;
  return `v${v}`;
}

export function fleetProjectKey(projectRoot: string, recordName: string, fleet: FleetJson): string {
  let repoName: string | null = null;
  try {
    const commonDir = execFileSync("git", ["-C", projectRoot, "rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    repoName = basename(dirname(commonDir));
  } catch {
    repoName = null;
  }
  if (Array.isArray(fleet.projects)) {
    for (const p of fleet.projects) {
      if (repoName !== null && typeof p.repo === "string" && p.repo.toLowerCase() === repoName.toLowerCase()) {
        return typeof p.name === "string" ? p.name : recordName;
      }
    }
    for (const p of fleet.projects) {
      if (typeof p.name === "string" && p.name.toLowerCase() === recordName.toLowerCase()) {
        return p.name;
      }
    }
  }
  return recordName;
}

function parseFleetRoot(parsed: unknown): FleetJson | { error: string } {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "not an object" };
  }
  return parsed as FleetJson;
}

function normalizedSeats(data: FleetJson): FleetSeat[] {
  if (!Array.isArray(data.seats)) return [];
  const out: FleetSeat[] = [];
  for (const raw of data.seats) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    if (typeof s.name !== "string" || typeof s.project !== "string") continue;
    out.push({
      name: s.name,
      project: s.project,
      kind: typeof s.kind === "string" ? s.kind : "?",
      runtime: typeof s.runtime === "string" ? s.runtime : "?",
      model: typeof s.model === "string" ? s.model : "?",
      host: typeof s.host === "string" ? s.host : "?",
      status: typeof s.status === "string" ? s.status : "?",
    });
  }
  return out;
}

function projectSeats(data: FleetJson, fleetKey: string): FleetSeat[] {
  const want = fleetKey.toLowerCase();
  return normalizedSeats(data).filter((s) => s.project.toLowerCase() === want);
}

function seatToken(s: FleetSeat): string {
  return `${s.name} ${s.kind} ${s.runtime}/${s.model} ${s.host} ${s.status}`;
}

function verifiedStale(verifiedAt: string | undefined, now: Date): string | null {
  if (!verifiedAt) return null;
  const t = new Date(verifiedAt);
  if (Number.isNaN(t.getTime())) return null;
  const ageMs = now.getTime() - t.getTime();
  if (ageMs <= FLEET_STALE_HOURS * 60 * 60 * 1000) return null;
  return ` · STALE (verified ${chicagoStamp(t)})`;
}

function hubFields(data: FleetJson): { hubV: string; hubUrl: string; dashV: string; dashUrl: string } {
  const hub = data.hub && typeof data.hub === "object" && !Array.isArray(data.hub) ? data.hub : null;
  const dash =
    data.dashboard && typeof data.dashboard === "object" && !Array.isArray(data.dashboard) ? data.dashboard : null;
  return {
    hubV: vtag(hub?.version),
    hubUrl: urlWithOptionalSlash(hub && typeof hub.url === "string" ? hub.url : undefined),
    dashV: vtag(dash?.version),
    dashUrl: urlWithOptionalSlash(dash && typeof dash.url === "string" ? dash.url : undefined),
  };
}

function buildFleet(
  path: string,
  projectRoot: string,
  recordName: string,
  data: FleetJson,
  now: Date,
): { legacy: string[]; budget: string } {
  const fleetKey = fleetProjectKey(projectRoot, recordName, data);
  const seats = projectSeats(data, fleetKey);
  const coord =
    data.coordinator && typeof data.coordinator === "object" && typeof data.coordinator.name === "string"
      ? data.coordinator.name
      : "?";
  const { hubV, hubUrl, dashV, dashUrl } = hubFields(data);
  const verified = data.verifiedAt ? new Date(data.verifiedAt) : null;
  const verifiedLabel = verified && !Number.isNaN(verified.getTime()) ? chicagoStamp(verified) : "?";
  const stale = verifiedStale(data.verifiedAt, now);

  const header = `## Fleet (fleet.json, verified ${verifiedLabel})${stale ?? ""}`;
  const legacy: string[] = [
    header,
    `Coordinator: ${coord} · questions and Aaron's decisions go to ${coord}`,
    `Hub: ${hubV} ${hubUrl} · Dashboard: ${dashV} ${dashUrl}`,
    seats.length === 0
      ? `Seats (${fleetKey}): none in fleet.json`
      : `Seats (${fleetKey}): ${seats.map(seatToken).join(" · ")}`,
  ];

  const verifiedSuffix = `(verified ${verifiedLabel})${stale ?? ""}`;
  const allNames = seats.map((s) => s.name);
  const budgetCore = `FLEET: coordinator ${coord} · hub ${hubV} · dashboard ${dashV} · seats `;
  const suffix = ` ${verifiedSuffix}`;
  let shown = allNames.length;
  let budget = "";
  while (shown >= 0) {
    const names = allNames.slice(0, shown);
    const hidden = allNames.length - shown;
    const more = hidden > 0 ? ` +${hidden} more` : "";
    const namePart = names.length > 0 ? names.join(", ") : "none";
    budget = `${budgetCore}${namePart}${more}${suffix}`;
    if (budget.length <= FLEET_LINE_CHARS || shown === 0) break;
    shown -= 1;
  }

  return { legacy, budget };
}

export function describeFleet(
  projectRoot: string,
  recordName: string,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): { legacy: string[]; budget: string } {
  const path = fleetPath(env);
  try {
    if (!existsSync(path)) return unavailable(path, "not found");
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      return unavailable(path, "not found");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return unavailable(path, "invalid JSON");
    }
    const root = parseFleetRoot(parsed);
    if ("error" in root) return invalidShape(path, root.error);
    return buildFleet(path, projectRoot, recordName, root, now);
  } catch (err) {
    return invalidShape(path, firstLine(err));
  }
}
