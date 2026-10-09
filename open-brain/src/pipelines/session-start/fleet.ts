import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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

interface FleetJson {
  verifiedAt?: string;
  coordinator?: { name?: string };
  hub?: { version?: string; url?: string };
  dashboard?: { version?: string; url?: string };
  seats?: FleetSeat[];
}

function fleetPath(env: NodeJS.ProcessEnv): string {
  if (env.FLEET_JSON) return env.FLEET_JSON;
  return join(homedir(), "Projects", "fleet", "fleet.json");
}

function loadFleet(path: string): { ok: true; data: FleetJson } | { ok: false; reason: string } {
  if (!existsSync(path)) return { ok: false, reason: "not found" };
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { ok: false, reason: "not found" };
  }
  try {
    return { ok: true, data: JSON.parse(text) as FleetJson };
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
}

function projectSeats(data: FleetJson, projectName: string): FleetSeat[] {
  const want = projectName.toLowerCase();
  return (data.seats ?? []).filter((s) => s.project.toLowerCase() === want);
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

export function describeFleet(
  projectName: string,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): { legacy: string[]; budget: string } {
  const path = fleetPath(env);
  const loaded = loadFleet(path);
  if (!loaded.ok) {
    const line = `FLEET: unavailable (${path}: ${loaded.reason})`;
    return { legacy: [line], budget: line };
  }
  const data = loaded.data;
  const seats = projectSeats(data, projectName);
  const coord = data.coordinator?.name ?? "?";
  const hubV = data.hub?.version ?? "?";
  const hubUrl = data.hub?.url ?? "?";
  const dashV = data.dashboard?.version ?? "?";
  const dashUrl = data.dashboard?.url ?? "?";
  const verified = data.verifiedAt ? new Date(data.verifiedAt) : null;
  const verifiedLabel =
    verified && !Number.isNaN(verified.getTime()) ? chicagoStamp(verified) : "?";
  const stale = verifiedStale(data.verifiedAt, now);

  const header = `## Fleet (fleet.json, verified ${verifiedLabel})${stale ?? ""}`;
  const legacy: string[] = [
    header,
    `Coordinator: ${coord} · questions and Aaron's decisions go to ${coord}`,
    `Hub: v${hubV} ${hubUrl} · Dashboard: v${dashV} ${dashUrl}/`,
    seats.length === 0
      ? `Seats (${projectName}): none in fleet.json`
      : `Seats (${projectName}): ${seats.map(seatToken).join(" · ")}`,
  ];

  const verifiedSuffix = `(verified ${verifiedLabel})${stale ?? ""}`;
  const allNames = seats.map((s) => s.name);
  const budgetCore = `FLEET: coordinator ${coord} · hub v${hubV} · dashboard v${dashV} · seats `;
  const suffix = ` ${verifiedSuffix}`;
  let shown = allNames.length;
  let budget = "";
  while (shown >= 0) {
    const names = allNames.slice(0, shown);
    const hidden = allNames.length - shown;
    const more = hidden > 0 ? ` +${hidden} more` : "";
    budget = `${budgetCore}${names.join(", ")}${more}${suffix}`;
    if (budget.length <= FLEET_LINE_CHARS || shown === 0) break;
    shown -= 1;
  }

  return { legacy, budget };
}
