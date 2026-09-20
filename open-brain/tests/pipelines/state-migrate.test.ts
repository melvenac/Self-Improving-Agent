import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrateStateFile } from "../../src/pipelines/state-migrate/index.js";
import { parseState } from "../../src/shared/state-schema.js";

function v1(overrides: Record<string, unknown> = {}): string {
  return (
    JSON.stringify(
      {
        schema_version: 1,
        revision: 52,
        project: { name: "fixture" },
        objective: { text: "do the thing", since_session: 1 },
        tasks: [],
        verified: [],
        gaps: [],
        decisions: [],
        handoff: {
          pick_up: "THIS IS THE QA SEAT'S HANDOFF",
          watch_out: ["one", "two"],
          open_questions: ["why"],
          session: 70,
        },
        last_session: { n: 70, date: "2026-09-20", uuid: "abc" },
        ...overrides,
      },
      null,
      2
    ) + "\n"
  );
}

describe("migrateStateFile", () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "state-migrate-"));
    path = join(dir, "state.json");
  });

  afterEach(async () => {
    await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
  });

  it("moves handoff to handoffs[] under the seat it was told, and bumps both versions", () => {
    writeFileSync(path, v1());
    const r = migrateStateFile(path, { seat: "qa", lastSessionSeat: "qa" });

    expect(r.ok).toBe(true);
    expect(r.from).toBe(1);
    expect(r.to).toBe(2);
    expect(r.revisionBefore).toBe(52);
    expect(r.revisionAfter).toBe(53);

    const parsed = parseState(readFileSync(path, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.schema_version).toBe(2);
    expect(parsed.data.revision).toBe(53);
    expect(parsed.data.handoffs).toHaveLength(1);
    expect(parsed.data.handoffs[0].seat).toBe("qa");
    expect(parsed.data.handoffs[0].pick_up).toBe("THIS IS THE QA SEAT'S HANDOFF");
    expect(parsed.data.handoffs[0].session).toBe(70);
    expect(parsed.data.last_session.seat).toBe("qa");
  });

  it("carries every unrelated field through byte-identically", () => {
    // A migration that quietly reshapes something it was not asked to touch is
    // the worst kind, because the diff is large enough that nobody reads it.
    const before = JSON.parse(v1()) as Record<string, unknown>;
    writeFileSync(path, v1());
    migrateStateFile(path, { seat: "qa" });

    const after = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    for (const key of ["project", "objective", "tasks", "verified", "gaps", "decisions"]) {
      expect(after[key]).toEqual(before[key]);
    }
    expect(after).not.toHaveProperty("handoff");
  });

  it("sets loop_state to null rather than an empty object", () => {
    // An empty loop_state would ASSERT "no open PRs, no pending questions, no
    // rulings" — a claim a v1 record gives no basis for. Null says the record
    // does not know, and the schema then makes the planner's next write supply it.
    writeFileSync(path, v1());
    migrateStateFile(path, { seat: "qa" });
    const parsed = parseState(readFileSync(path, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.handoffs[0].loop_state).toBeNull();
  });

  it("is idempotent: a second run changes nothing and does NOT bump the revision again", () => {
    writeFileSync(path, v1());
    const first = migrateStateFile(path, { seat: "qa" });
    const afterFirst = readFileSync(path, "utf8");

    const second = migrateStateFile(path, { seat: "qa" });
    expect(second.ok).toBe(true);
    expect(second.revisionAfter).toBe(first.revisionAfter);
    expect(second.changes.join(" ")).toMatch(/already at schema v2/);
    expect(readFileSync(path, "utf8")).toBe(afterFirst);
  });

  it("--keep-revision leaves the number alone and says which it did", () => {
    // For a template or a fixture there is no concurrent writer to protect, and
    // the revision is a readability parameter rather than a count of writes.
    // Both branches must be distinguishable in the output, or a reader cannot
    // tell a migration that held the number from one that failed to move it.
    writeFileSync(path, v1());
    const r = migrateStateFile(path, { seat: "developer", keepRevision: true });

    expect(r.ok).toBe(true);
    expect(r.revisionBefore).toBe(52);
    expect(r.revisionAfter).toBe(52);
    expect(r.changes.join("\n")).toMatch(/revision 52 unchanged/);

    const parsed = parseState(readFileSync(path, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.revision).toBe(52);
    expect(parsed.data.schema_version).toBe(2);
  });

  it("bumps the revision when --keep-revision is NOT passed", () => {
    // The negative half, so that hardcoding either branch fails.
    writeFileSync(path, v1());
    const r = migrateStateFile(path, { seat: "developer" });
    expect(r.revisionAfter).toBe(53);
    expect(r.changes.join("\n")).toMatch(/revision 52 → 53/);
    expect(r.changes.join("\n")).not.toMatch(/unchanged/);
  });

  it("dry run writes nothing but reports the same changes", () => {
    writeFileSync(path, v1());
    const original = readFileSync(path, "utf8");
    const r = migrateStateFile(path, { seat: "qa", dryRun: true });

    expect(r.ok).toBe(true);
    expect(r.revisionAfter).toBe(53);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("REFUSES a file that is neither valid v1 nor valid v2, and writes nothing", () => {
    writeFileSync(path, JSON.stringify({ schema_version: 1, revision: 3 }) + "\n");
    const original = readFileSync(path, "utf8");
    const r = migrateStateFile(path, { seat: "qa" });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/neither a valid v2 record nor a valid v1 record/);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("REFUSES a seat outside the closed set", () => {
    writeFileSync(path, v1());
    const original = readFileSync(path, "utf8");
    // @ts-expect-error deliberately outside the closed set
    const r = migrateStateFile(path, { seat: "builder" });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/planner \/ developer \/ qa/);
    expect(readFileSync(path, "utf8")).toBe(original);
  });

  it("refuses a missing file rather than creating one", () => {
    const r = migrateStateFile(join(dir, "nope.json"), { seat: "qa" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/does not exist/);
  });

  it("names every change it made, so the diff can be checked against words", () => {
    writeFileSync(path, v1());
    const r = migrateStateFile(path, { seat: "developer", lastSessionSeat: "developer" });
    const text = r.changes.join("\n");
    expect(text).toMatch(/schema_version 1 → 2/);
    expect(text).toMatch(/revision 52 → 53/);
    expect(text).toMatch(/handoffs\[0\] with seat "developer"/);
    expect(text).toMatch(/loop_state = null/);
  });
});
