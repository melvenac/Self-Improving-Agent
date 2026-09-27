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

type Ctx = { event: string; ref: string; hosted: boolean | null };

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
    let left = parsePrimary();
    skip();
    if (s.startsWith("==", i)) {
      i += 2;
      const right = parsePrimary();
      return left === right;
    }
    return left;
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
      const arg = parsePrimary();
      skip();
      if (s[i] === ")") i++;
      if (m[0] === "fromJSON") return JSON.parse(String(arg));
      throw new Error(`evalRunsOn: unknown call ${m[0]}`);
    }
    if (m[0] === "true") return true;
    if (m[0] === "false") return false;
    if (m[0] === "null") return null;
    if (m[0] === "github.event_name") return ctx.event;
    if (m[0] === "github.ref") return ctx.ref;
    if (m[0] === "inputs.hosted") return ctx.hosted;
    throw new Error(`evalRunsOn: unknown name ${m[0]}`);
  }
  return parseOr();
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

  it("a pull request ignores only docs/** and README.md (D-055); push and workflow_dispatch have no paths filter", () => {
    const doc = parse(readFileSync(workflowPath, "utf-8")) as {
      on: {
        push?: Record<string, unknown> | null;
        pull_request?: { "paths-ignore"?: string[]; paths?: unknown } | null;
        workflow_dispatch?: Record<string, unknown> | null;
      };
    };
    expect(doc.on.pull_request?.["paths-ignore"]).toEqual(["docs/**", "README.md"]);
    expect(doc.on.push == null || !("paths" in doc.on.push || "paths-ignore" in doc.on.push)).toBe(true);
    expect(doc.on.workflow_dispatch == null || !("paths" in doc.on.workflow_dispatch || "paths-ignore" in doc.on.workflow_dispatch)).toBe(true);
  });
});
