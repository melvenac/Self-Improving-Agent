// node repoint7.mjs — QA 96. Repoint QA 92's and QA 94's scripts at this session's scratchpad. Asserts each file had
// at least one occurrence and none remain after.
import { readFileSync, writeFileSync } from "node:fs";
const OLDS = ["0a0b5075-ad5c-443e-9891-39b25fa14528", "08650273-2511-4f23-8fbc-6b4796c2a257"];
const NEW = "07fe8094-75b7-499f-88b2-6bf1761d35a3";
const FILES = ["archive.mjs", "build6.mjs", "allmut6.sh", "plainsync.sh", "plainsync6.sh", "rest6.sh", "runmut6.sh", "runp15.sh"];
for (const f of FILES) {
  let s = readFileSync(f, "utf-8");
  let n = 0;
  for (const o of OLDS) { n += s.split(o).length - 1; s = s.split(o).join(NEW); }
  if (n === 0) { console.error(`${f}: nothing to repoint`); process.exit(3); }
  writeFileSync(f, s);
  const back = readFileSync(f, "utf-8");
  const left = OLDS.reduce((k, o) => k + back.split(o).length - 1, 0);
  console.log(`${f}: ${n} replaced, ${left} left`);
  if (left !== 0) process.exit(3);
}
