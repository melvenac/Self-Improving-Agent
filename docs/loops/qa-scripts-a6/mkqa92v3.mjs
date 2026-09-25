// QA 94: make QA 92's probe file runnable at A6, where MachineConfigWatch.recordChain no longer exists.
// The ONLY change: the two route prints become optional, so a missing method prints a note instead of throwing
// before the hash assertion. Asserts exactly two replacements and reads the file back.
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync("qa92-a5-probe.test.ts", "utf-8");
const find = "((watch as any).recordChain(cfg) as Array<{ kind: string; path: string }>).slice(-3).map((c) => `${c.kind} ${c.path}`)";
const repl = "(typeof (watch as any).recordChain === \"function\" ? ((watch as any).recordChain(cfg) as Array<{ kind: string; path: string }>).slice(-3).map((c) => `${c.kind} ${c.path}`) : [\"recordChain absent at this candidate\"])";
const n = src.split(find).length - 1;
if (n !== 2) { console.error(`expected 2, found ${n}`); process.exit(3); }
const out = src.split(find).join(repl).replace(
  " * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 92, scoring candidate A5 4c1287f.",
  " * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 92, scoring candidate A5 4c1287f.\n * v3 (QA 94): the two route prints are optional, because A6 removed recordChain; nothing else changed.",
);
writeFileSync("qa92-a5-probe.v3.test.ts", out);
const back = readFileSync("qa92-a5-probe.v3.test.ts", "utf-8");
console.log(`replaced ${n}; header ${back.includes("v3 (QA 94)")}; old left ${back.split(find).length - 1}; bytes ${src.length} -> ${back.length}`);
