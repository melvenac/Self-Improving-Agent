/**
 * T-192: a master push runs on tcm. `evalRunsOn` is the small evaluator for the
 * one `runs-on` expression. `&&` binds tighter than `||`, and each returns the
 * value rather than a boolean, as GitHub's expression language does.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse } from "yaml";

const workflowPath = join(import.meta.dirname, "../../../../.github/workflows/ci.yml");
const TCM = ["self-hosted", "linux", "tcm"];

type Ctx = {
  event: string;
  ref: string;
  hosted: boolean | null;
  commits?: unknown;
  changedResult?: string;
  changedSkip?: string;
};

function truthy(v: unknown): boolean {
  return v !== false && v !== null && v !== undefined && v !== "" && v !== 0;
}

/** Evaluate the `${{ ... }}` expression on `jobs.test.runs-on`. */
export function evalRunsOn(runsOn: string, ctx: Ctx): unknown {
  const inner = runsOn.replace(/^\$\{\{\s*/, "").replace(/\s*\}\}$/, "");
  let i = 0;
  const s = inner;
  const skip = () => { while (s[i] === " ") i++; };
  function parseOr(): unknown {
    let left = parseAnd();
    skip();
    while (s.startsWith("||", i)) {
      i += 2;
      const right = parseAnd();
      left = truthy(left) ? left : right;
    }
    return left;
  }
  function parseAnd(): unknown {
    let left = parseEq();
    skip();
    while (s.startsWith("&&", i)) {
      i += 2;
      const right = parseEq();
      left = truthy(left) ? right : left;
    }
    return left;
  }
  function parseEq(): unknown {
    let left = parseUnary();
    skip();
    if (s.startsWith("!=", i)) {
      i += 2;
      const right = parseUnary();
      return left !== right;
    }
    if (s.startsWith("==", i)) {
      i += 2;
      const right = parseUnary();
      return left === right;
    }
    return left;
  }
  function parseUnary(): unknown {
    skip();
    if (s[i] === "!" && s[i + 1] !== "=") {
      i++;
      return !truthy(parseUnary());
    }
    return parsePrimary();
  }
  function parsePrimary(): unknown {
    skip();
    if (s[i] === "(") {
      i++;
      const v = parseOr();
      skip();
      if (s[i] === ")") i++;
      return v;
    }
    if (s[i] === "'") {
      i++;
      let out = "";
      while (i < s.length && s[i] !== "'") out += s[i++];
      i++;
      return out;
    }
    const m = /^[A-Za-z_.][A-Za-z0-9_.]*/.exec(s.slice(i));
    if (!m) throw new Error(`evalRunsOn: bad token at ${JSON.stringify(s.slice(i))}`);
    i += m[0].length;
    skip();
    if (s[i] === "(") {
      i++;
      const args: unknown[] = [];
      skip();
      if (s[i] !== ")") {
        args.push(parseOr());
        skip();
        while (s[i] === ",") {
          i++;
          args.push(parseOr());
          skip();
        }
      }
      if (s[i] === ")") i++;
      if (m[0] === "cancelled") return false;
      if (m[0] === "fromJSON") return JSON.parse(String(args[0]));
      if (m[0] === "toJSON") return JSON.stringify(args[0] ?? null);
      if (m[0] === "contains") return String(args[0] ?? "").includes(String(args[1] ?? ""));
      throw new Error(`evalRunsOn: unknown call ${m[0]}`);
    }
    if (m[0] === "true") return true;
    if (m[0] === "false") return false;
    if (m[0] === "null") return null;
    if (m[0] === "github.event_name") return ctx.event;
    if (m[0] === "github.ref") return ctx.ref;
    if (m[0] === "github.event.commits") return ctx.commits ?? null;
    if (m[0] === "needs.changed.result") return ctx.changedResult ?? "";
    if (m[0] === "needs.changed.outputs.skip") return ctx.changedSkip ?? "";
    if (m[0] === "inputs.hosted") return ctx.hosted;
    throw new Error(`evalRunsOn: unknown name ${m[0]}`);
  }
  return parseOr();
}

type Workflow = {
  on: {
    push?: { branches?: string[]; "paths-ignore"?: string[]; paths?: unknown };
    pull_request?: { "paths-ignore"?: string[] };
    workflow_dispatch?: Record<string, unknown> | null;
  };
  concurrency?: { group?: unknown; "cancel-in-progress"?: unknown };
  jobs: Record<string, { if?: string }>;
};

function workflow(): Workflow {
  return parse(readFileSync(workflowPath, "utf-8")) as Workflow;
}

/** GitHub drops a push when every path matches paths-ignore. No list means the push triggers. */
function pushTriggers(paths: string[]): boolean {
  const ignore = workflow().on.push?.["paths-ignore"];
  if (!ignore || ignore.length === 0 || paths.length === 0) return true;
  const matched = (pattern: string, path: string) => {
    if (pattern.endsWith("/**")) {
      const root = pattern.slice(0, -3);
      return path === root || path.startsWith(root + "/");
    }
    return path === pattern;
  };
  return !paths.every((path) => ignore.some((pattern) => matched(pattern, path)));
}

const skipScript = join(import.meta.dirname, "../../../scripts/ci-seat-skip.mjs");

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** What ci-seat-skip.mjs prints for a real pair of commits, or for a sha git cannot read. */
function seatSkip(paths: string[] | "unreadable"): string {
  const root = mkdtempSync(join(tmpdir(), "ci-seat-"));
  try {
    git(root, ["init"]);
    git(root, ["config", "user.email", "forge@example.com"]);
    git(root, ["config", "user.name", "forge"]);
    git(root, ["commit", "--allow-empty", "-m", "base"]);
    const before = git(root, ["rev-parse", "HEAD"]).trim();
    const after = paths === "unreadable" ? "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" : before;
    if (paths !== "unreadable") {
      for (const rel of paths) {
        const abs = join(root, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, "x\n");
      }
      git(root, ["add", "-A"]);
      git(root, ["commit", "-m", "change"]);
    }
    const head = paths === "unreadable" ? before : git(root, ["rev-parse", "HEAD"]).trim();
    const from = paths === "unreadable" ? after : before;
    const out = execFileSync("node", [skipScript, from, head], { cwd: root, encoding: "utf8" });
    const line = out.trim().split(/\r?\n/).filter((row) => row.startsWith("skip=")).at(-1) ?? "";
    return line === "skip=true" ? "true" : "false";
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The test job runs when the push is not path-filtered and its if is absent or true. */
function testJobRuns(ctx: Ctx, paths: string[] | "unreadable"): boolean {
  if (ctx.event === "push" && paths !== "unreadable" && !pushTriggers(paths)) return false;
  const jobIf = workflow().jobs.test.if;
  if (!jobIf) return true;
  if (jobIf.includes("github.event.commits")) {
    const listed = paths === "unreadable" ? [] : paths;
    return truthy(evalRunsOn(jobIf, { ...ctx, commits: [{ modified: listed }] }));
  }
  // The changed job runs on a pull request (D-091) and on a non-master push (T-178).
  const seat = ctx.event === "pull_request" || (ctx.event === "push" && ctx.ref !== "refs/heads/master");
  return truthy(evalRunsOn(jobIf, {
    ...ctx,
    changedResult: seat ? "success" : "skipped",
    changedSkip: seat ? seatSkip(paths) : "",
  }));
}

function runsOn(): string {
  const doc = parse(readFileSync(workflowPath, "utf-8")) as { jobs: Record<string, { "runs-on"?: unknown; if?: unknown; steps?: Array<{ name?: string; if?: string }> }> };
  const test = doc.jobs.test;
  expect(test, "job name stays test").toBeTruthy();
  expect(typeof test["runs-on"]).toBe("string");
  return test["runs-on"] as string;
}

describe("ci.yml runs-on (T-192)", () => {
  const expr = runsOn();

  it("a master push runs on tcm", () => {
    expect(evalRunsOn(expr, { event: "push", ref: "refs/heads/master", hosted: null })).toEqual(TCM);
  });

  it("a dispatch runs on tcm", () => {
    expect(evalRunsOn(expr, { event: "workflow_dispatch", ref: "refs/heads/loop/x", hosted: false })).toEqual(TCM);
  });

  it("a dispatch with hosted=true runs on ubuntu-latest", () => {
    expect(evalRunsOn(expr, { event: "workflow_dispatch", ref: "refs/heads/master", hosted: true })).toBe("ubuntu-latest");
  });

  it("a push to a non-master branch runs on tcm", () => {
    expect(evalRunsOn(expr, { event: "push", ref: "refs/heads/loop/x", hosted: null })).toEqual(TCM);
  });

  it("keeps the egress self-check on the test job and leaves test-windows opt-in", () => {
    const doc = parse(readFileSync(workflowPath, "utf-8")) as {
      jobs: Record<string, { if?: string; steps?: Array<{ name?: string; if?: string }> }>;
      on?: { workflow_dispatch?: { inputs?: Record<string, unknown> } };
    };
    const egress = doc.jobs.test.steps?.find((s) => s.name === "Egress isolation self-check (tcm)");
    expect(egress?.if).toBe("runner.environment == 'self-hosted'");
    expect(doc.jobs["test-windows"].if).toBe("github.event_name == 'workflow_dispatch' && inputs.windows");
    expect(doc.on?.workflow_dispatch?.inputs).toMatchObject({ hosted: expect.anything(), windows: expect.anything() });
  });

  it("a pull request has no paths filter, so a docs-only PR starts the workflow and reports test (D-091, T-219)", () => {
    const doc = parse(readFileSync(workflowPath, "utf-8")) as {
      on: {
        pull_request?: { "paths-ignore"?: string[]; paths?: unknown } | null;
      };
    };
    // D-055 filtered docs-only PRs out here. A workflow that never starts never reports `test`,
    // which master's ruleset requires, so the PR was blocked forever.
    expect("pull_request" in doc.on, "the pull_request trigger is gone").toBe(true);
    expect(doc.on.pull_request == null || !("paths-ignore" in doc.on.pull_request || "paths" in doc.on.pull_request)).toBe(true);
  });

  it("T-219 a docs-only PR skips test at the job level, a code PR runs it, and there is no stub job named test", () => {
    const docsOnly = ["docs/loops/x.md", "README.md"];
    const pr = { event: "pull_request", ref: "refs/pull/1/merge", hosted: null } as const;
    expect(testJobRuns(pr, docsOnly), "a docs-only PR ran test").toBe(false);
    expect(testJobRuns(pr, ["open-brain/src/cli.ts"]), "a code PR skipped test").toBe(true);
    expect(testJobRuns(pr, [".github/workflows/ci.yml", "docs/a.md"]), "a PR changing ci.yml plus docs skipped test").toBe(true);
    expect(testJobRuns(pr, "unreadable"), "an unreadable change list skipped test").toBe(true);
    // Not allowed (D-091): a second workflow or stub job that reports `test` and always passes.
    const doc = parse(readFileSync(workflowPath, "utf-8")) as { jobs: Record<string, { name?: string; steps?: unknown[] }> };
    const named = Object.entries(doc.jobs).filter(([id, job]) => id === "test" || job.name === "test");
    expect(named.map(([id]) => id)).toEqual(["test"]);
    expect((doc.jobs.test.steps ?? []).length, "the test job lost its steps").toBeGreaterThan(5);
    expect(JSON.stringify(doc.jobs.test)).toContain("npm ci");
  });

  it("T-219 a PR is diffed from the merge-base, so master's later code does not keep a docs-only PR from skipping", () => {
    const root = mkdtempSync(join(tmpdir(), "ci-pr-"));
    try {
      git(root, ["init", "--initial-branch=main"]);
      git(root, ["config", "user.email", "forge@example.com"]);
      git(root, ["config", "user.name", "forge"]);
      git(root, ["commit", "--allow-empty", "-m", "base"]);
      const branchPoint = git(root, ["rev-parse", "HEAD"]).trim();
      git(root, ["checkout", "-q", "-b", "pr"]);
      mkdirSync(join(root, "docs"), { recursive: true });
      writeFileSync(join(root, "docs/a.md"), "x\n");
      git(root, ["add", "-A"]);
      git(root, ["commit", "-m", "docs only"]);
      const head = git(root, ["rev-parse", "HEAD"]).trim();
      git(root, ["checkout", "-q", "main"]);
      mkdirSync(join(root, "open-brain"), { recursive: true });
      writeFileSync(join(root, "open-brain/code.ts"), "x\n");
      git(root, ["add", "-A"]);
      git(root, ["commit", "-m", "master moved on with code"]);
      const base = git(root, ["rev-parse", "HEAD"]).trim();
      const run = (from: string): string =>
        execFileSync("node", [skipScript, from, head], { cwd: root, encoding: "utf8" }).trim();
      const mergeBase = git(root, ["merge-base", base, head]).trim();
      expect(mergeBase).toBe(branchPoint);
      expect(run(mergeBase), "from the merge-base").toBe("skip=true");
      expect(run(base), "from base.sha: master's own code change leaks in (the safe, but wrong, direction)").toBe("skip=false");
      expect(run(""), "an empty merge-base").toBe("skip=false");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("push branches are master, loop/**, and qa/** (T-178)", () => {
    const doc = parse(readFileSync(workflowPath, "utf-8")) as {
      on: { push?: { branches?: string[] } };
    };
    expect(doc.on.push?.branches).toEqual(["master", "loop/**", "qa/**"]);
  });

  it("a push has no paths filter, so master is not filtered, and a dispatch has none either (T-178)", () => {
    const doc = workflow();
    const push = doc.on.push ?? {};
    expect("paths" in push || "paths-ignore" in push).toBe(false);
    const dispatch = doc.on.workflow_dispatch;
    expect(dispatch == null || !("paths" in dispatch || "paths-ignore" in dispatch)).toBe(true);
  });

  it("a push and the pull request for that branch share one concurrency group, and a dispatch does not join it (T-178)", () => {
    const doc = parse(readFileSync(workflowPath, "utf-8")) as {
      concurrency?: { group?: unknown; "cancel-in-progress"?: unknown };
    };
    expect(doc.concurrency, "concurrency is absent").toBeTruthy();
    const group = String(doc.concurrency?.group ?? "");
    expect(group).toContain("github.head_ref || github.ref_name");
    expect(group).toContain("github.event_name == 'workflow_dispatch'");
    const cancel = String(doc.concurrency?.["cancel-in-progress"] ?? "");
    expect(truthy(evalRunsOn(cancel, { event: "workflow_dispatch", ref: "refs/heads/loop/x", hosted: null }))).toBe(false);
    expect(truthy(evalRunsOn(cancel, { event: "push", ref: "refs/heads/loop/x", hosted: null }))).toBe(true);
    expect(truthy(evalRunsOn(cancel, { event: "pull_request", ref: "refs/pull/1/merge", hosted: null }))).toBe(true);
  });

  it("a master push whose only path is under docs still runs the test job (T-178)", () => {
    expect(
      testJobRuns({ event: "push", ref: "refs/heads/master", hosted: null }, ["docs/loops/x.md"]),
      "a docs-only master push did not run the test job",
    ).toBe(true);
  });

  it("a seat push of docs and README does not run the test job, and a seat push of open-brain does (T-178)", () => {
    expect(testJobRuns({ event: "push", ref: "refs/heads/loop/x", hosted: null }, ["docs/a.md", "README.md"])).toBe(false);
    expect(testJobRuns({ event: "push", ref: "refs/heads/qa/y", hosted: null }, ["open-brain/src/cli.ts"])).toBe(true);
  });

  it("a seat push of a code path outside the prefix list plus a docs file still runs (T-178)", () => {
    expect(
      testJobRuns({ event: "push", ref: "refs/heads/loop/x", hosted: null }, ["LICENSE", "docs/a.md"]),
      "a code file outside the prefix list was skipped because a docs file was in the same push",
    ).toBe(true);
  });

  it("an unreadable change list still runs the test job (T-178)", () => {
    expect(testJobRuns({ event: "push", ref: "refs/heads/qa/y", hosted: null }, "unreadable")).toBe(true);
  });

  it("a failed change-list job still runs the test job (T-178)", () => {
    const jobIf = workflow().jobs.test.if ?? "";
    expect(truthy(evalRunsOn(jobIf, {
      event: "push", ref: "refs/heads/loop/x", hosted: null, changedResult: "failure", changedSkip: "true",
    }))).toBe(true);
  });

  it("test's if names a status function, so a skipped changed job does not skip test (T-178)", () => {
    const jobIf = workflow().jobs.test.if ?? "";
    expect(
      jobIf.includes("!cancelled()") || jobIf.includes("always("),
      "GitHub skips a needed job unless the if calls always, cancelled, or success",
    ).toBe(true);
  });

  it("the change list is git diff of before..sha, and the test job runs unless that output is exactly true (T-178)", () => {
    const doc = workflow() as Workflow & {
      jobs: Record<string, {
        if?: string;
        needs?: string;
        "runs-on"?: string;
        outputs?: { skip?: string };
        steps?: Array<{ id?: string; uses?: string; run?: string; with?: { "fetch-depth"?: number } }>;
      }>;
    };
    const changed = doc.jobs.changed;
    expect(changed.if).toBe("github.event_name == 'pull_request' || (github.event_name == 'push' && github.ref != 'refs/heads/master')");
    expect(changed["runs-on"]).toBe(doc.jobs.test["runs-on"]);
    expect(changed.outputs?.skip).toBe("${{ steps.diff.outputs.skip }}");
    const checkout = changed.steps?.find((step) => step.uses === "actions/checkout@v4");
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    const diff = changed.steps?.find((step) => step.id === "diff");
    expect(diff?.run).toContain("open-brain/scripts/ci-seat-skip.mjs");
    expect(diff?.run).toContain("github.event.before");
    expect(diff?.run).toContain("github.sha");
    expect(diff?.run).toContain("github.event.pull_request.base.sha");
    expect(diff?.run).toContain("github.event.pull_request.head.sha");
    expect(diff?.run).toContain("git merge-base");
    expect(diff?.run).not.toContain("github.event.commits");
    expect(doc.jobs.test.needs).toBe("changed");
    const jobIf = doc.jobs.test.if ?? "";
    expect(truthy(evalRunsOn(jobIf, {
      event: "push", ref: "refs/heads/loop/x", hosted: null, changedResult: "success", changedSkip: "true",
    }))).toBe(false);
    expect(truthy(evalRunsOn(jobIf, {
      event: "push", ref: "refs/heads/loop/x", hosted: null, changedResult: "success", changedSkip: "false",
    }))).toBe(true);
  });

  it("cancel-in-progress evaluates to false for a push to refs/heads/master (T-178)", () => {
    const cancel = String(workflow().concurrency?.["cancel-in-progress"] ?? "");
    expect(truthy(evalRunsOn(cancel, { event: "push", ref: "refs/heads/master", hosted: null }))).toBe(false);
  });
});
