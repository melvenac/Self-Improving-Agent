// node w32codes10.mjs — QA 108: which error codes win32 gives for odd link targets (report section 3.2). First run inline
// with `node -e` at about 23:36Z; this file is the same code, re-run from the file so that the tracked copy is what ran.
import * as fs from "node:fs";
import * as p from "node:path";
const d = fs.mkdtempSync("C:/qa-tmp/w32codes-");
const tryc = (f) => { try { f(); return "ok"; } catch (e) { return e.code; } };
const cases = {
  "junction->Z:\\nope": () => fs.symlinkSync("Z:\\nope", p.join(d, "j1"), "junction"),
  "symlink->Z:\\nope\\cfg": () => fs.symlinkSync("Z:\\nope\\cfg", p.join(d, "s1"), "file"),
  "symlink->\\\\nohost\\share\\cfg": () => fs.symlinkSync("\\\\nohost-q108\\share\\cfg", p.join(d, "s2"), "file"),
  "symlink->CON": () => fs.symlinkSync("CON", p.join(d, "s3"), "file"),
  "file-symlink->dir": () => { fs.mkdirSync(p.join(d, "realdir")); fs.symlinkSync(p.join(d, "realdir"), p.join(d, "s4"), "file"); },
};
for (const [k, mk] of Object.entries(cases)) console.log(k, "create:", tryc(mk));
for (const n of ["j1", "s1", "s2", "s3", "s4"]) {
  const q = p.join(d, n);
  const q2 = n === "j1" ? p.join(q, "config") : q;
  console.log(n, "lstat:", tryc(() => fs.lstatSync(q2)), "realpath:", tryc(() => fs.realpathSync(q2)), "stat:", tryc(() => fs.statSync(q2)), "open:", tryc(() => fs.closeSync(fs.openSync(q2, "r"))));
}
fs.rmSync(d, { recursive: true, force: true });
