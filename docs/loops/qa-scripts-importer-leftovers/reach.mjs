// QA 138: which real judged inputs (INBOX.md, task.md, next-session.md) have no line starting "# ". Read-only.
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
const roots = process.argv.slice(2);
const want = new Set(["INBOX.md", "task.md", "next-session.md"]);
const skip = new Set(["node_modules", ".git", "AppData", "build", "dist", ".cache", "archive", "scratchpad", "Application Data", "Local Settings", "My Documents", "Cookies", "NetHood", "PrintHood", "Recent", "SendTo", "Start Menu", "Templates"]);
const found = [];
const walk = (d, depth) => {
  if (depth > 8) return;
  let ents; try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (!skip.has(e.name)) walk(p, depth + 1); continue; }
    const segs = d.split(sep);
    if (!want.has(e.name) || segs[segs.length - 2] !== ".agents" || !["TASKS", "SESSIONS"].includes(segs[segs.length - 1])) continue;
    const b = readFileSync(p);
    let t = b.toString("utf8"); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
    const lines = t.split(/\r?\n/);
    const titled = lines.some((l) => l.startsWith("# "));
    const firstNonBlank = lines.find((l) => l.trim() !== "") ?? "";
    found.push({ p, size: b.length, titled, first: firstNonBlank.slice(0, 70), line1: lines[0].slice(0, 40), nul: b.includes(0), bom: b[0] === 0xef || b[0] === 0xff || b[0] === 0xfe });
  }
};
for (const r of roots) walk(r, 0);
for (const f of found) console.log(`${f.titled ? "titled  " : "NO TITLE"} ${f.nul ? "NUL " : ""}${f.bom ? "BOM " : ""}${f.size}B ${f.p} | first: ${JSON.stringify(f.first)}${f.line1 !== f.first ? ` | line1: ${JSON.stringify(f.line1)}` : ""}`);
console.log(`\n${found.length} files; ${found.filter((f) => !f.titled).length} with no "# " line`);
