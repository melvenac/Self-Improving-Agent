import { describe, it, expect, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkVaultPollution, scanVaultForTestArtifacts } from "../../../src/pipelines/sync/vault-pollution.js";

/**
 * T-042: vault pollution had a preventer (the isolation in tests/setup-env.ts and the throw in obsidianVaultDir) and no
 * detector. The 13 files named ob-server-<slug>.md that the suite wrote into the real vault were found by accident, at
 * /end, while listing Summaries/. This counts them.
 */
const made: string[] = [];
const vault = (): string => {
  const d = mkdtempSync(join(tmpdir(), "t042-vault-"));
  made.push(d);
  return d;
};
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const put = (root: string, rel: string, body = "test\n"): void => {
  const p = join(root, ...rel.split("/"));
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
};

describe("checkVaultPollution — T-042", () => {
  it("VP-1: a seeded vault warns with the count and the paths", () => {
    const v = vault();
    put(v, "Summaries/2026-08-31-ob-server-cz4uxz.md");
    put(v, "Summaries/2026-08-31-ob-server-abc123.md");
    put(v, "Checkpoints/deep/ob-server-q.md");
    put(v, "Summaries/2026-09-01-real-session.md");
    const r = checkVaultPollution("/unused", v);
    expect(r.name).toBe("vault-pollution");
    expect(r.severity).toBe("warn");
    expect(r.report).toBe(true);
    expect(r.message).toContain("3 ob-server-* file(s) in the vault");
    for (const p of ["Summaries/2026-08-31-ob-server-cz4uxz.md", "Summaries/2026-08-31-ob-server-abc123.md", "Checkpoints/deep/ob-server-q.md"]) expect(r.message).toContain(p);
    expect(r.message).not.toContain("real-session");
  });

  it("VP-2: a clean vault passes, and says how many notes it looked at", () => {
    const v = vault();
    put(v, "Summaries/2026-09-01-real-session.md");
    put(v, "Experiences/a.md");
    put(v, ".obsidian/workspace.json", "{}");
    const r = checkVaultPollution("/unused", v);
    expect(r.severity).toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toBe("0 ob-server-* files in 2 .md files under the vault; 0 directories unreadable");
  });

  it("VP-3: an absent vault is 'not checked', which is neither a pass nor a warning", () => {
    const missing = join(vault(), "does-not-exist");
    const r = checkVaultPollution("/unused", missing);
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("not checked");
    expect(r.message).toContain(missing.replace(/\\/g, "/"));
  });

  it("VP-4: a directory that cannot be read is counted, and a clean-looking scan says so", () => {
    const v = vault();
    put(v, "Summaries/a.md");
    put(v, "Locked/ob-server-hidden.md");
    const flaky = ((p: string, o: unknown) => {
      if (String(p).replace(/\\/g, "/").endsWith("/Locked")) throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      return readdirSync(p, o as never);
    }) as never;
    const scan = scanVaultForTestArtifacts(v, flaky);
    expect(scan.found).toEqual([]);
    expect(scan.unreadable).toEqual(["Locked (EACCES)"]);
    expect(scan.notes).toBe(1);
  });

  it("VP-5: only .md files with the ob-server- slug count; a folder or a similar name does not", () => {
    const v = vault();
    put(v, "Summaries/my-ob-server-notes.txt");
    put(v, "Summaries/server-ob.md");
    put(v, "ob-server-folder/readme.md");
    expect(checkVaultPollution("/unused", v).severity).toBe("pass");
  });

  // G-052 / QA 257: no vaultDir arg — default obsidianVaultDir() under an injected home.
  it("VP-6: resolves the default vault under home when vaultDir is omitted", () => {
    const home = mkdtempSync(join(tmpdir(), "t042-g052-home-"));
    made.push(home);
    const defaultVault = join(home, "Obsidian Vault v2");
    mkdirSync(defaultVault, { recursive: true });
    put(defaultVault, "Summaries/2026-08-31-ob-server-default.md");
    const saved = {
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      OPEN_BRAIN_VAULT_DIR: process.env.OPEN_BRAIN_VAULT_DIR,
      VITEST: process.env.VITEST,
      VITEST_WORKER_ID: process.env.VITEST_WORKER_ID,
    };
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    delete process.env.OPEN_BRAIN_VAULT_DIR;
    // obsidianVaultDir()'s real-vault guard compares default resolution to homedir(); with an
    // injected home those paths match and the guard fires. Lift it for this row only.
    delete process.env.VITEST;
    delete process.env.VITEST_WORKER_ID;
    try {
      const r = checkVaultPollution("/unused");
      expect(r.severity).toBe("warn");
      expect(r.message).toContain("1 ob-server-* file(s) in the vault");
      expect(r.message).toContain("Summaries/2026-08-31-ob-server-default.md");
    } finally {
      if (saved.HOME === undefined) delete process.env.HOME;
      else process.env.HOME = saved.HOME;
      if (saved.USERPROFILE === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = saved.USERPROFILE;
      if (saved.OPEN_BRAIN_VAULT_DIR === undefined) delete process.env.OPEN_BRAIN_VAULT_DIR;
      else process.env.OPEN_BRAIN_VAULT_DIR = saved.OPEN_BRAIN_VAULT_DIR;
      if (saved.VITEST === undefined) delete process.env.VITEST;
      else process.env.VITEST = saved.VITEST;
      if (saved.VITEST_WORKER_ID === undefined) delete process.env.VITEST_WORKER_ID;
      else process.env.VITEST_WORKER_ID = saved.VITEST_WORKER_ID;
    }
  });
});
