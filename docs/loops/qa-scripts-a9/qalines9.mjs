// node qalines.mjs <out> [prefix] — QA 99: the probes' printed QAnn- lines, ANSI stripped, temp paths shortened.
import { readFileSync } from "node:fs";
const [p, pre = "QA"] = process.argv.slice(2);
const text = readFileSync(p, "utf-8").replace(/\x1b?\[[0-9;]*m/g, "");
for (const line of text.split(/\r?\n/)) {
  const i = line.indexOf(pre);
  if (i < 0 || !/^QA\d+-/.test(line.slice(i))) continue;
  console.log(
    line
      .slice(i)
      .replace(/C:(\\\\|\\|\/)Users(\\\\|\\|\/)(AARONM~1|Aaron Melven)(\\\\|\\|\/)AppData(\\\\|\\|\/)Local(\\\\|\\|\/)Temp(\\\\|\\|\/)/g, "%T%")
      .replace(/\/tmp\//g, "%T%"),
  );
}
