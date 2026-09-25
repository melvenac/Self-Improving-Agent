/**
 * QA 92, R57 against R54(2). Usage: tsx probe-r57.mts <open-brain tree>
 * A watched repository file ABSENT at the loop's base appears BETWEEN stages (written by something that is not the
 * stage's role: in the observed run, .git/info/refs), and is NOT changed during the next stage.
 *   NEWBETWEEN: captureBase; write .git/info/refs; begin("developer"); nothing; closeAndRestore.
 *     R54(2): a change is reported once, in the stage in which it happens, against that stage's start. Expected: ok.
 *   CONTROL:    captureBase; begin("developer"); write .git/info/refs during the stage; closeAndRestore. Expected: created.
 * At A4 (no captureBase) the watch opens at begin, which is the only baseline it has.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const TREE = process.argv[2]!;
const imp = (p: string) => import(pathToFileURL(join(TREE, p)).href);
const { ConfigWatch, resolveGitDirs } = await imp("src/harness/configwatch.ts");
const { makeRepo } = await imp("tests/harness/fixture.ts");
const out: Record<string, unknown> = { tree: TREE };
for (const probe of ["NEWBETWEEN", "CONTROL"]) {
  const repo = makeRepo("qa92-r57-");
  try {
    const dirs = resolveGitDirs(repo.root);
    const w = new ConfigWatch(dirs, repo.root);
    const hasCapture = typeof (w as any).captureBase === "function";
    if (hasCapture) (w as any).captureBase();
    const refs = join(dirs.commonDir, "info", "refs");
    if (probe === "NEWBETWEEN") writeFileSync(refs, "0000000000000000000000000000000000000000\trefs/heads/main\n");
    w.begin("developer");
    if (probe === "CONTROL") writeFileSync(refs, "0000000000000000000000000000000000000000\trefs/heads/main\n");
    const v = w.closeAndRestore();
    out[probe] = { hasCapture, ok: v.ok, changes: v.changes, unrestored: v.unrestored, message: v.message.slice(0, 400) };
  } catch (e) {
    out[probe] = { error: String((e as Error).stack ?? e).slice(0, 600) };
  } finally {
    await repo.cleanup().catch(() => {});
  }
}
console.log(JSON.stringify(out, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
