/**
 * T-192: a master push runs on tcm. `evalRunsOn` is the small evaluator for the
 * one `runs-on` expression. `&&` binds tighter than `||`, and each returns the
 * value rather than a boolean, as GitHub's expression language does.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const workflowPath = join(import.meta.dirname, "../../../../.github/workflows/ci.yml");
const TCM = ["self-hosted", "linux", "tcm"];

type Ctx = { event: string; ref: string; hosted: boolean | null; commits?: unknown };

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

/** The test job runs when the push is not path-filtered and its if is absent or true. */
function testJobRuns(ctx: Ctx, paths: string[]): boolean {
  if (ctx.event === "push" && !pushTriggers(paths)) return false;
  const jobIf = workflow().jobs.test.if;
  if (!jobIf) return true;
  return truthy(evalRunsOn(jobIf, { ...ctx, commits: [{ modified: paths }] }));
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

  it("a pull request ignores only docs/** and README.md (D-055)", () => {
    const doc = parse(readFileSync(workflowPath, "utf-8")) as {
      on: {
        pull_request?: { "paths-ignore"?: string[]; paths?: unknown } | null;
      };
    };
    expect(doc.on.pull_request?.["paths-ignore"]).toEqual(["docs/**", "README.md"]);
    expect(doc.on.pull_request == null || !("paths" in doc.on.pull_request)).toBe(true);
  });

  it("push branches are master, loop/**, and qa/** (T-178)", () => {
    const doc = parse(readFileSync(workflowPath, "utf-8")) as {
      on: { push?: { branches?: string[] } };
    };
    expect(doc.on.push?.branches).toEqual(["master", "loop/**", "qa/**"]);
  });

  it("a push ignores docs/** and README.md, the same list as a pull request, and a dispatch has no paths filter (T-178)", () => {
    const doc = parse(readFileSync(workflowPath, "utf-8")) as {
      on: {
        push?: { "paths-ignore"?: string[] };
        pull_request?: { "paths-ignore"?: string[] };
        workflow_dispatch?: Record<string, unknown> | null;
      };
    };
    expect(doc.on.push?.["paths-ignore"]).toEqual(["docs/**", "README.md"]);
    expect(doc.on.pull_request?.["paths-ignore"]).toEqual(["docs/**", "README.md"]);
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
    expect(String(doc.concurrency?.["cancel-in-progress"] ?? "")).toBe("${{ github.event_name != 'workflow_dispatch' }}");
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

  it("cancel-in-progress evaluates to false for a push to refs/heads/master (T-178)", () => {
    const cancel = String(workflow().concurrency?.["cancel-in-progress"] ?? "");
    expect(truthy(evalRunsOn(cancel, { event: "push", ref: "refs/heads/master", hosted: null }))).toBe(false);
  });
});
