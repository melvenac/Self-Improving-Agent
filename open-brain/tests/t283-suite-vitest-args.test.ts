import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SUITE_VITEST_REPORT, suiteVitestArgs } from "../src/suite-vitest.js";

describe("T-283 the vitest arguments carry no path", () => {
  it("P1: the arguments name the report relatively", () => {
    expect(suiteVitestArgs()).toEqual(["vitest", "run", "--reporter=json", "--outputFile", "suite-vitest.json"]);
    expect(SUITE_VITEST_REPORT).toBe("suite-vitest.json");
  });

  it("P2: no element holds the cwd, a separator or a space", () => {
    for (const a of suiteVitestArgs()) {
      expect(a.includes(process.cwd())).toBe(false);
      expect(/[\\/ ]/.test(a)).toBe(false);
    }
  });

  it("P3: the call site uses suiteVitestArgs and keeps jsonOut absolute for the read", () => {
    const src = readFileSync(join(import.meta.dirname, "../src/cli-suite-run.ts"), "utf8");
    expect(src.split('spawnSync("npx", suiteVitestArgs(), {').length - 1).toBe(1);
    expect(src).toContain("const jsonOut = join(process.cwd(), SUITE_VITEST_REPORT);");
    expect(src).not.toContain('"--outputFile", jsonOut');
  });

  it.skipIf(process.platform !== "win32")("P4: under shell:true from a cwd with a space, the arguments arrive intact", () => {
    const root = mkdtempSync(join(tmpdir(), "t283-"));
    const cwd = join(root, "dir with space");
    mkdirSync(cwd);
    writeFileSync(join(root, "argv.cjs"), "console.log(JSON.stringify(process.argv.slice(2)));\n");
    mkdirSync(join(root, "bin"));
    writeFileSync(join(root, "bin", "npx.cmd"), `@"${process.execPath}" "${join(root, "argv.cjs")}" %*\r\n`);
    const env: NodeJS.ProcessEnv = { ...process.env };
    const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "Path";
    env[pathKey] = join(root, "bin") + ";" + (env[pathKey] ?? "");

    const r = spawnSync("npx", suiteVitestArgs(), { encoding: "utf8", shell: true, cwd, env });
    expect(JSON.parse(r.stdout.trim())).toEqual(suiteVitestArgs());

    // Control: the round-1 shape, an absolute --outputFile, splits on the space.
    const abs = join(cwd, SUITE_VITEST_REPORT);
    const c = spawnSync("npx", ["vitest", "run", "--reporter=json", "--outputFile", abs], {
      encoding: "utf8",
      shell: true,
      cwd,
      env,
    });
    const argv = JSON.parse(c.stdout.trim()) as string[];
    expect(argv.length).toBeGreaterThan(5);
    expect(argv[4]).not.toBe(abs);

    rmSync(root, { recursive: true, force: true });
  });
});
