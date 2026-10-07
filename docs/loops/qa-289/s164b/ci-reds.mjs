// QA 289 row 2: list failing tests per mutant CI run (gh read-only).
import { execFileSync } from "node:child_process";
for (const r of ["37631307220", "37631314012", "37631319809"]) {
  let log = "";
  try { log = execFileSync("gh", ["run", "view", r, "--log-failed"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }); }
  catch (e) { log = String(e.stdout ?? ""); }
  const lines = log.split(/\r?\n/).map((l) => l.replace(/^.*?\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, ""));
  const hits = [...new Set(lines.filter((l) => /FAIL\s|Test Files|Tests\s+\d|AssertionError|^\s*×/.test(l)))];
  console.log(`=== run ${r}\n${hits.slice(0, 40).join("\n")}`);
}
