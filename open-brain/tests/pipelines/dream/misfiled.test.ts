import { describe, it, expect } from "vitest";
import { findMisfiled } from "../../../src/pipelines/dream/rules.js";
import { entry } from "./fixtures.js";

describe("findMisfiled", () => {
  it("flags a [CHECKPOINT] row in knowledge_index", () => {
    const found = findMisfiled([entry({ id: 1, content: "[CHECKPOINT] Session 40 — mid-session state." })]);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("misfiled");
    expect(found[0].targetIds).toEqual([1]);
    expect(found[0].summary).toContain("chunks");
  });

  it("flags a [SUMMARY] row", () => {
    const found = findMisfiled([entry({ id: 2, content: "[SUMMARY] What happened this session." })]);
    expect(found).toHaveLength(1);
  });

  it("matches the marker in the key as well as the content", () => {
    const found = findMisfiled([entry({ id: 3, key: "[CHECKPOINT]-session-12", content: "body" })]);
    expect(found).toHaveLength(1);
  });

  it("requires the marker to open the row", () => {
    // An entry *about* checkpoints is durable knowledge and belongs where it is.
    const found = findMisfiled([
      entry({ id: 4, content: "Checkpoints written as [CHECKPOINT] rows belong in chunks, per entry #138." }),
    ]);
    expect(found).toHaveLength(0);
  });

  it("leaves ordinary entries alone", () => {
    const found = findMisfiled([
      entry({ id: 5, content: "Node v22 is required; v24 breaks Smart Connections." }),
      entry({ id: 6, content: "The vault lives at ~/Obsidian Vault v2." }),
    ]);
    expect(found).toHaveLength(0);
  });

  it("ignores archived rows", () => {
    const found = findMisfiled([entry({ id: 7, content: "[CHECKPOINT] old", archived_into: 99 })]);
    expect(found).toHaveLength(0);
  });
});
