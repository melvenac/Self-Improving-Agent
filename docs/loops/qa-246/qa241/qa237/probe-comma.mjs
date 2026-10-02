// QA 237: the row that kills qa-p3-comma-list-off (neither Forge's tests nor gen-p3 write an unquoted comma list).
// Usage: node probe-comma.mjs <build dir> <fixture dir>
import { makeFixture, cli, pwsh } from "./lib.mjs";
const [build, fx] = process.argv.slice(2);
makeFixture(fx);
for (const cmd of ["Remove-Item C:/qa-tmp/a.txt,open-brain/src/x.ts", "Set-Content -Path C:/qa-tmp/a.txt,open-brain/src/x.ts -Value x"]) {
  const r = await cli(pwsh(cmd, fx), build, fx);
  console.log(`${r.decision.padEnd(5)} ${cmd}`);
}
