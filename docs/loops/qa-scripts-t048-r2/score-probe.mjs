// What the health score PRINTS for each invocation-log state. Usage: node score-probe.mjs <label> <openBrainDir> <root>
import { spawnSync, spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const U = (p) => pathToFileURL(p).href;
const [label, ob, root] = process.argv.slice(2);
const states = {
  missing: () => {},
  corrupt: (p) => writeFileSync(p, "garbage\n{nope\n"),
  unreadable: (p) => { writeFileSync(p, JSON.stringify({ ts: "2026-09-27 01:00:00" }) + "\n"); return spawn("powershell", ["-NoProfile", "-Command", `$f=[IO.File]::Open('${p}','Open','ReadWrite','None'); 'HELD'; Start-Sleep 60; $f.Close()`], { stdio: ["ignore", "pipe", "inherit"] }); },
};
for (const [st, setup] of Object.entries(states)) {
  const dir = join(root, label, "score-" + st); rmSync(dir, { recursive: true, force: true });
  const home = join(dir, "home"), proj = join(dir, "proj");
  mkdirSync(join(home, ".claude", "open-brain"), { recursive: true }); mkdirSync(join(home, "vault"), { recursive: true }); mkdirSync(proj, { recursive: true });
  spawnSync("git", ["init", "-q", proj]); writeFileSync(join(proj, "package.json"), '{"name":"qa","version":"0.0.1"}');
  const env = { ...process.env, HOME: home, USERPROFILE: home, KNOWLEDGE_V2_DB: join(home, ".claude", "open-brain", "knowledge-v2.db"), OPEN_BRAIN_VAULT_DIR: join(home, "vault"), NODE_NO_WARNINGS: "1" };
  // create the db with the tree's own opener
  spawnSync(process.execPath, ["-e", `import(${JSON.stringify(U(join(ob, "build/db-v2.js")))}).then(m=>m.openV2Database(process.env.KNOWLEDGE_V2_DB).close())`], { env });
  const lock = setup(join(home, ".claude", "open-brain", "skill-invocations.jsonl"));
  if (lock) await new Promise((res) => lock.stdout.on("data", (d) => String(d).includes("HELD") && res()));
  console.log(`\n===== [${label}] invocation log ${st} =====`);
  for (const args of [["sync", "--check", "--score", proj], ["sync", "--check", "--score", "--json", proj]]) {
    const r = spawnSync(process.execPath, [join(ob, "build", "cli.js"), ...args], { env, encoding: "utf8", cwd: proj });
    const out = r.stdout.split("\n");
    const i = out.findIndex((l) => l.includes("Health Score") || l.trim().startsWith("{"));
    const tail = args.includes("--json") ? JSON.stringify(JSON.parse(out.slice(i).join("\n")).categories.find((c) => c.name === "Pipeline Health")) : out.slice(i).filter((l) => l.trim()).join("\n    ");
    console.log(`$ open-brain ${args.slice(0, -1).join(" ")} (exit ${r.status})\n    ${tail}`);
  }
  const s = spawnSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(U(join(ob, "build/server.js")))}); const r = await m.handleScore({ project_root: ${JSON.stringify(proj)} }); console.log(r.content[0].text); process.exit(0);`], { env, encoding: "utf8", cwd: proj });
  console.log(`$ ob_score (handleScore):\n    ${s.stdout.split("\n").filter((l) => l.trim()).join("\n    ")}${s.stderr.trim() ? "\n  stderr: " + s.stderr.trim().split("\n")[0] : ""}`);
  if (lock) lock.kill();
}
