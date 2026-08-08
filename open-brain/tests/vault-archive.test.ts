import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { archiveVaultNote, experiencePath, writeExperience } from "../src/vault-writer.js";

/**
 * Cover for the two halves of the vault<->index seam found in the v0.12.0 audit:
 * deletion left the markdown behind, and an existing note had no way into the
 * index. Both let the vault and the DB disagree silently.
 */
describe("archiveVaultNote", () => {
  let vault: string;

  beforeEach(() => {
    vault = mkdtempSync(join(tmpdir(), "ob-archive-"));
  });
  afterEach(() => {
    rmSync(vault, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  function note(rel: string, body = "# note\n"): string {
    const full = join(vault, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
    return full;
  }

  it("moves a note into Archive/ preserving its relative path", () => {
    const src = note("Experiences/General/a.md");
    const dest = archiveVaultNote(vault, src);

    expect(dest).toBe(join(vault, "Archive", "Experiences", "General", "a.md"));
    expect(existsSync(src)).toBe(false);
    expect(existsSync(dest!)).toBe(true);
  });

  it("takes the note out of the scanned corpus, which is the point", () => {
    // skill-scan reads Experiences/ recursively; a deleted entry that stays
    // there keeps inflating clusters while ob_recall can no longer reach it.
    const src = note("Experiences/General/counted.md");
    archiveVaultNote(vault, src);

    const remaining = readdirSync(join(vault, "Experiences", "General"));
    expect(remaining).toHaveLength(0);
  });

  it("does not destroy an existing archived note of the same name", () => {
    const first = note("Experiences/General/dup.md", "first\n");
    archiveVaultNote(vault, first);
    const second = note("Experiences/ProjX/dup.md", "second\n");

    // Same basename, different origin — the second must not overwrite the first.
    const dest = archiveVaultNote(vault, second);
    expect(dest).not.toBe(join(vault, "Archive", "Experiences", "General", "dup.md"));
    expect(existsSync(join(vault, "Archive", "Experiences", "General", "dup.md"))).toBe(true);
    expect(existsSync(dest!)).toBe(true);
  });

  it("returns null for a missing file rather than throwing", () => {
    expect(archiveVaultNote(vault, join(vault, "Experiences", "nope.md"))).toBeNull();
    expect(archiveVaultNote(vault, null)).toBeNull();
  });

  it("refuses to relocate a path outside the vault", () => {
    const outside = mkdtempSync(join(tmpdir(), "ob-outside-"));
    const stray = join(outside, "stray.md");
    writeFileSync(stray, "x\n");

    expect(archiveVaultNote(vault, stray)).toBeNull();
    expect(existsSync(stray)).toBe(true);
    rmSync(outside, { recursive: true, force: true });
  });

  it("agrees with writeExperience on where a note lives", () => {
    const written = writeExperience(vault, {
      key: "Some Key", tags: ["a"], content: "body", created: "2026-08-08T00:00:00.000Z",
      maturity: "progenitor", helpful: 0, harmful: 0, neutral: 0, project: "General", source: "test",
    });
    expect(written).toBe(experiencePath(vault, "General", "Some Key"));
  });
});
