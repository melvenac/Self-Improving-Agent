#!/usr/bin/env node
// QA 196 mutants for T192-D1 and T-048 r3 server rows.
// Usage: node mutants-qa196.mjs <name> [apply|restore|run|commit <branch>]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.env.QA_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "../../../../cand");
const checksPath = join(root, "open-brain/src/pipelines/sync/checks-state.ts");
const serverPath = join(root, "open-brain/src/server.ts");
const backup = { checks: checksPath + ".qa196bak", server: serverPath + ".qa196bak" };

const MUTANTS = {
  "m-d1-never-started-plain": {
    file: checksPath,
    from: `    if (test.steps.length === 0) {
      return {
        name,
        report: true,
        severity: "warn",
        message: \`\${branch} \${sha} conclusion: never-started — job test recorded 0 steps. LIMIT: read from gh run view jobs[].steps, not the billing annotation; a failure with no steps for another reason is named never-started\`,
      };
    }`,
    to: `    if (test.steps.length === 0) {
      // mutant: empty steps are a plain failure again
    }`,
  },
  "m-d1-absent-only": {
    file: checksPath,
    from: `    if (!test) {
      return { name, report: true, severity: "warn", message: \`\${branch} \${sha} conclusion: failure (steps not read: job test absent in run view)\` };
    }`,
    to: `    if (!test) {
      return { name, report: true, severity: "warn", message: \`\${branch} \${sha} conclusion: failure\` };
    }`,
  },
  "m-d1-steps-missing-only": {
    file: checksPath,
    from: `    if (!Array.isArray(test.steps)) {
      return { name, report: true, severity: "warn", message: \`\${branch} \${sha} conclusion: failure (steps not read: steps field missing)\` };
    }`,
    to: `    if (!Array.isArray(test.steps)) {
      return { name, report: true, severity: "warn", message: \`\${branch} \${sha} conclusion: failure\` };
    }`,
  },
  "m-routes-sync-only": {
    file: serverPath,
    from: `        lines.push(\`  \${cat.name}: \${cat.score}/\${cat.max} (\${pct}%)\${invocationLogSuffix(cat)}\`);`,
    to: `        const logNote = invocationLogSuffix(cat);
        const hidden = logNote === " (invocation log: missing)" || logNote === " (invocation log: unreadable)" ? "" : logNote;
        lines.push(\`  \${cat.name}: \${cat.score}/\${cat.max} (\${pct}%)\${hidden}\`);`,
    count: 1,
  },
};

const [name, cmd = "run", branchArg] = process.argv.slice(2);
if (!name || !MUTANTS[name]) {
  console.error("usage: node mutants-qa196.mjs <name> [apply|restore|run|commit <branch>]");
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
  const need = spec.count ?? 1;
  if (count !== need) {
    console.error(`anchor matched ${count} times, expected ${need} in ${path}`);
    process.exit(1);
  }
  write(path, before.replace(spec.from, spec.to));
}

function backupFile(path, key) {
  if (!existsSync(backup[key])) write(path, read(path));
}

function restoreFile(path, key) {
  if (existsSync(backup[key])) {
    write(path, read(backup[key]));
  }
}

function tsc() {
  const r = spawnSync("npx", ["tsc", "--noEmit", "-p", "."], { cwd: join(root, "open-brain"), encoding: "utf8", shell: true });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    process.exit(r.status ?? 1);
  }
}

function vitest(...files) {
  const r = spawnSync("npm", ["test", "--", ...files], {
    cwd: join(root, "open-brain"),
    encoding: "utf8",
    shell: true,
  });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  return r.status ?? 1;
}

if (cmd === "apply") {
  backupFile(m.file, m.file === checksPath ? "checks" : "server");
  applyOne(m.file, m);
  tsc();
  console.log(`applied ${name}`);
} else if (cmd === "restore") {
  restoreFile(checksPath, "checks");
  restoreFile(serverPath, "server");
  console.log("restored");
} else if (cmd === "run") {
  backupFile(m.file, m.file === checksPath ? "checks" : "server");
  applyOne(m.file, m);
  tsc();
  const code = vitest("tests/pipelines/sync/checks-state.test.ts", "tests/t048-r3.test.ts");
  restoreFile(checksPath, "checks");
  restoreFile(serverPath, "server");
  console.log(`mutant ${name}: vitest exit ${code}`);
  process.exit(code === 0 ? 1 : 0);
} else if (cmd === "commit") {
  const branch = branchArg;
  if (!branch) {
    console.error("commit requires branch name");
    process.exit(2);
  }
  backupFile(m.file, m.file === checksPath ? "checks" : "server");
  applyOne(m.file, m);
  tsc();
  const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8", shell: false });
  git("checkout", "-B", branch);
  git("add", m.file.replace(root + "/", "").replace(root + "\\", ""));
  const msg = `qa(t192-d1): mutant ${name} for record 193 scoring`;
  const c = git("commit", "-m", msg);
  if (c.status !== 0) {
    console.error(c.stdout, c.stderr);
    process.exit(c.status ?? 1);
  }
  restoreFile(checksPath, "checks");
  restoreFile(serverPath, "server");
  console.log(`committed ${branch}: ${git("rev-parse", "HEAD").stdout.trim()}`);
} else {
  console.error(`unknown cmd ${cmd}`);
  process.exit(2);
}
