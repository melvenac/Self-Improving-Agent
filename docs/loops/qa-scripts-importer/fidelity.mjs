#!/usr/bin/env node
// QA 102, dispatch step 3: the vendored fixture's 7 .agents files, byte for byte, against A2A-Hub at e0bc3f8.
// Compares git BLOBS on both sides (no checkout, so no eol conversion on either side), then the same bytes
// with CRLF -> LF, and reports each file's sha256, size and CR count.
// Usage: node fidelity.mjs <sia-repo> <a2a-hub-clone>   (read-only on both)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const [sia, hub] = process.argv.slice(2);
if (!sia || !hub) { console.error("usage: node fidelity.mjs <sia-repo> <a2a-hub-clone>"); process.exit(2); }
const CAND = "f6b6d44", HUB = "e0bc3f8", FIX = "open-brain/tests/fixtures-import-a2a-hub/";
const FILES = [
  ".agents/SESSIONS/next-session.md", ".agents/SESSIONS/Session_13.md", ".agents/SESSIONS/Session_14.md",
  ".agents/SYSTEM/DECISIONS.md", ".agents/SYSTEM/SUMMARY.md", ".agents/TASKS/INBOX.md", ".agents/TASKS/task.md",
];
const blob = (repo, rev, path) => execFileSync("git", ["-C", repo, "cat-file", "blob", `${rev}:${path}`], { maxBuffer: 1 << 26 });
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 12);
const crs = (b) => b.filter((x) => x === 13).length;
const lf = (b) => Buffer.from(b.toString("latin1").replace(/\r\n/g, "\n"), "latin1");

// The fixture must hold exactly these files plus README.md and package.json.
const listed = execFileSync("git", ["-C", sia, "ls-tree", "-r", "--name-only", CAND, FIX], { encoding: "utf8" })
  .trim().split("\n").map((p) => p.slice(FIX.length)).sort();
const expected = [...FILES, "README.md", "package.json"].sort();
console.log(`fixture file list matches the expected 9: ${JSON.stringify(listed) === JSON.stringify(expected)}`);
if (JSON.stringify(listed) !== JSON.stringify(expected)) console.log(`  listed: ${listed.join(", ")}`);

let exact = 0, lfOnly = 0, differ = 0;
for (const f of FILES) {
  const a = blob(hub, HUB, f), b = blob(sia, CAND, FIX + f);
  const same = a.equals(b), sameLf = lf(a).equals(lf(b));
  if (same) exact++; else if (sameLf) lfOnly++; else differ++;
  console.log(`${same ? "IDENTICAL" : sameLf ? "EOL-ONLY " : "DIFFERENT"} ${f}  hub ${sha(a)} ${a.length}B CR=${crs(a)} | fixture ${sha(b)} ${b.length}B CR=${crs(b)}`);
}
console.log(`summary: identical ${exact}, eol-only ${lfOnly}, different ${differ} (of ${FILES.length})`);

// package.json: the fixture claims to be the original cut to name and version.
const hp = JSON.parse(blob(hub, HUB, "package.json").toString("utf8"));
const fp = JSON.parse(blob(sia, CAND, FIX + "package.json").toString("utf8"));
console.log(`package.json fixture keys: ${Object.keys(fp).join(",")}; name ${fp.name === hp.name ? "matches" : "DIFFERS"}, version ${fp.version === hp.version ? "matches" : "DIFFERS"} (hub ${hp.name}@${hp.version})`);
process.exit(differ === 0 ? 0 : 1);
