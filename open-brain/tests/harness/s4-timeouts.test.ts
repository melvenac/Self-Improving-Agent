/**
 * Slice four's spawning tests carry an explicit timeout, by class (QA 242, r3 item 1).
 *
 * A test that spawns `tsx` or the CLI takes seconds on its own and more under full-suite load. P4
 * took 4.5 s alone and failed at vitest's 5 s default in both of QA 242's full runs. The fix is a
 * describe-level timeout on every file that spawns, and this guard fails when a spawning s4 file
 * has a top-level describe without one.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const HERE = __dirname;

/** Whether the source calls a spawning function (a call, not a mention in a comment line). */
export function spawns(source: string): boolean {
  return source
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .some((l) => /\b(spawnSync|execFileSync|execSync|spawn|execFile|exec)\s*\(/.test(l));
}

/** The top-level describe lines that carry no explicit timeout option. */
export function describesWithoutTimeout(source: string): string[] {
  return source.split("\n").filter((l) => /^describe\(/.test(l) && !/\{\s*timeout:\s*\d[\d_]*\s*\}/.test(l));
}

/** The files a spawning s4 test could be in: every s4-*.test.ts next to this one. */
export function s4TestFiles(): string[] {
  return readdirSync(HERE).filter((f) => /^s4-.*\.test\.ts$/.test(f)).sort();
}

describe("slice four spawning tests have an explicit timeout", { timeout: 120_000 }, () => {
  it("T0 the guard fires on a planted spawn with no timeout, and stays quiet with one or without a spawn", () => {
    const planted = `import { spawnSync } from "node:child_process";\ndescribe("x", () => {\n  it("y", () => { spawnSync("node", []); });\n});\n`;
    expect(spawns(planted)).toBe(true);
    expect(describesWithoutTimeout(planted)).toHaveLength(1);
    const fixed = planted.replace('describe("x", () =>', 'describe("x", { timeout: 120_000 }, () =>');
    expect(describesWithoutTimeout(fixed)).toEqual([]);
    expect(spawns(`describe("x", () => { it("y", () => {}); });`)).toBe(false);
    // A spawn named only in a comment is not a spawn.
    expect(spawns("// spawnSync( is how it would be done\nconst a = 1;")).toBe(false);
  });

  it("T1 every spawning s4 test file puts an explicit timeout on each top-level describe", () => {
    const files = s4TestFiles();
    expect(files.length).toBeGreaterThanOrEqual(7);
    const spawning: string[] = [];
    for (const f of files) {
      const text = readFileSync(resolve(HERE, f), "utf-8");
      if (!spawns(text)) continue;
      spawning.push(f);
      expect(describesWithoutTimeout(text), `${f} spawns and has a describe with no explicit timeout`).toEqual([]);
    }
    // The guard looked at the files that spawn: it is not vacuous.
    expect(spawning).toContain("s4-g1-records.test.ts");
    expect(spawning).toContain("s4-g2-key.test.ts");
    expect(spawning).toContain("s4-g3-done.test.ts");
    expect(spawning).toContain("s4-g5-qa.test.ts");
  });
});
