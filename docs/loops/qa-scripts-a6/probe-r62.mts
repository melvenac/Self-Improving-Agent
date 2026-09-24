/**
 * QA 94, R62 against A6's `drifted` clause in ConfigWatch.closeAndRestore. Usage: tsx probe-r62.mts <open-brain tree>
 * R62: "Attribution never treats 'not read' as 'changed'. Where either side of a comparison is unread, the runtime
 * compares the identity facts both sides hold. Equal facts mean no change." R54(2): a change is attributed to the stage
 * in which it happens, against that stage's start.
 *   NEWBETWEEN    (QA 92's A5-4 known positive) absent at base, written between base and begin, untouched: expect ok.
 *   EXISTBETWEEN  PRESENT at base; between base and begin it is rewritten by lock-and-rename (git's own way of
 *                 rewriting a file: same bytes, new inode); untouched during the stage: expect ok (R62).
 *   EXISTBETWEEN2 the same, but the rewrite carries different bytes: a change BEFORE this stage; expect ok.
 *   CONTROL-NEW   absent at base, created during the stage: expect created.
 *   CONTROL-EXIST present at base, rewritten by lock-and-rename DURING the stage: expect modified.
 */
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const TREE = process.argv[2]!;
const imp = (p: string) => import(pathToFileURL(join(TREE, p)).href);
const { ConfigWatch, resolveGitDirs } = await imp("src/harness/configwatch.ts");
const { makeRepo } = await imp("tests/harness/fixture.ts");
const LINE = "0000000000000000000000000000000000000000\trefs/heads/main\n";
const LINE2 = "1111111111111111111111111111111111111111\trefs/heads/main\n";
const lockRename = (p: string, bytes: string) => {
  writeFileSync(`${p}.lock`, bytes);
  renameSync(`${p}.lock`, p);
};
const out: Record<string, unknown> = { tree: TREE };
for (const probe of ["NEWBETWEEN", "EXISTBETWEEN", "EXISTBETWEEN2", "CONTROL-NEW", "CONTROL-EXIST"]) {
  const repo = makeRepo("qa94-r62-");
  try {
    const dirs = resolveGitDirs(repo.root);
    const refs = join(dirs.commonDir, "info", "refs");
    if (probe.startsWith("EXIST") || probe === "CONTROL-EXIST") writeFileSync(refs, LINE);
    const w = new ConfigWatch(dirs, repo.root);
    const hasCapture = typeof (w as any).captureBase === "function";
    if (hasCapture) (w as any).captureBase();
    if (probe === "NEWBETWEEN") writeFileSync(refs, LINE);
    if (probe === "EXISTBETWEEN") lockRename(refs, LINE);
    if (probe === "EXISTBETWEEN2") lockRename(refs, LINE2);
    w.begin("developer");
    if (probe === "CONTROL-NEW") writeFileSync(refs, LINE);
    if (probe === "CONTROL-EXIST") lockRename(refs, LINE2);
    const v = w.closeAndRestore();
    out[probe] = { hasCapture, ok: v.ok, changes: v.changes, unrestored: v.unrestored, message: String(v.message).slice(0, 500) };
  } catch (e) {
    out[probe] = { error: String((e as Error).stack ?? e).slice(0, 600) };
  } finally {
    await repo.cleanup().catch(() => {});
  }
}
console.log(JSON.stringify(out, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
