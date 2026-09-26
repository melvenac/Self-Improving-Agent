import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { parseArgs, declaredFlags, type CommandSpec } from "../../src/shared/cli-args.js";
import { COMMAND_SPECS } from "../../src/cli-spec.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");

const SPEC: CommandSpec = {
  name: "demo",
  booleans: ["--dry-run", "--force"],
  values: { "--seat": "space", "--min": "equals", "--from": "both" },
  positionals: "directory",
};

let dir: string;
beforeAll(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), "t185-args-")));
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "a-file"), "x");
});
afterAll(async () => {
  await import("node:fs/promises").then((fs) => fs.rm(dir, { recursive: true, force: true }));
});

function refused(tokens: string[], spec: CommandSpec = SPEC): string {
  const r = parseArgs(spec, tokens, dir);
  expect(r.ok, `expected a refusal for ${JSON.stringify(tokens)}`).toBe(false);
  return r.ok ? "" : r.error;
}

describe("parseArgs refuses what it was not told about", () => {
  it.each([["-dry-run"], ["--dry-rn"], ["--help"], ["-h"], ["--"], ["-"]])("%s refuses, naming it and the flags", (tok) => {
    const e = refused([tok]);
    expect(e).toContain(`unrecognised flag "${tok}".`);
    expect(e).toContain("Accepted flags: --dry-run, --force, --seat, --min, --from");
  });

  it("names every unknown token, not only the first", () => {
    expect(refused(["-x", "--y"])).toContain('unrecognised flags "-x", "--y".');
  });

  it("a command with no flags says so", () => {
    expect(refused(["--x"], COMMAND_SPECS.start)).toContain("Accepted flags: (none)");
  });

  it("a value flag keeps its declared form", () => {
    expect(refused(["--seat=qa"])).toMatch(/--seat takes its value as "--seat <value>"/);
    expect(refused(["--min", "3"])).toMatch(/--min takes its value as "--min=<value>"/);
    expect(refused(["--seat"])).toMatch(/--seat needs a value/);
    expect(refused(["--seat", "--force"])).toMatch(/--seat needs a value/);
    expect(refused(["--seat", "a", "--seat", "b"])).toMatch(/--seat given more than once/);
  });
});

describe("positionals", () => {
  it("a directory that does not exist refuses, with what it resolved to", () => {
    const e = refused(["nope"]);
    expect(e).toContain('"nope" is not an existing directory');
    expect(e).toContain(resolve(dir, "nope"));
  });

  it("a file is not a directory", () => {
    expect(refused(["a-file"])).toMatch(/not an existing directory/);
  });

  it("two directories refuse", () => {
    expect(refused(["sub", "sub"])).toMatch(/at most one directory/);
  });

  it("an existing directory is resolved against the cwd given", () => {
    const r = parseArgs(SPEC, ["sub"], dir);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.args.directory).toBe(join(dir, "sub"));
  });

  it("no directory leaves it undefined for the caller's default", () => {
    const r = parseArgs(SPEC, [], dir);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.args.directory).toBeUndefined();
  });

  it("'none' refuses any positional", () => {
    expect(refused(["x"], COMMAND_SPECS.relocate)).toMatch(/takes no positional arguments/);
  });

  it("'any' keeps positionals in order and does not treat flag values as positionals", () => {
    const r = parseArgs(COMMAND_SPECS.stateMigrate, ["a.json", "--seat", "qa", "b.json", "--dry-run"], dir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.args.positionals).toEqual(["a.json", "b.json"]);
    expect(r.args.value("--seat")).toBe("qa");
    expect(r.args.has("--dry-run")).toBe(true);
  });
});

describe("reading an undeclared flag is a defect, not 'not given'", () => {
  it("has() and value() throw on a flag the spec does not declare", () => {
    const r = parseArgs(SPEC, [], dir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(() => r.args.has("--dry-rn")).toThrow(/--dry-rn is not a declared boolean flag/);
    expect(() => r.args.value("--sat")).toThrow(/--sat is not a declared value flag/);
    // A value flag is not a boolean, and the reverse.
    expect(() => r.args.has("--seat")).toThrow();
    expect(() => r.args.value("--force")).toThrow();
  });
});

describe("every declared flag of every command is accepted", () => {
  const specs = Object.values(COMMAND_SPECS) as CommandSpec[];

  it("walks at least the seven commands (proves it looked)", () => {
    expect(specs.map((s) => s.name).sort()).toEqual(
      ["detach", "relocate", "start", "state migrate", "state show", "sync", "topics"]
    );
  });

  it.each(specs.map((s) => [s.name, s] as const))("%s", (_name, spec) => {
    for (const flag of spec.booleans) {
      const r = parseArgs(spec, [flag], dir);
      expect(r.ok, `${spec.name} ${flag}: ${r.ok ? "" : r.error}`).toBe(true);
      if (r.ok) expect(r.args.has(flag)).toBe(true);
    }
    for (const [flag, form] of Object.entries(spec.values)) {
      const forms = form === "both" ? ["space", "equals"] : [form];
      for (const f of forms) {
        const tokens = f === "space" ? [flag, "v1"] : [`${flag}=v1`];
        const r = parseArgs(spec, tokens, dir);
        expect(r.ok, `${spec.name} ${tokens.join(" ")}: ${r.ok ? "" : r.error}`).toBe(true);
        if (r.ok) expect(r.args.value(flag)).toBe("v1");
      }
    }
  });
});

describe("the declarations agree with the usage text the CLI prints", () => {
  // The usage text is what an operator reads, so a declaration that disagrees
  // with it (a typo on either side) locks a documented flag out or accepts an
  // undocumented one.
  let usage = "";
  beforeAll(() => {
    const top = spawnSync(process.execPath, [tsxCli, cliEntry], { encoding: "utf8", cwd: dir, timeout: 60_000 });
    const state = spawnSync(process.execPath, [tsxCli, cliEntry, "state"], { encoding: "utf8", cwd: dir, timeout: 60_000 });
    usage = `${top.stdout}\n${state.stderr}`;
  }, 120_000);

  const flagsOn = (line: string): string[] => [...line.matchAll(/--[a-z][a-z-]*/g)].map((m) => m[0]);

  it("the usage text was captured (proves it looked)", () => {
    expect(usage).toContain("Usage: open-brain <command>");
    expect(usage).toContain("Usage: open-brain state <show");
  });

  it.each([
    ["sync", /^\s+sync (.*)$/m],
    ["start", /^\s+start(.*)$/m],
    ["relocate", /^\s+relocate (.*)$/m],
    ["topics", /^\s+topics (.*)$/m],
    ["detach", /^\s+detach (.*)$/m],
    ["state show", /^\s+state show (.*)$/m],
    ["state migrate", /^\s+state migrate (.*)$/m],
  ])("every flag documented for %s is declared", (name, re) => {
    const line = usage.match(re)?.[1];
    expect(line, `no usage line for ${name}`).toBeDefined();
    const spec = (Object.values(COMMAND_SPECS) as CommandSpec[]).find((s) => s.name === name)!;
    // Only the flags before any "Description" column; the descriptions carry no flags.
    for (const flag of flagsOn(line!)) expect(declaredFlags(spec), `${name} documents ${flag}`).toContain(flag);
  });

  it("every declared flag is documented somewhere in the usage text", () => {
    for (const spec of Object.values(COMMAND_SPECS) as CommandSpec[]) {
      for (const flag of declaredFlags(spec)) expect(usage, `${spec.name} declares ${flag}`).toContain(flag);
    }
  });
});
