// QA 268 row 5: every local binding introduced by an import, per file, across src/. Reports any binding seen twice.
// Uses the TypeScript compiler's parser so multi-line, default, namespace and `type` imports are all counted.
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "src";
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : /\.(ts|mts|cts)$/.test(n) && files.push(p); } };
walk(root);

let dups = 0, imports = 0;
for (const f of files) {
  const sf = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true);
  const seen = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const c = st.importClause, names = [];
    if (c.name) names.push(c.name.text);
    const nb = c.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) names.push(nb.name.text);
    if (nb && ts.isNamedImports(nb)) for (const e of nb.elements) names.push(e.name.text);
    const line = sf.getLineAndCharacterOfPosition(st.getStart()).line + 1;
    for (const n of names) { imports++; (seen.get(n) ?? seen.set(n, []).get(n)).push(line); }
  }
  for (const [n, lines] of seen) if (lines.length > 1) { dups++; console.log(`DUP ${f}: ${n} at lines ${lines.join(", ")}`); }
}
console.log(`files=${files.length} import-bindings=${imports} duplicates=${dups}`);
process.exit(dups ? 1 : 0);
