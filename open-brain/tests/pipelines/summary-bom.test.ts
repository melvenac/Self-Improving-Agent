import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";

/**
 * T-186 through the real writer: a SUMMARY.md saved with a UTF-8 BOM (Windows editors do this) must come
 * out of a state write with its BOM first on disk and the generated region right after the title.
 */
describe("SUMMARY.md with a BOM through applyStateOps (T-186)", () => {
  let dir: string;
  const BOM_BYTES = Buffer.from([0xef, 0xbb, 0xbf]);
  const summary = () => join(dir, ".agents", "SYSTEM", "SUMMARY.md");

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t186-"));
    for (const d of ["TASKS", "SESSIONS", "SYSTEM"]) mkdirSync(join(dir, ".agents", d), { recursive: true });
    writeFileSync(join(dir, "package.json"), '{"version":"1.0.0"}');
    cpSync(join(import.meta.dirname, "../fixtures-state/state.json"), join(dir, ".agents", "state.json"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  function write(): void {
    const rev = JSON.parse(readFileSync(join(dir, ".agents", "state.json"), "utf8")).revision;
    const r = applyStateOps(dir, { session: 200, expected_revision: rev, session_uuid: "aaaaaaaa-0000-4000-8000-00000000000a", checkout: "sia-forge", render: true, ops: [{ op: "set_objective", text: "T-186 fixture" }] });
    if (!r.ok) throw new Error(r.error);
  }

  it("a BOM'd SUMMARY.md keeps its BOM first and gets the region after the title", () => {
    writeFileSync(summary(), Buffer.concat([BOM_BYTES, Buffer.from("# Project Summary\n\nHand-written intro.\n", "utf8")]));
    write();
    const bytes = readFileSync(summary());
    expect(bytes.subarray(0, 3).equals(BOM_BYTES)).toBe(true);
    const text = bytes.toString("utf8");
    expect(text.startsWith("﻿# Project Summary\n\n")).toBe(true);
    expect(text.indexOf("<!-- ")).toBeGreaterThan(text.indexOf("# Project Summary"));
    expect(text.lastIndexOf("﻿")).toBe(0);
    expect(text).toContain("Hand-written intro.");
    expect(text).toContain("T-186 fixture");
  });

  it("a SUMMARY.md without a BOM is written without one, and a second write is stable", () => {
    writeFileSync(summary(), "# Project Summary\n\nHand-written intro.\n", "utf8");
    write();
    const first = readFileSync(summary());
    expect(first.subarray(0, 3).equals(BOM_BYTES)).toBe(false);
    expect(first.toString("utf8").startsWith("# Project Summary\n\n")).toBe(true);
    write();
    const second = readFileSync(summary()).toString("utf8");
    expect(second.startsWith("# Project Summary\n\n")).toBe(true);
    expect(second.includes("﻿")).toBe(false);
  });
});
