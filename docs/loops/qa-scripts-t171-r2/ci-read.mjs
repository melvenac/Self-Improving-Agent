// QA 134: read a CI run per test: branch, sha, runner, conclusion, the Tests line, each failing row, and what kind
// of failure each is (AssertionError vs anything else). usage: node ci-read.mjs <run-id>...
import { execFileSync } from "node:child_process";
const strip = (s) => s.replace(/\^\[\[[0-9;]*m/g, "").replace(new RegExp(String.fromCharCode(27) + "[[][0-9;]*m", "g"), "");
for (const id of process.argv.slice(2)) {
  const meta = JSON.parse(execFileSync("gh", ["run", "view", id, "--json", "headBranch,headSha,conclusion,status"], { encoding: "utf8" }));
  const log = strip(execFileSync("gh", ["run", "view", id, "--log"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }));
  const body = log.split("\n").map((l) => l.replace(/^[^\t]*\t[^\t]*\t\S+Z ?/, ""));
  const runner = (log.match(/Runner name: '([^']+)'/) || [])[1] ?? "?";
  const tests = body.find((l) => /^\s*Tests\s+\d/.test(l))?.trim() ?? "(no Tests line)";
  const files = body.find((l) => /^\s*Test Files\s+\d/.test(l))?.trim() ?? "";
  const fails = [...new Set(body.filter((l) => /^\s*FAIL\s+tests\//.test(l)).map((l) => l.trim().replace(/^FAIL\s+/, "")))];
  const errs = body.filter((l) => /^(AssertionError|TypeError|Error|ReferenceError|SyntaxError)\b/.test(l.trim()) || /##\[error\]/.test(l));
  const kinds = {};
  for (const e of errs) { const k = (e.replace(/.*##\[error\]/, "").trim().match(/^\w+/) || ["?"])[0]; kinds[k] = (kinds[k] || 0) + 1; }
  console.log(`== run ${id}: ${meta.headBranch} @ ${meta.headSha.slice(0, 7)} runner ${runner}: ${meta.status} ${meta.conclusion}\n   ${files} | ${tests}\n   error lines by kind: ${JSON.stringify(kinds)}`);
  for (const f of fails) console.log(`   FAIL ${f.slice(0, 230)}`);
}
