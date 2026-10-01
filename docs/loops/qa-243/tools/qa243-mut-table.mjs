// QA 243: one line per mutant from qa243-mut.mjs result files: red/survives, and the red tests as <file>:<test id>.
// Usage: node qa243-mut-table.mjs <result.json>...
import { readFileSync } from "node:fs";
for (const file of process.argv.slice(2)) {
  for (const r of JSON.parse(readFileSync(file, "utf8"))) {
    const ids = r.failed.map((f) => {
      const [fname, full = ""] = f.split(" :: ");
      // the test id is the first token of the it() title, which follows the describe title
      const m = full.match(/ ((?:[A-Z]+\d+[a-z]?(?:\.\d+)?|K\d)(?:\([^)]*\))?) /);
      return `${fname.replace(".test.ts", "")}:${m ? m[1] : full.slice(0, 50)}`;
    });
    const verdict = !r.reverted_clean ? "NOT CLEAN" : r.exit === 0 ? (r.name.startsWith("control") ? "green" : "SURVIVES") : "red";
    console.log(`${r.name.replace(/\.diff$/, "")} | tsc ${r.tsc_exit} | ${r.failed.length}/${r.total} failed | ${verdict} | ${ids.join(", ")}`);
  }
}
