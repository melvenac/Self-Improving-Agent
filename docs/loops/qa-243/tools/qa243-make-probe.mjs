// QA 243, R3-2 liveness probe: copy the candidate's s4-g7-merge.test.ts to an UNTRACKED probe file whose V1 also
// (a) plants the reject G_done at docs/loops/loop-<loop>-records/<loop>.G_done.json (s01's path) and
// (b) commits every planted record in the fixture repo (s04 reads HEAD).
// At the unmutated candidate the probe must pass; under s01 and s04 it must go red, or those survivors are vacuous.
// Usage: node qa243-make-probe.mjs <candidate tree>   (writes open-brain/tests/harness/qa243-probe-g7.test.ts)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [tree] = process.argv.slice(2);
const dir = join(tree, "open-brain/tests/harness");
const src = readFileSync(join(dir, "s4-g7-merge.test.ts"), "utf8");
const anchor = '    const withRecords = prepare("d".repeat(40));';
if (!src.includes(anchor)) throw new Error("anchor not found");
const probe = src.replace(
  anchor,
  '    plant(`docs/loops/loop-${LOOP}-records/${LOOP}.G_done.json`, doneRec, "reject"); // QA 243 probe: s01\'s path\n' +
    '    repo.commitAll("QA 243 probe: commit the records"); // QA 243 probe: s04 reads HEAD\n' +
    anchor,
).replace('describe("S4-6d.3', 'describe("QA 243 PROBE S4-6d.3');
writeFileSync(join(dir, "qa243-probe-g7.test.ts"), probe);
console.log("wrote qa243-probe-g7.test.ts");
