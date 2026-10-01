// QA 241's own mutants: one per P0 refusal family. Each weakens ONE line of parse-gate.ts so the gate stops refusing
// that family, then runs the planner-hook suite; a mutant that goes red proves the suite pins that family independently
// of Forge's p0-* mutants. Applied in the mutant worktree, restored after each. Usage: node qa-mutants.mjs <out.json>
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const WT = "C:/qa-scratch/qa241-mut";
const OB = `${WT}/open-brain`;
const GATE = `${OB}/src/planner-hook/parse-gate.ts`;
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
const git = (...a) => execFileSync("git", ["-C", WT, ...a], { encoding: "utf8" });
const run = () => spawnSync("npx", ["vitest", "run", "tests/planner-hook", "--reporter=json"], { cwd: OB, env, encoding: "utf8", shell: true, maxBuffer: 1 << 28 });
if (git("status", "--porcelain", "--", "open-brain/src").trim()) throw new Error("dirty src");

const MUTANTS = [
  { name: "qa-bash-backslash", family: "Bash quoting (backslash quote removal)",
    from: `      if (c === "\\\\") return refuse("backslash");\n      if (c === "$") return refuse("$ (variable, substitution or $'...' string)");`,
    to:   `      if (c === "$") return refuse("$ (variable, substitution or $'...' string)");` },
  { name: "qa-bash-reserved", family: "Bash comments & keywords (reserved word)",
    from: `    if (cmd.bare && RESERVED.has(cmd.text)) return refuse(\`reserved word (\${cmd.text})\`);`,
    to:   `    if (false && cmd.bare && RESERVED.has(cmd.text)) return refuse(\`reserved word (\${cmd.text})\`);` },
  { name: "qa-bash-wrappers", family: "Bash wrappers / code-running commands",
    from: `    if (REFUSED_COMMANDS.has(name)) return refuse(\`wrapper, shell or code-running command (\${name})\`);`,
    to:   `    if (false && REFUSED_COMMANDS.has(name)) return refuse(\`wrapper, shell or code-running command (\${name})\`);` },
  { name: "qa-bash-shell-stdin", family: "shells fed code (only sh -c '<string>')",
    from: `      const ok = args.length === 2 && /^-[a-z]*c$/.test(args[0].text);\n      if (!ok) return refuse(\`\${name} is only parseable as: \${name} -c '<string>'\`);`,
    to:   `      const ok = true;\n      if (!ok) return refuse(\`\${name} is only parseable as: \${name} -c '<string>'\`);` },
  { name: "qa-ps-unknown-param", family: "PowerShell unknown parameter",
    from: `        if (p === "unknown") return refuse(\`unknown parameter \${colon > 0 ? a.text.slice(0, colon) : a.text} for \${canon}\`);`,
    to:   `        if (false) return refuse(\`unknown parameter \${colon > 0 ? a.text.slice(0, colon) : a.text} for \${canon}\`);` },
  { name: "qa-ps-dynamic", family: "PowerShell dynamic code (Invoke-Expression, &, etc.)",
    from: `    if (PS_REFUSED_COMMANDS.has(headLower) || PS_REFUSED_COMMANDS.has(baseLower)) return refuse(\`code-running or unknown command (\${head.text})\`);`,
    to:   `    if (false) return refuse(\`code-running or unknown command (\${head.text})\`);` },
];

const results = [];
const orig = readFileSync(GATE, "utf8");
for (const m of MUTANTS) {
  if (!orig.includes(m.from)) { results.push({ ...m, applied: false, note: "anchor not found" }); console.log(`SKIP ${m.name}: anchor not found`); continue; }
  writeFileSync(GATE, orig.replace(m.from, () => m.to)); // function replacement: no $'/$& specials in m.to
  const r = run();
  let failed = null, total = null;
  try { const j = JSON.parse(r.stdout.slice(r.stdout.indexOf("{"))); failed = j.numFailedTests; total = j.numTotalTests; } catch {}
  git("checkout", "--", "open-brain/src");
  const killed = r.status !== 0 && failed > 0;
  results.push({ name: m.name, family: m.family, applied: true, killed, failedTests: failed, totalTests: total });
  console.log(`${killed ? "KILLED  " : "SURVIVED"} ${m.name} failed=${failed} [${m.family}]`);
  writeFileSync(process.argv[2], JSON.stringify(results, null, 1));
}
console.log(`\n${results.filter((r) => r.killed).length}/${results.filter((r)=>r.applied).length} applied QA mutants killed; survivors: ${results.filter((r) => r.applied && !r.killed).map((r) => r.name).join(", ") || "none"}`);
