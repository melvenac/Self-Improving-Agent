// QA 253 row 7: `git log -1 --format=%cI -- <path>` for every *brief*.md under docs/loops at HEAD of a tree.
// Usage: node brief-dates.mjs <tree>
import { execFileSync } from "node:child_process";
const root = process.argv[2];
const git = (...a) => execFileSync("git", ["-C", root, ...a], { encoding: "utf8" }).trim();
console.log("HEAD", git("rev-parse", "HEAD"));
console.log("status:", JSON.stringify(git("status", "--short")));
const briefs = git("ls-tree", "-r", "--name-only", "HEAD", "--", "docs/loops/").split("\n")
  .filter((p) => { const b = p.split("/").pop(); return b.includes("brief") && b.endsWith(".md"); });
const rows = briefs.map((p) => [git("log", "-1", "--format=%cI", "--", p), p]).sort((a, b) => Date.parse(b[0]) - Date.parse(a[0]));
console.log(`${rows.length} briefs; newest 8:`);
for (const [d, p] of rows.slice(0, 8)) console.log(`  ${d}  ${p}`);
