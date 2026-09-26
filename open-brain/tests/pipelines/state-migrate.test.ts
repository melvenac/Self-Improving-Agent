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

  it("moves a v1 handoff to handoffs[] under the seat it was told, through v2 to v3, bumping the revision ONCE", () => {
    writeFileSync(path, v1());
    const r = migrateStateFile(path, { seat: "qa", lastSessionSeat: "qa" });

    expect(r.ok).toBe(true);
    expect(r.from).toBe(1);
    expect(r.to).toBe(3);
    expect(r.revisionBefore).toBe(52);
    expect(r.revisionAfter).toBe(53);

    const parsed = parseState(readFileSync(path, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.schema_version).toBe(3);
    expect(parsed.data.revision).toBe(53);
    expect(parsed.data.handoffs).toHaveLength(1);
    expect(parsed.data.handoffs[0].seat).toBe("qa");
    expect(parsed.data.handoffs[0].pick_up).toBe("THIS IS THE QA SEAT'S HANDOFF");
    expect(parsed.data.handoffs[0].session).toBe(70);
    expect(parsed.data.handoffs[0].session_uuid).toBeNull();
    expect(parsed.data.sessions).toEqual([{ n: 70, date: "2026-09-20", uuid: "abc", seat: "qa", checkout: null }]);
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
    expect(second.changes.join(" ")).toMatch(/already at schema v3/);
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
    expect(parsed.data.schema_version).toBe(3);
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

  it("REFUSES a file that is none of v3, v2 or v1, and writes nothing", () => {
    writeFileSync(path, JSON.stringify({ schema_version: 1, revision: 3 }) + "\n");
    const original = readFileSync(path, "utf8");
    const r = migrateStateFile(path, { seat: "qa" });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/is not a valid v3, v2 or v1 record/);
    expect(r.error).toMatch(/v2 check failed at .*v1 check failed at/);
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
    expect(text).toMatch(/schema_version 2 → 3/);
    expect(text).toMatch(/revision 52 → 53/);
    expect(text).toMatch(/handoffs\[0\] with seat "developer"/);
    expect(text).toMatch(/loop_state = null/);
  });

  // ---- v2 → v3 (T-163) ----

  const U1 = "22631f4e-433a-4f29-8669-47ee2f543bec";
  const U2 = "d7e514f8-df2a-483c-a8c7-57f2e0a931b0";
  function v2(): string {
    const h = (seat: string, session: number, pick_up: string) => ({
      seat, pick_up, watch_out: ["w"], open_questions: [], session,
      loop_state: seat === "planner" ? { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } : null,
    });
    return JSON.stringify({
      schema_version: 2,
      revision: 131,
      project: { name: "fixture" },
      objective: null,
      tasks: [],
      verified: [],
      gaps: [],
      decisions: [{ id: "D-001", title: "t", date: "2026-09-20", note: `the planner uuid ${U2} is cited in a note` }],
      handoffs: [h("qa", 75, "qa words"), h("developer", 74, "developer words"), h("planner", 109, "planner words")],
      last_session: { n: 76, date: "2026-09-21", uuid: U1, seat: "planner" },
    }, null, 2) + "\n";
  }

  it("v2 → v3 keeps every handoff word for word, with session_uuid and checkout null, and needs no --seat", () => {
    writeFileSync(path, v2());
    const before = JSON.parse(v2()) as { handoffs: Array<Record<string, unknown>> };
    const r = migrateStateFile(path, {});
    expect(r.ok).toBe(true);
    expect(r.from).toBe(2);
    expect(r.to).toBe(3);
    expect(r.revisionBefore).toBe(131);
    expect(r.revisionAfter).toBe(132);
    const parsed = parseState(readFileSync(path, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.handoffs).toEqual(before.handoffs.map((h) => ({ ...h, session_uuid: null, checkout: null })));
  });

  it("v2 → v3 turns last_session into the one sessions[] entry, uuid and seat included", () => {
    writeFileSync(path, v2());
    migrateStateFile(path, {});
    const after = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    expect(after).not.toHaveProperty("last_session");
    expect(after.sessions).toEqual([{ n: 76, date: "2026-09-21", uuid: U1, seat: "planner", checkout: null }]);
  });

  it("v2 → v3 keeps EVERY uuid in the file, counted before and after (the planner's ruling on T-163)", () => {
    writeFileSync(path, v2());
    const r = migrateStateFile(path, {});
    expect(r.uuidsBefore).toBe(2);
    expect(r.uuidsAfter).toBe(2);
    expect(r.changes.join("\n")).toMatch(/uuids: 2 distinct before, 2 after, none lost/);
    const text = readFileSync(path, "utf8");
    expect(text).toContain(U1);
    expect(text).toContain(U2);
  });

  it("a v1 record without --seat is REFUSED, naming v1 as the reason, and nothing is written", () => {
    writeFileSync(path, v1());
    const original = readFileSync(path, "utf8");
    const r = migrateStateFile(path, {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/this is a v1 record: --seat must be one of planner \/ developer \/ qa/);
    expect(readFileSync(path, "utf8")).toBe(original);
  });
});
