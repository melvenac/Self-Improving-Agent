/**
 * T-194 r5: the three properties, as example rows. The property test (r5-property.test.ts) generates
 * spellings nobody listed; these rows pin the named ones, including every probe QA 233, 234 and 235 ran.
 *
 * P1  a write target is protected iff the location the tool will actually write to is protected;
 *     a non-literal target, or a cd in the same command line as a write, is refused with a cause.
 * P2  a command is a merge iff gh would run `pr merge`; one exact grammar is allowed without a grant.
 * P3  the PowerShell tool is matched and held to P1 and P2.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { writeFileSync } from "node:fs";
import { runPlannerHook } from "../../src/planner-hook/run.js";
import { grantPath, readOutwardGrant } from "../../src/planner-hook/grant.js";
import { plannerHookRegistration } from "../../src/planner-hook/registration.js";
import { BASH_WRITE_LIMIT } from "../../src/planner-hook/bash.js";
import { makeFixture, type Fixture } from "./r5-fixture.js";

let fx: Fixture;
beforeAll(() => {
  fx = makeFixture("r5");
});
afterAll(() => fx.dispose());
beforeEach(() => fx.resetGrant());

const deny = (r: { decision: string }) => expect(r.decision).toBe("deny");
const allow = (r: { decision: string }) => expect(r.decision).toBe("allow");

describe("P1 — a target that is not a literal path is refused, with its cause (QA 235 D4)", () => {
  it.each([
    ["~ at the start", "echo x > ~/anything/open-brain/src/cli.ts"],
    ["~user at the start", "echo x > ~root/open-brain/src/cli.ts"],
    ["a quoted ~", 'echo x > "~/open-brain/src/cli.ts"'],
    ["$VAR", "echo x > $HOME/open-brain/src/cli.ts"],
    ["${VAR}", 'echo x > "${HOME}/x.txt"'],
    ["a backtick", "echo x > `pwd`/x.txt"],
    ["$( )", "echo x > $(pwd)/x.txt"],
    ["a * glob", "echo x > open-brain/src/*.ts"],
    ["a ? glob", "echo x > open-brain/sr?/cli.ts"],
    ["a [ ] glob", "echo x > open-brain/src/[c]li.ts"],
    ["a brace list", "echo x > open-brain/src/{a,b}.ts"],
    ["a parenthesis in a quoted target", "echo x > 'docs/loops/a(1).md'"],
    ["a parenthesis in a cp destination", "cp a.ts 'docs/b(2).md'"],
    ["process substitution", "echo x > >(cat)"],
    ["tee with a glob", "echo x | tee open-brain/src/*.ts"],
    ["cp to a brace list", "cp a.ts open-brain/src/{x,y}.ts"],
    ["sed -i on a glob", "sed -i s/a/b/ open-brain/src/*.ts"],
  ])("%s", (_name, command) => {
    const r = fx.bash(command);
    deny(r);
    // r6: P0 now refuses most of these first (the construct is named); either refusal names why it cannot be located.
    expect(r.reason).toMatch(/cannot be determined|denied — not statically parseable/);
  });

  it.each(["~/x/open-brain/src/cli.ts", "~/.agents/state.json", "open-brain/src/*.ts", "open-brain/src/{a,b}.ts"])(
    "the file tools refuse %s the same way",
    (file_path) => {
      for (const r of [fx.edit(file_path), fx.write(file_path)]) {
        deny(r);
        expect(r.reason).toMatch(/cannot be determined|denied — not statically parseable/);
      }
    },
  );

  it("a literal path that merely contains the same characters outside the target is still allowed", () => {
    allow(fx.bash("git commit -m 'fix: ~ a -> b *x* {y} $5' -- docs/loops/q.md"));
    allow(fx.bash("echo '$HOME ~ *' > docs/loops/q.md"));
  });
});

describe("P1 — a cd in the same command line as a write is refused as undeterminable (QA 235 declared limit)", () => {
  it.each([
    "cd open-brain && echo x > src/cli.ts",
    "(cd open-brain; echo x > src/cli.ts)",
    "pushd open-brain; echo x > src/cli.ts",
    "cd open-brain\necho x > src/cli.ts",
    "cd docs/loops && echo x > notes.md",
    "true && (cd .. ; cp a.ts src/b.ts)",
    "command cd open-brain && sed -i s/a/b/ src/cli.ts",
    "bash -c 'cd open-brain && echo x > src/cli.ts'",
  ])("%s", (command) => {
    const r = fx.bash(command);
    deny(r);
    expect(r.reason).toMatch(/changes directory|cannot be determined|denied — not statically parseable/);
  });

  it("a cd with no write, and a write with no cd, are not refused", () => {
    allow(fx.bash("cd docs/loops && ls"));
    allow(fx.bash("cd docs/loops && ls 2>&1 >/dev/null"));
    allow(fx.bash("cd open-brain && npm test 2>/dev/null"));
    allow(fx.bash("echo x > docs/loops/q.md"));
  });

  it("PowerShell: Set-Location with a write is refused", () => {
    deny(fx.ps("Set-Location open-brain; Set-Content src/cli.ts x"));
    deny(fx.ps("cd open-brain; 'x' | Out-File src/cli.ts"));
    allow(fx.ps("Set-Location open-brain; Get-ChildItem"));
  });
});

describe("P1 — the real write location, whatever the spelling (QA 233/234/235 probes)", () => {
  it.each([
    ["open-brain", "echo x > src/cli.ts"],
    ["open-brain", "sed -i s/a/b/ src/cli.ts"],
    ["open-brain", "sed -i -e s/a/b/ src/cli.ts"],
    ["open-brain", "sed -i.bak -e s/a/b/ -e s/c/d/ src/cli.ts"],
    ["open-brain", "echo x | tee src/x.ts"],
    ["open-brain", "echo x | tee -a notes.md src/x.ts"],
    ["open-brain", "cp a.ts tests/x.ts"],
    ["open-brain", "cp a.ts b.ts tests/"],
    ["open-brain", "cp -t tests a.ts b.ts"],
    ["open-brain", "cp --target-directory=tests a.ts"],
    ["open-brain", "mv a.json package.json"],
    ["open-brain", "mv src/cli.ts /tmp/gone.ts"],
    ["open-brain", "npm test 2>> src/x.log"],
    ["open-brain", "npm test &> src/x.log"],
    ["open-brain", "echo x >| src/x.ts"],
    ["open-brain", "echo x >src/x.ts"],
    ["open-brain", "echo x 1>src/x.ts"],
    ["open-brain", 'echo x > "src"/\'cli.ts\''],
    ["open-brain/src", "echo x > cli.ts"],
    [".agents", "echo '{}' > state.json"],
    [".agents", "echo x > TASKS/INBOX.md"],
    ["docs/loops", "echo x > ../../open-brain/src/cli.ts"],
    ["open-brain", "echo x > ../scripts/x.sh"],
    ["", "echo x > open-brain/./src/../src/cli.ts"],
    ["", "echo x > ./open-brain//src///cli.ts"],
    ["", "bash -c 'echo x > open-brain/src/cli.ts'"],
    ["", 'sh -c "echo x > open-brain/src/cli.ts"'],
    ["", "eval 'echo x > open-brain/src/cli.ts'"],
    ["", 'echo "$(echo x > open-brain/src/cli.ts)"'],
    ["", "echo `echo x > open-brain/src/cli.ts`"],
    ["", "true && echo x > open-brain/src/cli.ts"],
    ["", "echo a | tee scripts/x.sh | wc -l"],
    ["", "env FOO=1 sed -i s/a/b/ package.json"],
  ])("cwd %s: `%s` is denied", (cwd, command) => {
    deny(fx.bash(command, fx.sub(cwd)));
  });

  it.each([
    ["docs/loops", "echo x > src/cli.ts"],
    ["scratch", "echo '{}' > state.json"],
    ["open-brain", "echo x > notes.md"],
    ["", "echo x > docs/loops/q.md"],
    ["", "cp open-brain/src/cli.ts docs/loops/copy.ts"],
    ["", "sed -n p open-brain/src/cli.ts"],
    ["", "cat open-brain/src/cli.ts > scratch/out.txt"],
    ["", "git log > scratch/log.txt"],
    ["", "echo x > /dev/null"],
    ["", "npm test > /dev/null 2>&1"],
  ])("cwd %s: `%s` is allowed (the cwd and the real target decide)", (cwd, command) => {
    allow(fx.bash(command, fx.sub(cwd)));
  });

  it("a write outside the repo is allowed; the hook protects the repo's artifacts and is not a sandbox", () => {
    allow(fx.bash("echo x > C:/qa-tmp/log.txt"));
    allow(fx.bash("echo x > /tmp/log.txt"));
    // A sibling shares the root's own spelling (even an 8.3 profile name such as AARONM~1) up to the point it
    // leaves, so it is outside beyond doubt.
    allow(fx.bash(`echo x > "${fx.fwd}-sibling/open-brain/src/cli.ts"`));
  });

  it("an 8.3 short name outside the root prefix is refused, because it may be inside", () => {
    const r = fx.bash("echo x > C:/PROGRA~1/x.txt");
    deny(r);
    expect(r.reason).toContain("8.3 short name");
  });

  // SUPERSEDED BY r6: a heredoc is outside the parse gate's grammar, so the r5 "heredoc bodies are data" rows are now refused
  // by P0 (see r6.test.ts). Quoted prose stays data: that is what these rows keep.
  it("quoted prose is data: a commit message with > ` * $ is not a write", () => {
    allow(fx.bash("git commit -m 'fix: a -> b `code` *x* $5 > y' -m 'Co-Authored-By: Claude <noreply@anthropic.com>'"));
    allow(fx.bash("echo '> quoted **bold** $VAR `x`' > docs/loops/q.md"));
    deny(fx.bash("echo 'body' > open-brain/src/cli.ts"));
  });

  it("the file tools resolve the same way", () => {
    deny(fx.edit("src/cli.ts", fx.sub("open-brain")));
    deny(fx.write("state.json", fx.sub(".agents")));
    deny(fx.write("../.agents/state.json", fx.sub("docs")));
    deny(fx.edit(`${fx.fwd}/open-brain/./src/../src/cli.ts`));
    allow(fx.edit("src/cli.ts", fx.sub("docs/loops")));
    allow(fx.write("docs/loops/q.md"));
    allow(fx.write(`${fx.fwd}-sibling/open-brain/src/cli.ts`));
  });

  it.skipIf(process.platform !== "win32")("Windows: case, long-path prefix, NTFS dots/streams and the /mnt, /cygdrive forms", () => {
    deny(fx.edit(`${fx.fwd}/OPEN-BRAIN/SRC/cli.ts`));
    deny(fx.bash("echo x > OPEN-BRAIN/SRC/cli.ts"));
    deny(fx.bash(`echo x > '\\\\?\\${fx.repo}\\open-brain\\src\\cli.ts'`));
    deny(fx.edit(`//?/${fx.fwd}/open-brain/src/cli.ts`));
    // The device form has no `?`, so only the prefix rule (not the glob rule) can resolve it.
    deny(fx.bash(`echo x > '\\\\.\\${fx.repo}\\open-brain\\src\\cli.ts'`));
    deny(fx.edit(`//./${fx.fwd}/open-brain/src/cli.ts`));
    deny(fx.write(`\\\\.\\${fx.repo}\\.agents\\state.json`));
    deny(fx.bash("echo x > open-brain/src./cli.ts"));
    deny(fx.bash("echo x > open-brain/src/cli.ts:stream"));
    deny(fx.bash("echo x > 'open-brain/src /cli.ts'"));
    const drive = fx.fwd[0].toLowerCase();
    deny(fx.bash(`echo x > "/mnt/${drive}${fx.fwd.slice(2)}/open-brain/src/cli.ts"`));
    deny(fx.bash(`echo x > "/cygdrive/${drive}${fx.fwd.slice(2)}/open-brain/src/cli.ts"`));
  });
});

describe("P2 — a merge is `gh ... pr ... merge` in any spelling; one exact grammar needs no grant (QA 235 D5)", () => {
  const notExact = [
    "Gh Pr Merge 2",
    "gh --repo other/x pr merge 1",
    "gh --repo=other/x pr merge 1",
    "gh -R other/x pr merge 1",
    "gh -Rother/x pr merge 1",
    "gh -R other/x pr merge 1 --squash",
    "gh pr merge 1 --repo other/x",
    "gh pr merge 1 -R other/x",
    "gh pr merge 1 --admin",
    "gh pr merge 1 --auto",
    "gh pr merge 1 --body hi",
    "gh pr merge --squash 1",
    "gh pr merge 1 -sd",
    "GH_REPO=other/x gh pr merge 1",
    "GH_HOST=evil gh pr merge 1",
    "env gh pr merge 1",
    "env GH_REPO=other/x gh pr merge 1",
    "command gh pr merge 1",
    "sudo gh pr merge 1",
    "time gh pr merge 1",
    "gh pr merge 1 && echo done",
    "gh pr merge 1; echo done",
    "gh pr merge 1 | tee out.txt",
    "gh pr merge 1 > out.txt",
    "gh pr merge 1\necho done",
    "echo hi && gh pr merge 1",
    "(gh pr merge 1)",
    "bash -c 'gh pr merge 1'",
    'sh -c "gh pr merge 1"',
    "eval gh pr merge 1",
    "echo $(gh pr merge 1)",
    "echo `gh pr merge 1`",
    "$GH pr merge 1",
    "gh pr merge $N",
    "gh pr merge $(echo 1)",
    "xargs gh pr merge 1",
    '"C:/Program Files/GitHub CLI/gh.exe" --repo other/x pr merge 1',
  ];
  it.each(notExact)("`%s` needs a grant and fetches nothing", async (command) => {
    const r = await fx.merge("Bash", command);
    deny(r);
    expect(fx.calls).toEqual([]);
  });

  it.each([
    "gh pr merge 1",
    "gh pr merge 1 --squash",
    "gh pr merge 1 --merge --delete-branch",
    "gh pr merge 1 -s -d",
    "gh.exe pr merge 1",
    "GH.EXE pr merge 1 --rebase",
    '"gh" pr merge 1',
    "'gh' pr merge 1",
    '"C:/Program Files/GitHub CLI/gh.exe" pr merge 1',
    "gh pr merge https://github.com/melvenac/Self-Improving-Agent/pull/1",
    "  gh   pr  merge   1  --squash ",
  ])("`%s` with a docs-only PR is allowed, after reading the list", async (command) => {
    const r = await fx.merge("Bash", command);
    allow(r);
    expect(fx.calls.length).toBeGreaterThan(0);
  });

  it.each(["gh pr merge 2", "GH pr merge 2", "gh.EXE pr merge 2", "gh.exe pr merge 2 --squash", '"gh" pr merge 2'])("`%s` with a code PR is denied after reading the list", async (command) => {
    const r = await fx.merge("Bash", command);
    deny(r);
    expect(r.reason).toContain("unlisted path");
  });

  it.each(["gh pr view 1", "gh pr list --state merged", "gh --repo other/x pr view 1", "gh issue list", "echo gh pr"])(
    "`%s` is not a merge",
    async (command) => {
      allow(await fx.merge("Bash", command));
      expect(fx.calls).toEqual([]);
    },
  );

  it("a refusal names why: a shape outside the grammar, a repo flag, or a chain", async () => {
    expect((await fx.merge("Bash", "gh pr merge 1 --admin")).reason).toContain("no-grant grammar");
    expect((await fx.merge("Bash", "gh pr merge 1 --repo=o/x")).reason).toContain("--repo");
    expect((await fx.merge("Bash", "gh pr merge 1 && x")).reason).toContain("not a single gh pr merge invocation");
    expect((await fx.merge("Bash", "env GH_REPO=o/x gh pr merge 1")).reason).toContain("not a single gh pr merge invocation");
  });

  it("a grant covers exactly its own command, and a refused shape does not burn it", async () => {
    writeFileSync(grantPath(fx.repo), JSON.stringify({ command: "gh pr merge 2 --squash" }), "utf-8");
    deny(await fx.merge("Bash", "GH pr merge 2 --squash --admin"));
    expect(readOutwardGrant(fx.repo)).not.toBeNull();
    allow(await fx.merge("Bash", "gh pr merge 2 --squash"));
    expect(readOutwardGrant(fx.repo)).toBeNull();
  });
});

describe("P3 — the PowerShell tool is matched, and held to P1 and P2", () => {
  it("the registration snippet's matcher names PowerShell", () => {
    const reg = plannerHookRegistration("C:/x/open-brain") as { hooks: { PreToolUse: Array<{ matcher: string }> } };
    const names = reg.hooks.PreToolUse[0].matcher.split("|");
    expect(names).toEqual(expect.arrayContaining(["Edit", "Write", "NotebookEdit", "Bash", "PowerShell"]));
  });

  it("the tool name is read without case", () => {
    deny(runPlannerHook(fx.payload("powershell", { command: "Set-Content open-brain/src/cli.ts x" })));
    deny(runPlannerHook(fx.payload("POWERSHELL", { command: "Set-Content open-brain/src/cli.ts x" })));
    deny(runPlannerHook(fx.payload("bash", { command: "echo x > open-brain/src/cli.ts" })));
  });

  it.each([
    "Set-Content open-brain/src/cli.ts x",
    "Set-Content -Path open-brain/src/cli.ts -Value x",
    "Set-Content -Value x -Path open-brain/src/cli.ts",
    "Set-Content -LiteralPath open-brain/src/cli.ts x",
    "Set-Content -Lit open-brain/src/cli.ts x",
    "Set-Content -Path:open-brain/src/cli.ts x",
    "sc open-brain/src/cli.ts x",
    "Add-Content .agents/state.json x",
    "'x' | Add-Content .agents/state.json",
    "Out-File open-brain/src/cli.ts",
    "'x' | Out-File -FilePath open-brain/src/cli.ts -Append",
    "New-Item open-brain/src/new.ts",
    "New-Item -Path open-brain -Name src/new.ts",
    "ni -Path open-brain/src/new.ts -ItemType File",
    "Copy-Item a.ts open-brain/src/b.ts",
    "Copy-Item -Path a.ts -Destination open-brain/src/b.ts",
    "Copy-Item -Dest open-brain/src/b.ts a.ts",
    "Move-Item a.ts open-brain/src/b.ts",
    "Move-Item open-brain/src/cli.ts a.ts",
    "Remove-Item open-brain/src/cli.ts",
    "Remove-Item -Force a.ts, open-brain/src/cli.ts",
    "Remove-Item -Recurse -Path open-brain/src",
    "ri open-brain/src/cli.ts",
    "echo x > open-brain/src/cli.ts",
    "echo x >> .agents/TASKS/INBOX.md",
    "Write-Output x 2> open-brain/src/err.log",
    'Set-Content "open-brain\\src\\cli.ts" x',
    "Set-Content 'open-brain/src/cli.ts' x",
    "Get-Date; Set-Content package.json x",
    "powershell -Command \"Set-Content open-brain/src/cli.ts x\"",
    "pwsh -c 'Set-Content open-brain/src/cli.ts x'",
  ])("`%s` is denied", (command) => {
    deny(fx.ps(command));
  });

  it.each([
    "Set-Content $env:TEMP\\x.txt hi",
    "Set-Content $path hi",
    "Set-Content open-brain/src/*.ts x",
    "Remove-Item open-brain/src/*",
    "Out-File ~/open-brain/src/x.ts",
    "Invoke-Expression 'Set-Content open-brain/src/cli.ts x'",
    "iex $cmd",
    "icm { Set-Content open-brain/src/cli.ts x }",
    "Get-ChildItem | ForEach-Object { Set-Content $_.FullName x }",
    "& { 'x' > open-brain/src/cli.ts }",
  ])("`%s` cannot be located and is refused", (command) => {
    const r = fx.ps(command);
    deny(r);
    expect(r.reason).toMatch(/cannot be determined|cannot read|statically/);
  });

  it.each([
    "Set-Content docs/loops/q.md hi",
    "Set-Content -Path docs/loops/q.md -Value '{\"a\":1}'",
    "Set-Content -Path docs/loops/q.md -Value \"{ not a block }\"",
    "Get-Content open-brain/src/cli.ts",
    "Get-ChildItem open-brain/src | Select-Object -First 3",
    "Write-Output hi > $null",
    "Write-Output hi 2>&1 | Out-Null",
    "Copy-Item open-brain/src/cli.ts docs/loops/copy.ts",
    "Set-Content C:/qa-tmp/x.txt hi",
  ])("`%s` is allowed", (command) => {
    allow(fx.ps(command));
  });

  it.each([
    ["& gh pr merge 2", false],
    [".\\gh.exe pr merge 2", false],
    ['& "C:\\Program Files\\GitHub CLI\\gh.exe" pr merge 2', false],
    ["& 'gh' pr merge 2", false],
    ["gh pr merge 2 --repo other/x", true],
    ["& gh --repo other/x pr merge 1", true],
    ["GH pr merge 2", false],
    ["& $gh pr merge 1", true],
  ])("`%s` from PowerShell is held to P2", async (command, noFetch) => {
    const r = await fx.merge("PowerShell", command);
    deny(r);
    if (noFetch) expect(fx.calls).toEqual([]);
    else expect(r.reason).toContain("unlisted path");
  });

  it("PowerShell: the exact grammar is allowed for a docs-only PR, with a call operator or a path", async () => {
    allow(await fx.merge("PowerShell", "gh pr merge 1 --squash"));
    allow(await fx.merge("PowerShell", "& gh pr merge 1"));
    allow(await fx.merge("PowerShell", ".\\gh.exe pr merge 1"));
  });
});

describe("the limit is stated in the refusal text, not only in a handoff", () => {
  it("BASH_WRITE_LIMIT names what is out of reach", () => {
    for (const phrase of ["PowerShell", "at runtime", "gh api", "not a sandbox", "symlinks"]) {
      expect(BASH_WRITE_LIMIT).toContain(phrase);
    }
  });

  it("a denied write carries it", () => {
    expect(fx.bash("echo x > open-brain/src/cli.ts").reason).toContain("OUT OF REACH");
    expect(fx.ps("Set-Content open-brain/src/cli.ts x").reason).toContain("OUT OF REACH");
  });
});

describe("P2b — a git merge, tag or push is read by the same rule: git word, any options, then the subcommand", () => {
  const needsGrant = [
    "git merge origin/master",
    "git merge --no-ff x",
    "git tag v1.0.0",
    "git tag -a v1 -m x",
    "git push",
    "git push origin",
    "git push origin master",
    "git push origin main",
    "git push origin HEAD:master",
    "git push origin HEAD:refs/heads/master",
    "git push origin +loop/x",
    "git push origin :loop/x",
    "git push origin +HEAD:loop/x",
    "git push origin +loop/x:loop/y",
    "git push origin loop/$BR",
    "git push origin \"loop/$BR\"",
    "git push origin loop/x master",
    "git push origin feature/x",
    "git push origin loopx/x",
    "git push upstream loop/x",
    "git push https://example.com/r.git loop/x",
    "git push --force origin loop/x",
    "git push origin loop/x --force",
    "git push -f origin loop/x",
    "git push -fu origin loop/x",
    "git push --force-with-lease origin loop/x",
    "git push --force-if-includes origin loop/x",
    "git push --tags",
    "git push --follow-tags origin loop/x",
    "git push --mirror",
    "git push --all",
    "git push --delete origin loop/x",
    "git push -d origin loop/x",
    "GIT push --force origin loop/x",
    "Git.EXE push origin master",
    "git.exe push --force origin loop/x",
    '"git" push origin master',
    "'git' push origin master",
    '"C:/Program Files/Git/cmd/git.exe" push origin master',
    "git -C docs push origin master",
    "git -C ../x push --force origin loop/x",
    "git -c user.name=x push origin master",
    "git --git-dir=.git push origin master",
    "git --git-dir .git push origin master",
    "git --no-pager push origin master",
    "git -c a=b -C d --no-pager push --tags",
    "git -C docs merge origin/master",
    "git --git-dir=.git tag v2",
    "GIT -C docs MERGE x",
    "true && git push origin master",
    "git status; git push origin master",
    "(git push origin master)",
    "env X=1 git push --force origin loop/x",
    "bash -c 'git push --force origin loop/x'",
    'sh -c "git -C d push origin master"',
    "echo $(git push origin master)",
    "git $SUB origin loop/x",
    "$GIT push origin master",
    "git push $REMOTE loop/x",
  ];
  it.each(needsGrant)("`%s` needs a grant", (command) => {
    const r = fx.bash(command);
    deny(r);
    expect(r.reason).toMatch(/D-038|denied — not statically parseable/);
  });

  it.each([
    "git push origin loop/x",
    "git push -u origin loop/t194-planner-hook",
    "git push --no-verify origin docs/my-branch",
    "git push origin qa/t194-r5-report",
    "git push origin chore/x",
    "git push origin refs/heads/loop/x",
    "git push origin HEAD:loop/x",
    "git push origin loop/a loop/b",
    "git -C docs push origin loop/x",
    "git --no-pager push origin loop/x",
    "GIT push origin loop/x",
    "git.exe push origin loop/x",
    '"git" push origin loop/x',
    "git status",
    "git log --oneline -5",
    "git log --grep push",
    "git log --grep merge",
    "git merge-base a b",
    'git commit -m "push origin master and git tag v1"',
    "git -C docs status",
    "git diff --stat",
    "git fetch origin",
    "git branch -D loop/old",
    "git checkout --detach origin/master",
  ])("`%s` is not restricted", (command) => {
    allow(fx.bash(command));
  });

  it("PowerShell: the same rule", () => {
    deny(fx.ps("git push --force origin loop/x"));
    deny(fx.ps("& git -C docs push origin master"));
    deny(fx.ps(".\\git.exe push --tags"));
    deny(fx.ps("git merge origin/master"));
    allow(fx.ps("git push origin loop/x"));
    allow(fx.ps("git log --oneline"));
  });

  it("a grant is matched exactly, a variant does not burn it", () => {
    writeFileSync(grantPath(fx.repo), JSON.stringify({ command: "git push origin loop/x --force" }), "utf-8");
    deny(fx.bash("git -C docs push origin loop/x --force"));
    deny(fx.bash("git push origin loop/x --force && git push --tags"));
    expect(readOutwardGrant(fx.repo)).not.toBeNull();
    allow(fx.bash("git  push origin   loop/x --force"));
    expect(readOutwardGrant(fx.repo)).toBeNull();
  });
});
