// QA 293: npm ci, build and tsc --noEmit in each mutant tree (C:/qa-scratch/qa293-m<N>/open-brain), via QA_ENV.
import { spawnSync } from "node:child_process";
import { QA_ENV } from "./run.mjs";
for (const n of process.argv.slice(2)) {
  const ob = `C:/qa-scratch/qa293-m${n}/open-brain`;
  for (const [cmd, ...args] of [["npm", "ci", "--no-audit", "--no-fund"], ["npm", "run", "build"], ["npx", "tsc", "--noEmit"]]) {
    const r = spawnSync(cmd, args, { cwd: ob, env: QA_ENV, encoding: "utf8", shell: true, maxBuffer: 256 << 20 });
    const out = ((r.stdout ?? "") + (r.stderr ?? "")).split(/\r?\n/).filter((l) => /error|stamped|added/i.test(l)).slice(0, 8).join("\n");
    console.log(`m${n}: ${cmd} ${args.join(" ")} [exit ${r.status}]\n${out}`);
  }
}
