// QA 291 row 9 (N6): where the END-FIX store is, and whether its per-project key separates / unifies path spellings.
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
process.env.KNOWLEDGE_V2_DB = "C:/qa-tmp/qa291/db/keyprobe/kb.db";
rmSync("C:/qa-tmp/qa291/db/keyprobe", { recursive: true, force: true });
const { endRecordProjectDir } = await import(pathToFileURL("C:/qa-scratch/qa291-pr489/open-brain/build/shared/end-record-store.js").href);
const base = "C:/qa-tmp/qa291/repos/keyprobe";
rmSync(base, { recursive: true, force: true });
mkdirSync(`${base}/Proj`, { recursive: true });
mkdirSync(`${base}/Proj2`, { recursive: true });
const k = (p) => endRecordProjectDir(p).replace(/\\/g, "/").replace("C:/qa-tmp/qa291/db/keyprobe/", "");
const rows = {
  "C:/qa-tmp/qa291/repos/keyprobe/Proj": null,
  "C:\\qa-tmp\\qa291\\repos\\keyprobe\\Proj": null,
  "c:\\QA-TMP\\qa291\\repos\\KEYPROBE\\proj\\": null,
  "C:/qa-tmp//qa291/repos/keyprobe/Proj/": null,
  "C:/qa-tmp/qa291/repos/keyprobe/Proj2": null,
};
for (const p of Object.keys(rows)) rows[p] = k(p);
console.log(JSON.stringify(rows, null, 2));
// Two projects that differ only by case can exist on Windows only in a case-sensitive directory.
const cs = `${base}/cs`;
mkdirSync(cs, { recursive: true });
const r = spawnSync("fsutil.exe", ["file", "setCaseSensitiveInfo", cs.replace(/\//g, "\\"), "enable"], { encoding: "utf8" });
console.log(`fsutil setCaseSensitiveInfo: exit ${r.status} ${(r.stdout + r.stderr).trim()}`);
if (r.status === 0) {
  mkdirSync(`${cs}/Proj`); mkdirSync(`${cs}/proj`);
  console.log(`two dirs exist: ${existsSync(`${cs}/Proj`)} ${existsSync(`${cs}/proj`)} keys: ${k(`${cs}/Proj`)} vs ${k(`${cs}/proj`)}`);
}
