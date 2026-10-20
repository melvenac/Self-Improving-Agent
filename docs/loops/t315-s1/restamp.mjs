// T-315 SIM helper: node restamp.mjs <build dir> <sha40>. Rewrites build-info.json's commit, as a rebuild's postbuild would.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [dir, sha] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("usage: node restamp.mjs <build dir> <sha40>");
const p = join(dir, "build-info.json");
const info = JSON.parse(readFileSync(p, "utf8"));
const was = info.commit;
info.commit = sha;
writeFileSync(p, JSON.stringify(info, null, 2) + "\n");
console.log(`restamped ${p}: ${was} -> ${sha}`);
