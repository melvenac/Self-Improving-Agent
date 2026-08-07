import { describe, it, expect } from "vitest";
import { classify, effectiveKind } from "../../../src/pipelines/dream/classify.js";
import { entry } from "./fixtures.js";

describe("classify — failure structure", () => {
  it("reads writeFailure's headings as an event", () => {
    const c = classify(entry({
      id: 1,
      content: "## What was attempted\nRan the build.\n\n## Why it failed\nStale path.",
    }));
    expect(c.kind).toBe("event");
    expect(c.confidence).toBeGreaterThan(0.8);
    expect(c.signals.length).toBeGreaterThan(0);
  });

  it("outranks word choice — only writeFailure emits these headings", () => {
    const failure = classify(entry({
      id: 3,
      content: "## What was attempted\nThe db lives at knowledge-v2.db and currently defaults to WAL.",
    }));
    const linguistic = classify(entry({
      id: 4,
      content: "The db lives at knowledge-v2.db and currently defaults to WAL.",
    }));
    expect(failure.kind).toBe("event");
    expect(linguistic.kind).toBe("state");
    expect(failure.confidence).toBeGreaterThan(linguistic.confidence);
  });
});

describe("classify — the experience template", () => {
  // 287 of 341 live entries carry this template. It is a prior, not a finding,
  // and the ranking below reflects that.
  it("leans event when nothing else speaks", () => {
    const c = classify(entry({ id: 2, content: "TRIGGER: build fails. OUTCOME: rebuilt." }));
    expect(c.kind).toBe("event");
    expect(c.confidence).toBeLessThan(0.4);
  });

  it("does not override a state fact written inside it", () => {
    // The case the live corpus exposed: a current value wrapped in an
    // event-shaped template is still a current value, and still rots.
    const c = classify(entry({
      id: 5,
      content: "TRIGGER: locating the db. OUTCOME: it now lives at knowledge-v2.db; override via KNOWLEDGE_V2_DB. Currently WAL.",
    }));
    expect(c.kind).toBe("state");
  });

  it("ranks below every linguistic verdict", () => {
    const template = classify(entry({ id: 6, content: "TRIGGER: x. OUTCOME: y." }));
    const linguistic = classify(entry({ id: 7, content: "The vault lives at ~/Obsidian Vault v2." }));
    expect(template.confidence).toBeLessThan(linguistic.confidence);
  });

  it("breaks a tie that word choice alone could not settle", () => {
    const c = classify(entry({
      id: 8,
      content: "TRIGGER: a broken path. The root cause was a stale build. It now lives at knowledge-v2.db.",
    }));
    expect(c.kind).toBe("event");
    expect(c.confidence).toBeLessThan(0.4);
  });
});

describe("classify — the failure tag", () => {
  it("treats a tagged failure as an event", () => {
    const c = classify(entry({ id: 5, tags: "failure, windows", content: "Something went sideways." }));
    expect(c.kind).toBe("event");
  });

  it("treats the failure- key prefix as an event", () => {
    const c = classify(entry({ id: 6, key: "failure-npm-crash", content: "Something went sideways." }));
    expect(c.kind).toBe("event");
  });

  it("does not match a tag that merely contains the word", () => {
    const c = classify(entry({ id: 7, tags: "failure-modes", content: "no markers here at all" }));
    expect(c.kind).toBeNull();
  });
});

describe("classify — word choice", () => {
  it("calls a present-tense current value state", () => {
    const c = classify(entry({ id: 8, content: "The vault lives at ~/Obsidian Vault v2. Override via OPEN_BRAIN_VAULT_DIR." }));
    expect(c.kind).toBe("state");
  });

  it("calls past-tense narration an event", () => {
    const c = classify(entry({ id: 9, content: "The root cause was a stale build. The fix was to rebuild before testing." }));
    expect(c.kind).toBe("event");
  });

  it("caps linguistic confidence below every structural verdict", () => {
    const c = classify(entry({ id: 10, content: "It lives at X. It is now Y. Currently Z. Defaults to W." }));
    expect(c.kind).toBe("state");
    expect(c.confidence).toBeLessThanOrEqual(0.65);
  });
});

describe("classify — refusing to guess", () => {
  it("returns null when nothing matches", () => {
    const c = classify(entry({ id: 11, content: "Some prose about an unrelated topic." }));
    expect(c).toEqual({ kind: null, confidence: 0, signals: [] });
  });

  it("returns null for an entry that both narrates a change and asserts its result", () => {
    // The costly case: a wrong label here would archive real history. With no
    // template to break the tie, it refuses.
    const c = classify(entry({
      id: 12,
      content: "The root cause was a stale path. It now lives at knowledge-v2.db.",
    }));
    expect(c.kind).toBeNull();
    // Still reports what it saw, so the tie is reviewable rather than invisible.
    expect(c.signals.length).toBeGreaterThan(1);
  });

  it("still decides when one side clearly dominates", () => {
    const c = classify(entry({
      id: 13,
      content: "It lives at X. It is now Y. Currently Z. Defaults to W. The fix was applied.",
    }));
    expect(c.kind).toBe("state");
  });

  it("never returns a kind with zero confidence, or null with any", () => {
    for (const content of [
      "nothing here",
      "The root cause was a stale path. It now lives at knowledge-v2.db.",
      "The vault lives at ~/Obsidian Vault v2.",
      "## TRIGGER\nx",
    ]) {
      const c = classify(entry({ id: 14, content }));
      if (c.kind === null) expect(c.confidence).toBe(0);
      else expect(c.confidence).toBeGreaterThan(0);
    }
  });
});

describe("effectiveKind", () => {
  it("prefers a recorded label over anything inferred", () => {
    // Content reads unambiguously as an event; the recorded label says state.
    const e = entry({
      id: 15,
      fact_kind: "state",
      content: "## What was attempted\nRan the build.\n## Why it failed\nStale path.",
    });
    expect(classify(e).kind).toBe("event");
    expect(effectiveKind(e).kind).toBe("state");
    expect(effectiveKind(e).confidence).toBe(1);
  });

  it("falls through to the classifier when unrecorded", () => {
    const e = entry({ id: 16, content: "The vault lives at ~/Obsidian Vault v2." });
    expect(effectiveKind(e)).toEqual(classify(e));
  });
});
