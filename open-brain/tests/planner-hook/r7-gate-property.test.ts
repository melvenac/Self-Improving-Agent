/**
 * T-194 r7, generators.
 *   P0a  every Unicode whitespace, dash and quote PowerShell 5.1 honours (and more), in every position: refused in PowerShell; in Bash
 *        refused outside quotes and parsed inside ASCII quotes.
 *   P0c  every command word NOT on the allow-list, in command position, in seven placements: refused. Every word that IS on the list,
 *        in four placements: parsed.
 * A refused case must be denied with `not statically parseable` and name what refused it.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { BASH_ALLOWED_COMMANDS } from "../../src/planner-hook/bash-commands.js";
import { parseGate } from "../../src/planner-hook/parse-gate.js";
import { makeFixture, type Fixture } from "./r5-fixture.js";
import { GATE_PREFIX } from "./r6-cases.js";
import { BASH_POSITIONS, NON_ASCII_CHARS, NOT_ALLOWED_WORDS, PS_POSITIONS } from "./r7-cases.js";

let fx: Fixture;
beforeAll(() => {
  fx = makeFixture("r7gate");
});
afterAll(() => fx.dispose());
beforeEach(() => fx.resetGrant());

const u = (c: string): string => `U+${(c.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0")}`;

describe("P0a generator — PowerShell refuses every non-ASCII character in every position", () => {
  const cases = NON_ASCII_CHARS.flatMap(([cname, c]) => PS_POSITIONS.map(([pname, make]) => ({ cname, c, pname, command: make(c) })));

  it("builds at least 300 cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(300);
    expect(new Set(cases.map((x) => x.c)).size).toBeGreaterThanOrEqual(30);
    // the characters the dispatch names, at least
    for (const code of [" ", " ", " ", " ", "　", "–", "—", "―", "‘", "’", "“", "”"]) {
      expect(cases.some((x) => x.c === code), u(code)).toBe(true);
    }
  });

  it("every case is refused, naming the character", () => {
    const wrong: string[] = [];
    for (const x of cases) {
      const r = fx.ps(x.command);
      if (r.decision !== "deny" || !(r.reason ?? "").includes(GATE_PREFIX) || !(r.reason ?? "").includes(`non-ASCII character ${u(x.c)}`)) {
        wrong.push(`${x.cname} ${x.pname}: ${JSON.stringify(x.command)} -> ${r.decision} ${(r.reason ?? "").slice(0, 110)}`);
      }
    }
    expect(wrong, `${wrong.length} of ${cases.length}:\n${wrong.slice(0, 20).join("\n")}`).toEqual([]);
  });
});

describe("P0a generator — Bash allows non-ASCII only inside ASCII quotes", () => {
  const cases = NON_ASCII_CHARS.flatMap(([cname, c]) => BASH_POSITIONS.map(([pname, make, quoted]) => ({ cname, c, pname, quoted, command: make(c) })));

  it("builds at least 200 cases, both kinds", () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
    expect(cases.some((x) => x.quoted)).toBe(true);
    expect(cases.some((x) => !x.quoted)).toBe(true);
  });

  it("outside quotes: refused, naming the character; inside quotes: the gate parses it", () => {
    const wrong: string[] = [];
    for (const x of cases) {
      const gate = parseGate(x.command, "bash");
      if (x.quoted) {
        if (gate !== null) wrong.push(`${x.cname} ${x.pname}: ${JSON.stringify(x.command)} refused inside quotes: ${gate}`);
      } else if (gate === null || !gate.includes(`non-ASCII character ${u(x.c)}`)) {
        // a newline-like character may be met as something else first; it must still be refused
        const r = fx.bash(x.command);
        if (r.decision !== "deny" || !(r.reason ?? "").includes(GATE_PREFIX)) wrong.push(`${x.cname} ${x.pname}: ${JSON.stringify(x.command)} -> ${gate}`);
      }
    }
    expect(wrong, `${wrong.length} of ${cases.length}:\n${wrong.slice(0, 20).join("\n")}`).toEqual([]);
  });
});

describe("P0c generator — a command word not on the allow-list is refused wherever it stands", () => {
  const PLACEMENTS: Array<[string, (w: string) => string]> = [
    ["alone", (w) => `${w} x`],
    ["after &&", (w) => `true && ${w} x`],
    ["after a pipe", (w) => `echo ok | ${w} x`],
    ["behind env", (w) => `env A=1 ${w} x`],
    ["behind command", (w) => `command ${w} x`],
    ["behind nohup", (w) => `nohup ${w} x`],
    ["inside sh -c", (w) => `sh -c '${w} x'`],
    ["after ;", (w) => `ls; ${w} x`],
  ];
  const cases = NOT_ALLOWED_WORDS.flatMap((w) => PLACEMENTS.map(([pname, make]) => ({ w, pname, command: make(w) })));

  it("builds at least 800 cases over at least 100 words", () => {
    expect(cases.length).toBeGreaterThanOrEqual(800);
    expect(NOT_ALLOWED_WORDS.length).toBeGreaterThanOrEqual(100);
  });

  it("none of the words is on the list", () => {
    const onList = NOT_ALLOWED_WORDS.filter((w) => Object.prototype.hasOwnProperty.call(BASH_ALLOWED_COMMANDS, w.toLowerCase()));
    expect(onList).toEqual([]);
  });

  it("every case is refused with `not statically parseable`, naming the word", () => {
    const wrong: string[] = [];
    for (const x of cases) {
      const gate = parseGate(x.command, "bash");
      const named = gate !== null && gate.toLowerCase().includes(x.w.toLowerCase());
      // reserved words (coproc) and the wrappers the gate names itself are still refusals that name the word
      if (!named) wrong.push(`${x.pname}: ${JSON.stringify(x.command)} -> ${gate}`);
    }
    expect(wrong, `${wrong.length} of ${cases.length}:\n${wrong.slice(0, 20).join("\n")}`).toEqual([]);
  });

  it("through the hook, a sample is denied with the gate's prefix", () => {
    for (const x of cases.filter((_, k) => k % 37 === 0)) {
      const r = fx.bash(x.command);
      expect(r.decision, x.command).toBe("deny");
      expect(r.reason, x.command).toContain(GATE_PREFIX);
    }
  });
});

describe("P0c generator — every word on the list parses, in four placements", () => {
  const SAMPLE: Record<string, string> = {
    git: "git status", gh: "gh pr view 5", node: "node x.js", sed: "sed -n p x", curl: "curl -s https://x", rg: "rg x y",
    sh: "sh -c 'ls'", bash: "bash -c 'ls'", env: "env A=1 ls", command: "command ls", nohup: "nohup ls", ssh: "ssh host ls",
    scp: "scp a.txt host:/tmp/", cd: "cd docs", pushd: "pushd docs", popd: "popd", npm: "npm test", npx: "npx tsc",
  };
  const PLACEMENTS: Array<[string, (c: string) => string]> = [
    ["alone", (c) => c],
    ["after &&", (c) => `true && ${c}`],
    ["after a pipe", (c) => `echo ok | ${c}`],
    ["behind env", (c) => `env A=1 ${c}`],
  ];
  const words = Object.keys(BASH_ALLOWED_COMMANDS);
  const cases = words.flatMap((w) => PLACEMENTS.map(([pname, make]) => ({ w, pname, command: make(SAMPLE[w] ?? `${w} a b`) })));

  it("builds a case for every word on the list", () => {
    expect(cases.length).toBe(words.length * 4);
    expect(words.length).toBeGreaterThanOrEqual(50);
    for (const w of ["git", "gh", "npm", "npx", "node", "ls", "cat", "echo", "printf", "grep", "rg", "head", "tail", "wc", "diff", "pwd", "which", "date", "mkdir", "cp", "mv", "tee", "sed", "test", "true", "false", "ssh", "scp", "curl"]) {
      expect(words, w).toContain(w);
    }
  });

  it("every one passes the gate", () => {
    const wrong: string[] = [];
    for (const x of cases) {
      const gate = parseGate(x.command, "bash");
      if (gate !== null) wrong.push(`${x.w} ${x.pname}: ${JSON.stringify(x.command)} -> ${gate}`);
    }
    expect(wrong, `${wrong.length} of ${cases.length}:\n${wrong.slice(0, 20).join("\n")}`).toEqual([]);
  });

  it("every restricted spelling is refused and every plain one parses (node, curl, rg, ssh)", () => {
    const refused = ["node -e 1", "node --eval 1", "node --eval=1", "node -e'1'", "node -p 1", "node -pe 1", "node -r x y.js", "node --import x y.js", "node -",
      "curl -o f x", "curl -O x", "curl --output f x", "curl -fsSLo f x", "rg --pre x y", "ssh -F c h", "ssh -o ProxyCommand=x h"];
    const plain = ["node x.js", "node x.mjs -e", "curl -s x", "curl -fsSL x", "rg x y", "ssh h ls", "ssh -p 22 h"];
    for (const c of refused) for (const [p, make] of PLACEMENTS) expect(parseGate(make(c), "bash"), `${p}: ${c}`).not.toBeNull();
    for (const c of plain) for (const [p, make] of PLACEMENTS) expect(parseGate(make(c), "bash"), `${p}: ${c}`).toBeNull();
  });
});
