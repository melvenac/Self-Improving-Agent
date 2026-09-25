import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkGreetingSize, composeGreeting, GREETING_LIMIT } from "../../../src/pipelines/sync/checks.js";
import { parseState } from "../../../src/shared/state-schema.js";
import type { State } from "../../../src/shared/state-schema.js";

/**
 * T-183, row T183-4: the `greeting-size` detector, validated against a known
 * positive and a known negative in the same test (T-156) — a detector only ever
 * seen green cannot be told apart from one that never looks.
 *
 * Both fixtures are the repository's own record, cut down, so they are real
 * schema-valid state rather than a hand-written approximation of one. The
 * positive carries its bulk in the OBJECTIVE, which the render deliberately does
 * not clip, so it goes over the real limit through the same path a real record
 * would.
 */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function realState(): State {
  const parsed = parseState(readFileSync(join(REPO_ROOT, ".agents", "state.json"), "utf-8"));
  if (!parsed.ok) throw new Error(`the repository's own state.json does not parse: ${parsed.error}`);
  return parsed.data;
}

function fixture(root: string, state: State): string {
  mkdirSync(join(root, ".agents"), { recursive: true });
  writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(state, null, 2));
  return root;
}

describe("greeting-size — T183-4", () => {
  let base: string;
  let negative: string;
  let positive: string;

  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "t183-greeting-"));
    const small = realState();
    small.tasks = small.tasks.slice(0, 3);
    small.gaps = small.gaps.slice(0, 3);
    small.verified = small.verified.slice(0, 3);
    small.handoffs = [];
    negative = fixture(join(base, "negative"), small);
    positive = fixture(join(base, "positive"), {
      ...small,
      objective: { text: "O".repeat(GREETING_LIMIT + 1_000), since_session: 1 },
    });
  });

  afterAll(() => rmSync(base, { recursive: true, force: true }));

  it("is red on the known positive, and prints the count", () => {
    const g = composeGreeting(positive, "0.0.0");
    expect(g).not.toBeNull();
    expect(g!.text.length).toBeGreaterThan(GREETING_LIMIT);
    const r = checkGreetingSize("0.0.0", positive);
    expect(r.name).toBe("greeting-size");
    expect(r.severity).toBe("issue");
    expect(r.report).toBe(true);
    expect(r.message).toContain(`greeting is ${g!.text.length} characters, over the ${GREETING_LIMIT} limit`);
  });

  it("is green on the known negative, and prints the count", () => {
    const g = composeGreeting(negative, "0.0.0");
    expect(g).not.toBeNull();
    expect(g!.text.length).toBeLessThanOrEqual(GREETING_LIMIT);
    // A negative that renders nothing would pass for the wrong reason.
    expect(g!.text.length).toBeGreaterThan(500);
    const r = checkGreetingSize("0.0.0", negative);
    expect(r.severity).toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toContain(`greeting is ${g!.text.length} characters, within the ${GREETING_LIMIT} limit`);
  });

  it("states what it does not count, in its own output", () => {
    expect(checkGreetingSize("0.0.0", negative).message).toContain("not counted");
  });

  it("skips with a reason, rather than passing, when there is no state.json", () => {
    const empty = join(base, "empty");
    mkdirSync(empty, { recursive: true });
    const r = checkGreetingSize("0.0.0", empty);
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("no valid .agents/state.json");
  });
});

describe("the composed greeting carries the role files whole — T183-3", () => {
  it("contains every role file this repository loads, byte for byte", () => {
    const g = composeGreeting(REPO_ROOT, "0.0.0");
    expect(g).not.toBeNull();
    const shared = readFileSync(join(REPO_ROOT, ".agents", "roles", "shared.md"), "utf-8").replace(/\s+$/, "");
    expect(shared.length).toBeGreaterThan(1_000);
    expect(g!.text).toContain(shared);
    // The seat's own role file: whichever of the three the checkout greets as.
    const seatFiles = ["planner", "developer", "qa"]
      .map((r) => readFileSync(join(REPO_ROOT, ".agents", "roles", `${r}.md`), "utf-8").replace(/\s+$/, ""))
      .filter((c) => g!.text.includes(c));
    expect(seatFiles).toHaveLength(1);
    // Explicit: 3.5s idle on win32 (it shells out to git for tree currency and
    // each role file's commit), too near vitest's 5s default under load (G-042).
  }, 30_000);
});
