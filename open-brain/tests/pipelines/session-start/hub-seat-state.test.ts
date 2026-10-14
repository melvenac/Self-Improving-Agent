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

describe("T-269 an alarm prints the hub's alarmReason (A2A-Hub v1.22.13)", () => {
  it("A1 alarm with run_too_long prints the reason", () => {
    expect(formatHubSeatState("alarm", "run_too_long")).toBe("alarm(run_too_long)");
  });

  it("A2 alarm with no_reply_since_turn_<n> prints the reason", () => {
    expect(formatHubSeatState("alarm", "no_reply_since_turn_42")).toBe("alarm(no_reply_since_turn_42)");
  });

  it("A3 a 40-character reason prints; 41 is unprintable", () => {
    expect(formatHubSeatState("alarm", "x".repeat(40))).toBe(`alarm(${"x".repeat(40)})`);
    expect(formatHubSeatState("alarm", "x".repeat(41))).toBe("alarm(reason:unprintable)");
  });

  it("A4 a reason that is not a snake_case token is unprintable", () => {
    expect(formatHubSeatState("alarm", "Run Too Long")).toBe("alarm(reason:unprintable)");
    expect(formatHubSeatState("alarm", 7)).toBe("alarm(reason:unprintable)");
    expect(formatHubSeatState("alarm", "a\nb")).toBe("alarm(reason:unprintable)");
  });

  it("A5 an alarm with no reason prints alarm", () => {
    expect(formatHubSeatState("alarm")).toBe("alarm");
    expect(formatHubSeatState("alarm", undefined)).toBe("alarm");
    expect(formatHubSeatState("alarm", null)).toBe("alarm");
    expect(formatHubSeatState("alarm", "")).toBe("alarm");
  });

  it("A6 a reason on any other state is ignored", () => {
    expect(formatHubSeatState("waker_down", "run_too_long")).toBe("waker_down");
    expect(formatHubSeatState("working", "run_too_long")).toBe("working");
  });
});
