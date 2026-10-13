import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as cp from "node:child_process";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as paths from "../src/shared/paths.js";
import * as dbv2 from "../src/db-v2.js";
import * as server from "../src/server.js";
import * as endRecord from "../src/shared/end-record-store.js";
import * as active from "../src/shared/active-session.js";
import { spawnAsync } from "./spawn-async.js";

/**
 * T-249: a worktree's knowledge belongs to its repository.
 *
 * `canonicalizeProjectDir` keys a session or an entry by the CHECKOUT, so every
 * worktree of one repo was its own project: knowledge stored from sia-forge was
 * invisible to a project-scoped recall from the main tree, and its notes landed
 * in a vault folder named after the worktree. The identity functions resolve a
 * linked worktree to its main worktree by reading git's own files; the
 * per-checkout keys (the session slot, the end-record store) must NOT move.
 */

const TSX_CLI = createRequire(import.meta.url).resolve("tsx/cli");
const CLI = path.join(import.meta.dirname, "../src/cli.ts");
const OB = path.resolve(import.meta.dirname, "..");
const canon = (p: string) => paths.canonicalizeProjectDir(p)!;

let base: string;
let main: string;
let wtX: string;
let wtY: string;

function git(cwd: string, ...args: string[]): string {
  return cp.execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

beforeAll(() => {
  // realpath.native: some hosts hand out an 8.3 short temp path.
  base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "t249-")));
  main = path.join(base, "Repo-Main");
  fs.mkdirSync(main);
  git(main, "init", "-q");
  git(main, "config", "user.email", "t249@example.invalid");
  git(main, "config", "user.name", "t249");
  git(main, "config", "commit.gpgsign", "false");
  fs.writeFileSync(path.join(main, "README.md"), "t249\n");
  git(main, "add", "README.md");
  git(main, "commit", "-q", "-m", "init");
  wtX = path.join(base, "wt-x");
  wtY = path.join(base, "wt-y");
  git(main, "worktree", "add", "-q", wtX);
  git(main, "worktree", "add", "-q", wtY);
}, 60_000);

afterAll(() => {
  try { fs.rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch { /* Windows race */ }
});

describe("WT-1: a real `git worktree add` resolves to the main worktree", () => {
  it("the worktree's identity is the main repo's; main itself is unchanged", () => {
    expect(paths.mainWorktreeRoot(main)).toBe(main);
    expect(paths.projectIdentity(main)).toBe(canon(main));
    expect(paths.projectIdentity(wtX)).toBe(paths.projectIdentity(main));
    expect(paths.projectIdentity(wtX)).toBe(canon(main));
    expect(paths.projectIdentityName(wtX)).toBe("Repo-Main");
    expect(paths.projectIdentityName(main)).toBe("Repo-Main");
  });
});

describe("WT-2: hand-made worktree files", () => {
  function handMade(name: string, gitFile: string, commondir: (mainDir: string) => string): { w: string; m: string } {
    const root = path.join(base, name);
    const m = path.join(root, "main");
    const w = path.join(root, "w");
    fs.mkdirSync(path.join(m, ".git", "worktrees", "w"), { recursive: true });
    fs.mkdirSync(w, { recursive: true });
    fs.writeFileSync(path.join(m, ".git", "worktrees", "w", "commondir"), commondir(m));
    fs.writeFileSync(path.join(w, ".git"), gitFile);
    return { w, m };
  }

  it("relative gitdir, relative commondir", () => {
    const { w, m } = handMade("hm-lf", "gitdir: ../main/.git/worktrees/w\n", () => "../..\n");
    expect(canon(paths.mainWorktreeRoot(w))).toBe(canon(m));
  });

  it("CRLF line endings", () => {
    const { w, m } = handMade("hm-crlf", "gitdir: ../main/.git/worktrees/w\r\n", () => "../..\r\n");
    expect(canon(paths.mainWorktreeRoot(w))).toBe(canon(m));
  });

  it("an absolute commondir", () => {
    const { w, m } = handMade("hm-abs", "gitdir: ../main/.git/worktrees/w\n", (mm) => path.join(mm, ".git") + "\n");
    expect(canon(paths.mainWorktreeRoot(w))).toBe(canon(m));
  });
});

describe("WT-3: fail-safe, the input comes back unchanged and nothing throws", () => {
  const unchanged = (dir: string) => {
    let out: string | undefined;
    expect(() => { out = paths.mainWorktreeRoot(dir); }).not.toThrow();
    expect(out).toBe(dir);
  };

  it("a submodule-shaped gitdir with no commondir", () => {
    const root = path.join(base, "fs-sub");
    fs.mkdirSync(path.join(root, ".git", "modules", "sub"), { recursive: true });
    fs.mkdirSync(path.join(root, "sub"), { recursive: true });
    fs.writeFileSync(path.join(root, "sub", ".git"), "gitdir: ../.git/modules/sub\n");
    unchanged(path.join(root, "sub"));
  });

  it("a separate git dir that happens to be named .git, with no commondir", () => {
    const root = path.join(base, "fs-sep");
    fs.mkdirSync(path.join(root, "store", ".git"), { recursive: true });
    fs.mkdirSync(path.join(root, "work"), { recursive: true });
    fs.writeFileSync(path.join(root, "work", ".git"), "gitdir: ../store/.git\n");
    unchanged(path.join(root, "work"));
  });

  it("a bare `repo.git` common dir", () => {
    const root = path.join(base, "fs-bare");
    fs.mkdirSync(path.join(root, "repo.git", "worktrees", "w"), { recursive: true });
    fs.writeFileSync(path.join(root, "repo.git", "worktrees", "w", "commondir"), "../..\n");
    fs.mkdirSync(path.join(root, "w"), { recursive: true });
    fs.writeFileSync(path.join(root, "w", ".git"), "gitdir: ../repo.git/worktrees/w\n");
    unchanged(path.join(root, "w"));
  });

  it("a malformed .git file", () => {
    const root = path.join(base, "fs-bad");
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, ".git"), "this is not a gitdir line\n");
    unchanged(root);
  });

  it("a .git DIRECTORY (a normal repo)", () => {
    const root = path.join(base, "fs-dir");
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    unchanged(root);
  });

  it("a missing path", () => {
    unchanged(path.join(base, "does-not-exist"));
  });
});

describe("WT-4: the server, called from a worktree, keys to the repository", () => {
  it("ob_store_chunk: main key in the row, Repo-Main in the name and project:, the worktree in working_dir:", async () => {
    const vault = path.join(base, "vault-chunk");
    const prevVault = process.env.OPEN_BRAIN_VAULT_DIR;
    process.env.OPEN_BRAIN_VAULT_DIR = vault;
    try {
      const key = "t249-chunk-zymurgy";
      const r = await server.handleStoreChunk({ content: "t249 zymurgy checkpoint body", key, project_dir: wtX });
      expect(r.isError ?? false).toBe(false);

      const files = fs.readdirSync(path.join(vault, "Checkpoints")).filter((f) => f.includes(key));
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^\d{4}-\d{2}-\d{2}-Repo-Main-/);
      const vaultPath = path.join(vault, "Checkpoints", files[0]!);
      const text = fs.readFileSync(vaultPath, "utf8");
      expect(text).toMatch(/^project: "?Repo-Main"?$/m);
      const wd = text.split(/\r?\n/).find((l) => l.startsWith("working_dir:"));
      expect(wd).toBeDefined();
      expect(wd).toContain(canon(wtX));

      const db = new Database(process.env.KNOWLEDGE_V2_DB!, { readonly: true });
      try {
        const row = db.prepare(`SELECT project_dir FROM knowledge_index WHERE vault_path = ?`).get(vaultPath) as { project_dir: string };
        expect(row.project_dir).toBe(canon(main));
      } finally {
        db.close();
      }

      // Scoped from a SECOND worktree of the same repo, it is found.
      const rec = await server.handleRecall({ queries: ["zymurgy"], project: wtY });
      expect(rec.content[0]!.text).toContain(key);
    } finally {
      process.env.OPEN_BRAIN_VAULT_DIR = prevVault;
    }
  }, 60_000);

  it("ob_store (through the MCP stdio server) files under Experiences/Repo-Main/", async () => {
    const vault = path.join(base, "vault-store");
    const transport = new StdioClientTransport({
      command: path.join(OB, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx"),
      args: [path.join(OB, "src", "server.ts")],
      cwd: OB,
      env: { ...(process.env as Record<string, string>), KNOWLEDGE_V2_DB: path.join(base, "store-db", "knowledge-v2.db"), OPEN_BRAIN_VAULT_DIR: vault },
      stderr: "ignore",
    });
    const client = new Client({ name: "t249-probe", version: "0.0.0" });
    await client.connect(transport);
    try {
      const res = (await client.callTool({
        name: "ob_store",
        arguments: { content: "t249 worktree store body", key: "t249-store-entry", tags: ["t249"], scope: "project", project_dir: wtX },
      })) as { content: { text: string }[]; isError?: boolean };
      expect(res.isError ?? false).toBe(false);
      const folders = fs.readdirSync(path.join(vault, "Experiences"));
      expect(folders).toEqual(["Repo-Main"]);
      expect(fs.readdirSync(path.join(vault, "Experiences", "Repo-Main")).some((f) => f.includes("t249-store-entry"))).toBe(true);
    } finally {
      await client.close();
    }
  }, 120_000);
});

describe("WT-5: per-checkout keys do NOT move", () => {
  it("the end-record store keeps the checkout", () => {
    expect(endRecord.endRecordProjectDir(wtX)).not.toBe(endRecord.endRecordProjectDir(main));
  });

  it("cli-bootstrap, run in a worktree, writes the slot under the worktree's own key", async () => {
    const home = path.join(base, "boot-home");
    const slot = path.join(home, "slot", "active-session.json");
    fs.mkdirSync(home, { recursive: true });
    const r = await spawnAsync(process.execPath, [TSX_CLI, path.join(OB, "src", "cli-bootstrap.ts")], {
      input: JSON.stringify({ cwd: wtX, session_id: "t249-slot-0001" }),
      env: { ...process.env, HOME: home, USERPROFILE: home, OPEN_BRAIN_ACTIVE_SESSION: slot },
    });
    expect(r.status, r.stderr).toBe(0);
    const all = JSON.parse(fs.readFileSync(slot, "utf8")) as Record<string, unknown>;
    expect(Object.keys(all)).toEqual([active.activeSessionKey(canon(wtX), "claude")]);
  }, 90_000);
});

describe("WT-6/WT-7: relocate --worktrees", () => {
  function cli(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
    const r = cp.spawnSync(process.execPath, [TSX_CLI, CLI, ...args], { cwd, env, encoding: "utf8", timeout: 90_000 });
    return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
  }

  it("WT-6: dry run changes nothing; --apply backs up, then folds rows, sessions and notes; a second --apply has nothing to fold", () => {
    const root = path.join(base, "rel");
    const vault = path.join(root, "vault");
    const dbPath = path.join(root, "db", "knowledge-v2.db");
    const plain = path.join(root, "plain-dir");
    const gone = path.join(base, "wt-pruned");
    fs.mkdirSync(plain, { recursive: true });
    const env = { ...process.env, KNOWLEDGE_V2_DB: dbPath, OPEN_BRAIN_VAULT_DIR: vault };

    const notes: string[] = [];
    const db = dbv2.openV2Database(dbPath);
    const seed = (folder: string, name: string, projectDir: string) => {
      const dir = path.join(vault, "Experiences", folder);
      fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, `${name}.md`);
      fs.writeFileSync(p, `# ${name}\n`, "utf8");
      dbv2.indexKnowledge(db, { vaultPath: p, key: name, content: "c", tags: "t", source: "agent", projectDir });
      return p;
    };
    notes.push(seed("wt-x", "wt-note-1", canon(wtX)));
    notes.push(seed("wt-x", "wt-note-2", canon(wtX)));
    seed("Repo-Main", "main-note", canon(main));
    seed("plain-dir", "plain-note", canon(plain));
    seed("wt-pruned", "gone-note", canon(gone));
    dbv2.recordSession(db, "s-wt-1", canon(wtX));
    dbv2.recordSession(db, "s-wt-2", canon(wtX));
    dbv2.recordSession(db, "s-main", canon(main));
    db.close();

    const snapshot = () => {
      const d = new Database(dbPath, { readonly: true });
      try {
        return JSON.stringify([
          d.prepare(`SELECT key, project_dir, vault_path FROM knowledge_index ORDER BY key`).all(),
          d.prepare(`SELECT uuid, project_dir FROM sessions ORDER BY uuid`).all(),
        ]);
      } finally {
        d.close();
      }
    };
    const backups = () => fs.readdirSync(path.dirname(dbPath)).filter((f) => /^knowledge-v2\.db\.bak-\d{8}-\d{6}-relocate$/.test(f));

    const before = snapshot();
    const dry = cli(root, env, "relocate", "--worktrees");
    expect(dry.status, dry.out).toBe(0);
    expect(dry.out).toContain(canon(wtX));
    expect(dry.out).toContain(`unresolvable (not on disk): ${canon(gone)}`);
    expect(snapshot()).toBe(before);
    for (const n of notes) expect(fs.existsSync(n)).toBe(true);
    expect(backups()).toHaveLength(0);

    const apply = cli(root, env, "relocate", "--worktrees", "--apply");
    expect(apply.status, apply.out).toBe(0);
    expect(backups()).toHaveLength(1);

    const d = new Database(dbPath, { readonly: true });
    try {
      const byKey = (k: string) => d.prepare(`SELECT project_dir, vault_path FROM knowledge_index WHERE key = ?`).get(k) as { project_dir: string; vault_path: string };
      for (const k of ["wt-note-1", "wt-note-2"]) {
        const row = byKey(k);
        expect(row.project_dir).toBe(canon(main));
        expect(row.vault_path).toBe(path.join(vault, "Experiences", "Repo-Main", `${k}.md`));
        expect(fs.existsSync(row.vault_path)).toBe(true);
      }
      expect(byKey("main-note").project_dir).toBe(canon(main));
      expect(byKey("plain-note").project_dir).toBe(canon(plain));
      expect(byKey("gone-note").project_dir).toBe(canon(gone));
      const sessions = d.prepare(`SELECT project_dir FROM sessions WHERE uuid IN ('s-wt-1','s-wt-2','s-main')`).all() as { project_dir: string }[];
      expect(sessions.map((s) => s.project_dir)).toEqual([canon(main), canon(main), canon(main)]);
    } finally {
      d.close();
    }
    for (const n of notes) expect(fs.existsSync(n)).toBe(false);

    const again = cli(root, env, "relocate", "--worktrees", "--apply");
    expect(again.status, again.out).toBe(0);
    expect(again.out).toContain("nothing to fold");
  }, 300_000);

  it("WT-7: --worktrees with --from refuses before the DB is opened", () => {
    const root = path.join(base, "rel-refuse");
    fs.mkdirSync(root, { recursive: true });
    const dbPath = path.join(root, "db", "knowledge-v2.db");
    const env = { ...process.env, KNOWLEDGE_V2_DB: dbPath, OPEN_BRAIN_VAULT_DIR: path.join(root, "vault") };
    const r = cli(root, env, "relocate", "--worktrees", "--from", "a");
    expect(r.status).not.toBe(0);
    expect(r.status).not.toBeNull();
    expect(fs.existsSync(dbPath)).toBe(false);
  }, 120_000);
});
