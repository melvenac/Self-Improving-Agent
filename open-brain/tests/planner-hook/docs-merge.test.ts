/**
 * T-194 r2 — the planner may `gh pr merge` a PR whose EVERY changed path is on the
 * D-032/D-055 allowlist with no grant (Aaron, 2026-09-30: "docs only merge have my go-ahead"),
 * and the path check spawns nothing. Everything else is grant-required and the refusal names why.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { runPlannerHookAsync } from "../../src/planner-hook/run.js";
import { grantPath } from "../../src/planner-hook/grant.js";
import { parseGithubRemote, parsePrRef, readGhToken, type FetchLike } from "../../src/planner-hook/prfiles.js";

const OPEN_BRAIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

let repo: string;
let home: string;
const CMD = "gh pr merge 12 --merge";
const TOKEN_ENV = { GH_TOKEN: "test-token" } as NodeJS.ProcessEnv;

function writeAgentLocal(role: string): void {
  writeFileSync(join(repo, ".agents", "AGENT.local.md"), `---\nname: Atlas\nrole: ${role}\npartner: Forge\n---\n`, "utf-8");
}

const payload = (command: string) => ({
  cwd: repo,
  hook_event_name: "PreToolUse",
  tool_name: "Bash",
  tool_input: { command },
});

interface FakePr {
  changed_files?: number;
  files?: Array<{ filename: string; status?: string; previous_filename?: string }>;
}

/** A fetch that answers the two endpoints the hook reads and records every URL it was asked for. */
function fakeFetch(pr: FakePr, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith("/files")) {
      const page = Number(u.searchParams.get("page") ?? "1");
      const per = Number(u.searchParams.get("per_page") ?? "30");
      const slice = (pr.files ?? []).slice((page - 1) * per, page * per);
      return { ok: true, status: 200, json: async () => slice };
    }
    return { ok: true, status: 200, json: async () => ({ changed_files: pr.changed_files ?? (pr.files ?? []).length }) };
  };
}

const docs = (...names: string[]) => names.map((filename) => ({ filename, status: "modified" }));

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "planner-merge-"));
  home = mkdtempSync(join(tmpdir(), "planner-merge-home-"));
  for (const d of [".agents/SYSTEM", ".agents/TASKS", ".agents/SESSIONS", "open-brain/src", "docs/loops", ".git"]) {
    mkdirSync(join(repo, d), { recursive: true });
  }
  writeFileSync(join(repo, "package.json"), '{"name":"fixture"}\n', "utf-8");
  writeFileSync(join(repo, "open-brain", "package.json"), '{"name":"open-brain"}\n', "utf-8");
  writeFileSync(
    join(repo, ".git", "config"),
    '[core]\n\tbare = false\n[remote "origin"]\n\turl = https://github.com/melvenac/Self-Improving-Agent.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n',
    "utf-8",
  );
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

beforeEach(() => {
  writeAgentLocal("planner");
  if (existsSync(grantPath(repo))) rmSync(grantPath(repo));
});

describe("row 1 — an all-docs PR passes with no grant", () => {
  it("allows when every path is on the allowlist, reading the API and no grant", async () => {
    const calls: string[] = [];
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      {
        env: TOKEN_ENV,
        home,
        fetchImpl: fakeFetch(
          {
            files: docs(
              "docs/loops/x.md",
              "README.md",
              ".agents/state.json",
              ".agents/TASKS/INBOX.md",
              ".agents/TASKS/task.md",
              ".agents/SESSIONS/next-session.md",
              ".agents/SYSTEM/SUMMARY.md",
              ".agents/SYSTEM/PRD.md",
              ".agents/SYSTEM/DECISIONS.md",
              ".agents/SYSTEM/ENTITIES.md",
            ),
          },
          calls,
        ),
      },
    );
    expect(r.decision).toBe("allow");
    expect(existsSync(grantPath(repo))).toBe(false);
    expect(calls[0]).toBe("https://api.github.com/repos/melvenac/Self-Improving-Agent/pulls/12");
  });

  it("a grant present for a CODE merge is neither read nor consumed by a docs-only merge (bytes and mtime unchanged)", async () => {
    // "*" matches every command, so it matches this docs merge too: the grant a docs merge could burn.
    const codeGrant = JSON.stringify({ command: "*" });
    writeFileSync(grantPath(repo), codeGrant, "utf-8");
    const before = statSync(grantPath(repo)).mtimeMs;
    await new Promise((r) => setTimeout(r, 30));
    const r = await runPlannerHookAsync(payload(CMD), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: docs("docs/a.md") }) });
    expect(r.decision).toBe("allow");
    expect(existsSync(grantPath(repo))).toBe(true);
    expect(readFileSync(grantPath(repo), "utf-8")).toBe(codeGrant);
    expect(statSync(grantPath(repo)).mtimeMs).toBe(before);
    // ...and the code merge it was written for still passes with it.
    const code = await runPlannerHookAsync(
      payload("gh pr merge 99 --merge"),
      {},
      { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: docs("open-brain/src/x.ts") }) },
    );
    expect(code.decision).toBe("allow");
    expect(existsSync(grantPath(repo))).toBe(false);
  });

  it("sends the GH_TOKEN value as the bearer token on every request (the env var is the one read)", async () => {
    const seen: string[] = [];
    const inner = fakeFetch({ files: docs("docs/a.md") });
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      {
        env: { GH_TOKEN: "fixture-token-4f1c" } as NodeJS.ProcessEnv,
        home,
        fetchImpl: (url, init) => {
          seen.push(init.headers.Authorization);
          return inner(url, init);
        },
      },
    );
    expect(r.decision).toBe("allow");
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seen)).toEqual(new Set(["Bearer fixture-token-4f1c"]));
  });

  it("pages through a list longer than one page", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ filename: `docs/loops/f${i}.md`, status: "added" }));
    const r = await runPlannerHookAsync(payload(CMD), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: many }) });
    expect(r.decision).toBe("allow");
  });

  it("takes owner/repo from a PR URL and makes no read of the origin remote", async () => {
    const calls: string[] = [];
    const r = await runPlannerHookAsync(
      payload("gh pr merge https://github.com/other/thing/pull/7 --squash"),
      {},
      { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: docs("docs/a.md") }, calls) },
    );
    expect(r.decision).toBe("allow");
    expect(calls[0]).toBe("https://api.github.com/repos/other/thing/pulls/7");
  });
});

describe("row 2 — one unlisted path is denied without a grant", () => {
  it("names the unlisted path and says a grant is required", async () => {
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: docs("docs/a.md", "open-brain/src/x.ts") }) },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("unlisted path open-brain/src/x.ts");
    expect(r.reason).toContain("a grant is required");
    expect(r.reason).toContain("D-038");
  });

  it("a rename OUT of an unlisted path is denied naming the old path", async () => {
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      {
        env: TOKEN_ENV,
        home,
        fetchImpl: fakeFetch({
          files: [{ filename: "docs/moved.md", status: "renamed", previous_filename: "open-brain/src/moved.ts" }],
        }),
      },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("unlisted path open-brain/src/moved.ts");
  });

  it("a renamed file with no previous_filename is denied, not assumed docs-only", async () => {
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: [{ filename: "docs/moved.md", status: "renamed" }] }) },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("previous_filename");
  });

  it("a matching grant still allows it, and is consumed", async () => {
    writeFileSync(grantPath(repo), JSON.stringify({ command: CMD }), "utf-8");
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: docs("open-brain/src/x.ts") }) },
    );
    expect(r.decision).toBe("allow");
    expect(existsSync(grantPath(repo))).toBe(false);
  });
});

describe("row 3 — an unreadable list is denied and says why", () => {
  const files = docs("docs/a.md");

  it("network error names the API as unreachable and carries the error", async () => {
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      {
        env: TOKEN_ENV,
        home,
        fetchImpl: async () => {
          throw new Error("connect ECONNREFUSED 140.82.112.5:443");
        },
      },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("unreachable");
    expect(r.reason).toContain("ECONNREFUSED");
    expect(r.reason).toContain("a grant is required");
  });

  it("a hung API is cut off by the timeout and denied", async () => {
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      {
        env: TOKEN_ENV,
        home,
        timeoutMs: 50,
        fetchImpl: (_url, init) =>
          new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted")))),
      },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("unreachable");
  });

  it("HTTP 404 names the status", async () => {
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      { env: TOKEN_ENV, home, fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("HTTP 404");
  });

  it("no token (env empty, hosts.yml has no oauth_token, as with a keyring-stored gh token) names the cause", async () => {
    mkdirSync(join(home, ".config", "gh"), { recursive: true });
    writeFileSync(
      join(home, ".config", "gh", "hosts.yml"),
      "github.com:\n    git_protocol: https\n    users:\n        melvenac:\n    user: melvenac\n",
      "utf-8",
    );
    const calls: string[] = [];
    const r = await runPlannerHookAsync(payload(CMD), {}, { env: {}, home, fetchImpl: fakeFetch({ files }, calls) });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("no GitHub token");
    expect(r.reason).toContain("keyring");
    expect(calls).toEqual([]);
  });

  it("a truncated list (fewer files than changed_files) is denied as incomplete", async () => {
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ changed_files: 3, files: docs("docs/a.md", "docs/b.md") }) },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("incomplete (2 of 3");
  });

  it("an empty changed_files or list is denied", async () => {
    const r = await runPlannerHookAsync(payload(CMD), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ changed_files: 0, files: [] }) });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("changed_files");
  });

  it("a files endpoint that is not a list is denied", async () => {
    const r = await runPlannerHookAsync(
      payload(CMD),
      {},
      {
        env: TOKEN_ENV,
        home,
        fetchImpl: async (url) => ({
          ok: true,
          status: 200,
          json: async () => (url.endsWith("per_page=100&page=1") ? { message: "nope" } : { changed_files: 1 }),
        }),
      },
    );
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("other than a list");
  });

  it("a ref that is not a PR number (a branch, or a flag where the ref should be) is denied", async () => {
    for (const cmd of ["gh pr merge some-branch --merge", "gh pr merge --merge"]) {
      const r = await runPlannerHookAsync(payload(cmd), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files }) });
      expect(r.decision).toBe("deny");
      expect(r.reason).toContain("could not read a PR number");
    }
  });

  it("an origin that is not github.com is denied", async () => {
    const cfg = join(repo, ".git", "config");
    const before = readFileSync(cfg, "utf-8");
    writeFileSync(cfg, before.replace("https://github.com/", "https://gitlab.example.com/"), "utf-8");
    try {
      const r = await runPlannerHookAsync(payload(CMD), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files }) });
      expect(r.decision).toBe("deny");
      expect(r.reason).toContain("not a github.com remote");
    } finally {
      writeFileSync(cfg, before, "utf-8");
    }
  });
});

describe("scope — the check does not widen the hook", () => {
  it("makes no network read for a non-planner seat", async () => {
    writeAgentLocal("developer");
    const calls: string[] = [];
    const r = await runPlannerHookAsync(payload(CMD), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: docs("docs/a.md") }, calls) });
    expect(r.decision).toBe("passthrough");
    expect(calls).toEqual([]);
  });

  it("makes no network read for other restricted acts, which stay grant-only", async () => {
    const calls: string[] = [];
    const r = await runPlannerHookAsync(payload("git merge origin/master"), {}, { env: TOKEN_ENV, home, fetchImpl: fakeFetch({ files: docs("docs/a.md") }, calls) });
    expect(r.decision).toBe("deny");
    expect(calls).toEqual([]);
  });
});

describe("no child process (CA-4b / R16)", () => {
  /** A parser, not a pattern: import declarations, dynamic imports and require calls of child_process. */
  function importsChildProcess(file: string): boolean {
    const sf = ts.createSourceFile(file, readFileSync(file, "utf-8"), ts.ScriptTarget.Latest, true);
    const isCp = (s: string) => /^(node:)?child_process$/.test(s);
    let found = false;
    const visit = (n: ts.Node): void => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && isCp(n.moduleSpecifier.text)) found = true;
      if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0])) {
        const callee = n.expression.getText(sf);
        if ((callee === "require" || n.expression.kind === ts.SyntaxKind.ImportKeyword) && isCp(n.arguments[0].text)) found = true;
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return found;
  }

  const files = [
    ...readdirSync(join(OPEN_BRAIN_ROOT, "src", "planner-hook")).map((f) => join(OPEN_BRAIN_ROOT, "src", "planner-hook", f)),
    join(OPEN_BRAIN_ROOT, "src", "cli-planner-hook.ts"),
  ];

  it("walked the planner-hook sources, and none imports child_process", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files.filter(importsChildProcess)).toEqual([]);
  });

  it("the detector finds a planted import in each form (known positive)", () => {
    const dir = mkdtempSync(join(tmpdir(), "cp-plant-"));
    try {
      const forms = [
        'import { spawnSync } from "node:child_process";\n',
        'import cp from "child_process";\n',
        'const cp = require("node:child_process");\n',
        'const cp = await import("child_process");\n',
      ];
      for (const [i, src] of forms.entries()) {
        const f = join(dir, `p${i}.ts`);
        writeFileSync(f, src, "utf-8");
        expect(importsChildProcess(f), src).toBe(true);
      }
      const clean = join(dir, "clean.ts");
      writeFileSync(clean, 'import { join } from "node:path";\n// child_process is only a comment here\n', "utf-8");
      expect(importsChildProcess(clean)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("helpers", () => {
  it("parseGithubRemote reads https, ssh and scp forms and refuses other hosts", () => {
    expect(parseGithubRemote("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(parseGithubRemote("git@github.com:a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(parseGithubRemote("ssh://git@github.com/a/b")).toEqual({ owner: "a", repo: "b" });
    expect(parseGithubRemote("https://gitlab.com/a/b.git")).toBeNull();
  });

  it("parsePrRef reads a number, #number and a pull URL, and refuses a branch", () => {
    expect(parsePrRef("12")).toEqual({ number: 12 });
    expect(parsePrRef("#12")).toEqual({ number: 12 });
    expect(parsePrRef("https://github.com/o/r/pull/9")).toEqual({ number: 9, owner: "o", repo: "r" });
    expect(parsePrRef("--merge")).toBeNull();
    expect(parsePrRef("feature/x")).toBeNull();
  });

  it("readGhToken prefers GH_TOKEN, then GITHUB_TOKEN, then an oauth_token in hosts.yml", () => {
    const h = mkdtempSync(join(tmpdir(), "ghtok-"));
    try {
      expect(readGhToken({ GH_TOKEN: "a", GITHUB_TOKEN: "b" } as NodeJS.ProcessEnv, h)).toBe("a");
      expect(readGhToken({ GITHUB_TOKEN: "b" } as NodeJS.ProcessEnv, h)).toBe("b");
      mkdirSync(join(h, ".config", "gh"), { recursive: true });
      writeFileSync(join(h, ".config", "gh", "hosts.yml"), "github.com:\n    oauth_token: fromfile\n", "utf-8");
      expect(readGhToken({} as NodeJS.ProcessEnv, h)).toBe("fromfile");
    } finally {
      rmSync(h, { recursive: true, force: true });
    }
  });
});
