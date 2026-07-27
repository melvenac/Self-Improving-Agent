import { describe, it, expect } from "vitest";
import {
  parseExperienceTags,
  clusterByTag,
  detectChanges,
  consolidateClusters,
  dedupeClusters,
  scanForSkills,
} from "../../../src/pipelines/session-end/skill-scan.js";
import type { ExperienceFile } from "../../../src/pipelines/session-end/skill-scan.js";

// --- parseExperienceTags ---

describe("parseExperienceTags", () => {
  it("parses inline array syntax", () => {
    const content = `---
tags: [auth, validation, middleware]
---
Content here.`;
    const result = parseExperienceTags(content);
    expect(result).toContain("auth");
    expect(result).toContain("validation");
    expect(result).toContain("middleware");
  });

  it("parses YAML list syntax", () => {
    const content = `---
tags:
  - auth
  - validation
---
Content here.`;
    const result = parseExperienceTags(content);
    expect(result).toContain("auth");
    expect(result).toContain("validation");
  });

  it("extracts domain tags", () => {
    const content = `---
domain: memory-systems
---
Content here.`;
    const result = parseExperienceTags(content);
    expect(result).toContain("memory-systems");
  });

  it("combines tags and domain fields", () => {
    const content = `---
tags: [auth, validation]
domain:
  - memory-systems
  - indexing
---
Content here.`;
    const result = parseExperienceTags(content);
    expect(result).toContain("auth");
    expect(result).toContain("validation");
    expect(result).toContain("memory-systems");
    expect(result).toContain("indexing");
  });

  it("returns empty array when no tags found", () => {
    const content = `---
title: Some experience
---
Content.`;
    expect(parseExperienceTags(content)).toEqual([]);
  });

  it("returns empty array for content without frontmatter", () => {
    const content = "Just plain content, no frontmatter.";
    expect(parseExperienceTags(content)).toEqual([]);
  });

  it("filters noise tags", () => {
    const content = `---
tags: [auth, test, marker, fix, optimization, debug, gotcha, pattern, validation]
---`;
    const result = parseExperienceTags(content);
    expect(result).toContain("auth");
    expect(result).toContain("validation");
    expect(result).not.toContain("test");
    expect(result).not.toContain("marker");
    expect(result).not.toContain("fix");
    expect(result).not.toContain("optimization");
    expect(result).not.toContain("debug");
    expect(result).not.toContain("gotcha");
    expect(result).not.toContain("pattern");
  });

  it("strips YAML quoting so quoted and bare tags are one tag", () => {
    const content = `---
tags: ["deployment", 'windows', mcp]
---`;
    const result = parseExperienceTags(content);
    expect(result).toEqual(["deployment", "windows", "mcp"]);
  });

  it("filters noise tags even when quoted", () => {
    const content = `---
tags: ["gotcha", "auth"]
---`;
    const result = parseExperienceTags(content);
    expect(result).not.toContain("gotcha");
    expect(result).toContain("auth");
  });

  it("deduplicates quoted against bare forms of the same tag", () => {
    const content = `---
tags: ["windows", windows]
---`;
    expect(parseExperienceTags(content)).toEqual(["windows"]);
  });

  it("deduplicates tags", () => {
    const content = `---
tags: [auth, auth, validation]
domain: auth
---`;
    const result = parseExperienceTags(content);
    expect(result.filter((t) => t === "auth")).toHaveLength(1);
  });

  it("handles domain as inline value", () => {
    const content = `---
domain: session-management
---`;
    const result = parseExperienceTags(content);
    expect(result).toContain("session-management");
  });
});

// --- clusterByTag ---

describe("clusterByTag", () => {
  it("groups files by shared tags", () => {
    const files = [
      { name: "exp-001.md", tags: ["auth", "middleware"] },
      { name: "exp-002.md", tags: ["auth", "validation"] },
      { name: "exp-003.md", tags: ["validation"] },
    ];
    const result = clusterByTag(files);
    expect(result.get("auth")).toEqual(["exp-001.md", "exp-002.md"]);
    expect(result.get("validation")).toEqual(["exp-002.md", "exp-003.md"]);
    expect(result.get("middleware")).toEqual(["exp-001.md"]);
  });

  it("returns empty map for empty input", () => {
    expect(clusterByTag([])).toEqual(new Map());
  });

  it("handles files with no tags", () => {
    const files = [{ name: "exp-001.md", tags: [] }];
    expect(clusterByTag(files)).toEqual(new Map());
  });
});

// --- detectChanges ---

describe("detectChanges", () => {
  it("marks new clusters at or above threshold", () => {
    const current = new Map([
      ["auth", ["a.md", "b.md", "c.md"]],
    ]);
    const previous = new Map<string, number>();
    const result = detectChanges(current, previous, 3);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("auth");
    expect(result[0].status).toBe("new");
    expect(result[0].count).toBe(3);
  });

  it("marks growing clusters", () => {
    const current = new Map([
      ["auth", ["a.md", "b.md", "c.md", "d.md"]],
    ]);
    const previous = new Map([["auth", 3]]);
    const result = detectChanges(current, previous, 3);
    expect(result[0].status).toBe("growing");
  });

  it("marks stable clusters", () => {
    const current = new Map([
      ["auth", ["a.md", "b.md", "c.md"]],
    ]);
    const previous = new Map([["auth", 3]]);
    const result = detectChanges(current, previous, 3);
    expect(result[0].status).toBe("stable");
  });

  it("filters clusters below threshold", () => {
    const current = new Map([
      ["auth", ["a.md", "b.md"]],
      ["validation", ["x.md", "y.md", "z.md"]],
    ]);
    const previous = new Map<string, number>();
    const result = detectChanges(current, previous, 3);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("validation");
  });

  it("uses default threshold of 3", () => {
    const current = new Map([
      ["auth", ["a.md", "b.md"]],
    ]);
    const previous = new Map<string, number>();
    const result = detectChanges(current, previous);
    expect(result).toHaveLength(0);
  });
});

// --- consolidateClusters ---

describe("consolidateClusters", () => {
  it("merges clusters with >60% Jaccard overlap", () => {
    // auth has [a, b, c], auth-middleware has [a, b, c, d]
    // intersection = [a, b, c] = 3, union = 4, ratio = 0.75 > 0.6
    const clusters = [
      { tag: "auth", count: 3, files: ["a.md", "b.md", "c.md"], status: "new" as const },
      { tag: "auth-middleware", count: 4, files: ["a.md", "b.md", "c.md", "d.md"], status: "new" as const },
    ];
    const result = consolidateClusters(clusters, 0.6);
    expect(result).toHaveLength(1);
    expect(result[0].consolidatedFrom).toContain("auth");
    expect(result[0].files).toContain("d.md");
  });

  it("does not merge a small cluster fully contained in a large one", () => {
    // The containment bug: intersection/min(3,20) = 1.0 → always merged.
    // Jaccard = 3/20 = 0.15 → correctly left alone.
    const big = Array.from({ length: 20 }, (_, i) => `exp-${i}.md`);
    const clusters = [
      { tag: "convex", count: 20, files: big, status: "new" as const },
      { tag: "clerk", count: 3, files: big.slice(0, 3), status: "new" as const },
    ];
    const result = consolidateClusters(clusters, 0.6);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.tag).sort()).toEqual(["clerk", "convex"]);
  });

  it("refuses a merge that would exceed the max cluster size", () => {
    // intersection = 7, union = 9 → 0.78 > 0.6, but 9 exceeds the cap of 8.
    const shared = Array.from({ length: 7 }, (_, i) => `s-${i}.md`);
    const clusters = [
      { tag: "a", count: 8, files: [...shared, "a-only.md"], status: "new" as const },
      { tag: "b", count: 8, files: [...shared, "b-only.md"], status: "new" as const },
    ];
    expect(consolidateClusters(clusters, 0.6, 8)).toHaveLength(2);
    expect(consolidateClusters(clusters, 0.6, 9)).toHaveLength(1);
  });

  it("names the merged cluster after the dominant member, not the first tag", () => {
    // `node` contributes 5 of the 6 merged files; `vite` only 4 — but `vite`
    // comes first, which is what the old code named the result.
    const clusters = [
      { tag: "vite", count: 4, files: ["a.md", "b.md", "c.md", "d.md"], status: "new" as const },
      { tag: "node", count: 5, files: ["a.md", "b.md", "c.md", "d.md", "e.md"], status: "new" as const },
    ];
    const result = consolidateClusters(clusters, 0.6);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("node");
    expect(result[0].consolidatedFrom).toEqual(["vite"]);
  });

  it("keeps non-overlapping clusters separate", () => {
    // overlap = 0/3 = 0 < 0.6
    const clusters = [
      { tag: "auth", count: 3, files: ["a.md", "b.md", "c.md"], status: "new" as const },
      { tag: "indexing", count: 3, files: ["x.md", "y.md", "z.md"], status: "new" as const },
    ];
    const result = consolidateClusters(clusters, 0.6);
    expect(result).toHaveLength(2);
  });

  it("returns same clusters when only one cluster", () => {
    const clusters = [
      { tag: "auth", count: 3, files: ["a.md", "b.md", "c.md"], status: "new" as const },
    ];
    const result = consolidateClusters(clusters, 0.6);
    expect(result).toHaveLength(1);
    expect(result[0].consolidatedFrom).toBeUndefined();
  });

  it("does not merge clusters at exactly the threshold boundary (<=)", () => {
    // intersection = [a] = 1, union = 5, ratio = 0.2 < 0.6 → keep separate
    const clusters = [
      { tag: "auth", count: 3, files: ["a.md", "b.md", "c.md"], status: "new" as const },
      { tag: "sessions", count: 3, files: ["a.md", "x.md", "y.md"], status: "new" as const },
    ];
    const result = consolidateClusters(clusters, 0.6);
    expect(result).toHaveLength(2);
  });
});

// --- dedupeClusters ---

describe("dedupeClusters", () => {
  it("drops a cluster whose files are 75% covered by a larger one", () => {
    // `methodology` shares 3 of its 4 files with the 5-file `agent-orchestration`.
    const clusters = [
      { tag: "agent-orchestration", count: 5, files: ["a.md", "b.md", "c.md", "d.md", "e.md"], status: "new" as const },
      { tag: "methodology", count: 4, files: ["a.md", "b.md", "c.md", "z.md"], status: "new" as const },
    ];
    const result = dedupeClusters(clusters);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("agent-orchestration");
  });

  it("keeps the earlier cluster when sizes tie", () => {
    const clusters = [
      { tag: "verification", count: 4, files: ["a.md", "b.md", "c.md", "d.md"], status: "new" as const },
      { tag: "methodology", count: 4, files: ["a.md", "b.md", "c.md", "z.md"], status: "new" as const },
    ];
    const result = dedupeClusters(clusters);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("verification");
  });

  it("keeps clusters that share less than the containment threshold", () => {
    const clusters = [
      { tag: "auth", count: 4, files: ["a.md", "b.md", "c.md", "d.md"], status: "new" as const },
      { tag: "indexing", count: 4, files: ["a.md", "b.md", "y.md", "z.md"], status: "new" as const },
    ];
    expect(dedupeClusters(clusters)).toHaveLength(2);
  });

  it("does not drop a large cluster into a smaller one", () => {
    const big = Array.from({ length: 20 }, (_, i) => `exp-${i}.md`);
    const clusters = [
      { tag: "convex", count: 20, files: big, status: "new" as const },
      { tag: "clerk", count: 3, files: big.slice(0, 3), status: "new" as const },
    ];
    const result = dedupeClusters(clusters);
    // `clerk` is fully contained, so it goes; `convex` survives.
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe("convex");
  });
});

// --- scanForSkills ---

describe("scanForSkills", () => {
  const makeFile = (name: string, tags: string[]): ExperienceFile => ({
    name,
    content: `---\ntags: [${tags.join(", ")}]\n---\nContent.`,
  });

  it("returns empty result for empty input", () => {
    const result = scanForSkills([], new Map());
    expect(result.clusters).toHaveLength(0);
    expect(result.pendingProposals).toBe(0);
    expect(result.approaching).toBe(0);
  });

  it("full pipeline produces correct clusters", () => {
    const files: ExperienceFile[] = [
      makeFile("exp-001.md", ["auth", "middleware"]),
      makeFile("exp-002.md", ["auth", "validation"]),
      makeFile("exp-003.md", ["auth", "middleware"]),
    ];
    const result = scanForSkills(files, new Map());
    const authCluster = result.clusters.find((c) => c.tag === "auth");
    expect(authCluster).toBeDefined();
    expect(authCluster!.count).toBe(3);
    expect(authCluster!.status).toBe("new");
  });

  it("reports approaching clusters (threshold-1 = 2 files)", () => {
    const files: ExperienceFile[] = [
      makeFile("exp-001.md", ["auth", "sessions"]),
      makeFile("exp-002.md", ["auth", "sessions"]),
      makeFile("exp-003.md", ["auth"]),
    ];
    // auth has 3 → at threshold → cluster
    // sessions has 2 → approaching
    const result = scanForSkills(files, new Map());
    expect(result.approaching).toBeGreaterThanOrEqual(1);
  });

  it("counts pendingProposals as new or growing clusters", () => {
    const files: ExperienceFile[] = [
      makeFile("exp-001.md", ["auth"]),
      makeFile("exp-002.md", ["auth"]),
      makeFile("exp-003.md", ["auth"]),
    ];
    const previous = new Map([["auth", 2]]);
    const result = scanForSkills(files, previous);
    const authCluster = result.clusters.find((c) => c.tag === "auth");
    expect(authCluster?.status).toBe("growing");
    expect(result.pendingProposals).toBeGreaterThanOrEqual(1);
  });

  it("flags oversized clusters and excludes them from pending proposals", () => {
    // One broad tag with 12 experiences — never a single reviewable skill.
    const files: ExperienceFile[] = Array.from({ length: 12 }, (_, i) =>
      makeFile(`exp-${i}.md`, ["deployment"])
    );
    const result = scanForSkills(files, new Map());
    const cluster = result.clusters.find((c) => c.tag === "deployment");
    expect(cluster?.count).toBe(12);
    expect(cluster?.status).toBe("new");
    expect(cluster?.oversized).toBe(true);
    expect(result.pendingProposals).toBe(0);
  });

  it("does not flag clusters at the size cap", () => {
    const files: ExperienceFile[] = Array.from({ length: 8 }, (_, i) =>
      makeFile(`exp-${i}.md`, ["deployment"])
    );
    const result = scanForSkills(files, new Map());
    expect(result.clusters.find((c) => c.tag === "deployment")?.oversized).toBeUndefined();
    expect(result.pendingProposals).toBe(1);
  });

  it("stable clusters do not count as pending proposals", () => {
    const files: ExperienceFile[] = [
      makeFile("exp-001.md", ["auth"]),
      makeFile("exp-002.md", ["auth"]),
      makeFile("exp-003.md", ["auth"]),
    ];
    const previous = new Map([["auth", 3]]);
    const result = scanForSkills(files, previous);
    const authCluster = result.clusters.find((c) => c.tag === "auth");
    expect(authCluster?.status).toBe("stable");
    expect(result.pendingProposals).toBe(0);
  });
});
