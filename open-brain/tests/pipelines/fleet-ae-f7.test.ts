import { describe, it, expect } from "vitest";
import { cpSync, readFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";

const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");

describe("F7: set_standing refuses unknown id", () => {
  it("set_standing on an unknown id refuses and writes nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "fleet-ae-f7-"));
    try {
      mkdirSync(join(root, ".agents"), { recursive: true });
      cpSync(stateFixture, join(root, ".agents/state.json"));
      const before = readFileSync(join(root, ".agents/state.json"), "utf8");
      const r = applyStateOps(root, {
        session: 55,
        expected_revision: 7,
        ops: [{ op: "set_standing", id: "D-404", standing: true }],
      });
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/unknown decision D-404/);
      expect(readFileSync(join(root, ".agents/state.json"), "utf8")).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
