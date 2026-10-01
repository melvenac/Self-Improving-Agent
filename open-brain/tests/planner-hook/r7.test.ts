/**
 * T-194 r7: the inversion applied to CHARACTERS and COMMAND WORDS.
 *
 * P0a  PowerShell: any character outside printable ASCII is refused; Bash: non-ASCII only inside ASCII quotes.
 * P0b  ONE target validator for every write source (the sources are pinned one by one here and in r7-depth.test.ts).
 * P0c  a Bash command word must be on the allow-list; node only as `node <file.js|.mjs|.cjs> [args]`.
 * P0d  GIT_* and GH_REPO/GH_HOST (and a few other) environment assignments are refused.
 * D-C  New-Item -Name with no -Path targets the current directory.
 * The generated cases are in r7-gate-property.test.ts; every QA 241 case is in r7-qa241.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { parseGate } from "../../src/planner-hook/parse-gate.js";
import { BASH_ALLOWED_COMMANDS } from "../../src/planner-hook/bash-commands.js";
import { BASH_WRITE_LIMIT } from "../../src/planner-hook/bash.js";
import { makeFixture, type Fixture } from "./r5-fixture.js";
import { GATE_PREFIX } from "./r6-cases.js";
import { CURL_ALLOWED, CURL_REFUSED, ENV_ALLOWED, ENV_REFUSED, NODE_ALLOWED, NODE_REFUSED, SSH_ALLOWED, SSH_REFUSED } from "./r7-cases.js";

let fx: Fixture;
beforeAll(() => {
  fx = makeFixture("r7");
});
afterAll(() => fx.dispose());
beforeEach(() => fx.resetGrant());

const deny = (r: { decision: string }) => expect(r.decision).toBe("deny");
const allow = (r: { decision: string }) => expect(r.decision).toBe("allow");

describe("P0a — characters", () => {
  it.each([
    ["NBSP between cmdlet and path", "Set-Content\u00a0open-brain/src/x.ts x", "U+00A0"],
    ["ideographic space", "Set-Content\u3000open-brain/src/x.ts x", "U+3000"],
    ["en-dash parameter", "Set-Content \u2013Value x open-brain/src/x.ts", "U+2013"],
    ["em-dash parameter", "Set-Content \u2014Value x open-brain/src/x.ts", "U+2014"],
    ["en-dash common parameter", "Set-Content \u2013EA 0 open-brain/src/x.ts x", "U+2013"],
    ["curly single quotes", "Set-Content \u2018open-brain/src/x.ts\u2019 x", "U+2018"],
    ["curly double quotes", "Set-Content \u201copen-brain/src/x.ts\u201d x", "U+201C"],
    ["NBSP after a redirect", "Write-Output x >\u00a0open-brain/src/x.ts", "U+00A0"],
    ["a curly-quoted merge", "gh pr \u201cmerge\u201d 2", "U+201C"],
    ["a curly-quoted git subcommand", "git \u2018merge\u2019 feature", "U+2018"],
    ["a double dash from en-dashes", "git push \u2013\u2013force origin loop/x", "U+2013"],
    ["an astral character", "Write-Output \u{1f600}", "U+1F600"],
  ])("PowerShell: %s is refused, naming the character", (_n, command, code) => {
    const r = fx.ps(command);
    deny(r);
    expect(r.reason).toContain(GATE_PREFIX);
    expect(r.reason).toContain(`non-ASCII character ${code}`);
  });

  it("PowerShell: ASCII control characters other than tab, newline and carriage return are refused too", () => {
    expect(parseGate("Get-Date\u0001", "powershell")).toContain("non-ASCII character U+0001");
    expect(parseGate("Get-Date\u007f", "powershell")).toContain("U+007F");
    expect(parseGate("Get-Date\tGet-Date", "powershell")).toBeNull();
  });

  it.each([
    ["NBSP between words", "echo a\u00a0b"],
    ["in the command word", "ec\u00e9ho x"],
    ["after a redirect", "echo x >\u2013docs/loops/q.md"],
    ["a curly quote used as a quote", "git commit -m \u201cfix\u201d"],
    ["a curly-quoted merge", "gh pr \u201cmerge\u201d 2"],
    ["at the end", "ls\u00a0"],
  ])("Bash: %s outside quotes is refused", (_n, command) => {
    const r = fx.bash(command);
    deny(r);
    expect(r.reason).toContain(GATE_PREFIX);
    expect(r.reason).toContain("non-ASCII character");
  });

  it("Bash: non-ASCII inside ASCII quotes is data and parses", () => {
    allow(fx.bash("echo 'caf\u00e9 \u2014 ok'"));
    allow(fx.bash('echo "caf\u00e9 \u2014 ok"'));
    allow(fx.bash("git commit -m 'fix \u2014 the em dash'"));
    expect(parseGate("echo '\u00e9'", "bash")).toBeNull();
  });

  it("the cost: a non-ASCII TARGET is refused even when quoted (P0b); give the file an ASCII name", () => {
    const r = fx.bash("echo x > 'docs/loops/caf\u00e9.md'");
    deny(r);
    expect(r.reason).toContain("non-ASCII character U+00E9");
  });
});

describe("P0b — one target validator, every write source", () => {
  const SHAPES: Array<[string, string]> = [
    ["a provider path", "FileSystem::C:/x/open-brain/src/x.ts"],
    ["a drive-relative path", "C:open-brain/src/x.ts"],
    ["a non-ASCII name", "docs/loops/caf\u00e9.md"],
    ["a tilde", "~/x.txt"],
  ];

  describe.each(SHAPES)("%s", (_name, target) => {
    it("is refused as a Bash redirect, tee, cp, mv, install and sed -i target", () => {
      for (const command of [
        `echo x > '${target}'`, `echo x >> '${target}'`, `echo x 2> '${target}'`, `echo x | tee '${target}'`, `cp a.txt '${target}'`,
        `mv a.txt '${target}'`, `install a.txt '${target}'`, `sed -i 's/a/b/' '${target}'`,
        ...(target.includes("::") ? [] : [`scp host:a.txt '${target}'`]), // `Word::x` is a remote spec to scp, not a local path
      ]) {
        const r = fx.bash(command);
        deny(r);
        expect(r.reason, command).toMatch(/cannot be determined|statically parseable/);
      }
    });

    it("is refused by the file tools", () => {
      for (const r of [fx.write(target), fx.edit(target)]) {
        deny(r);
        expect(r.reason).toMatch(/cannot be determined|statically parseable/);
      }
    });
  });

  it("an ASCII quoted target is not the validator's business: it is read and decided", () => {
    allow(fx.bash("echo x > 'docs/loops/q.md'"));
    deny(fx.bash("echo x > 'open-brain/src/x.ts'"));
  });

  it("scp: the local end is a write target; a remote end is not", () => {
    deny(fx.bash("scp host:/tmp/a.txt open-brain/src/x.ts"));
    deny(fx.bash("scp host:/tmp/a.txt open-brain/src/"));
    allow(fx.bash("scp host:/tmp/a.txt docs/loops/a.txt"));
    allow(fx.bash("scp a.txt host:/tmp/open-brain/src/x.ts"));
    allow(fx.bash("scp a.txt user@host:open-brain/src/x.ts"));
    deny(fx.bash("scp host:/tmp/a.txt C:open-brain/src/x.ts"));
  });
});

describe("D-C — New-Item -Name with no -Path targets the current directory", () => {
  it("is read from the repo root and from a subdirectory", () => {
    deny(fx.ps("New-Item -Name open-brain/src/x.ts -ItemType File"));
    deny(fx.ps("New-Item -Name x.ts -ItemType File", fx.sub("open-brain/src")));
    deny(fx.ps("New-Item -ItemType File -Name .agents/state.json"));
    allow(fx.ps("New-Item -Name n.md -ItemType File", fx.sub("docs/loops")));
    allow(fx.ps("New-Item -Name docs/loops/n.md -ItemType File"));
  });

  it("with a -Path it still joins the two", () => {
    deny(fx.ps("New-Item -Path open-brain -Name src/x.ts -ItemType File"));
    allow(fx.ps("New-Item -Path docs -Name loops/n.md -ItemType File"));
  });
});

describe("P0c — Bash command words are allow-listed", () => {
  it("the planner's working set is on the list, each with a reason", () => {
    for (const w of ["git", "gh", "npm", "npx", "node", "ls", "cat", "echo", "printf", "grep", "rg", "head", "tail", "wc", "diff", "pwd", "which", "date", "mkdir", "cp", "mv", "tee", "sed", "test", "true", "false", "ssh", "scp", "curl"]) {
      expect(BASH_ALLOWED_COMMANDS[w], w).toBeTruthy();
    }
    for (const w of ["perl", "python", "ruby", "awk", "find", "sort", "xargs", "trap", "mapfile", "eval", "source", ".", "wget", "dd", "export"]) {
      expect(Object.prototype.hasOwnProperty.call(BASH_ALLOWED_COMMANDS, w), w).toBe(false);
    }
  });

  it.each([
    "awk 'BEGIN{print \"x\" > \"open-brain/src/x.ts\"}'",
    "awk 'BEGIN{system(\"echo x > open-brain/src/x.ts\")}'",
    "trap 'echo x > open-brain/src/x.ts' EXIT",
    "mapfile -C 'echo x > open-brain/src/x.ts;:' -c 1 < README.md",
    "sort -o open-brain/src/x.ts README.md",
    "find . -maxdepth 0 -fprint open-brain/src/x.ts",
    "perl -e'open(F,\">open-brain/src/x.ts\")'",
    "ruby -e'File.write(\"open-brain/src/x.ts\",\"x\")'",
    "python -c 'open(\"open-brain/src/x.ts\",\"w\")'",
    "export GIT_DIR=x",
  ])("`%s` is refused: command not allowed", (command) => {
    const r = fx.bash(command);
    deny(r);
    expect(r.reason).toContain(`${GATE_PREFIX}`);
    expect(r.reason).toMatch(/command not allowed|wrapper, shell or code-running command/);
  });

  it.each(NODE_REFUSED)("node: %s", (_n, command) => {
    const r = fx.bash(command);
    deny(r);
    expect(r.reason).toContain(GATE_PREFIX);
    expect(r.reason).toMatch(/node|command not allowed/);
  });

  it.each(NODE_ALLOWED)("node: `%s` is allowed", (command) => {
    expect(parseGate(command, "bash")).toBeNull();
    allow(fx.bash(command));
  });

  it.each(CURL_REFUSED)("curl: `%s` is refused", (command) => {
    deny(fx.bash(command));
    expect(parseGate(command, "bash")).toContain("curl option");
  });
  it.each(CURL_ALLOWED)("curl: `%s` is allowed", (command) => {
    allow(fx.bash(command));
  });

  it.each(SSH_REFUSED)("ssh/scp: `%s` is refused", (command) => {
    deny(fx.bash(command));
    expect(parseGate(command, "bash")).toMatch(/option that runs a local program/);
  });
  it.each(SSH_ALLOWED)("ssh/scp: `%s` is allowed", (command) => {
    allow(fx.bash(command));
  });

  it.each(["rg --pre cat x", "rg --pre=cat x", "rg --hostname-bin x y"])("rg: `%s` runs a program and is refused", (command) => {
    expect(parseGate(command, "bash")).toContain("rg option that runs a program");
  });

  it.each(["./git status", "/usr/bin/git status", "bin/node x.js", "C:/Program Files/Git/bin/git.exe status", "./evil.sh"])(
    "a PATH as the command word is refused: `%s`",
    (command) => {
      expect(parseGate(command, "bash")).toMatch(/a path, not a bare command name|unclosed|command not allowed/);
    },
  );

  it("the wrappers are unwrapped, and the command after them is held to the list as well", () => {
    allow(fx.bash("env FOO=1 ls"));
    allow(fx.bash("command git status"));
    allow(fx.bash("nohup node x.js"));
    expect(parseGate("env FOO=1 awk 'x'", "bash")).toContain("command not allowed: awk");
    expect(parseGate("command perl -e 1", "bash")).toContain("command not allowed: perl");
    expect(parseGate("nohup python x.py", "bash")).toContain("command not allowed: python");
    expect(parseGate("true && echo ok | awk '{print}'", "bash")).toContain("command not allowed: awk");
  });

  it("sh -c and bash -c still gate the string, and the string is held to the list", () => {
    allow(fx.bash("sh -c 'ls docs'"));
    expect(parseGate("sh -c 'awk 1'", "bash")).toContain("command not allowed: awk");
    expect(parseGate("bash -c 'node -e 1'", "bash")).toContain("node");
  });
});

describe("P0d — git and gh configuration through the environment", () => {
  it.each(ENV_REFUSED)("`%s` is refused", (command) => {
    const r = fx.bash(command);
    deny(r);
    expect(r.reason).toContain(GATE_PREFIX);
    expect(r.reason).toMatch(/git\/gh config through the environment|environment variable that changes/);
  });

  it.each(ENV_ALLOWED)("`%s` is allowed", (command) => {
    allow(fx.bash(command));
  });

  it("the message names the variable", () => {
    expect(parseGate("GIT_CONFIG_COUNT=1 git status", "bash")).toBe("git/gh config through the environment (GIT_CONFIG_COUNT)");
    expect(parseGate("GH_REPO=a/b gh pr view 1", "bash")).toBe("git/gh config through the environment (GH_REPO)");
  });
});

describe("the limit text (r7)", () => {
  it("states the remote side of ssh and scp, and that an allow-listed program does what its arguments say", () => {
    for (const phrase of ["ssh and scp", "allow-list", "what its own arguments say", "at runtime", "gh api", "not a sandbox", "symlinks and junctions"]) {
      expect(BASH_WRITE_LIMIT).toContain(phrase);
    }
  });

  it("names nothing the hook now catches or refuses", () => {
    for (const caught of ["dd,", "curl -o", "perl -pi", "awk -i", "heredoc", "eval"]) expect(BASH_WRITE_LIMIT).not.toContain(caught);
  });

  it("every Bash item it names as out of reach is allowed", async () => {
    allow(fx.bash("rm docs/loops/old.md"));
    allow(fx.bash("touch docs/loops/new.md"));
    allow(fx.bash("mkdir docs/loops/newdir"));
    allow(fx.bash("git checkout --detach origin/master"));
    allow(fx.bash("node scripts/x.js"));
    allow(fx.bash("npm test"));
    allow(fx.bash("ssh host 'echo x > open-brain/src/x.ts'"));
    allow(await fx.merge("Bash", "gh api repos/melvenac/Self-Improving-Agent/pulls/2/merge -X PUT"));
  });
});
