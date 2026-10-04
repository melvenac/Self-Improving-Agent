import { describe, it, expect } from "vitest";
import { formatHubSeatState, HUB_SEAT_STATE_NAMES } from "../../../src/pipelines/session-start/hub-seat-state.js";

describe("formatHubSeatState (A2A-Hub seatStateStore.ts)", () => {
  it.each(HUB_SEAT_STATE_NAMES)("prints %s as-is", (name) => {
    expect(formatHubSeatState(name)).toBe(name);
  });

  it("prints state:unknown(missing) when absent", () => {
    expect(formatHubSeatState(undefined)).toBe("state:unknown(missing)");
    expect(formatHubSeatState(null)).toBe("state:unknown(missing)");
    expect(formatHubSeatState("")).toBe("state:unknown(missing)");
  });

  it("prints state:unknown(raw) for an unknown hub value", () => {
    expect(formatHubSeatState("room_full")).toBe("state:unknown(room_full)");
  });
});
