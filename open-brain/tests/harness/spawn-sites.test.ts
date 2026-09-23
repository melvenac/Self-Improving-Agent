/**
 * CA-4b / R16 — the runtime spawns git in exactly ONE place.
 *
 * Every runtime git call must carry layers 0 and 1 and R18's pin, which is only
 * true by construction if there is one spawn site to carry them. This check is
 * a PARSER, not a pattern (shared.md: two seats pattern-matched the same file an
 * hour apart): a TypeScript AST walk over every call to a `child_process`
 * function in `src/harness/`. It classifies each call:
 *
 * - a GIT spawn: the command argument is the literal "git" — exactly one allowed;
 * - a NAMED non-git spawn: the check runner, the role process, the tree kill;
 * - anything else FAILS the check, so the boundary cannot widen by omission.
 *
 * Validated both ways before it is trusted: it finds a planted second git spawn
 * in each API form, including a multi-line call with "git" on its own line —
 * the single-line pattern QA's first draft named missed two of four sites.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const SPAWN_FUNCTIONS = new Set(["spawn", "spawnSync", "execFile", "execFileSync", "exec", "execSync", "fork"]);

interface SpawnSite {
  file: string;
  fn: string;
  /** The first argument as written. */
  command: string;
  /** The enclosing function's name, for classification. */
  within: string;
}

function spawnSites(file: string, text: string): SpawnSite[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const sites: SpawnSite[] = [];
  const enclosing = (n: ts.Node): string => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText(sf);
      // A variable names the enclosing scope only when it HOLDS a function —
      // `const r = spawnSync(...)` is a result, not a scope.
      if (
        ts.isVariableDeclaration(p) &&
        ts.isIdentifier(p.name) &&
        p.initializer !== undefined &&
        (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))
      ) {
        return p.name.text;
      }
    }
    return "(module)";
  };
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : "";
      if (SPAWN_FUNCTIONS.has(name)) {
        const first = n.arguments[0];
        sites.push({ file, fn: name, command: first ? first.getText(sf).trim() : "", within: enclosing(n) });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return sites;
}

const isGit = (s: SpawnSite): boolean => /^["'`]git["'`]$/.test(s.command);

/** The named, reviewed non-git spawns. Anything else is unclassified and fails. */
const CLASSIFIED: ReadonlyArray<{ file: string; within: string; why: string }> = [
  { file: "checks.ts", within: "runCheck", why: "the deterministic checks (R15: constructed env)" },
  { file: "process.ts", within: "runBounded", why: "the role process (constructed env, no shell)" },
  { file: "process.ts", within: "killTree", why: "taskkill /T on the timeout path (win32)" },
];

function classify(sites: SpawnSite[]): { git: SpawnSite[]; unclassified: SpawnSite[] } {
  const git = sites.filter(isGit);
  const unclassified = sites.filter(
    (s) => !isGit(s) && !CLASSIFIED.some((c) => s.file.endsWith(c.file) && s.within === c.within),
  );
  return { git, unclassified };
}

const HARNESS = join(__dirname, "..", "..", "src", "harness");

function realSites(): SpawnSite[] {
  const out: SpawnSite[] = [];
  for (const f of readdirSync(HARNESS).filter((n) => n.endsWith(".ts"))) {
    out.push(...spawnSites(f, readFileSync(join(HARNESS, f), "utf-8")));
  }
  return out;
}

describe("CA-4b / R16 — one git spawn site, every other spawn named", () => {
  it("the candidate's source has exactly one git spawn site, in git.ts's spawnGit, and no unclassified spawn", () => {
    const sites = realSites();
    const { git, unclassified } = classify(sites);
    // A check must prove it looked: the walk found the three classified sites too.
    expect(sites.length).toBeGreaterThanOrEqual(4);
    expect(git.map((s) => `${s.file}:${s.within}`)).toEqual(["git.ts:spawnGit"]);
    expect(unclassified, JSON.stringify(unclassified)).toEqual([]);
  });

  describe("validated against planted positives in every API form", () => {
    const forms: Array<[string, string]> = [
      ["execFileSync", `import { execFileSync } from "node:child_process";\nfunction x() { return execFileSync("git", ["status"]); }`],
      ["execFile", `import { execFile } from "node:child_process";\nfunction x() { execFile("git", ["status"], () => {}); }`],
      ["spawnSync", `import { spawnSync } from "node:child_process";\nfunction x() { return spawnSync('git', ["status"]); }`],
      ["spawn", `import { spawn } from "node:child_process";\nfunction x() { return spawn(\`git\`, ["status"]); }`],
      [
        "multi-line, git on its own line",
        `import { execFileSync } from "node:child_process";\nfunction changedPaths(cwd: string) {\n  const raw = execFileSync(\n    "git",\n    ["status", "--porcelain=v1", "-z"],\n    { cwd },\n  );\n  return raw;\n}`,
      ],
      ["namespace call", `import * as cp from "node:child_process";\nfunction x() { return cp.spawnSync("git", []); }`],
    ];
    for (const [name, src] of forms) {
      it(`finds a second git spawn written as ${name}`, () => {
        const { git } = classify([...realSites(), ...spawnSites("planted.ts", src)]);
        expect(git.length, `${name} was not found`).toBe(2);
      });
    }

    it("fails an unclassified non-git spawn", () => {
      const src = `import { spawnSync } from "node:child_process";\nfunction sneaky() { return spawnSync(process.execPath, ["-e", "1"]); }`;
      const { unclassified } = classify([...realSites(), ...spawnSites("planted.ts", src)]);
      expect(unclassified.map((s) => s.within)).toEqual(["sneaky"]);
    });
  });
});
