// QA 138: every blob ever committed at a judged-input path (any directory), checked for a line starting "# ". Read-only.
import { execFileSync } from "node:child_process";
const repo = process.argv[2];
const git = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "buffer", maxBuffer: 1 << 30 });
const list = git("rev-list", "--all", "--objects").toString("utf8").split("\n");
const seen = new Map();
for (const l of list) {
  const i = l.indexOf(" "); if (i < 0) continue;
  const sha = l.slice(0, i), path = l.slice(i + 1);
  if (!/(^|\/)(TASKS\/(INBOX|task)\.md|SESSIONS\/next-session\.md)$/.test(path)) continue;
  if (!seen.has(sha)) seen.set(sha, new Set());
  seen.get(sha).add(path);
}
let untitled = 0;
const byPath = new Map();
for (const [sha, paths] of seen) {
  let b; try { b = git("cat-file", "-p", sha); } catch { continue; }
  let t = b.toString("utf8"); if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const lines = t.split(/\r?\n/);
  const titled = lines.some((l) => l.startsWith("# "));
  for (const p of paths) { const k = byPath.get(p) ?? { n: 0, bad: [] }; k.n++; if (!titled) k.bad.push(`${sha.slice(0, 9)} ${b.length}B first=${JSON.stringify((lines.find((x) => x.trim()) ?? "").slice(0, 60))}`); byPath.set(p, k); }
  if (!titled) untitled++;
}
for (const [p, k] of [...byPath].sort()) { console.log(`${p}: ${k.n} blob(s), ${k.bad.length} with no "# " line`); for (const x of k.bad) console.log(`    ${x}`); }
console.log(`\n${seen.size} distinct blobs; ${untitled} with no "# " line`);
