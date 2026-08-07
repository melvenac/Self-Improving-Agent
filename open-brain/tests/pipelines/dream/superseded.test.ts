import { describe, it, expect } from "vitest";
import { findSuperseded } from "../../../src/pipelines/dream/rules.js";
import { entry } from "./fixtures.js";

const OLDER = "2026-04-01T00:00:00.000Z";
const NEWER = "2026-07-01T00:00:00.000Z";

describe("findSuperseded — narration", () => {
  it("flags an entry another names as out of date", () => {
    const found = findSuperseded([
      entry({ id: 232, key: "cli-vs-mcp-benchmark", content: "Stateful tools belong on MCP." }),
      entry({
        id: 234,
        key: "cli-vs-mcp-revisited",
        content: "The earlier cli-vs-mcp-benchmark result is outdated after the v2 port.",
      }),
    ]);
    expect(found).toHaveLength(1);
    // [superseded, superseding] — the direction the fix would be applied.
    expect(found[0].targetIds).toEqual([232, 234]);
    expect(found[0].confidence).toBe(0.85);
  });

  it("quotes the sentence that made the claim", () => {
    const found = findSuperseded([
      entry({ id: 1, key: "old-thing", content: "Some content." }),
      entry({ id: 2, key: "new-thing", content: "Unrelated line. The old-thing entry is superseded by this one." }),
    ]);
    expect(found[0].evidence[0].quote).toContain("superseded");
  });

  it("needs the marker and the reference in the same sentence", () => {
    const found = findSuperseded([
      entry({ id: 1, key: "old-thing", content: "Some content." }),
      entry({ id: 2, key: "new-thing", content: "See old-thing for background. Our Docker setup is outdated." }),
    ]);
    expect(found).toHaveLength(0);
  });

  it("stays quiet when the two already point at each other", () => {
    const found = findSuperseded([
      entry({ id: 1, key: "old-thing", content: "Replaced by new-thing." }),
      entry({ id: 2, key: "new-thing", content: "This supersedes old-thing." }),
    ]);
    expect(found).toHaveLength(0);
  });

  it("does not depend on which entry is older", () => {
    const found = findSuperseded([
      entry({ id: 1, key: "recent-note", content: "Some content.", created_at: NEWER }),
      entry({ id: 2, key: "older-note", content: "recent-note is no longer accurate.", created_at: OLDER }),
    ]);
    expect(found[0].targetIds).toEqual([1, 2]);
  });
});

describe("findSuperseded — state pairs", () => {
  const dbPathOld = entry({
    id: 10,
    key: "knowledge-db-location",
    content: "The knowledge database lives at ~/.claude/context-mode/knowledge.db and currently uses the v1 schema.",
    created_at: OLDER,
  });
  const dbPathNew = entry({
    id: 11,
    key: "knowledge-db-location-v2",
    content: "Storage now lives under open-brain. Override via KNOWLEDGE_V2_DB; defaults to the WAL journal mode.",
    created_at: NEWER,
  });

  it("flags two state entries about one subject that disagree", () => {
    const found = findSuperseded([dbPathOld, dbPathNew]);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("superseded");
    expect(found[0].targetIds).toEqual([10, 11]);
  });

  it("orders the pair oldest first", () => {
    const found = findSuperseded([dbPathNew, dbPathOld]);
    expect(found[0].targetIds).toEqual([10, 11]);
  });

  it("ranks below the narration path", () => {
    const found = findSuperseded([dbPathOld, dbPathNew]);
    expect(found[0].confidence).toBeLessThan(0.85);
  });

  it("ignores pairs where either side is not state", () => {
    const eventish = entry({
      id: 12,
      key: "knowledge-db-location-notes",
      content: "## What was attempted\nPointed the build at the old database.\n## Why it failed\nSchema mismatch.",
      created_at: NEWER,
    });
    expect(findSuperseded([dbPathOld, eventish])).toHaveLength(0);
  });

  it("ignores pairs about different subjects", () => {
    const unrelated = entry({
      id: 13,
      key: "traefik-router-config",
      content: "The router config lives at /etc/traefik and currently defaults to the file provider.",
      created_at: NEWER,
    });
    expect(findSuperseded([dbPathOld, unrelated])).toHaveLength(0);
  });

  it("ignores pairs that say the same thing — that is a duplicate, not a supersession", () => {
    const nearCopy = entry({
      id: 14,
      key: "knowledge-db-location-copy",
      content: "The knowledge database lives at ~/.claude/context-mode/knowledge.db and currently uses the v1 schema.",
      created_at: NEWER,
    });
    expect(findSuperseded([dbPathOld, nearCopy])).toHaveLength(0);
  });

  it("prefers a recorded fact_kind over the classifier", () => {
    // Neither body carries a state marker, so only the recorded label can
    // qualify this pair.
    const a = entry({ id: 20, key: "retainer-rate", content: "Three thousand two hundred monthly.", fact_kind: "state", created_at: OLDER });
    const b = entry({ id: 21, key: "retainer-rate-2027", content: "Four thousand one hundred each month.", fact_kind: "state", created_at: NEWER });
    expect(findSuperseded([a, b])).toHaveLength(1);
  });

  it("ignores archived rows", () => {
    expect(findSuperseded([{ ...dbPathOld, archived_into: 99 }, dbPathNew])).toHaveLength(0);
  });
});
