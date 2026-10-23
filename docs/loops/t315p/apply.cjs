// SIM applier: node apply.cjs <repo-root> <edits.txt>
// Each block: "@@@ <path>", "<<<", old lines, "===", new lines, ">>>". Every old text must occur EXACTLY once; otherwise exit 1, nothing written.
const fs = require("fs");
const path = require("path");
const [root, editsPath] = process.argv.slice(2);
const src = fs.readFileSync(editsPath, "utf8").replace(/\r\n/g, "\n");
const blocks = src.split(/^@@@ /m).filter((b) => b.trim());
const files = new Map();
let n = 0;
for (const b of blocks) {
  const nl = b.indexOf("\n");
  const rel = b.slice(0, nl).trim();
  const m = b.slice(nl + 1).match(/^<<<\n([\s\S]*?)\n===\n([\s\S]*?)\n>>>\s*$/);
  if (!m) { console.error(`BAD BLOCK for ${rel}`); process.exit(1); }
  const p = path.join(root, rel);
  if (!files.has(p)) {
    const raw = fs.readFileSync(p, "utf8");
    files.set(p, { text: raw.replace(/\r\n/g, "\n"), crlf: raw.includes("\r\n") });
  }
  const f = files.get(p);
  const count = f.text.split(m[1]).length - 1;
  n++;
  if (count !== 1) { console.error(`EDIT ${n} (${rel}) matched ${count} times; nothing written`); process.exit(1); }
  f.text = f.text.replace(m[1], () => m[2]);
}
for (const [p, f] of files) fs.writeFileSync(p, f.crlf ? f.text.replace(/\n/g, "\r\n") : f.text);
console.log(`APPLIED ${n} edits to ${files.size} files`);
