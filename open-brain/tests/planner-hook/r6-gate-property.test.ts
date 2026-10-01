/**
 * T-194 r6, P0: the generator. It builds, from combinators, (a) at least 400 commands the parse gate must REFUSE, each
 * placed where the construct is most dangerous (a write target, a git or gh subcommand, a wrapper, a command after an
 * operator, inside `sh -c`), and (b) at least 200 commands inside the accepted grammar that must PARSE. A refused case
 * must be denied with `not statically parseable` and must name its construct; an accepted case is decided by P1-P3.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { parseGate } from "../../src/planner-hook/parse-gate.js";
import { makeFixture, type Fixture } from "./r5-fixture.js";
import { BASH_REFUSED, PS_REFUSED } from "./r6-cases.js";

const NOT_PARSEABLE = "not statically parseable";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];

let fx: Fixture;
beforeAll(() => {
  fx = makeFixture("r6gate");
});
afterAll(() => fx.dispose());
beforeEach(() => fx.resetGrant());

interface Case {
  command: string;
  tool: "Bash" | "PowerShell";
  /** The construct the refusal must name (lower case); null for an accepted case. */
  named: string | null;
  how: string[];
}

// ------------------------------------------------------------------------------------------------ refused: words
// A construct that is ONE WORD, and the word of the refusal that names it.
const WORD_CONSTRUCTS: Array<[string, string]> = [
  ["$HOME", "$"], ["${HOME}", "$"], ["$'merge'", "$"], ['"$HOME"', "double quotes"], ["`pwd`", "backtick"], ["$(pwd)", "$"],
  ["{a,b}", "brace"], ["m\\erge", "backslash"], ["~", "tilde"], ["~root", "tilde"], ["*", "glob"], ["?", "glob"], ["[ab]", "glob"],
  ['"`pwd`"', "backtick"], ['"a\\b"', "backslash"], ["(x)", "parenthesis"], ["a\\ b", "backslash"], ["$X", "$"], ["$((1+1))", "$"],
  ["x*", "glob"], ["open-brain/sr?/x", "glob"],
];
const WORD_PLACEMENTS: Array<[string, (w: string) => string, boolean]> = [
  ["write target", (w) => `echo x > ${w}`, true],
  ["cp destination", (w) => `cp a.ts ${w}`, true],
  ["git subcommand", (w) => `git ${w} status`, true],
  ["gh subcommand", (w) => `gh pr ${w} 2`, true],
  ["wrapper position", (w) => `${w} cp a.ts docs/loops/q.md`, true],
  ["after an operator", (w) => `true && echo ${w}`, true],
  ["behind env", (w) => `env A=1 echo ${w}`, true],
  ["inside sh -c", (w) => `sh -c 'echo ${w}'`, false], // not for a word that itself carries a single quote
];

function refusedCases(): Case[] {
  const out: Case[] = [];
  for (const [w, key] of WORD_CONSTRUCTS) {
    for (const [place, make, needsNoSingleQuote] of WORD_PLACEMENTS) {
      if (!needsNoSingleQuote && w.includes("'")) continue;
      out.push({ command: make(w), tool: "Bash", named: key, how: ["word", place, key] });
    }
  }
  // whole-command constructs, in six positions
  const POS: Array<[string, (c: string) => string]> = [
    ["alone", (c) => c],
    ["after &&", (c) => `true && ${c}`],
    ["before ;", (c) => `${c}; true`],
    ["after a pipe", (c) => `echo ok | ${c}`],
    ["behind env", (c) => `env A=1 ${c}`],
    ["behind command", (c) => `command ${c}`],
  ];
  for (const [name, command, key] of BASH_REFUSED) {
    for (const [place, make] of POS) {
      out.push({ command: make(command), tool: "Bash", named: key.toLowerCase(), how: ["statement", place, name] });
    }
  }
  const PS_POS: Array<[string, (c: string) => string]> = [
    ["alone", (c) => c],
    ["after ;", (c) => `Get-Date; ${c}`],
    ["before a pipe", (c) => `${c} | Out-Null`],
  ];
  for (const [name, command, key] of PS_REFUSED) {
    for (const [place, make] of PS_POS) {
      out.push({ command: make(command), tool: "PowerShell", named: key.toLowerCase(), how: ["powershell", place, name] });
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ accepted
const SAFE_BASH = [
  "ls -la", "git status", "git log --oneline -5", "git diff --stat", "git fetch origin", "cat README.md", "npm test",
  "node build/cli.js sync", "gh pr view 5", "gh pr list --label merge", "gh issue list", 'git commit -m "a > b # c"',
  "echo 'it is $HOME ~ * {x} (y)'", 'grep -n "x" README.md', "sed -n '1,5p' README.md", "FOO=bar npm test", "env X=1 ls",
  "command git status", "nohup node x.js", "sh -c 'ls docs'", "git log --grep merge", "echo a#b", "cat < README.md",
  "git -c color.ui=false status", "pwd", "which git", "head -5 README.md", "wc -l README.md", "date", 'echo "a b c"',
  "echo x > docs/loops/q.md", "echo x >> docs/loops/q.md", "cp docs/loops/a.md docs/loops/b.md", "mv docs/loops/a.md docs/loops/b.md",
  "sed -i 's/a/b/' docs/loops/q.md", "echo x | tee docs/loops/q.md", "install -m 644 a.md docs/loops/b.md",
  "npm test > /dev/null 2>&1", "npm test 2> docs/loops/err.log", "echo x &> docs/loops/o.txt", "cp -t docs/loops a.md",
  "echo x > C:/qa-tmp/o.txt", "git commit -m 'fix: a -> b'", "gh pr comment 5 --body merge", "git branch -D loop/old",
];
const SAFE_PS = [
  "Set-Content docs/loops/q.md hi", "Set-Content -Path docs/loops/q.md -Value 'a b'", "Set-Content -Path:docs/loops/q.md -Value x",
  "Add-Content docs/loops/q.md more", "New-Item -Type File docs/loops/n.md", "Copy-Item docs/loops/a.md docs/loops/b.md",
  "Move-Item docs/loops/a.md docs/loops/b.md", "Remove-Item docs/loops/a.md,docs/loops/b.md", "Remove-Item -Recurse -Force scratch",
  "Get-Content open-brain/src/cli.ts | Select-Object -First 3", "Get-ChildItem open-brain/src -Recurse -Name",
  "Select-String -Pattern x -Path README.md", "Write-Output hi > $null", "Write-Output hi 2>&1 | Out-Null",
  "Write-Output hi > docs/loops/o.txt", "git status", "git log --oneline -5", "gh pr view 5", "npm test", "Get-Date", "Test-Path docs",
  "Out-File -FilePath docs/loops/o.txt", "Set-Location docs", "Write-Host hello",
];
const PROTECTED_BASH = [
  "echo x > open-brain/src/x.ts", "cp a.ts open-brain/src/x.ts", "sed -i 's/a/b/' open-brain/src/x.ts", "echo x | tee .agents/state.json",
  "install -m 644 a.ts open-brain/src/x.ts", "git push origin master", "git merge origin/master", "gh pr merge 2 --repo o/x", "git tag v1",
];
const PROTECTED_PS = [
  "Set-Content open-brain/src/x.ts hi", "Copy-Item docs/a.md open-brain/src/b.md", "New-Item -Type File open-brain/src/n.ts",
  "Remove-Item open-brain/src/x.ts,docs/a.md", "git push --force origin loop/x",
];
const JOIN_BASH = [" && ", " || ", " ; ", " | "];

function acceptedCases(): Case[] {
  const rng = mulberry32(20261001);
  const out: Case[] = [];
  for (const c of SAFE_BASH) out.push({ command: c, tool: "Bash", named: null, how: ["single"] });
  for (const c of SAFE_PS) out.push({ command: c, tool: "PowerShell", named: null, how: ["single", "powershell"] });
  for (let n = 0; n < 190; n++) {
    out.push({ command: `${pick(rng, SAFE_BASH)}${pick(rng, JOIN_BASH)}${pick(rng, SAFE_BASH)}`, tool: "Bash", named: null, how: ["pair"] });
  }
  for (let n = 0; n < 40; n++) {
    out.push({ command: `${pick(rng, SAFE_PS)}; ${pick(rng, SAFE_PS)}`, tool: "PowerShell", named: null, how: ["pair", "powershell"] });
  }
  return out;
}

describe("P0 generator — what must be REFUSED", () => {
  it("builds at least 400 cases, over every construct and every position", () => {
    const cs = refusedCases();
    expect(cs.length).toBeGreaterThanOrEqual(400);
    const places = new Set(cs.flatMap((c) => c.how.slice(0, 2)));
    for (const p of ["word", "statement", "powershell", "write target", "git subcommand", "gh subcommand", "wrapper position", "after an operator", "behind env", "alone", "after &&", "behind command"]) {
      expect(places.has(p), `no case placed a construct at: ${p}`).toBe(true);
    }
  });

  it("every case is refused with `not statically parseable` and names its construct", () => {
    const cs = refusedCases();
    const wrong: string[] = [];
    for (const c of cs) {
      const r = c.tool === "Bash" ? fx.bash(c.command) : fx.ps(c.command);
      const reason = (r.reason ?? "").toLowerCase();
      if (r.decision !== "deny" || !reason.includes(NOT_PARSEABLE) || !reason.includes(c.named as string)) {
        wrong.push(`${JSON.stringify(c.command)} [${c.tool}] want deny + "${c.named}", got ${r.decision} ${(r.reason ?? "").slice(0, 110)}  [${c.how.join(",")}]`);
      }
    }
    expect(wrong, `${wrong.length} of ${cs.length} disagree:\n${wrong.slice(0, 25).join("\n")}`).toEqual([]);
  });

  it("parseGate agrees with the hook on every one (the gate alone, no fixture)", () => {
    const wrong = refusedCases().filter((c) => parseGate(c.command, c.tool === "Bash" ? "bash" : "powershell") === null);
    expect(wrong.map((c) => c.command).slice(0, 10)).toEqual([]);
  });
});

describe("P0 generator — what must PARSE", () => {
  it("builds at least 200 accepted cases", () => {
    expect(acceptedCases().length).toBeGreaterThanOrEqual(200);
  });

  it("every one passes the gate, and P1-P3 then allow it (none is refused as unparseable)", () => {
    const cs = acceptedCases();
    const wrong: string[] = [];
    for (const c of cs) {
      const flavor = c.tool === "Bash" ? "bash" : "powershell";
      const gate = parseGate(c.command, flavor);
      const r = c.tool === "Bash" ? fx.bash(c.command) : fx.ps(c.command);
      if (gate !== null || r.decision !== "allow") {
        wrong.push(`${JSON.stringify(c.command)} [${c.tool}] gate=${gate} hook=${r.decision} ${(r.reason ?? "").slice(0, 110)}`);
      }
    }
    expect(wrong, `${wrong.length} of ${cs.length} refused:\n${wrong.slice(0, 25).join("\n")}`).toEqual([]);
  });

  it("a parseable command that writes a protected path is decided by P1-P3, never by the gate", () => {
    const rng = mulberry32(20261002);
    const wrong: string[] = [];
    for (let n = 0; n < 60; n++) {
      const bash = rng() < 0.7;
      const base = bash ? pick(rng, PROTECTED_BASH) : pick(rng, PROTECTED_PS);
      const command = rng() < 0.5 ? `${pick(rng, bash ? SAFE_BASH : SAFE_PS)}${bash ? pick(rng, JOIN_BASH) : "; "}${base}` : base;
      const r = bash ? fx.bash(command) : fx.ps(command);
      if (r.decision !== "deny" || (r.reason ?? "").includes(NOT_PARSEABLE)) {
        wrong.push(`${JSON.stringify(command)} [${bash ? "Bash" : "PowerShell"}] ${r.decision} ${(r.reason ?? "").slice(0, 100)}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
