// QA 151: can THIS process see each path? Usage: node see.mjs <root> <rel>...
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
const [root, ...rels] = process.argv.slice(2);
for (const rel of rels) {
  const p = join(root, rel); let kind = "?";
  try { kind = statSync(p).isDirectory() ? "dir" : "file"; } catch (e) { console.log(`SEE ${rel}: stat ${e.code}`); continue; }
  try { kind === "dir" ? readdirSync(p) : readFileSync(p); console.log(`SEE ${rel}: ${kind} READABLE`); }
  catch (e) { console.log(`SEE ${rel}: ${kind} ${e.code}`); }
}
