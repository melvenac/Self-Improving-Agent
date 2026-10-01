// QA 242: take the SKIPS pattern exactly as committed in s4-guards.test.ts (the `const SKIPS = new RegExp(...)` line,
// evaluated as written) and run it over call-position spellings the builder did not list, plus non-calls.
// Usage: node qa242-d1-spellings.mjs <candidate tree>
import { readFileSync } from "node:fs";
import { join } from "node:path";
const src = readFileSync(join(process.argv[2], "open-brain/tests/harness/s4-guards.test.ts"), "utf8");
const line = src.split("\n").find((l) => l.startsWith("const SKIPS = new RegExp("));
const SKIPS = new Function(`${line}; return SKIPS;`)();
console.log(`pattern: ${SKIPS.source}\n`);
const calls = [
  // dispatch-named
  'test.only.skip("x", () => {})',
  'describe.skipIf(x)("x", () => {})',
  'it.concurrent.skip("x", () => {})',
  // more call positions that skip or never run a test
  'it.skipIf(process.env.CI)("x", fn)',
  'describe.runIf(a)("x", fn)',
  'test.todo("x")',
  'it.each([[1, 2]]).skip("x", fn)',
  'it.each([{ a: f(1) }]).skip("x", fn)',
  'it.each([f(g(1))]).skip("x", fn)',
  "it.each`a`.skip(\"x\", fn)",
  'test.for([1]).skip("x", fn)',
  'test.extend({}).skip("x", fn)',
  'it .skip("x", fn)',
  'it["skip"]("x", fn)',
  'suite.skip("x", fn)',
  'bench.skip("x", fn)',
  'xit("x", fn)',
  'it("x", (ctx) => { ctx.skip(); })',
  'it("x", ({ skip }) => { skip(); })',
  'const s = it.skip; s("x", fn)',
];
const nonCalls = [
  'it("S4-9.2 no skip, todo, skipIf or runIf is added, and no test file loses a test", () => {',
  'it("uses skipIf and runIf in its title", fn)',
  'test("describe.skip is mentioned in a string", fn)',
  "it('x', () => {})",
];
console.log("call position (a HIT is wanted):");
for (const c of calls) console.log(`  ${SKIPS.test(c) ? "HIT " : "miss"}  ${c}`);
console.log("not a call (a miss is wanted):");
for (const c of nonCalls) console.log(`  ${SKIPS.test(c) ? "HIT " : "miss"}  ${c}`);
