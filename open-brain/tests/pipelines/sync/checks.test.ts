import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import {
  syncReadmeVersion,
  syncPrdVersion,
  syncKmcpVersion,
} from "../../../src/pipelines/sync/checks.js";

const fixturesDir = join(import.meta.dirname, "../../fixtures");

describe("version sync checks", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ob-sync-"));
    cpSync(fixturesDir, tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("syncReadmeVersion", () => {
    it("detects version mismatch and fixes it", () => {
      const result = syncReadmeVersion("0.6.0", tempDir, false);
      expect(result.severity).toBe("fixed");
      expect(result.autoFixed).toBe(true);
      const readme = readFileSync(join(tempDir, "README.md"), "utf-8");
      expect(readme).toContain("**Latest: v0.6.0**");
    });

    it("reports mismatch without fixing in check-only mode", () => {
      const result = syncReadmeVersion("0.6.0", tempDir, true);
      expect(result.severity).toBe("issue");
      expect(result.autoFixed).toBeUndefined();
      const readme = readFileSync(join(tempDir, "README.md"), "utf-8");
      expect(readme).toContain("**Latest: v0.5.0**");
    });

    it("passes when versions match", () => {
      const result = syncReadmeVersion("0.5.0", tempDir, false);
      expect(result.severity).toBe("pass");
    });

    it("warns when README.md is missing", () => {
      const result = syncReadmeVersion("0.6.0", join(tempDir, "nonexistent"), false);
      expect(result.severity).toBe("warn");
    });

    it("warns when README has no version pattern", () => {
      writeFileSync(join(tempDir, "README.md"), "# No version here\n");
      const result = syncReadmeVersion("0.6.0", tempDir, false);
      expect(result.severity).toBe("warn");
    });
  });

  describe("syncPrdVersion", () => {
    it("detects PRD version mismatch and fixes it", () => {
      const result = syncPrdVersion("0.6.0", tempDir, false);
      expect(result.severity).toBe("fixed");
      const prd = readFileSync(join(tempDir, "docs", "PRD.md"), "utf-8");
      expect(prd).toContain("| Version | 0.6.0 |");
    });

    it("passes when versions match", () => {
      const result = syncPrdVersion("0.5.0", tempDir, false);
      expect(result.severity).toBe("pass");
    });

    it("reports mismatch without fixing in check-only mode", () => {
      const result = syncPrdVersion("0.6.0", tempDir, true);
      expect(result.severity).toBe("issue");
      const prd = readFileSync(join(tempDir, "docs", "PRD.md"), "utf-8");
      expect(prd).toContain("| Version | 0.5.0 |");
    });

    it("warns when PRD.md is missing", () => {
      const result = syncPrdVersion("0.6.0", join(tempDir, "nonexistent"), false);
      expect(result.severity).toBe("warn");
    });
  });

  describe("syncKmcpVersion", () => {
    it("detects knowledge-mcp version mismatch and fixes it", () => {
      const result = syncKmcpVersion("0.6.0", tempDir, false);
      expect(result.severity).toBe("fixed");
      const kmcp = JSON.parse(
        readFileSync(join(tempDir, "knowledge-mcp", "package.json"), "utf-8")
      );
      expect(kmcp.version).toBe("0.6.0");
    });

    it("passes when versions match", () => {
      const result = syncKmcpVersion("0.5.0", tempDir, false);
      expect(result.severity).toBe("pass");
    });

    it("reports mismatch without fixing in check-only mode", () => {
      const result = syncKmcpVersion("0.6.0", tempDir, true);
      expect(result.severity).toBe("issue");
      const kmcp = JSON.parse(readFileSync(join(tempDir, "knowledge-mcp", "package.json"), "utf-8"));
      expect(kmcp.version).toBe("0.5.0");
    });

    it("warns when knowledge-mcp/package.json is missing", () => {
      const result = syncKmcpVersion("0.6.0", join(tempDir, "nonexistent"), false);
      expect(result.severity).toBe("warn");
    });
  });
});
