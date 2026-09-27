// QA 151: apply named mutants (same find/replace as mutants-qa151.cjs) to <tree>/open-brain/src/pipelines/sync/checks.ts.
// Usage: node apply-mut.cjs <tree> <id>...   Refuses unless each find matches exactly once.
const fs = require("node:fs"), path = require("node:path");
const [tree, ...ids] = process.argv.slice(2);
const F = path.join(tree, "open-brain/src/pipelines/sync/checks.ts");
const M = {
  P1: ["try { texts.set(rel, readFileSync(join(projectRoot, rel), \"utf8\")); } catch (e) {\n      unreadable.push(`${rel} (${(e as NodeJS.ErrnoException).code ?? \"error\"})`);\n    }",
       "try { texts.set(rel, readFileSync(join(projectRoot, rel), \"utf8\")); } catch { continue; }"],
  Q2: [String.raw`const SCANNED_EXT = /\.(md|ts|mts|cts|mjs|cjs|js|json|sh|ps1|yml|yaml|toml)$/;`,
       String.raw`const SCANNED_EXT = /\.(md|ts|mts|cts|mjs|cjs|js|json|sh|ps1)$/;`],
  Q3: ["if (files.length > 0) return { files, source: \"git\", label: \"listed by git ls-files\", unreadable: [] };",
       "return { files, source: \"git\", label: \"listed by git ls-files\", unreadable: [] };"],
  Q4: ["try { sources.set(rel, readFileSync(join(srcDir, rel), \"utf8\")); } catch (e) {\n      unreadable.push(",
       "try { sources.set(rel, readFileSync(join(srcDir, rel), \"utf8\")); } catch (e) {\n      if ((e as NodeJS.ErrnoException).code === \"EACCES\") unreadable.push("],
  Q5: ["try { txt = readFileSync(full, \"utf-8\"); } catch (e) {\n        unreadable.push(",
       "try { txt = readFileSync(full, \"utf-8\"); } catch (e) {\n        if ((e as NodeJS.ErrnoException).code !== \"EACCES\") continue;\n        unreadable.push("],
};
let src = fs.readFileSync(F, "utf8");
for (const id of ids) {
  const [find, repl] = M[id] ?? [];
  if (!find) throw new Error(`unknown mutant ${id}`);
  const n = src.split(find).length - 1;
  if (n !== 1) throw new Error(`${id}: find matched ${n} times`);
  src = src.replace(find, repl);
  console.log(`applied ${id}`);
}
fs.writeFileSync(F, src);
