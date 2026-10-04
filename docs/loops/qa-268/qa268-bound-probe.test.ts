// QA 268 probe (row 9 follow-up): is presenceBlockUpperBound still an upper bound once a room may carry
// pollAgeMs null? The bound's own contract: "every partner in the longest live form". No network: the
// actual block is rendered by the same formatter the live path uses (formatPartnerLine), on the same seat file.
import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  formatPartnerLine,
  presenceBlockUpperBound,
  readHubPartnerSeats,
  HUB_PARTNER_SEATS_REL,
  type PresenceAgent,
} from "../src/pipelines/session-start/hub-presence.js";

const base = mkdtempSync(join(tmpdir(), "qa268-bound-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

function seat(name: string): string {
  const root = join(base, name);
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  cpSync(join(import.meta.dirname, "../../.agents/SYSTEM/hub-partner-seats.json"), join(root, HUB_PARTNER_SEATS_REL));
  return root;
}

describe("QA 268: presence upper bound vs a live block whose rooms have no recorded poll", () => {
  it("the bound is >= the rendered block when every partner has 999 unread and pollAgeMs null", () => {
    const root = seat("sia-planner");
    const bound = presenceBlockUpperBound(root);
    const seats = readHubPartnerSeats(root);
    if (!seats.ok) throw new Error(seats.reason);
    const partners = Object.values(seats.data.readers).flatMap((r) => r.partners)
      .filter((p) => bound.lines.some((l) => l.startsWith(`  ${p.label}:`)));
    const nullRooms: PresenceAgent[] = partners.map((p) => ({
      name: p.hub_as,
      rooms: [{ sessionId: p.session_id, unread: 999, pollingNow: false, pollAgeMs: null as unknown as number }],
    }));
    const actual = [bound.lines[0], ...partners.map((p) => `  ${formatPartnerLine(p, nullRooms)}`)];
    const actualChars = actual.join("\n").length;
    console.log(`QA268 bound.chars=${bound.chars} actual.chars=${actualChars} partners=${partners.length}`);
    console.log(`QA268 bound line:  ${JSON.stringify(bound.lines[1])}`);
    console.log(`QA268 actual line: ${JSON.stringify(actual[1])}`);
    expect(partners.length).toBeGreaterThan(0);
    expect(actualChars).toBeLessThanOrEqual(bound.chars);
  });
});
