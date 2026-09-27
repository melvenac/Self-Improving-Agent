// QA 132: does master's runtime accept an E_t whose `loop` differs from the run's loop?
// Run t001 with StubQa overriding loop to "t002". Prints the loop outcome and the written E_t's loop.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const W = "file:///C:/Users/Aaron%20Melven/Worktrees/sia-qa/open-brain";
const { runLoop } = await import(`${W}/src/harness/runtime.ts`);
const { StubDeveloper, StubPlanner, StubQa } = await import(`${W}/src/harness/roles.ts`);
const { makeRepo, exitingChecks } = await import(`${W}/tests/harness/fixture.ts`);

const repo = makeRepo("qa132-loopmm-");
try {
  const r = await runLoop({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa({ loop: "t002" }) },
    checks: exitingChecks(0, 0),
    log: () => {},
  });
  const p = join(repo.root, "artifacts/iterations/t001/E_t.json");
  console.log(`result=${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v !== "object" || v === null)))} evidence_written=${existsSync(p)}`);
  if (existsSync(p)) console.log(`E_t.loop=${(JSON.parse(readFileSync(p, "utf-8")) as { loop: string }).loop}`);
} finally {
  await repo.cleanup();
}
