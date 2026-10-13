import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import * as mr from "../../src/pipelines/main-rebuild/index.js";
import { describeServingBuild } from "../../src/pipelines/session-start/serving-build.js";

/**
 * T-172 half 2: `open-brain main-rebuild` updates, rebuilds and verifies the serving checkout, or refuses and
 * changes nothing. Every case runs against a temp bare "origin" and a clone of it standing in for the main checkout.
 * npm and node are FAKES (injected): npm writes build/build-info.json from HEAD the way the real postbuild does and
 * records its argv; node answers V2, and V3 with describeServingBuild()'s real line against the temp tree, unless a
 * case overrides it. git is the real runner.
 */

const TMP = realpathSync(tmpdir());
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(TMP, "t172-mr-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const lock = (zod: string, sqlite: string): string =>
  JSON.stringify(
    {
      name: "open-brain",
      lockfileVersion: 3,
      packages: { "": { name: "open-brain" }, "node_modules/better-sqlite3": { version: sqlite }, "node_modules/zod": { version: zod } },
    },
    null,
    2,
  ) + "\n";

interface Fixture {
  origin: string;
  seed: string;
  main: string;
  /** C1: the base. C2: changes package-lock.json (zod). C3: changes open-brain/src only. origin/master is C3. */
  c1: string;
  c2: string;
  c3: string;
  proofDir: string;
}

function commitAll(cwd: string, msg: string): string {
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", msg);
  return git(cwd, "rev-parse", "HEAD");
}

function fixture(): Fixture {
  const origin = join(root, "origin.git");
  const seed = join(root, "seed");
  const main = join(root, "main");
  const proofDir = join(root, "by-pid");
  mkdirSync(origin);
  mkdirSync(join(seed, "open-brain", "src"), { recursive: true });
  mkdirSync(proofDir);
  git(origin, "init", "-q", "--bare", "-b", "master");
  git(seed, "init", "-q", "-b", "master");
  git(seed, "config", "user.email", "t@example.com");
  git(seed, "config", "user.name", "T");
  git(seed, "config", "core.autocrlf", "false");
  writeFileSync(join(seed, ".gitignore"), "node_modules/\nopen-brain/build/\n");
  writeFileSync(join(seed, "open-brain", "package.json"), JSON.stringify({ name: "open-brain", dependencies: { zod: "^4" } }) + "\n");
  writeFileSync(join(seed, "open-brain", "package-lock.json"), lock("4.0.0", "11.0.0"));
  writeFileSync(join(seed, "open-brain", "src", "a.ts"), "export const a = 1;\n");
  const c1 = commitAll(seed, "C1");
  writeFileSync(join(seed, "open-brain", "package-lock.json"), lock("4.1.0", "11.0.0"));
  const c2 = commitAll(seed, "C2 lock");
  writeFileSync(join(seed, "open-brain", "src", "a.ts"), "export const a = 3;\n");
  const c3 = commitAll(seed, "C3 src");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, main], { stdio: ["ignore", "pipe", "pipe"] });
  git(main, "config", "user.email", "t@example.com");
  git(main, "config", "user.name", "T");
  return { origin, seed, main, c1, c2, c3, proofDir };
}

const buildDir = (tree: string): string => join(tree, "open-brain", "build");

/** A build stamped `sha`, with a file whose bytes name it, so "restored" is a byte comparison. */
function setBuild(tree: string, sha: string): void {
  const b = buildDir(tree);
  rmSync(b, { recursive: true, force: true });
  mkdirSync(join(b, "pipelines"), { recursive: true });
  writeFileSync(join(b, "build-info.json"), JSON.stringify({ commit: sha, builtAt: "2026-10-01T00:00:00.000Z" }) + "\n");
  writeFileSync(join(b, "index.js"), `// built from ${sha}\n`);
  writeFileSync(join(b, "pipelines", "x.js"), `export const x = "${sha}";\n`);
}

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p).replace(/\\/g, "/")] = readFileSync(p).toString("base64");
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

const stamp = (tree: string): string | null => {
  try {
    return JSON.parse(readFileSync(join(buildDir(tree), "build-info.json"), "utf8")).commit ?? null;
  } catch {
    return null;
  }
};

const backupsDir = (tree: string): string => join(tree, ".git", "open-brain-build-backups");

type BuildMode = "stamp" | "leave-old-stamp" | "junk-exit-1";

interface Fakes {
  deps: mr.MainRebuildDeps;
  npmCalls: { args: string[]; cwd: string }[];
  nodeCalls: string[][];
}

function fakes(
  tree: string,
  o: { build?: BuildMode; v3?: (sha7: string) => string; startTimes?: Record<number, string | null>; table?: Map<number, { pid: number; ppid: number; commandLine: string }> | null } = {},
): Fakes {
  const npmCalls: { args: string[]; cwd: string }[] = [];
  const nodeCalls: string[][] = [];
  const real = mr.defaultDeps();
  const npm: mr.Runner = (args, cwd) => {
    npmCalls.push({ args: [...args], cwd });
    if (args[0] === "run" && args[1] === "build") {
      const mode = o.build ?? "stamp";
      const b = join(cwd, "build");
      if (mode === "leave-old-stamp") return { status: 0, stdout: "", stderr: "" };
      if (mode === "junk-exit-1") {
        writeFileSync(join(b, "junk.js"), "junk\n");
        return { status: 1, stdout: "", stderr: "error TS2322: junk" };
      }
      rmSync(b, { recursive: true, force: true });
      mkdirSync(b, { recursive: true });
      const head = git(cwd, "rev-parse", "HEAD");
      writeFileSync(join(b, "build-info.json"), JSON.stringify({ commit: head, builtAt: new Date().toISOString() }) + "\n");
      writeFileSync(join(b, "index.js"), `// built from ${head}\n`);
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  const node: mr.Runner = (args, _cwd) => {
    nodeCalls.push([...args]);
    const code = args.join(" ");
    if (code.includes("serving-build")) {
      const s = stamp(tree) ?? "0000000";
      const line = o.v3 ? o.v3(s.slice(0, 7)) : describeServingBuild(buildDir(tree), null);
      return { status: 0, stdout: line + "\n", stderr: "" };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  const startTimes = o.startTimes ?? {};
  return {
    deps: {
      git: real.git,
      npm,
      node,
      startTimeOf: (pid) => (pid in startTimes ? startTimes[pid]! : null),
      processTable: () => (o.table === undefined ? new Map() : o.table),
      now: () => new Date("2026-10-13T12:00:00.000Z"),
    },
    npmCalls,
    nodeCalls,
  };
}

const text = (r: mr.MainRebuildResult): string => r.lines.join("\n");

function expectRefused(r: mr.MainRebuildResult, reason: RegExp | string, exitCode = 1): void {
  const t = text(r);
  expect(r.exitCode, t).toBe(exitCode);
  expect(t).toContain("main-rebuild REFUSED: ");
  if (typeof reason === "string") expect(t).toContain(reason);
  else expect(t).toMatch(reason);
  expect(t).toContain("Nothing was changed.");
}

describe("R1: a linked worktree is refused", () => {
  it("refusal 1, HEAD unchanged, npm never called", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    const wt = join(root, "wt");
    git(f.main, "worktree", "add", "-q", "--detach", wt, f.c2);
    setBuild(wt, f.c1);
    const fk = fakes(wt);
    const r = await mr.mainRebuild(wt, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, /is a linked worktree, not the main checkout \(.+\): only the main checkout's open-brain\/build serves the hooks and MCP servers\./);
    expect(git(wt, "rev-parse", "HEAD")).toBe(f.c2);
    expect(fk.npmCalls).toEqual([]);
  });
});

describe("R2: a dirty tree is refused", () => {
  it("a tracked edit: refusal 2 names the path, no backup directory", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    writeFileSync(join(f.main, "open-brain", "src", "a.ts"), "edited\n");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `the working tree is not clean, so the build would be stamped ${f.c3.slice(0, 7)} while carrying changes that are not in it:`);
    expect(text(r)).toContain("open-brain/src/a.ts");
    expect(existsSync(backupsDir(f.main))).toBe(false);
    expect(fk.npmCalls).toEqual([]);
  });

  it("an untracked file counts: refusal 2 names it", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    mkdirSync(join(f.main, "notes"));
    writeFileSync(join(f.main, "notes", "new.txt"), "x\n");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, "the working tree is not clean");
    expect(text(r)).toContain("notes/new.txt");
    expect(existsSync(backupsDir(f.main))).toBe(false);
  });
});

describe("R3: only merged code, and no commits stranded", () => {
  it("an unpushed local SHA: refusal 5", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    git(f.main, "checkout", "-q", "-b", "local");
    writeFileSync(join(f.main, "open-brain", "src", "a.ts"), "local\n");
    const local = commitAll(f.main, "local only");
    git(f.main, "checkout", "-q", "master");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [local], proofDir: f.proofDir }, fk.deps);
    expectRefused(r, new RegExp(`${local.slice(0, 7)} is not on origin/master \\(fetch .+\\): only merged code may serve every session\\.`));
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c3);
  });

  it("an origin/feature-only SHA: refusal 5", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    git(f.seed, "checkout", "-q", "-b", "feature");
    writeFileSync(join(f.seed, "open-brain", "src", "a.ts"), "feature\n");
    const feat = commitAll(f.seed, "feature");
    git(f.seed, "push", "-q", "origin", "feature");
    const fk = fakes(f.main);
    // Not --no-fetch: the fetch brings origin/feature in, and it is still not origin/master.
    const r = await mr.mainRebuild(f.main, { positionals: [feat], proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `${feat.slice(0, 7)} is not on origin/master`);
    expect(git(f.main, "rev-parse", "origin/feature")).toBe(feat);
  });

  it("HEAD with commits origin/master lacks: refusal 3", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    writeFileSync(join(f.main, "open-brain", "src", "a.ts"), "ahead\n");
    const ahead = commitAll(f.main, "ahead");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `HEAD carries 1 commit(s) that origin/master does not have: checking out ${f.c3.slice(0, 7)} would leave them reachable only through the reflog.`);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(ahead);
  });

  it("a failed fetch: refusal 4, naming --no-fetch", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    git(f.main, "remote", "set-url", "origin", join(root, "no-such-origin.git"));
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], proofDir: f.proofDir }, fk.deps);
    expectRefused(r, /git fetch origin failed \(.+\): refusing to compare against a reference that may be stale\. --no-fetch uses the last fetch \(.+\)\./);
    expect(fk.npmCalls).toEqual([]);
  });
});

describe("R4: compared against the build stamp, not HEAD", () => {
  it("build at C1, HEAD at C3, <sha> C3: proceeds", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(stamp(f.main)).toBe(f.c3);
  });

  it("build at C2, <sha> C1: not ahead", async () => {
    const f = fixture();
    setBuild(f.main, f.c2);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c1], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `${f.c1.slice(0, 7)} is not ahead of the serving build ${f.c2.slice(0, 7)}: this would roll every session back.`);
    expect(stamp(f.main)).toBe(f.c2);
  });

  it("<sha> equal to the build: nothing to do, exit 0", async () => {
    const f = fixture();
    setBuild(f.main, f.c3);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `the serving build is already ${f.c3.slice(0, 7)}: nothing to do.`, 0);
    expect(fk.npmCalls).toEqual([]);
  });

  it("no stamp: refused", async () => {
    const f = fixture();
    mkdirSync(buildDir(f.main), { recursive: true });
    writeFileSync(join(buildDir(f.main), "index.js"), "x\n");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `the serving build carries no stamp, so ${f.c3.slice(0, 7)} cannot be shown to be ahead of it.`);
  });
});

describe("R5: npm install only when the manifest changed since the BUILT commit; never ci", () => {
  it("a src-only change: npm runs exactly build", async () => {
    const f = fixture();
    setBuild(f.main, f.c2);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(fk.npmCalls.map((c) => c.args)).toEqual([["run", "build"]]);
  });

  it("a lock change: install then build, both in open-brain", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    await mr.mainRebuild(f.main, { positionals: [f.c2], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(fk.npmCalls.map((c) => c.args)).toEqual([["install"], ["run", "build"]]);
    for (const c of fk.npmCalls) expect(realpathSync(c.cwd)).toBe(realpathSync(join(f.main, "open-brain")));
  });

  it("HEAD already past the lock change, the build older: install still runs", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c3);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(fk.npmCalls.map((c) => c.args)).toEqual([["install"], ["run", "build"]]);
    expect(fk.npmCalls.some((c) => c.args.includes("ci"))).toBe(false);
  });

  it("a better-sqlite3 version change in the lock: refusal 7", async () => {
    const f = fixture();
    setBuild(f.main, f.c3);
    writeFileSync(join(f.seed, "open-brain", "package-lock.json"), lock("4.1.0", "12.1.0"));
    const c4 = commitAll(f.seed, "C4 sqlite");
    git(f.seed, "push", "-q", "origin", "master");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [c4], proofDir: f.proofDir }, fk.deps);
    expectRefused(
      r,
      "open-brain/package-lock.json changes better-sqlite3 (11.0.0 -> 12.1.0); every running open-brain server holds its native module and Windows will not replace it. Close every session first. Ask Aaron.",
    );
    expect(fk.npmCalls).toEqual([]);
  });

  it("npm cannot be located: refusal 8", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, { ...fk.deps, npm: null });
    expectRefused(r, "npm could not be located (set npm_execpath).");
  });
});

describe("R6: the happy path", () => {
  it("HEAD detached at <sha>, stamp <sha>, V3 current, the backup holds the OLD stamp, at most 3 backups", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    const old = snapshot(buildDir(f.main));
    const bk = backupsDir(f.main);
    for (const n of ["aaaaaaa-20200101T000000000Z", "bbbbbbb-20200102T000000000Z", "ccccccc-20200103T000000000Z", "ddddddd-20200104T000000000Z"]) {
      mkdirSync(join(bk, n), { recursive: true });
      writeFileSync(join(bk, n, "build-info.json"), "{}\n");
    }
    const fk = fakes(f.main);
    // No <sha>: origin/master's tip after the fetch.
    const r = await mr.mainRebuild(f.main, { positionals: [], proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(0);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c3);
    expect(() => git(f.main, "symbolic-ref", "-q", "HEAD")).toThrow();
    expect(stamp(f.main)).toBe(f.c3);
    expect(t).toMatch(new RegExp(`^REBUILT: serving build ${f.c3.slice(0, 7)} · current \\(fetch .+\\)\\.$`, "m"));
    const left = readdirSync(bk).sort();
    expect(left.length).toBe(3);
    const mine = left.filter((n) => n.startsWith(f.c1.slice(0, 7)));
    expect(mine.length).toBe(1);
    expect(snapshot(join(bk, mine[0]!))).toEqual(old);
    expect(left).not.toContain("aaaaaaa-20200101T000000000Z");
    expect(left).not.toContain("bbbbbbb-20200102T000000000Z");
    // V2 and V3 ran in children.
    expect(fk.nodeCalls.some((a) => a.join(" ").includes("server.js"))).toBe(true);
    expect(fk.nodeCalls.some((a) => a.join(" ").includes("serving-build"))).toBe(true);
  });

  const S = "abcdef1";
  it.each([
    [`Build ${S} · current`, "current"],
    [`Build ${S} · current (1 records-only commit behind)`, "current"],
    [`Build ${S} · current (12 records-only commits behind)`, "current"],
    [`Build ${S} · STALE: 2 code commits behind → ask Aaron to update`, "stale"],
    [`Build ${S} · STALE: 1 code commit behind, ahead by 1 → ask Aaron to update`, "stale"],
    [`Build 1234567 · current`, "other"],
    [`Serving build: not checked (garbage)`, "other"],
    [`Build ${S} · current (unmerged)`, "other"],
    [`Build ${S} · ahead by 1 (unmerged local commits)`, "other"],
    [`garbage`, "other"],
  ])("classify %j -> %s", (line, kind) => {
    expect(mr.classifyServingLine(line, S).kind).toBe(kind);
  });

  it("STALE after the build: keep it, exit 5", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main, { v3: (s) => `Build ${s} · STALE: 2 code commits behind → ask Aaron to update` });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(5);
    expect(text(r)).toContain(`REBUILT ${f.c3.slice(0, 7)}, but origin/master now has 2 code commits past it: run main-rebuild again.`);
    expect(stamp(f.main)).toBe(f.c3);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c3);
  });

  it("garbage from V3: restore, exit 3", async () => {
    const f = fixture();
    git(f.main, "checkout", "-q", "--detach", f.c2);
    setBuild(f.main, f.c1);
    const old = snapshot(buildDir(f.main));
    const fk = fakes(f.main, { v3: () => "Serving build: not checked (garbage)" });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(3);
    expect(text(r)).toContain("main-rebuild FAILED at ");
    expect(snapshot(buildDir(f.main))).toEqual(old);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c2);
  });
});

describe("R7: the build's exit code is not the verdict; a failure restores HEAD and build/", () => {
  it("a build that exits 0 but leaves the OLD stamp: exit 3, build/ byte-equal, HEAD restored", async () => {
    const f = fixture();
    git(f.main, "checkout", "-q", "--detach", f.c2);
    setBuild(f.main, f.c1);
    const old = snapshot(buildDir(f.main));
    const fk = fakes(f.main, { build: "leave-old-stamp" });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(3);
    expect(t).toContain("main-rebuild FAILED at ");
    expect(t).toContain(`RESTORED: HEAD ${f.c2.slice(0, 7)}, open-brain/build is the backup (stamp ${f.c1.slice(0, 7)}).`);
    expect(snapshot(buildDir(f.main))).toEqual(old);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c2);
  });

  it("a build that exits 1 after writing junk.js: exit 3, build/ byte-equal, HEAD restored, install re-run", async () => {
    const f = fixture();
    git(f.main, "checkout", "-q", "--detach", f.c2);
    setBuild(f.main, f.c1);
    const old = snapshot(buildDir(f.main));
    const fk = fakes(f.main, { build: "junk-exit-1" });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(3);
    expect(snapshot(buildDir(f.main))).toEqual(old);
    expect(existsSync(join(buildDir(f.main), "junk.js"))).toBe(false);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c2);
    // C1 -> C3 changes the lock, so install ran, and runs again in the restore.
    expect(fk.npmCalls.map((c) => c.args)).toEqual([["install"], ["run", "build"], ["install"]]);
  });
});

describe("R8: RECONNECT lists exactly the live sessions", () => {
  const server = (pid: number, ppid: number) => ({ pid, ppid, commandLine: "node C:/x/open-brain/build/server.js" });
  const writeProof = (dir: string, pid: number, start: string, sid: string, project: string): void =>
    writeFileSync(
      join(dir, `${pid}.json`),
      JSON.stringify({ session_id: sid, claude_pid: pid, proc_start: start, ide: "claude", written_at: "2026-10-13T00:00:00Z", transcript_path: `C:/u/.claude/projects/${project}/${sid}.jsonl` }) + "\n",
    );

  it("live, reused pid, dead, unreadable: one RECONNECT line, for the live one", async () => {
    const f = fixture();
    setBuild(f.main, f.c2);
    writeProof(f.proofDir, 101, "win:1", "aaaaaaaa-1111-1111-1111-111111111111", "C--proj-live");
    writeProof(f.proofDir, 102, "win:2", "bbbbbbbb-2222-2222-2222-222222222222", "C--proj-reused");
    writeProof(f.proofDir, 103, "win:3", "cccccccc-3333-3333-3333-333333333333", "C--proj-dead");
    writeFileSync(join(f.proofDir, "104.json"), "{not json");
    const table = new Map([101, 102, 103, 104].map((p) => [p + 100, server(p + 100, p)] as const));
    const fk = fakes(f.main, { startTimes: { 101: "win:1", 102: "win:999", 103: null, 104: "win:4" }, table });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(0);
    expect(t).toMatch(/^RECONNECT: 1 live session/m);
    const rows = r.lines.filter((l) => /pid \d+ {2}session /.test(l));
    expect(rows.length, t).toBe(1);
    expect(rows[0]).toContain("pid 101  session aaaaaaaa  C--proj-live");
    expect(t).toContain("Sessions with no proof are not listed; their greeting says STALE PROCESS until they reconnect.");
  });

  it("none live: RECONNECT: no live session found", async () => {
    const f = fixture();
    setBuild(f.main, f.c2);
    writeProof(f.proofDir, 102, "win:2", "bbbbbbbb-2222-2222-2222-222222222222", "C--proj-reused");
    const fk = fakes(f.main, { startTimes: { 102: "win:999" }, table: new Map([[202, server(202, 102)]]) });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(0);
    expect(t).toContain("RECONNECT: no live session found");
    expect(r.lines.filter((l) => /pid \d+ {2}session /.test(l))).toEqual([]);
    expect(t).toContain("Sessions with no proof are not listed; their greeting says STALE PROCESS until they reconnect.");
  });
});

describe("R9: --dry-run", () => {
  it("prints the plan and changes nothing", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    const head = git(f.main, "rev-parse", "HEAD");
    const old = snapshot(buildDir(f.main));
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [], dryRun: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(0);
    expect(t).toMatch(/WOULD/);
    expect(t).toContain("open-brain-build-backups");
    expect(t).toContain(`git checkout --detach ${f.c3}`);
    expect(t).toMatch(/npm install: yes/);
    expect(t).toContain("npm run build");
    expect(git(f.main, "rev-parse", "HEAD")).toBe(head);
    expect(git(f.main, "symbolic-ref", "--short", "HEAD")).toBe("master");
    expect(snapshot(buildDir(f.main))).toEqual(old);
    expect(existsSync(backupsDir(f.main))).toBe(false);
    expect(fk.npmCalls).toEqual([]);
    expect(fk.nodeCalls).toEqual([]);
  });
});

describe("R10: static imports only", () => {
  it("the module source contains no dynamic import(", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "..", "src", "pipelines", "main-rebuild", "index.ts"), "utf8");
    expect(src).not.toMatch(/\bimport\s*\(/);
  });
});

describe("usage", () => {
  it("more than one positional is refused", async () => {
    const f = fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c2, f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode).not.toBe(0);
    expect(text(r)).toContain("main-rebuild REFUSED: ");
    expect(text(r)).toContain("Nothing was changed.");
    expect(fk.npmCalls).toEqual([]);
  });
});
