#!/usr/bin/env node
// Apply one anchored substitution for T-048 r3 mutants.
// Usage: node mutants-qa182.mjs <name> [apply|restore|run|commit <branch>]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.env.QA_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "../../..");
const serverPath = join(root, "open-brain/src/server.ts");
const scoreLinePath = join(root, "open-brain/src/pipelines/sync/score-line.ts");
const backup = { server: serverPath + ".qa182bak", score: scoreLinePath + ".qa182bak" };

const MUTANTS = {
  "m-s4-empty-catch": {
    file: serverPath,
    from: `          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            results.push(\`_(NOT LOGGED: recall log write failed — \${message})_\`);
          }`,
    to: `          } catch { /* non-critical */ }`,
  },
  "m-s9-old-origin": {
    file: serverPath,
    from: `    const originLine = formatRecalledResolution(resolved).join("\\n");`,
    to: `    const originLine =
      \`  Recalled ids: \${recalledIds.length} from \${resolved.origin}\` +
      (resolved.rejected
        ? \`\\n  Ignored \${resolved.rejected.path}: \${resolved.rejected.reason}\`
        : \`\`);`,
  },
  "m-d1-no-suffix": {
    file: serverPath,
    from: `        lines.push(\`  \${cat.name}: \${cat.score}/\${cat.max} (\${pct}%)\${invocationLogSuffix(cat)}\`);`,
    to: `        lines.push(\`  \${cat.name}: \${cat.score}/\${cat.max} (\${pct}%)\`);`,
    all: true,
  },
  "m-preserve-recall-throws": {
    file: serverPath,
    from: `          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            results.push(\`_(NOT LOGGED: recall log write failed — \${message})_\`);
          }`,
    to: `          } catch (err) {
            throw err;
          }`,
  },
  "m-d1-missing-only": {
    file: scoreLinePath,
    from: `  return cat.name === "Pipeline Health" && typeof log === "string" && log !== "ran"
    ? \` (invocation log: \${log})\`
    : "";`,
    to: `  return cat.name === "Pipeline Health" && log === "missing"
    ? \` (invocation log: \${log})\`
    : "";`,
  },
};

const [name, cmd = "run", branchArg] = process.argv.slice(2);
if (!name || !MUTANTS[name]) {
  console.error("usage: node mutants-qa182.mjs <name> [apply|restore|run|commit <branch>]");
  process.exit(2);
}

const m = MUTANTS[name];
const read = (p) => readFileSync(p, "utf8");
const write = (p, s) => writeFileSync(p, s);

function applyOne(path, spec) {
  const before = read(path);
  const count = before.split(spec.from).length - 1;
  if (count === 0) {
    console.error(`anchor not found in ${path}`);
    process.exit(1);
  }
  if (!spec.all && count !== 1) {
    console.error(`anchor matched ${count} times in ${path}`);
    process.exit(1);
  }
  const after = before.replaceAll(spec.from, spec.to);
  if (after === before) {
    console.error("no change");
    process.exit(1);
  }
  write(path, after);
  return { before, after, count };
}

if (cmd === "restore") {
  if (existsSync(backup.server)) write(serverPath, read(backup.server));
  if (existsSync(backup.score)) write(scoreLinePath, read(backup.score));
  console.log("restored");
  process.exit(0);
}

if (cmd === "apply") {
  try { write(backup.server, read(serverPath)); } catch {}
  try { write(backup.score, read(scoreLinePath)); } catch {}
  applyOne(m.file, m);
  if (m.all) {
    const other = m.file === serverPath ? scoreLinePath : serverPath;
    if (read(other).includes(m.from)) applyOne(other, m);
  }
  console.log("applied", name);
  process.exit(0);
}

if (cmd === "commit") {
  if (!branchArg) {
    console.error("commit requires branch name");
    process.exit(2);
  }
  applyOne(m.file, m);
  if (m.all) {
    const other = m.file === serverPath ? scoreLinePath : serverPath;
    if (read(other).includes(m.from)) applyOne(other, m);
  }
  const tsc = spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: root, stdio: "inherit", shell: true });
  if (tsc.status) process.exit(tsc.status);
  spawnSync("git", ["checkout", "-B", branchArg], { cwd: root, stdio: "inherit" });
  spawnSync("git", ["add", "open-brain/src/server.ts", "open-brain/src/pipelines/sync/score-line.ts"], { cwd: root, stdio: "inherit" });
  const msg = `qa(t048-r3): mutant ${name}`;
  const commit = spawnSync("git", ["commit", "-m", msg], { cwd: root, stdio: "inherit" });
  if (commit.status) process.exit(commit.status);
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", shell: true }).stdout.trim();
  write(serverPath, read(backup.server));
  write(scoreLinePath, read(backup.score));
  console.log(JSON.stringify({ name, branch: branchArg, sha }));
  process.exit(0);
}

// run
write(backup.server, read(serverPath));
write(backup.score, read(scoreLinePath));
applyOne(m.file, m);
if (m.all) {
  const other = m.file === serverPath ? scoreLinePath : serverPath;
  if (read(other).includes(m.from)) applyOne(other, m);
}
const build = spawnSync("npm", ["run", "build"], { cwd: join(root, "open-brain"), stdio: "inherit", shell: true });
let killed = false;
let stdout = "";
let stderr = "";
if (!build.status) {
  const test = spawnSync("npx", ["vitest", "run", "tests/t048-r3.test.ts"], {
    cwd: join(root, "open-brain"),
    encoding: "utf8",
    shell: true,
    env: {
      ...process.env,
      HOME: process.env.HOME ?? "C:\\qa-scratch\\qa182\\home",
      USERPROFILE: process.env.USERPROFILE ?? "C:\\qa-scratch\\qa182\\home",
      KNOWLEDGE_V2_DB: process.env.KNOWLEDGE_V2_DB ?? "C:\\qa-scratch\\qa182\\db\\knowledge-v2.db",
      OPEN_BRAIN_VAULT_DIR: process.env.OPEN_BRAIN_VAULT_DIR ?? "C:\\qa-scratch\\qa182\\home\\vault",
      OPEN_BRAIN_ACTIVE_SESSION: process.env.OPEN_BRAIN_ACTIVE_SESSION ?? "C:\\qa-scratch\\qa182\\home\\.claude\\open-brain\\active-session",
    },
  });
  stdout = test.stdout ?? "";
  stderr = test.stderr ?? "";
  killed = test.status !== 0;
}
write(serverPath, read(backup.server));
write(scoreLinePath, read(backup.score));
console.log(JSON.stringify({ name, killed, buildFailed: !!build.status, stdout: stdout.slice(-2500), stderr: stderr.slice(-500) }));
process.exit(killed ? 0 : 1);
