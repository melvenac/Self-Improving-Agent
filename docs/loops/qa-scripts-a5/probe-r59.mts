/**
 * QA 92, R59 rollBack in BOTH directions. Usage: tsx probe-r59.mts <open-brain tree>
 *   SNEAKY:  the developer writes src/backdoor.ts outside its allowlist with node:fs -> a revert runs.
 *            "The offending paths were reverted." must be present, and the file must be gone.
 *   CFGONLY: the developer appends to .git/config only -> no path to revert; the sentence must be absent.
 *   BOTH:    both acts in one stage -> the revert runs; the sentence must be present and the file gone.
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const TREE = process.argv[2]!;
const imp = (p: string) => import(pathToFileURL(join(TREE, p)).href);
const { runLoop } = await imp("src/harness/runtime.ts");
const { StubDeveloper, StubPlanner, StubQa } = await imp("src/harness/roles.ts");
const { makeRepo, exitingChecks } = await imp("tests/harness/fixture.ts");
const SENT = "The offending paths were reverted.";
const out: Record<string, unknown> = { tree: TREE };
for (const probe of ["SNEAKY", "CFGONLY", "BOTH"]) {
  const repo = makeRepo("qa92-r59-");
  try {
    const dev = {
      role: "developer",
      run: async (ctx: any) => {
        const d = await new StubDeveloper().run(ctx);
        if (probe !== "CFGONLY") {
          const abs = join(ctx.repoRoot, "src/backdoor.ts");
          mkdirSync(dirname(abs), { recursive: true });
          writeFileSync(abs, "outside the allowlist\n");
        }
        if (probe !== "SNEAKY") appendFileSync(join(ctx.repoRoot, ".git", "config"), "\n# qa92-r59\n");
        return d;
      },
    };
    const r = await runLoop({ repoRoot: repo.root, loop: "t001", roles: { planner: new StubPlanner(), developer: dev, qa: new StubQa() }, checks: exitingChecks(0, 0), log: () => {} });
    out[probe] = {
      code: r.failure?.code ?? null,
      sentencePresent: (r.failure?.reason ?? "").includes(SENT),
      backdoorOnDisk: existsSync(join(repo.root, "src/backdoor.ts")),
      reasonTail: (r.failure?.reason ?? "").slice(-260),
    };
  } catch (e) {
    out[probe] = { error: String((e as Error).stack ?? e).slice(0, 600) };
  } finally {
    await repo.cleanup().catch(() => {});
  }
}
console.log(JSON.stringify(out, null, 2));
