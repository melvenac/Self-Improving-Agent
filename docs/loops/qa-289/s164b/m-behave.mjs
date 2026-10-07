// QA 289 row 8: show the surviving mutants change behaviour (QA_OB per tree).
import { spawnSync } from "node:child_process";
const run = (ob, script, arg) => {
  const r = spawnSync(process.execPath, [`C:/qa-tmp/qa289/${script}`, ...(arg ? [arg] : [])], { env: { ...process.env, QA_OB: ob }, encoding: "utf8", timeout: 300_000 });
  console.log(`######## ${script} ${arg ?? ""} @ ${ob}\n${r.stdout}${r.stderr}`);
};
run("C:/qa-scratch/qa289-m6/open-brain", "s-recordok.mjs");
run("C:/qa-scratch/qa289-m5/open-brain", "s-rows.mjs", "q2c");
