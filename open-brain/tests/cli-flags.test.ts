import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, realpathSync } from "node:fs";
import { join, relative, resolve, parse, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";

/**
 * T-185 (T-150's rule, every subcommand): an unrecognised flag refuses with
 * exit 2, names the token, and nothing is written.
 *
 * Every command runs with its cwd AND its positional inside a scratch directory
 * under the OS temp dir. That matters for the red run: at the base commit
 * `sync -check` and `detach -dry-run` fall through to the cwd and do the real
 * thing, so the cwd is what a failure reaches. `inScratch` refuses to spawn
 * when the cwd, or any argument that names an EXISTING path, resolves outside
 * the temp dir (R185-8). It does not look inside the command: a path the CLI
 * derives for itself (the project root it walks up to, the DB from the
 * environment) is kept inside the scratch dir by the fixtures, not by this.
 */

const cliEntry = join(import.meta.dirname, "../src/cli.ts");
// Absolute path: node resolves a bare `--import tsx` against the cwd.
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const TMP = realpathSync(tmpdir());

interface Run { status: number | null; stdout: string; stderr: string }

function inScratch(cwd: string, args: readonly string[] = []): void {
  const outside = (p: string): string | undefined => {
    const real = realpathSync(p);
    return real.startsWith(TMP + sep) ? undefined : real;
  };
  const cwdOut = outside(cwd);
  if (cwdOut !== undefined) throw new Error(`refusing to run the CLI outside the temp dir: ${cwdOut}`);
  // An argument is only a path if something is there; a flag or a word that
  // names nothing cannot point the CLI at a checkout.
  for (const a of args) {
    const p = resolve(cwd, a);
    const argOut = existsSync(p) ? outside(p) : undefined;
    if (argOut !== undefined) throw new Error(`refusing to run the CLI on an argument outside the temp dir: ${a} -> ${argOut}`);
  }
}

function cli(cwd: string, ...args: string[]): Run {
  // setup-env.ts has redirected the DB, vault and slot files
  return cliWith(process.env, cwd, ...args);
}

function cliWith(env: NodeJS.ProcessEnv, cwd: string, ...args: string[]): Run {
  inScratch(cwd, args);
  // spawnSync, not execFileSync: stderr must be captured on success as well as
  // failure, or an assertion on it passes without looking.
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env, timeout: 90_000 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Every file under `root` with its bytes, so "nothing written" is a comparison, not a hope. */
function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        out.set(relative(root, p) + "/", "<dir>");
        walk(p);
      } else {
        out.set(relative(root, p), readFileSync(p).toString("base64"));
      }
    }
  };
  walk(root);
  return out;
}

/** The refusal's own words: exit 2, the token named, the command's flags listed. */
function expectRefusal(r: Run, token: string): void {
  expect(r.status, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toBe(2);
  expect(r.stderr).toContain(`unrecognised flag "${token}"`);
  expect(r.stderr).toMatch(/Accepted flags: /);
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(TMP, "t185-cli-"));
});

afterEach(async () => {
  await import("node:fs/promises").then((fs) => fs.rm(root, { recursive: true, force: true }));
});

/** A project the fixing sync WOULD change: README's version is behind package.json. */
function syncProject(): string {
  const p = join(root, "proj");
  mkdirSync(join(p, ".agents", "SYSTEM"), { recursive: true });
  writeFileSync(join(p, "package.json"), JSON.stringify({ name: "fixture", version: "1.2.3" }) + "\n");
  writeFileSync(join(p, "README.md"), "# fixture\n\n**Latest: v0.0.1**\n");
  return p;
}

describe("sync", () => {
  it("the fixture is one a fixing sync would change (the red run's premise)", () => {
    // Without this, "README unchanged" below could pass on a fixture sync never touches.
    const p = syncProject();
    expect(readFileSync(join(p, "README.md"), "utf8")).toContain("**Latest: v0.0.1**");
    expect(JSON.parse(readFileSync(join(p, "package.json"), "utf8")).version).toBe("1.2.3");
  });

  it.each([["-check"], ["--chek"], ["--help"], ["-h"]])("sync %s refuses and touches no file", (token) => {
    const p = syncProject();
    const before = snapshot(p);
    const r = cli(p, "sync", token);
    expectRefusal(r, token);
    expect(r.stderr).toContain("--check");
    expect(snapshot(p)).toEqual(before);
  }, 120_000);

  it("sync <a directory that does not exist> refuses rather than walking up from the cwd", () => {
    const p = syncProject();
    const before = snapshot(p);
    // No --check: at the base the walk-up reaches the cwd's project and runs the
    // FIXING sync there, which is the harm this row exists for.
    const r = cli(p, "sync", "no-such-dir");
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(r.stderr).toContain("no-such-dir");
    expect(r.stderr).toMatch(/not an existing directory/);
    expect(snapshot(p)).toEqual(before);
  }, 120_000);
});

describe("start", () => {
  function startProject(): string {
    const p = join(root, "proj");
    mkdirSync(join(p, ".agents", "SYSTEM"), { recursive: true });
    mkdirSync(join(p, ".agents", "SESSIONS"), { recursive: true });
    writeFileSync(join(p, "package.json"), JSON.stringify({ name: "fixture", version: "1.2.3" }) + "\n");
    return p;
  }

  it.each([["-dry-run"], ["--dry-run"]])("start %s refuses and creates no session log", (token) => {
    const p = startProject();
    const before = snapshot(p);
    const r = cli(p, "start", token);
    expectRefusal(r, token);
    expect(snapshot(p)).toEqual(before);
  }, 120_000);

  it("start <a directory that does not exist> refuses", () => {
    const p = startProject();
    const before = snapshot(p);
    const r = cli(p, "start", "no-such-dir");
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(r.stderr).toMatch(/not an existing directory/);
    expect(existsSync(join(p, "no-such-dir"))).toBe(false);
    expect(snapshot(p)).toEqual(before);
  }, 120_000);
});

describe("detach", () => {
  /** A real clone on a branch, so a real detach would move HEAD off it. */
  function branchClone(): string {
    const origin = join(root, "origin.git");
    const seed = join(root, "seed");
    const clone = join(root, "clone");
    mkdirSync(origin);
    mkdirSync(seed);
    git(origin, "init", "-q", "--bare", "-b", "master");
    git(seed, "init", "-q", "-b", "master");
    git(seed, "config", "user.email", "t@example.com");
    git(seed, "config", "user.name", "T");
    // A project root (package.json beside .agents/SYSTEM/), so a stray token
    // that falls through to the cwd walks up to THIS clone and detaches it.
    writeFileSync(join(seed, "package.json"), "{}\n");
    mkdirSync(join(seed, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(seed, ".agents", "SYSTEM", "keep.md"), "x\n");
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "seed");
    git(seed, "remote", "add", "origin", origin);
    git(seed, "push", "-q", "origin", "master");
    execFileSync("git", ["clone", "-q", origin, clone], { stdio: ["ignore", "pipe", "pipe"] });
    return clone;
  }

  it("the fixture is on a branch that a real detach would leave (the red run's premise)", () => {
    const c = branchClone();
    expect(git(c, "symbolic-ref", "--short", "HEAD")).toBe("master");
    expect(existsSync(join(c, ".agents", "SYSTEM", "keep.md"))).toBe(true);
  });

  it.each([["-dry-run"], ["--dry-rn"]])("detach %s refuses and leaves HEAD and the tree alone", (token) => {
    const c = branchClone();
    const head = git(c, "rev-parse", "HEAD");
    const before = snapshot(c);
    const r = cli(c, "detach", token, "--no-fetch");
    expectRefusal(r, token);
    expect(r.stderr).toContain("--dry-run");
    expect(git(c, "symbolic-ref", "--short", "HEAD")).toBe("master");
    expect(git(c, "rev-parse", "HEAD")).toBe(head);
    expect(git(c, "status", "--porcelain")).toBe("");
    expect(snapshot(c)).toEqual(before);
  }, 120_000);

  it("detach <a directory that does not exist> refuses rather than walking up from the cwd", () => {
    const c = branchClone();
    const r = cli(c, "detach", "no-such-dir", "--no-fetch");
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(r.stderr).toMatch(/not an existing directory/);
    expect(git(c, "symbolic-ref", "--short", "HEAD")).toBe("master");
  }, 120_000);
});

describe("state migrate", () => {
  function v1File(name = "state.json"): string {
    const f = join(root, name);
    writeFileSync(
      f,
      JSON.stringify(
        {
          schema_version: 1,
          revision: 52,
          project: { name: "fixture" },
          objective: { text: "do the thing", since_session: 1 },
          tasks: [],
          verified: [],
          gaps: [],
          decisions: [],
          handoff: { pick_up: "p", watch_out: [], open_questions: [], session: 70 },
          last_session: { n: 70, date: "2026-09-20", uuid: "abc" },
        },
        null,
        2
      ) + "\n"
    );
    return f;
  }

  it.each([["-dry-run"], ["--dry-rn"]])("state migrate %s refuses and the file is byte-identical", (token) => {
    const f = v1File();
    const before = readFileSync(f);
    const r = cli(root, "state", "migrate", "--seat", "developer", token, f);
    expectRefusal(r, token);
    expect(r.stderr).toContain("--dry-run");
    expect(readFileSync(f).equals(before)).toBe(true);
  }, 120_000);

  it("state migrate --dry-run (spelled right) is still a dry run", () => {
    const f = v1File();
    const before = readFileSync(f);
    const r = cli(root, "state", "migrate", "--seat", "developer", "--dry-run", f);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("[dry run]");
    expect(readFileSync(f).equals(before)).toBe(true);
  }, 120_000);

  it("state migrate —dry-run (an em dash, as autocorrect writes it) refuses and the file is byte-identical", () => {
    // R185-5, QA 120's D1: the em dash does not start with "-", so it was taken
    // as a second FILE, refused as missing, and state.json WAS migrated.
    const f = v1File();
    const before = readFileSync(f);
    const tok = "—dry-run";
    const r = cli(root, "state", "migrate", "--seat", "developer", tok, "state.json");
    expectRefusal(r, tok);
    expect(r.stderr).toContain("a typographic dash");
    expect(readFileSync(f).equals(before)).toBe(true);
  }, 120_000);

  // R185-5's second half: a refusal that says "nothing was written" must be
  // true of EVERY named file, so each is checked before any is written.
  it.each([
    ["a file that does not exist, named after", ["state.json", "missing.json"]],
    ["a file that does not exist, named first", ["missing.json", "state.json"]],
    ["a file that is not JSON", ["state.json", "bad.json"]],
    ["a file that is not a state record", ["state.json", "other.json"]],
  ])("state migrate with %s writes none of the files", (_what, files) => {
    const f = v1File();
    writeFileSync(join(root, "bad.json"), "{ not json\n");
    writeFileSync(join(root, "other.json"), JSON.stringify({ hello: "world" }) + "\n");
    const before = snapshot(root);
    const r = cli(root, "state", "migrate", "--seat", "developer", ...files);
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stderr).toMatch(/nothing was written/);
    expect(readFileSync(f, "utf8")).toContain('"schema_version": 1');
    expect(snapshot(root)).toEqual(before);
  }, 120_000);

  it("state migrate with two valid files still migrates both (the check does not stop the good case)", () => {
    const a = v1File("a.json");
    const b = v1File("b.json");
    const beforeA = readFileSync(a);
    const beforeB = readFileSync(b);
    const r = cli(root, "state", "migrate", "--seat", "developer", "a.json", "b.json");
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(readFileSync(a).equals(beforeA)).toBe(false);
    expect(readFileSync(b).equals(beforeB)).toBe(false);
    expect(JSON.parse(readFileSync(a, "utf8")).schema_version).toBe(3);
    expect(JSON.parse(readFileSync(b, "utf8")).schema_version).toBe(3);
  }, 120_000);
});

describe("read-only and opt-in commands also refuse", () => {
  it("state show -json refuses", () => {
    const r = cli(root, "state", "show", "-json");
    expectRefusal(r, "-json");
  }, 120_000);

  it("relocate --aply refuses", () => {
    const r = cli(root, "relocate", "--from", "a", "--to", "b", "--aply");
    expectRefusal(r, "--aply");
  }, 120_000);

  it("topics --aply refuses", () => {
    const r = cli(root, "topics", "--aply");
    expectRefusal(r, "--aply");
  }, 120_000);
});

describe("the refusal comes before the database is opened (R185-7, QA 120's rows)", () => {
  // A DB path of this test's own, so "not created" is a fact about this spawn
  // alone. better-sqlite3 creates the file on open, so its absence is the proof.
  it.each([
    [["relocate", "--from", "a", "--to", "b", "--aply"]],
    [["relocate", "--aply"]],
    [["topics", "--aply"]],
  ])("%j refuses and the DB file is never created", (argv) => {
    const db = join(root, "knowledge-v2.db");
    const r = cliWith({ ...process.env, KNOWLEDGE_V2_DB: db }, root, ...argv);
    expectRefusal(r, "--aply");
    expect(existsSync(db)).toBe(false);
  }, 120_000);
});

describe("inScratch refuses an argument outside the temp dir (R185-8)", () => {
  // Every spawn here is `state show`, which is read-only, so at a commit where
  // the guard is missing the spawn goes ahead and harms nothing.
  it.each([
    ["the filesystem root", () => parse(root).root],
    ["a file outside (this test's own source)", () => cliEntry],
    ["a relative path that climbs out", () => ".."],
  ])("%s refuses before anything spawns", (_what, arg) => {
    expect(() => cli(root, "state", "show", "--json", arg())).toThrow(/argument outside the temp dir/);
  });

  it("an argument inside the temp dir, and a word that names nothing, still pass", () => {
    writeFileSync(join(root, "inside.json"), "{}\n");
    expect(() => inScratch(root, ["inside.json", join(root, "inside.json"), "no-such-thing", "--check", "sync"])).not.toThrow();
  });
});
