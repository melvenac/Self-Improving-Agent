import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { describeRoleFiles, ROLE_NAMES } from "../../../src/pipelines/session-start/role-files.js";

/**
 * C1's remainder, which is G-032: `.agents/roles/` is tracked and nothing reads
 * it. C1's own acceptance criterion, set 2026-09-17, is *"if `/start` does not
 * consult it, it does not exist."*
 *
 * A tracked file that nothing reads is an intention with a `git add`. These
 * tests are about the reading, and about the two ways the reading can mislead:
 * a file that is not there, and a file whose working copy is not what the
 * repository says it is.
 */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function seedRepo(dir: string, opts: { role?: string; roleFiles?: string[] } = {}): void {
  const role = opts.role ?? "developer";
  const roleFiles = opts.roleFiles ?? ["developer", "shared"];
  mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
  writeFileSync(join(dir, ".agents", "AGENT.md"), `---\nname: Seat\nrole: ${role}\npartner: Other\n---\n\n# Seat\n`);
  for (const f of roleFiles) {
    writeFileSync(join(dir, ".agents", "roles", `${f}.md`), `# ${f}\n\nrules for ${f}\n`);
  }
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "T");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "seed");
}

describe("describeRoleFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "role-files-"));
  });

  afterEach(async () => {
    await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
  });

  it("LOADS the content, not just the names — G-032 is about reading them", () => {
    seedRepo(dir);
    const r = describeRoleFiles(dir, { name: "Seat", role: "developer", partner: "Other" });

    const own = r.files.find((f) => f.rel.endsWith("developer.md"));
    const shared = r.files.find((f) => f.rel.endsWith("shared.md"));
    expect(own?.content).toContain("rules for developer");
    expect(shared?.content).toContain("rules for shared");
  });

  it("names each file AND its commit", () => {
    seedRepo(dir);
    const head = git(dir, "rev-parse", "HEAD");
    const r = describeRoleFiles(dir, { name: "Seat", role: "developer", partner: "Other" });

    for (const f of r.files) {
      expect(f.commit).toBe(head);
    }
    const text = r.lines.join("\n");
    expect(text).toContain(".agents/roles/developer.md");
    expect(text).toContain(".agents/roles/shared.md");
    expect(text).toContain(head.slice(0, 7));
  });

  it("TELLS the seat when its role file is missing, rather than leaving it to notice", () => {
    // The live case at the time this was written: tracked AGENT.md declares
    // `role: builder`, the closed seat set is planner/developer/qa, and there is
    // no .agents/roles/builder.md. A checkout with no AGENT.local.md — the main
    // tree — resolves a role that has no role file.
    seedRepo(dir, { role: "builder", roleFiles: ["developer", "shared"] });
    const r = describeRoleFiles(dir, { name: "Seat", role: "builder", partner: "Other" });

    expect(r.problems.length).toBeGreaterThan(0);
    const text = [...r.lines, ...r.problems].join("\n");
    expect(text).toMatch(/builder/);
    expect(text).toMatch(/missing|not found|absent/i);
    // Silence is the failure mode: an absent role file must not render as a
    // seat that simply has no rules.
    expect(r.files.find((f) => f.rel.endsWith("builder.md"))?.present).toBe(false);
  });

  it("names a role outside the closed seat set as its own problem", () => {
    seedRepo(dir, { role: "builder", roleFiles: ["developer", "shared"] });
    const r = describeRoleFiles(dir, { name: "Seat", role: "builder", partner: "Other" });

    expect(r.problems.join("\n")).toMatch(/planner.*developer.*qa|closed set/i);
    expect(ROLE_NAMES).toEqual(["planner", "developer", "qa"]);
  });

  it("TELLS the seat when the working copy differs from HEAD's blob — the stale case", () => {
    seedRepo(dir);
    writeFileSync(join(dir, ".agents", "roles", "shared.md"), "# shared\n\nEDITED AND NOT COMMITTED\n");

    const r = describeRoleFiles(dir, { name: "Seat", role: "developer", partner: "Other" });
    const shared = r.files.find((f) => f.rel.endsWith("shared.md"));
    expect(shared?.stale).toBe(true);
    expect(r.problems.join("\n")).toMatch(/shared\.md/);
    expect(r.problems.join("\n")).toMatch(/differs|uncommitted|stale/i);

    // And the content actually loaded is the working copy — what the seat would
    // read — not the committed blob it disagrees with.
    expect(shared?.content).toContain("EDITED AND NOT COMMITTED");
  });

  it("does not call an unmodified file stale", () => {
    seedRepo(dir);
    const r = describeRoleFiles(dir, { name: "Seat", role: "developer", partner: "Other" });
    for (const f of r.files) expect(f.stale).toBe(false);
    expect(r.problems).toEqual([]);
  });

  it("reports an UNTRACKED role file as a problem — tracked is the whole point", () => {
    seedRepo(dir);
    writeFileSync(join(dir, ".agents", "roles", "qa.md"), "# qa\n\nnever committed\n");

    const r = describeRoleFiles(dir, { name: "Seat", role: "qa", partner: "Other" });
    const own = r.files.find((f) => f.rel.endsWith("qa.md"));
    expect(own?.present).toBe(true);
    expect(own?.tracked).toBe(false);
    expect(own?.commit).toBeNull();
    expect(r.problems.join("\n")).toMatch(/qa\.md/);
    expect(r.problems.join("\n")).toMatch(/untracked|not tracked/i);
  });

  it("SKIPS commit resolution with a reason outside a git repository, and never invents one", () => {
    mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
    writeFileSync(join(dir, ".agents", "roles", "developer.md"), "# developer\n");
    writeFileSync(join(dir, ".agents", "roles", "shared.md"), "# shared\n");

    const r = describeRoleFiles(dir, { name: "Seat", role: "developer", partner: "Other" });
    for (const f of r.files) {
      expect(f.present).toBe(true);
      expect(f.commit).toBeNull();
      expect(f.note).toBeTruthy();
    }
    expect(r.lines.join("\n")).toMatch(/not .*git|no commit/i);
  });

  it("says so when there is no seat identity at all, rather than loading nothing quietly", () => {
    seedRepo(dir);
    const r = describeRoleFiles(dir, null);
    expect(r.problems.join("\n")).toMatch(/identity|seat/i);
    // shared.md is every seat's, so it still loads even with no identity.
    expect(r.files.find((f) => f.rel.endsWith("shared.md"))?.content).toContain("rules for shared");
  });

  it("records HEAD-behind-upstream for a role file without calling it stale", () => {
    // Atlas's ruling: stale is the working tree vs HEAD's blob (required);
    // HEAD behind origin/master for that path is RECORDED ONLY. The two are
    // different conditions and a seat must not read one as the other.
    const origin = join(dir, "origin.git");
    const seed = join(dir, "seed");
    const clone = join(dir, "clone");
    mkdirSync(origin);
    mkdirSync(seed);
    git(origin, "init", "-q", "--bare", "-b", "master");
    seedRepo(seed);
    git(seed, "remote", "add", "origin", origin);
    git(seed, "push", "-q", "origin", "master");
    execFileSync("git", ["clone", "-q", origin, clone], { stdio: ["ignore", "pipe", "pipe"] });

    // Upstream moves the role file; the clone does not fetch it into its tree.
    writeFileSync(join(seed, ".agents", "roles", "shared.md"), "# shared\n\nNEW UPSTREAM RULE\n");
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "upstream rule");
    git(seed, "push", "-q", "origin", "master");
    git(clone, "fetch", "-q", "origin");

    const r = describeRoleFiles(clone, { name: "Seat", role: "developer", partner: "Other" });
    const shared = r.files.find((f) => f.rel.endsWith("shared.md"));
    expect(shared?.stale).toBe(false);
    expect(shared?.behindUpstream).toBe(true);

    // The other half, and it is not decoration: with only the positive asserted,
    // hardcoding `behindUpstream` to true passed all ten tests. The one file the
    // upstream did NOT move must come back false in the same repository, or the
    // flag is only ever confirmed in the direction it was written to find.
    const own = r.files.find((f) => f.rel.endsWith("developer.md"));
    expect(own?.behindUpstream).toBe(false);
  });

  it("reports behindUpstream false when there is no upstream to compare against", () => {
    // Unanswerable must not read as positive. A repo with no origin/master can
    // say nothing about being behind it, and "false" here means "no observation",
    // which is why the line renders nothing rather than "up to date".
    seedRepo(dir);
    const r = describeRoleFiles(dir, { name: "Seat", role: "developer", partner: "Other" });
    for (const f of r.files) expect(f.behindUpstream).toBe(false);
    expect(r.lines.join("\n")).not.toMatch(/behind origin\/master/);
  });
});
