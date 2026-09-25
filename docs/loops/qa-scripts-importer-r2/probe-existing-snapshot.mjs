#!/usr/bin/env node
// QA 106: does a plain --commit, refused because today's snapshot already exists, delete that snapshot?
// The snapshot's `catch` in runCommit (aba35de index.ts:793-798) removes snapshotDir on ANY takeSnapshot error,
// including takeSnapshot's own "already exists" refusal. Usage: node probe-existing-snapshot.mjs <worktree> <scratch>
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
const [wt, scratch] = process.argv.slice(2).map((p) => resolve(p));
const CLI = join(wt, "open-brain/build/cli.js");
rmSync(scratch, { recursive: true, force: true });
const cli = (cwd, ...a) => { const r = spawnSync(process.execPath, [CLI, "state", "import", ...a], { cwd, encoding: "utf8" }); return { status: r.status, text: (r.stderr || r.stdout).trim().split(/\r?\n/)[0] }; };
const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
for (const variant of ["plain --commit", "--commit --accept-stale (stale project)"]) {
  const root = join(scratch, variant.replace(/[^a-z]+/gi, "_"));
  mkdirSync(join(root, ".agents/TASKS"), { recursive: true }); mkdirSync(join(root, ".agents/SESSIONS"), { recursive: true }); mkdirSync(join(root, ".agents/SYSTEM"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "qa106-snap", version: "0.0.1" }));
  const n = variant.includes("stale") ? 6 : 7;
  writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), "# Session 7 — 2026-09-20\n");
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), `# Next\n\n> Updated at end of Session ${n}.\n\n## Pick up here\n\nGo.\n`);
  writeFileSync(join(root, ".agents/TASKS/INBOX.md"), `# Inbox\n\n> Session ${n}\n\n## P0\n\n- [ ] **T** — x\n`);
  writeFileSync(join(root, ".agents/TASKS/task.md"), `# Focus\n\n> Session ${n}\n\n## Current Objective\n\nShip.\n`);
  // An earlier snapshot from today: e.g. the one a failed rollback KEPT, the only copy of the pre-import tree.
  const snap = join(root, ".agents/archive", `pre-state-migration-${today}`);
  mkdirSync(join(snap, "SESSIONS"), { recursive: true });
  writeFileSync(join(snap, "SESSIONS/Session_6.md"), "# Session 6 — the only copy\n");
  const d = cli(root, "--draft", root);
  const args = variant.includes("stale") ? ["--commit", "--accept-stale", root] : ["--commit", root];
  const c = cli(root, ...args);
  console.log(`${variant}: draft exit ${d.status}; ${args.slice(0, -1).join(" ")} exit ${c.status}: ${c.text}`);
  console.log(`   the earlier snapshot ${existsSync(snap) ? "STILL EXISTS" : "IS GONE"}; its Session_6.md ${existsSync(join(snap, "SESSIONS/Session_6.md")) ? "survives" : "IS DELETED"}; archive/ now: ${existsSync(join(root, ".agents/archive")) ? readdirSync(join(root, ".agents/archive")).join(", ") || "(empty)" : "(no archive/)"}`);
}
