import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runSkillScanPipeline } from "../../../src/pipelines/session-end/skill-scan-runner.js";

/**
 * Regression cover for the v1→v2 vault layout change.
 *
 * v1 stored experiences flat in Experiences/; v2 files them under a project
 * subdirectory. The reader was a flat readdir, so after the vault was repointed
 * it saw 1 note out of 399 and reported zero clusters — indistinguishable from
 * a healthy scan that found nothing worth clustering.
 */
describe("runSkillScanPipeline vault layout", () => {
  let vaultDir: string;

  function writeExperience(relDir: string, name: string, tags: string[]): void {
    const dir = join(vaultDir, "Experiences", relDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.md`),
      `---\ntags: [${tags.join(", ")}]\n---\n\n# ${name}\n\nBody text.\n`,
    );
  }

  beforeEach(() => {
    vaultDir = mkdtempSync(join(tmpdir(), "ob-skillscan-"));
    process.env.OPEN_BRAIN_VAULT_DIR = vaultDir;
  });

  afterEach(() => {
    delete process.env.OPEN_BRAIN_VAULT_DIR;
  });

  it("finds experiences nested under project subdirectories (v2 layout)", () => {
    writeExperience("General", "alpha", ["convex"]);
    writeExperience("A2A-Hub", "beta", ["convex"]);
    writeExperience("Mail-Server", "gamma", ["convex"]);

    const result = runSkillScanPipeline();

    expect(result.clusters).toBeGreaterThan(0);
  });

  it("still finds experiences stored flat (v1 layout)", () => {
    writeExperience(".", "alpha", ["convex"]);
    writeExperience(".", "beta", ["convex"]);
    writeExperience(".", "gamma", ["convex"]);

    const result = runSkillScanPipeline();

    expect(result.clusters).toBeGreaterThan(0);
  });

  it("returns an empty result rather than throwing when Experiences/ is absent", () => {
    const result = runSkillScanPipeline();

    expect(result).toEqual({ clusters: 0, pendingProposals: 0, approaching: 0 });
  });

  it("creates Skill-Candidates/ when the vault has no such directory yet", () => {
    writeExperience("General", "alpha", ["convex"]);
    writeExperience("General", "beta", ["convex"]);
    writeExperience("General", "gamma", ["convex"]);

    expect(() => runSkillScanPipeline()).not.toThrow();
  });
});
