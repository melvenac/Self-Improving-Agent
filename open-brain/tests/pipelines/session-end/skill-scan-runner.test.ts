import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
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

/**
 * Regression cover for graduation detection.
 *
 * SKILL-INDEX.md is a markdown table, but the reader matched
 * `### tag (N experiences) … has skill` — the shape of SKILL-CANDIDATES.md. It
 * never matched, so the set was always empty and every distilled skill kept
 * being re-proposed as an undistilled candidate. A missing index and a fully
 * populated one produced byte-identical output, which is what hid it.
 */
describe("runSkillScanPipeline graduation detection", () => {
  let vaultDir: string;

  function writeExperience(name: string, tags: string[]): void {
    const dir = join(vaultDir, "Experiences", "General");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.md`), `---\ntags: [${tags.join(", ")}]\n---\n\n# ${name}\n`);
  }

  function writeIndex(body: string): void {
    const dir = join(vaultDir, "Skill-Candidates");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL-INDEX.md"), body);
  }

  const candidates = (): string =>
    readFileSync(join(vaultDir, "Skill-Candidates", "SKILL-CANDIDATES.md"), "utf8");

  beforeEach(() => {
    vaultDir = mkdtempSync(join(tmpdir(), "ob-graduation-"));
    process.env.OPEN_BRAIN_VAULT_DIR = vaultDir;
    for (const n of ["alpha", "beta", "gamma"]) writeExperience(n, ["convex"]);
  });

  afterEach(() => {
    delete process.env.OPEN_BRAIN_VAULT_DIR;
  });

  it("marks a cluster as graduated when the index lists its domain", () => {
    writeIndex(
      "# Skill Index\n\n## Skills\n\n"
      + "| Name | File | Domain | Problem Class | Source Project | Version |\n"
      + "|---|---|---|---|---|---|\n"
      + "| Convex Development Patterns | `convex.md` | convex | data-modeling | Open Brain | 1.0 |\n",
    );

    runSkillScanPipeline();

    expect(candidates()).toContain("### convex (3 experiences) — has skill");
  });

  it("splits a multi-domain cell so every tag graduates", () => {
    for (const n of ["one", "two", "three"]) writeExperience(n, ["traefik"]);
    writeIndex(
      "# Skill Index\n\n## Skills\n\n"
      + "| Name | File | Domain | Problem Class | Source Project | Version |\n"
      + "|---|---|---|---|---|---|\n"
      + "| Docker VPS Deployment | `docker.md` | docker, traefik | deployment | Mail Server | 1.0 |\n",
    );

    runSkillScanPipeline();

    expect(candidates()).toContain("### traefik (3 experiences) — has skill");
  });

  it("does not graduate a domain that only appears under Pending Proposals", () => {
    writeIndex(
      "# Skill Index\n\n## Skills\n\n"
      + "| Name | File | Domain | Problem Class | Source Project | Version |\n"
      + "|---|---|---|---|---|---|\n\n"
      + "## Pending Proposals\n\n"
      + "| Proposed Skill | Related Experiences | Domain | Status |\n"
      + "|---|---|---|---|\n"
      + "| Convex Patterns | 3 notes | convex | proposed |\n",
    );

    runSkillScanPipeline();

    expect(candidates()).not.toContain("has skill");
  });

  it("does not treat the header or separator row as a domain", () => {
    writeIndex(
      "# Skill Index\n\n## Skills\n\n"
      + "| Name | File | Domain | Problem Class | Source Project | Version |\n"
      + "|---|---|---|---|---|---|\n",
    );

    runSkillScanPipeline();

    expect(candidates()).not.toContain("has skill");
  });
});
