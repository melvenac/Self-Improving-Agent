import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  slugify,
  writeExperience,
  writeFailure,
  writeSummary,
  parseFrontmatter,
} from "../src/vault-writer.js";

let tmpDirs: string[] = [];

function makeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "vault-writer-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of tmpDirs) {
    rmSync(d, { recursive: true, force: true });
  }
  tmpDirs = [];
});

// ─── slugify ────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("lowercases everything", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips special characters", () => {
    expect(slugify("foo: bar! baz?")).toBe("foo-bar-baz");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("a  --  b")).toBe("a-b");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("handles alphanumeric + hyphens only", () => {
    expect(slugify("use_snake-case & stuff")).toBe("use-snake-case-stuff");
  });
});

// ─── writeExperience ────────────────────────────────────────────────────────

describe("writeExperience", () => {
  it("creates file in Experiences/{project}/{slug}.md", () => {
    const vault = makeTmp();
    const input = {
      key: "my experience key",
      tags: ["typescript", "testing"],
      content: "This is the body content.",
      created: "2024-01-15T10:00:00.000Z",
      maturity: "progenitor" as const,
      helpful: 0,
      harmful: 0,
      neutral: 0,
      project: "Self-Improving-Agent",
      source: "session-end",
    };

    const filePath = writeExperience(vault, input);
    expect(filePath).toBeTruthy();
    expect(filePath).toContain("Experiences");
    expect(filePath).toContain("Self-Improving-Agent");
    expect(existsSync(filePath!)).toBe(true);
  });

  it("writes correct YAML frontmatter", () => {
    const vault = makeTmp();
    const input = {
      key: "test key",
      tags: ["alpha", "beta"],
      content: "Body text here.",
      created: "2024-03-01T00:00:00.000Z",
      maturity: "proven" as const,
      helpful: 3,
      harmful: 1,
      neutral: 2,
      project: "my-project",
      source: "manual",
    };

    const filePath = writeExperience(vault, input)!;
    const raw = readFileSync(filePath, "utf-8");

    expect(raw).toContain("key: test key");
    expect(raw).toContain("tags: [alpha, beta]");
    expect(raw).toContain("maturity: proven");
    expect(raw).toContain("helpful: 3");
    expect(raw).toContain("harmful: 1");
    expect(raw).toContain("neutral: 2");
    expect(raw).toContain("project: my-project");
    expect(raw).toContain("source: manual");
    expect(raw).toContain("Body text here.");
  });

  it("returns null if file already exists (dedup)", () => {
    const vault = makeTmp();
    const input = {
      key: "duplicate key",
      tags: [],
      content: "Content.",
      created: "2024-01-01T00:00:00.000Z",
      maturity: "progenitor" as const,
      helpful: 0,
      harmful: 0,
      neutral: 0,
      project: "proj",
      source: "test",
    };

    const first = writeExperience(vault, input);
    const second = writeExperience(vault, input);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("places file in project subdirectory", () => {
    const vault = makeTmp();
    const input = {
      key: "scoped entry",
      tags: [],
      content: "Content.",
      created: "2024-01-01T00:00:00.000Z",
      maturity: "mature" as const,
      helpful: 7,
      harmful: 0,
      neutral: 1,
      project: "ProjectX",
      source: "session",
    };

    const filePath = writeExperience(vault, input)!;
    expect(filePath).toContain(join("Experiences", "ProjectX"));
  });
});

// ─── writeFailure ────────────────────────────────────────────────────────────

describe("writeFailure", () => {
  it("creates failure-.md in Experiences/{project}/", () => {
    const vault = makeTmp();
    const input = {
      key: "some failure",
      tags: ["debugging"],
      attempted: "Tried to fix the bug by restarting.",
      why_failed: "Root cause was a race condition.",
      what_worked: "Added a mutex lock.",
      created: "2024-05-10T08:00:00.000Z",
      project: "MyApp",
    };

    const filePath = writeFailure(vault, input);
    expect(filePath).toBeTruthy();
    expect(filePath).toContain("failure-");
    expect(filePath).toContain("Experiences");
    expect(existsSync(filePath!)).toBe(true);
  });

  it("includes type: failure in frontmatter", () => {
    const vault = makeTmp();
    const input = {
      key: "bad deploy",
      tags: ["ops"],
      attempted: "Deployed without staging.",
      why_failed: "Missing env vars.",
      what_worked: "Added staging pipeline.",
      created: "2024-05-10T08:00:00.000Z",
      project: "Infra",
    };

    const filePath = writeFailure(vault, input)!;
    const raw = readFileSync(filePath, "utf-8");
    expect(raw).toContain("type: failure");
  });

  it("includes structured body sections", () => {
    const vault = makeTmp();
    const input = {
      key: "network error",
      tags: [],
      attempted: "Used HTTP without retry.",
      why_failed: "Flaky network dropped packets.",
      what_worked: "Added exponential backoff.",
      created: "2024-05-10T08:00:00.000Z",
      project: "NetLib",
    };

    const filePath = writeFailure(vault, input)!;
    const raw = readFileSync(filePath, "utf-8");
    expect(raw).toContain("What was attempted");
    expect(raw).toContain("Why it failed");
    expect(raw).toContain("What worked instead");
    expect(raw).toContain("Used HTTP without retry.");
    expect(raw).toContain("Flaky network dropped packets.");
    expect(raw).toContain("Added exponential backoff.");
  });

  it("returns null if failure file already exists", () => {
    const vault = makeTmp();
    const input = {
      key: "repeat failure",
      tags: [],
      attempted: "x",
      why_failed: "y",
      what_worked: "z",
      created: "2024-01-01T00:00:00.000Z",
      project: "proj",
    };

    const first = writeFailure(vault, input);
    const second = writeFailure(vault, input);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});

// ─── writeSummary ────────────────────────────────────────────────────────────

describe("writeSummary", () => {
  it("creates summary in Summaries/{date}-{project-slug}.md", () => {
    const vault = makeTmp();
    const input = {
      sessionId: "sess-001",
      project: "My Project",
      date: "2024-06-20",
      model: "claude-3-5-sonnet",
      content: "Session summary content goes here.",
    };

    const filePath = writeSummary(vault, input);
    expect(filePath).toBeTruthy();
    expect(filePath).toContain("Summaries");
    expect(filePath).toContain("2024-06-20");
    expect(existsSync(filePath!)).toBe(true);
  });

  it("slugifies project name in filename", () => {
    const vault = makeTmp();
    const input = {
      sessionId: "sess-002",
      project: "Self-Improving Agent",
      date: "2024-07-01",
      model: "claude-sonnet",
      content: "Summary.",
    };

    const filePath = writeSummary(vault, input)!;
    expect(filePath).toContain("self-improving-agent");
  });

  it("writes content to the file", () => {
    const vault = makeTmp();
    const input = {
      sessionId: "sess-003",
      project: "TestProj",
      date: "2024-08-15",
      model: "claude-opus",
      content: "Important session insights.",
    };

    const filePath = writeSummary(vault, input)!;
    const raw = readFileSync(filePath, "utf-8");
    expect(raw).toContain("Important session insights.");
    expect(raw).toContain("sess-003");
  });
});

// ─── parseFrontmatter ────────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("round-trips frontmatter written by writeExperience", () => {
    const vault = makeTmp();
    const input = {
      key: "round-trip test",
      tags: ["a", "b", "c"],
      content: "Body.",
      created: "2024-09-01T00:00:00.000Z",
      maturity: "proven" as const,
      helpful: 5,
      harmful: 2,
      neutral: 1,
      project: "TestProject",
      source: "unit-test",
    };

    const filePath = writeExperience(vault, input)!;
    const raw = readFileSync(filePath, "utf-8");
    const fm = parseFrontmatter(raw);

    expect(fm.key).toBe("round-trip test");
    expect(fm.maturity).toBe("proven");
    expect(fm.helpful).toBe(5);
    expect(fm.harmful).toBe(2);
    expect(fm.neutral).toBe(1);
    expect(Array.isArray(fm.tags)).toBe(true);
    expect(fm.tags).toContain("a");
    expect(fm.tags).toContain("b");
  });

  it("parses numbers as numbers", () => {
    const raw = `---\nhelpful: 7\nharmful: 0\n---\nbody`;
    const fm = parseFrontmatter(raw);
    expect(fm.helpful).toBe(7);
    expect(typeof fm.helpful).toBe("number");
  });

  it("parses arrays as arrays", () => {
    const raw = `---\ntags: [foo, bar, baz]\n---\nbody`;
    const fm = parseFrontmatter(raw);
    expect(Array.isArray(fm.tags)).toBe(true);
    expect(fm.tags).toEqual(["foo", "bar", "baz"]);
  });

  it("returns empty object for no frontmatter", () => {
    const raw = `just some content without frontmatter`;
    const fm = parseFrontmatter(raw);
    expect(fm).toEqual({});
  });
});
