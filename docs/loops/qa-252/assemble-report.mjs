#!/usr/bin/env node
// QA 252: build docs/loops/jev-calibration-1.md from report-template.md, so that no results table is typed.
// `<!-- include: <path under docs/loops> -->` is replaced by that file's content, with its top-level heading demoted
// to ### so it nests. `<!-- include: key-scan-summary -->` is replaced by the key-scan.out lines that carry no path.
// Usage: node docs/loops/qa-252/assemble-report.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const LOOPS = "C:/qa-scratch/qa252-wt/docs/loops";
const template = readFileSync(`${LOOPS}/qa-252/report-template.md`, "utf8");
const out = template.replace(/<!-- include: (\S+) -->/g, (_, name) => {
  if (name === "key-scan-summary") {
    const p = `${LOOPS}/qa-252/key-scan.out`;
    if (!existsSync(p)) return "(key scan not yet run)";
    const lines = readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("  "));
    return ["```", ...lines, "```"].join("\n");
  }
  return readFileSync(`${LOOPS}/${name}`, "utf8").trimEnd().split("\n")
    .map((l) => (l.startsWith("# ") ? `### ${l.slice(2)}` : l.startsWith("## ") ? `#### ${l.slice(3)}` : l)).join("\n");
});
writeFileSync(`${LOOPS}/jev-calibration-1.md`, out.endsWith("\n") ? out : `${out}\n`);
console.log(`wrote ${LOOPS}/jev-calibration-1.md`);
