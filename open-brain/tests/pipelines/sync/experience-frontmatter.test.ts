import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LEGACY_CLOSED_EXPERIENCE_TYPES,
  checkExperienceFrontmatter,
  experienceFrontmatterResultFromScan,
  experienceTypeViolation,
  scanExperienceFrontmatter,
} from "../../../src/pipelines/sync/checks.js";

const made: string[] = [];
const vault = (): string => {
  const d = mkdtempSync(join(tmpdir(), "t025-vault-"));
  made.push(d);
  return d;
};
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const put = (root: string, rel: string, body: string): void => {
  const p = join(root, ...rel.split("/"));
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
};

function closedListViolation(typeValue: unknown): string | null {
  const base = experienceTypeViolation(typeValue);
  if (base) return base;
  if (typeValue === undefined) return null;
  const v = String(typeValue).trim();
  if (!LEGACY_CLOSED_EXPERIENCE_TYPES.has(v)) return "type is not in the closed list";
  return null;
}

describe("experience-frontmatter — T-025", () => {
  it("R1: the check reports how many experience notes it walked, and the count matches the fixture tree", () => {
    const v = vault();
    put(
      v,
      "Experiences/Self-Improving Agent/no-type.md",
      `---
title: x
project: Self-Improving Agent
---
body`,
    );
    put(
      v,
      "Experiences/Self-Improving Agent/one-token.md",
      `---
type: zaphod
project: Self-Improving Agent
---
body`,
    );
    put(v, "Summaries/ignored.md", "---\ntype: two words\n---\n");
    const scan = scanExperienceFrontmatter(v);
    expect(scan.notes).toHaveLength(2);
    const r = checkExperienceFrontmatter("/unused", v);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("Walked 2 experience note(s)");
    expect(r.message).toContain("LIMIT:");
  });

  it("R2: missing type passes (known positive includes a note with no type key)", () => {
    const v = vault();
    put(v, "Experiences/p/no-type.md", "---\nproject: p\n---\n");
    expect(checkExperienceFrontmatter("/unused", v).severity).toBe("pass");
  });

  it("R3: one free-token type passes, including labels outside the old closed list", () => {
    const v = vault();
    put(v, "Experiences/p/free-label.md", "---\ntype: not-in-legacy-enum\nproject: p\n---\n");
    expect(experienceTypeViolation("not-in-legacy-enum")).toBeNull();
    expect(checkExperienceFrontmatter("/unused", v).severity).toBe("pass");
  });

  it("R4: empty type or two tokens is an issue (known negative)", () => {
    const v = vault();
    put(v, "Experiences/p/empty.md", "---\ntype:\nproject: p\n---\n");
    put(v, "Experiences/p/two.md", "---\ntype: foo bar\nproject: p\n---\n");
    const r = checkExperienceFrontmatter("/unused", v);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("2 experience note(s) with invalid type");
    expect(r.message).toContain("of 2 walked");
    expect(r.message).toMatch(/empty|one token/);
  });

  it("R5: a mutant that enforces the old closed list fails a valid free label", () => {
    expect(experienceTypeViolation("zaphod")).toBeNull();
    expect(closedListViolation("zaphod")).toMatch(/closed list/);
    expect(closedListViolation("gotcha")).toBeNull();
  });

  it("refuses when a note under Experiences/ cannot be read", () => {
    const v = vault();
    put(v, "Experiences/p/ok.md", "---\nproject: p\n---\n");
    const bad = join(v, "Experiences/p/bad.md");
    put(v, "Experiences/p/bad.md", "---\ntype: ok\n---\n");
    const r = checkExperienceFrontmatter("/unused", v, {
      readFile: (p) => {
        if (p === bad) throw Object.assign(new Error("EACCES"), { code: "EACCES" });
        return readFileSync(p, "utf8");
      },
    });
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("could not be read");
    expect(r.message).toContain("This is not a pass");
    expect(r.message).toContain("Walked 1 readable note(s)");
  });

  it("refuses when Experiences/ itself cannot be listed", () => {
    const v = vault();
    mkdirSync(join(v, "Experiences"), { recursive: true });
    const scan = scanExperienceFrontmatter(v, {
      readDir: (p, o) => {
        if (String(p).replace(/\\/g, "/").endsWith("/Experiences")) {
          throw Object.assign(new Error("EACCES"), { code: "EACCES" });
        }
        return readdirSync(p, { withFileTypes: true });
      },
    });
    expect(scan.unreadable.length).toBe(1);
    expect(experienceFrontmatterResultFromScan(scan).severity).toBe("issue");
  });

  it("refuses when Experiences/ exists but cannot be stat'd (EACCES or EPERM)", () => {
    const v = vault();
    mkdirSync(join(v, "Experiences"), { recursive: true });
    put(v, "Experiences/p/two.md", "---\ntype: foo bar\n---\n");
    const deny = (code: "EACCES" | "EPERM") => {
      const r = checkExperienceFrontmatter("/unused", v, {
        stat: (p) => {
          if (String(p).replace(/\\/g, "/").endsWith("/Experiences")) {
            throw Object.assign(new Error(code), { code });
          }
          throw Object.assign(new Error("unexpected stat"), { code: "EINVAL" });
        },
      });
      expect(r.severity).toBe("issue");
      expect(r.message).toContain(code);
      expect(r.message).toContain("This is not a pass");
      expect(r.message).not.toMatch(/Walked 0 experience note\(s\); all type labels/);
    };
    deny("EACCES");
    deny("EPERM");
  });

  it("skips when the vault path is absent (ENOENT)", () => {
    const missing = join(tmpdir(), `t025-no-vault-${Date.now()}`);
    const r = checkExperienceFrontmatter("/unused", missing);
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("ENOENT");
    expect(r.message).toContain("This is not a pass");
  });

  it("skips when Experiences/ is absent (ENOENT), not a Walked 0 pass", () => {
    const v = vault();
    put(v, "Summaries/x.md", "---\ntype: foo bar\n---\n");
    const r = checkExperienceFrontmatter("/unused", v);
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("Experiences/ is absent (ENOENT)");
  });

  it("passes with Walked 0 when Experiences/ is readable and empty", () => {
    const v = vault();
    mkdirSync(join(v, "Experiences"), { recursive: true });
    const r = checkExperienceFrontmatter("/unused", v);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("Walked 0 experience note(s)");
  });

  it("reports non-string type values as issues", () => {
    const v = vault();
    put(v, "Experiences/p/num.md", "---\ntype: 42\n---\n");
    put(v, "Experiences/p/list.md", "---\ntype: [a, b]\n---\n");
    const r = checkExperienceFrontmatter("/unused", v);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("2 experience note(s)");
    expect(r.message).toContain("type is not a string");
  });

  it("reads type from a BOM-prefixed note (invalid multi-token type is an issue)", () => {
    const v = vault();
    const body = "\uFEFF---\ntype: foo bar\nproject: p\n---\nbody";
    put(v, "Experiences/p/bom.md", body);
    const r = checkExperienceFrontmatter("/unused", v);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("one token");
  });
});
