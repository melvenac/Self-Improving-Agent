// QA 289: share pr489's node_modules into each mutant tree (junction, scratch only).
import { symlinkSync, existsSync } from "node:fs";
for (const n of [4, 5, 6]) {
  const p = `C:/qa-scratch/qa289-m${n}/open-brain/node_modules`;
  if (!existsSync(p)) symlinkSync("C:/qa-scratch/qa289-pr489/open-brain/node_modules", p, "junction");
  console.log(p, existsSync(`${p}/vitest`));
}
