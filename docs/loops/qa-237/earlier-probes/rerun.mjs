// QA 237: re-run the QA 233, 234 and 235 probe scripts, UNMODIFIED except that their fixture/home paths
// are re-pointed from qa23X-* to qa237-* (QA 237 may write only under C:/qa-scratch/qa237-*).
// Usage: node rerun.mjs <open-brain/build dir> <tag>
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
const [BUILD, TAG] = process.argv.slice(2);
const D = "C:/qa-scratch/qa237-probes";
const run = (script, args, outFile) => {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" }, maxBuffer: 1e8 });
  writeFileSync(outFile, r.stdout + (r.stderr ? `\n--- stderr ---\n${r.stderr}` : ""));
  console.log(`${script} -> exit ${r.status}`);
};
const patch = (src, n) => readFileSync(`${D}/${src}`, "utf8").replaceAll(`qa${n}-fx`, `qa237-fx${n}-${TAG}`).replaceAll(`qa${n}-nohome`, `qa237-nohome`);

// QA 233: fixture is not created by the script; build it as QA 233's driver did (planner role, origin remote).
const fx233 = `C:/qa-scratch/qa237-fx233-${TAG}`;
rmSync(fx233, { recursive: true, force: true });
for (const d of [".agents/SYSTEM", ".agents/TASKS", "open-brain/src", "docs/loops", ".git"]) mkdirSync(join(fx233, d), { recursive: true });
writeFileSync(join(fx233, "package.json"), '{"name":"qa233-fx"}\n');
writeFileSync(join(fx233, "open-brain", "package.json"), '{"name":"open-brain"}\n');
writeFileSync(join(fx233, ".git", "config"), '[remote "origin"]\n\turl = https://github.com/melvenac/Self-Improving-Agent.git\n');
writeFileSync(join(fx233, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\n---\n");
writeFileSync(`${D}/p233-${TAG}.mjs`, patch("233-qa233-probe.mjs", "233"));
run(`${D}/p233-${TAG}.mjs`, [BUILD], `${D}/out233-${TAG}.json`);

const fx234 = `C:/qa-scratch/qa237-fx234-${TAG}`;
rmSync(fx234, { recursive: true, force: true });
writeFileSync(`${D}/p234-${TAG}.mjs`, patch("234-qa234-probe.mjs", "234"));
run(`${D}/p234-${TAG}.mjs`, [BUILD, fx234], `${D}/out234-${TAG}.txt`);
writeFileSync(`${D}/p234b-${TAG}.mjs`, patch("234-qa234-probe2.mjs", "234"));
run(`${D}/p234b-${TAG}.mjs`, [BUILD, fx234], `${D}/out234b-${TAG}.json`);

const fx235 = `C:/qa-scratch/qa237-fx235-${TAG}`;
rmSync(fx235, { recursive: true, force: true });
writeFileSync(`${D}/p235-${TAG}.mjs`, patch("235-qa235-probe.mjs", "235"));
run(`${D}/p235-${TAG}.mjs`, [BUILD, fx235, `${D}/out235-${TAG}.json`], `${D}/out235-${TAG}.txt`);
