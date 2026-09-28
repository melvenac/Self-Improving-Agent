import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { checkProbeMarkers } from "../../../src/pipelines/sync/probe-markers.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "probe-markers-"));
  dirs.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, body);
  }
  return root;
}

describe("probe-markers", () => {
  it("a file under open-brain/tests that says not for merge is an issue naming the file", () => {
    const root = fixture({
      "open-brain/tests/harness/kept.test.ts": "it('ok', () => {});\n",
      "open-brain/tests/harness/probe.test.ts": "/** QA PROBE, not for merge. */\n",
    });
    const r = checkProbeMarkers(root);
    expect(r.severity).toBe("issue");
    expect(r.report).toBe(true);
    expect(r.message).toContain("open-brain/tests/harness/probe.test.ts");
    expect(r.message).toContain("not for merge");
    expect(r.message).not.toContain("kept.test.ts");
  });

  it("a tree with no such phrase passes and says how many files were read", () => {
    const root = fixture({
      "open-brain/tests/a.test.ts": "it('not-for-merge is a hyphen, not the phrase', () => {});\n",
      "open-brain/tests/nested/b.test.ts": "export const n = 1;\n",
    });
    const r = checkProbeMarkers(root);
    expect(r.severity).toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toContain("Read 2");
    expect(r.message).toContain("not for merge");
    expect(r.message).toContain("LIMIT");
  });

  it("a missing tests directory is not a pass", () => {
    const root = fixture({ "README.md": "no tests here\n" });
    const r = checkProbeMarkers(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("open-brain/tests");
    expect(r.message).toContain("not a pass");
  });

  it("index.ts runs the check", () => {
    const src = readFileSync(new URL("../../../src/pipelines/sync/index.ts", import.meta.url), "utf8");
    expect(src).toContain("checks.push(checkProbeMarkers(options.projectRoot))");
  });
});
