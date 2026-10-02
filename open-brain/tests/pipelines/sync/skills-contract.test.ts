import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { checkSkillsContract } from "../../../src/pipelines/sync/checks.js";

/**
 * T-051: each skill has three identities (directory, SKILL.md frontmatter `name`, INDEX.md
 * row) and they must agree. Fixture trees for the rows; the last test runs the real tree.
 */
describe("checkSkillsContract (T-051)", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t051-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const skills = () => join(root, ".agents", "skills");
  function skill(dir: string, body: string | null): void {
    mkdirSync(join(skills(), dir), { recursive: true });
    if (body !== null) writeFileSync(join(skills(), dir, "SKILL.md"), body);
  }
  const fm = (name: string) => `---\nname: ${name}\ndescription: d\n---\n\n# ${name}\n`;
  function index(rows: Array<[string, string]>): void {
    mkdirSync(skills(), { recursive: true });
    const table = rows.map(([s, d]) => `| ${s} | \`${d}/\` | some description | 2026-01-01 |`).join("\n");
    writeFileSync(join(skills(), "INDEX.md"), `# Skills Index\n\n## Registered Skills\n\n| Skill | Directory | Description | Created |\n|---|---|---|---|\n${table}\n`);
  }

  it("passes when all three identities agree for every skill", () => {
    skill("alpha", fm("alpha"));
    skill("beta", fm("beta"));
    index([["alpha", "alpha"], ["beta", "beta"]]);
    const r = checkSkillsContract(root);
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).toContain("2 skill(s)");
  });

  it("row 1: a SKILL.md with no frontmatter is a finding naming the directory, the missing name and the index row", () => {
    skill("alpha", fm("alpha"));
    skill("guide", "# Guide\n\nno frontmatter at all\n");
    index([["alpha", "alpha"], ["guide", "guide"]]);
    const r = checkSkillsContract(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain('directory guide; SKILL.md name none (no frontmatter); INDEX.md row "guide" -> guide/');
  });

  it("row 2: a frontmatter name that differs from the directory is a finding with both names", () => {
    skill("gotchas", fm("self-improving-agent-gotchas"));
    index([["self-improving-agent-gotchas", "self-improving-agent-gotchas"]]);
    const r = checkSkillsContract(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain('directory gotchas; SKILL.md name "self-improving-agent-gotchas"; INDEX.md no row');
    expect(r.message).toContain('directory absent; SKILL.md name none (no directory); INDEX.md row "self-improving-agent-gotchas" -> self-improving-agent-gotchas/');
  });

  it("row 3: an INDEX row with no directory is a finding", () => {
    skill("alpha", fm("alpha"));
    index([["alpha", "alpha"], ["phantom", "phantom"]]);
    const r = checkSkillsContract(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain('directory absent; SKILL.md name none (no directory); INDEX.md row "phantom" -> phantom/');
  });

  it("row 4: a directory with no INDEX row is a finding", () => {
    skill("alpha", fm("alpha"));
    skill("unlisted", fm("unlisted"));
    index([["alpha", "alpha"]]);
    const r = checkSkillsContract(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain('directory unlisted; SKILL.md name "unlisted"; INDEX.md no row');
  });

  it("a directory with no SKILL.md, and a frontmatter with no name, are findings", () => {
    skill("empty", null);
    skill("nameless", "---\ndescription: only\n---\n\n# x\n");
    index([["empty", "empty"], ["nameless", "nameless"]]);
    const r = checkSkillsContract(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("directory empty; SKILL.md name none (no SKILL.md)");
    expect(r.message).toContain("directory nameless; SKILL.md name none (frontmatter has no name)");
  });

  it("an INDEX row whose Skill cell is not the directory name is a finding", () => {
    skill("alpha", fm("alpha"));
    index([["Alpha Skill", "alpha"]]);
    const r = checkSkillsContract(root);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain('row "Alpha Skill" -> alpha/');
  });

  it("skills but no INDEX.md is a finding; no .agents/skills at all is SKIP, not a pass", () => {
    skill("alpha", fm("alpha"));
    const noIndex = checkSkillsContract(root);
    expect(noIndex.severity).toBe("issue");
    expect(noIndex.message).toContain("INDEX.md does not exist");
    const empty = mkdtempSync(join(tmpdir(), "t051-empty-"));
    try {
      const r = checkSkillsContract(empty);
      expect(r.severity).toBe("skip");
      expect(r.message).toMatch(/^not checked: .*This is not a pass\./);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("the real tree: this repository's .agents/skills agree", () => {
    const r = checkSkillsContract(resolve(import.meta.dirname, "../../../.."));
    expect(r.severity, r.message).toBe("pass");
  });
});
