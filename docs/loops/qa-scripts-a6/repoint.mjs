// Repoint QA 92's scripts at this session's scratchpad. Asserts every replacement landed.
import { readFileSync, writeFileSync } from "node:fs";
const OLD = "0a0b5075-ad5c-443e-9891-39b25fa14528";
const NEW = "08650273-2511-4f23-8fbc-6b4796c2a257";
const files = ["archive.mjs", "build.mjs", "runmut.sh", "runp15.sh", "mkbranch.sh", "cilog.sh", "plainsync.sh", "inforefs.sh"];
for (const f of files) {
  const s = readFileSync(f, "utf-8");
  const n = s.split(OLD).length - 1;
  const out = s.split(OLD).join(NEW);
  writeFileSync(f, out);
  const back = readFileSync(f, "utf-8");
  console.log(`${f}: ${n} replaced; old left ${back.split(OLD).length - 1}; new present ${back.split(NEW).length - 1}`);
}
