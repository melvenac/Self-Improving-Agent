// node qalines.mjs <vitest-out> [prefix] — QA 108: the printed Q1xx-/QAnn- lines and the failure blocks, ANSI stripped.
import { readFileSync } from "node:fs";
const t = readFileSync(process.argv[2], "utf8").replace(/(\x1b|\^\[)\[[0-9;]*m/g, "");
const pre = process.argv[3] ?? "Q108-";
for (const l of t.split(/\r?\n/)) if (l.includes(pre) && l.includes(" {")) console.log(l.slice(l.indexOf(pre)).slice(0, 30000));
const i = t.indexOf("Failed Tests");
if (i >= 0 && process.env.FAIL) console.log(t.slice(i, i + 12000));
