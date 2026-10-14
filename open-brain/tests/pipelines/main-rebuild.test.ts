import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
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

// G-042: vitest does not yield between the tests of one file, and every git call here is a synchronous spawn. An async
// rm and a macrotask per fixture step let the worker answer its reporter, or the run exits 1 on
// `Timeout calling "onTaskUpdate"` with every test green.
const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
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

async function fixture(): Promise<Fixture> {
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
  await tick();
  writeFileSync(join(seed, "open-brain", "package-lock.json"), lock("4.1.0", "11.0.0"));
  const c2 = commitAll(seed, "C2 lock");
  await tick();
  writeFileSync(join(seed, "open-brain", "src", "a.ts"), "export const a = 3;\n");
  const c3 = commitAll(seed, "C3 src");
  await tick();
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  await tick();
  execFileSync("git", ["clone", "-q", origin, main], { stdio: ["ignore", "pipe", "pipe"] });
  git(main, "config", "user.email", "t@example.com");
  git(main, "config", "user.name", "T");
  await tick();
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

type BuildMode = "stamp" | "leave-old-stamp" | "junk-exit-1" | "tamper-backup-exit-1";

interface Fakes {
  deps: mr.MainRebuildDeps;
  npmCalls: { args: string[]; cwd: string }[];
  nodeCalls: string[][];
}

function fakes(
  tree: string,
  o: {
    build?: BuildMode;
    v3?: (sha7: string) => string;
    startTimes?: Record<number, string | null>;
    table?: Map<number, { pid: number; ppid: number; commandLine: string }> | null;
    /** On ["install"]: rewrite package-lock.json minified, standing in for npm 10 stripping "libc" (T-172 r3, F1). */
    lockRewrite?: boolean;
    /** The FIRST ["install"] returns this status, after any lockRewrite, with stderr `npm error code ERESOLVE`. */
    installExit?: number;
    /** V2 (a call naming better-sqlite3 and not serving-build) fails with this stderr. */
    v2Fail?: string;
  } = {},
): Fakes {
  const npmCalls: { args: string[]; cwd: string }[] = [];
  const nodeCalls: string[][] = [];
  const real = mr.defaultDeps();
  let installs = 0;
  const npm: mr.Runner = (args, cwd) => {
    npmCalls.push({ args: [...args], cwd });
    if (args.length === 1 && args[0] === "install") {
      if (o.lockRewrite) {
        const p = join(cwd, "package-lock.json");
        writeFileSync(p, JSON.stringify(JSON.parse(readFileSync(p, "utf8"))) + "\n");
      }
      installs += 1;
      if (o.installExit !== undefined && installs === 1) return { status: o.installExit, stdout: "", stderr: "npm error code ERESOLVE\n" };
    }
    if (args[0] === "run" && args[1] === "build") {
      const mode = o.build ?? "stamp";
      const b = join(cwd, "build");
      if (mode === "leave-old-stamp") return { status: 0, stdout: "", stderr: "" };
      if (mode === "tamper-backup-exit-1") {
        const bk = backupsDir(tree);
        for (const n of readdirSync(bk)) {
          if (statSync(join(bk, n)).isDirectory()) writeFileSync(join(bk, n, "build-info.json"), JSON.stringify({ commit: "0000000000000000000000000000000000000000" }));
        }
        return { status: 1, stdout: "", stderr: "error TS2322: junk" };
      }
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
    if (o.v2Fail !== undefined && code.includes("better-sqlite3")) return { status: 1, stdout: "", stderr: o.v2Fail };
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
    const f = await fixture();
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
    const f = await fixture();
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
    const f = await fixture();
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
    const f = await fixture();
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
    const f = await fixture();
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
    const f = await fixture();
    setBuild(f.main, f.c1);
    writeFileSync(join(f.main, "open-brain", "src", "a.ts"), "ahead\n");
    const ahead = commitAll(f.main, "ahead");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `HEAD carries 1 commit(s) that origin/master does not have: checking out ${f.c3.slice(0, 7)} would leave them reachable only through the reflog.`);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(ahead);
  });

  it("a failed fetch: refusal 4, naming --no-fetch", async () => {
    const f = await fixture();
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
    const f = await fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(stamp(f.main)).toBe(f.c3);
  });

  it("build at C2, <sha> C1: not ahead", async () => {
    const f = await fixture();
    setBuild(f.main, f.c2);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c1], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `${f.c1.slice(0, 7)} is not ahead of the serving build ${f.c2.slice(0, 7)}: this would roll every session back.`);
    expect(stamp(f.main)).toBe(f.c2);
  });

  it("<sha> equal to the build: nothing to do, exit 0", async () => {
    const f = await fixture();
    setBuild(f.main, f.c3);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `the serving build is already ${f.c3.slice(0, 7)}: nothing to do.`, 0);
    expect(fk.npmCalls).toEqual([]);
  });

  it("no stamp: refused", async () => {
    const f = await fixture();
    mkdirSync(buildDir(f.main), { recursive: true });
    writeFileSync(join(buildDir(f.main), "index.js"), "x\n");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `the serving build carries no stamp, so ${f.c3.slice(0, 7)} cannot be shown to be ahead of it.`);
  });
});

describe("R5: npm install only when the manifest changed since the BUILT commit; never ci", () => {
  it("a src-only change: npm runs exactly build", async () => {
    const f = await fixture();
    setBuild(f.main, f.c2);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(fk.npmCalls.map((c) => c.args)).toEqual([["run", "build"]]);
  });

  it("a lock change: install then build, both in open-brain", async () => {
    const f = await fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    await mr.mainRebuild(f.main, { positionals: [f.c2], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(fk.npmCalls.map((c) => c.args)).toEqual([["install"], ["run", "build"]]);
    for (const c of fk.npmCalls) expect(realpathSync(c.cwd)).toBe(realpathSync(join(f.main, "open-brain")));
  });

  it("HEAD already past the lock change, the build older: install still runs", async () => {
    const f = await fixture();
    setBuild(f.main, f.c1);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c3);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(fk.npmCalls.map((c) => c.args)).toEqual([["install"], ["run", "build"]]);
    expect(fk.npmCalls.some((c) => c.args.includes("ci"))).toBe(false);
  });

  it("a better-sqlite3 version change in the lock: refusal 7", async () => {
    const f = await fixture();
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
    const f = await fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, { ...fk.deps, npm: null });
    expectRefused(r, "npm could not be located (set npm_execpath).");
  });
});

describe("R6: the happy path", () => {
  it("HEAD detached at <sha>, stamp <sha>, V3 current, the backup holds the OLD stamp, at most 3 backups", async () => {
    const f = await fixture();
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
    expect(fk.nodeCalls.some((a) => a.join(" ").includes('new Database(":memory:")'))).toBe(true);
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

  it("STALE after the build with an explicit <sha>: keep it, exit 0", async () => {
    const f = await fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main, { v3: (s) => `Build ${s} · STALE: 2 code commits behind → ask Aaron to update` });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(text(r)).toContain(`REBUILT: serving build ${f.c3.slice(0, 7)} as asked · 2 code commit(s) behind origin/master (fetch `);
    expect(stamp(f.main)).toBe(f.c3);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c3);
  });

  it("N-stale: STALE after the build with no <sha>: keep it, exit 5", async () => {
    const f = await fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main, { v3: (s) => `Build ${s} · STALE: 2 code commits behind → ask Aaron to update` });
    const r = await mr.mainRebuild(f.main, { positionals: [], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(5);
    expect(text(r)).toContain(`REBUILT ${f.c3.slice(0, 7)}, but origin/master now has 2 code commits past it: run main-rebuild again.`);
    expect(stamp(f.main)).toBe(f.c3);
  });

  it("garbage from V3: restore, exit 3", async () => {
    const f = await fixture();
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
    const f = await fixture();
    git(f.main, "checkout", "-q", "--detach", f.c2);
    setBuild(f.main, f.c1);
    const old = snapshot(buildDir(f.main));
    // V3 is made to vouch for <sha>, so only V1 (the stamp read back) can see that this build did not build it.
    const fk = fakes(f.main, { build: "leave-old-stamp", v3: () => `Build ${f.c3.slice(0, 7)} · current` });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(3);
    expect(t).toContain("main-rebuild FAILED at ");
    expect(t).toContain(`RESTORED: HEAD ${f.c2.slice(0, 7)}, open-brain/build is the backup (stamp ${f.c1.slice(0, 7)}).`);
    expect(snapshot(buildDir(f.main))).toEqual(old);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c2);
  });

  it("a build that exits 1 after writing junk.js: exit 3, build/ byte-equal, HEAD restored, install re-run", async () => {
    const f = await fixture();
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
    const f = await fixture();
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
    const f = await fixture();
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

  it("MB: only a pid whose tree runs an open-brain server, at any depth", async () => {
    const f = await fixture();
    setBuild(f.main, f.c2);
    writeProof(f.proofDir, 101, "win:1", "aaaaaaaa-1111-1111-1111-111111111111", "C--proj-a");
    writeProof(f.proofDir, 105, "win:5", "eeeeeeee-5555-5555-5555-555555555555", "C--proj-e");
    writeProof(f.proofDir, 106, "win:6", "ffffffff-6666-6666-6666-666666666666", "C--proj-f");
    const table = new Map([
      [201, server(201, 101)],
      [205, { pid: 205, ppid: 105, commandLine: "node C:/x/other-tool.js" }],
      [206, { pid: 206, ppid: 106, commandLine: "cmd.exe /c x" }],
      [306, server(306, 206)],
    ]);
    const fk = fakes(f.main, { startTimes: { 101: "win:1", 105: "win:5", 106: "win:6" }, table });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(0);
    const rows = r.lines.filter((l) => /pid \d+ {2}session /.test(l));
    expect(rows.length, t).toBe(2);
    expect(rows[0]).toContain("pid 101  session aaaaaaaa");
    expect(rows[1]).toContain("pid 106  session ffffffff");
  });

  it("ME: an unreadable process table lists every live proof, and says so", async () => {
    const f = await fixture();
    setBuild(f.main, f.c2);
    writeProof(f.proofDir, 101, "win:1", "aaaaaaaa-1111-1111-1111-111111111111", "C--proj-a");
    const fk = fakes(f.main, { startTimes: { 101: "win:1" }, table: null });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(0);
    const rows = r.lines.filter((l) => /pid \d+ {2}session /.test(l));
    expect(rows.length, t).toBe(1);
    expect(rows[0]).toContain("pid 101  session aaaaaaaa");
    expect(t).toContain("(the process table could not be read, so every live proof is listed)");
  });

  it("N-pid: a proof whose file name is not its claude_pid is skipped", async () => {
    const f = await fixture();
    setBuild(f.main, f.c2);
    writeProof(f.proofDir, 101, "win:1", "aaaaaaaa-1111-1111-1111-111111111111", "C--proj-a");
    writeFileSync(join(f.proofDir, "107.json"), readFileSync(join(f.proofDir, "101.json")));
    const fk = fakes(f.main, { startTimes: { 101: "win:1" }, table: new Map([[201, server(201, 101)]]) });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(0);
    expect(r.lines.filter((l) => /pid \d+ {2}session /.test(l)).length, t).toBe(1);
  });
});

describe("R9: --dry-run", () => {
  it("prints the plan and changes nothing", async () => {
    const f = await fixture();
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
    const f = await fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c2, f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode).not.toBe(0);
    expect(text(r)).toContain("main-rebuild REFUSED: ");
    expect(text(r)).toContain("Nothing was changed.");
    expect(fk.npmCalls).toEqual([]);
  });

  it("N-dash: a dash-led positional is refused, exit 2", async () => {
    const f = await fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: ["--upload-pack=evil"], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, `"--upload-pack=evil" is not a commit: a <sha> never starts with "-".`, 2);
    expect(fk.npmCalls).toEqual([]);
  });
});

// T-172 r3 (the Opus review's findings).
const porcelain = (tree: string): string => git(tree, "status", "--porcelain");

describe("F1: the tracked manifests are put back after every install", () => {
  it("F1-a: an install that rewrites the lock leaves the tree clean, exit 0", async () => {
    const f = await fixture();
    setBuild(f.main, f.c1);
    const fk = fakes(f.main, { lockRewrite: true });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(porcelain(f.main)).toBe("");
    // core.autocrlf (true on this host) checks the lock out with CRLF, and git show prints LF: compare with LF.
    const onDisk = readFileSync(join(f.main, "open-brain", "package-lock.json"), "utf8").replace(/\r\n/g, "\n");
    const inHead = execFileSync("git", ["show", "HEAD:open-brain/package-lock.json"], { cwd: f.main, encoding: "utf8" });
    expect(onDisk).toBe(inHead);
  });

  it("F1-b: a failed build after a lock-rewriting install restores cleanly, exit 3", async () => {
    const f = await fixture();
    git(f.main, "checkout", "-q", "--detach", f.c2);
    setBuild(f.main, f.c1);
    const old = snapshot(buildDir(f.main));
    const fk = fakes(f.main, { lockRewrite: true, build: "junk-exit-1" });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(3);
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c2);
    expect(porcelain(f.main)).toBe("");
    expect(snapshot(buildDir(f.main))).toEqual(old);
  });

  // Main detached at C1, not C2: C2 and C3 carry the same lock, so git checks C2 out over a dirty lock without
  // complaint and the restore's first put-back would go untested. C1's lock differs from C3's.
  it("F1-c: a failed install that rewrote the lock: exit 3, the cause is npm's error, HEAD and the tree restored", async () => {
    const f = await fixture();
    git(f.main, "checkout", "-q", "--detach", f.c1);
    setBuild(f.main, f.c1);
    const fk = fakes(f.main, { lockRewrite: true, installExit: 1 });
    let putBacks = 0;
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, {
      ...fk.deps,
      git: (args, cwd) =>
        args[0] === "checkout" && args.includes("open-brain/package-lock.json") && ++putBacks === 1
          ? { status: 1, stdout: "", stderr: "error: simulated put-back failure" }
          : fk.deps.git(args, cwd),
    });
    const t = text(r);
    expect(r.exitCode, t).toBe(3);
    expect(t).toContain("main-rebuild FAILED at npm install: npm error code ERESOLVE");
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c1);
    expect(porcelain(f.main)).toBe("");
  });
});

describe("F2: V2 opens a database through the build's own dependency", () => {
  const ob = (): string => {
    const d = join(root, "ob");
    mkdirSync(join(d, "build"), { recursive: true });
    mkdirSync(join(d, "node_modules", "better-sqlite3"), { recursive: true });
    writeFileSync(join(d, "package.json"), JSON.stringify({ type: "module" }));
    writeFileSync(join(d, "build", "server.js"), "export {};\n");
    writeFileSync(join(d, "node_modules", "better-sqlite3", "package.json"), JSON.stringify({ name: "better-sqlite3", main: "index.js" }));
    writeFileSync(
      join(d, "node_modules", "better-sqlite3", "index.js"),
      'const fs = require("node:fs"), path = require("node:path"); module.exports = class Database { constructor() { if (fs.existsSync(path.join(__dirname, "FAIL"))) throw new Error("Could not locate the bindings file"); } close() {} };',
    );
    return d;
  };
  const fail = (d: string): void => writeFileSync(join(d, "node_modules", "better-sqlite3", "FAIL"), "");
  const url = (d: string): string => pathToFileURL(join(d, "build", "server.js")).href;

  it("V2-a: a working binding passes", () => {
    const d = ob();
    const r = mr.defaultDeps().node(mr.v2Args(url(d)), d);
    expect(r.status, r.stderr).toBe(0);
  });

  it("V2-b: a binding that cannot load fails V2", () => {
    const d = ob();
    fail(d);
    const r = mr.defaultDeps().node(mr.v2Args(url(d)), d);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Could not locate the bindings file");
  });

  it("V2-c: round 2's import alone passes over a broken binding (the reason for V2-b)", () => {
    const d = ob();
    fail(d);
    const r = mr.defaultDeps().node(["--input-type=module", "-e", `import ${JSON.stringify(url(d))};`], d);
    expect(r.status, r.stderr).toBe(0);
  });
});

describe("F3: only backup names are pruned", () => {
  it("a README and hand-made directories are never read, counted or deleted", async () => {
    const f = await fixture();
    setBuild(f.main, f.c1);
    const bk = backupsDir(f.main);
    for (const n of ["aaaaaaa-20261010T120000000Z", "bbbbbbb-20261011T120000000Z", "ccccccc-20261012T120000000Z", "manual-keep", "x-1999"]) {
      mkdirSync(join(bk, n), { recursive: true });
    }
    writeFileSync(join(bk, "README.txt"), "mine\n");
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(0);
    expect(new Set(readdirSync(bk))).toEqual(
      new Set(["README.txt", "manual-keep", "x-1999", "bbbbbbb-20261011T120000000Z", "ccccccc-20261012T120000000Z", `${f.c1.slice(0, 7)}-20261013T120000000Z`]),
    );
  });
});

describe("F4: refusal 2b, a flag that hides a tracked file's changes", () => {
  it.each([
    ["skip-worktree", "open-brain/src/a.ts", "// local edit\n", "open-brain/src/a.ts (skip-worktree)"],
    ["assume-unchanged", "open-brain/package.json", " \n", "open-brain/package.json (assume-unchanged)"],
  ])("F4: --%s", async (flag, file, append, named) => {
    const f = await fixture();
    setBuild(f.main, f.c1);
    git(f.main, "update-index", `--${flag}`, file);
    const p = join(f.main, file);
    writeFileSync(p, readFileSync(p, "utf8") + append);
    const fk = fakes(f.main);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expectRefused(r, named);
    expect(existsSync(backupsDir(f.main))).toBe(false);
    expect(fk.npmCalls).toEqual([]);
  });
});

describe("MA, MC, MD, MF: the restore", () => {
  it("MA: a failure on a branch puts the branch back, not a detached HEAD", async () => {
    const f = await fixture();
    git(f.main, "checkout", "-q", "-B", "master", f.c2);
    setBuild(f.main, f.c1);
    const fk = fakes(f.main, { build: "junk-exit-1" });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    expect(r.exitCode, text(r)).toBe(3);
    expect(git(f.main, "symbolic-ref", "--short", "HEAD")).toBe("master");
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c2);
  });

  it("MC: a restore checkout that fails: exit 4, the cause and the by-hand recipe", async () => {
    const f = await fixture();
    git(f.main, "checkout", "-q", "--detach", f.c2);
    setBuild(f.main, f.c1);
    const fk = fakes(f.main, { build: "junk-exit-1" });
    const realGit = fk.deps.git;
    const gitDep: mr.Runner = (args, cwd) =>
      args[0] === "checkout" && args[args.length - 1] === f.c2 ? { status: 1, stdout: "", stderr: "error: simulated restore failure" } : realGit(args, cwd);
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, { ...fk.deps, git: gitDep });
    const t = text(r);
    expect(r.exitCode, t).toBe(4);
    expect(t).toContain(`RESTORE FAILED: git checkout ${f.c2.slice(0, 7)}: error: simulated restore failure`);
    expect(t).toContain(`By hand: git checkout -- open-brain/package.json open-brain/package-lock.json; git checkout --detach ${f.c2}; copy `);
  });

  it("MD: a restored stamp that is not the old build: exit 4", async () => {
    const f = await fixture();
    git(f.main, "checkout", "-q", "--detach", f.c2);
    setBuild(f.main, f.c1);
    const fk = fakes(f.main, { build: "tamper-backup-exit-1" });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(4);
    expect(t).toContain(`the restored stamp is 0000000, not ${f.c1.slice(0, 7)}`);
  });

  it("MF: V2 failing restores, exit 3, the cause named", async () => {
    const f = await fixture();
    git(f.main, "checkout", "-q", "--detach", f.c2);
    setBuild(f.main, f.c1);
    const old = snapshot(buildDir(f.main));
    const fk = fakes(f.main, { v2Fail: "Error: Could not locate the bindings file" });
    const r = await mr.mainRebuild(f.main, { positionals: [f.c3], noFetch: true, proofDir: f.proofDir }, fk.deps);
    const t = text(r);
    expect(r.exitCode, t).toBe(3);
    expect(t).toContain("main-rebuild FAILED at V2 (import server.js, open a database): Error: Could not locate the bindings file");
    expect(git(f.main, "rev-parse", "HEAD")).toBe(f.c2);
    expect(snapshot(buildDir(f.main))).toEqual(old);
  });
});

describe("N-cause: runCause names the real error", () => {
  const run = (o: Partial<mr.Run>): mr.Run => ({ status: 1, stdout: "", stderr: "", ...o });
  it.each([
    [
      "tsc's error on stdout, past npm's banner",
      run({
        stdout: "> open-brain@0.1.0-u prebuild\n> node x\n\nsrc/x.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.\n",
        stderr: "npm error Lifecycle script `build` failed with error:\nnpm error code 2\n",
      }),
      "src/x.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.",
    ],
    [
      "git's blocking file, joined to its line",
      run({
        stderr:
          "error: Your local changes to the following files would be overwritten by checkout:\n\topen-brain/package-lock.json\nPlease commit your changes or stash them before you switch branches.\nAborting\n",
      }),
      "error: Your local changes to the following files would be overwritten by checkout: open-brain/package-lock.json",
    ],
    ["a spawn error", run({ error: "spawnSync npm ETIMEDOUT", stdout: "x error y", stderr: "error z" }), "spawnSync npm ETIMEDOUT"],
    ["nothing at all", run({ status: 3 }), "exit 3"],
    ["no error word", run({ stdout: "plain first line\nsecond" }), "plain first line"],
  ])("%s", (_name, r, expected) => {
    expect(mr.runCause(r)).toBe(expected);
  });

  it("a long cause is cut to 300 characters", () => {
    const c = mr.runCause(run({ stderr: `error ${"x".repeat(400)}` }));
    expect(c.length).toBe(300);
    expect(c.endsWith("…")).toBe(true);
  });
});
