// Global test setup: redirect writable state away from the real ~/.claude.
//
// resolvePaths() keys score history and the shadow log off $HOME rather than
// the project root, so a test calling handleSync({project_root: tmp, score:
// true}) still appended to the PRODUCTION score history — silently, on every
// full test run. That corrupts the trend, which Pipeline Health scores against.
//
// Redirecting here rather than per-test means no future test can reintroduce
// the leak by forgetting to opt out.

import { afterEach, beforeEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { bindSymlinkTest } from "./harness/symlink-or-skip.js";
import { scrubHostEnv } from "./harness/host-env.js";

// T-257: a run inside Claude Code or Cursor inherits the host session's CLAUDE_* / CURSOR_* variables, and every hook
// a test spawns inherits them in turn (end-fix-r3-pins R7 resolved the host's session id and went red). CI has
// none of them, so dropping them here makes a local run match CI. A test that needs one sets it explicitly.
scrubHostEnv(process.env);

beforeEach((ctx) => {
  bindSymlinkTest(ctx);
});

const stateDir = mkdtempSync(join(tmpdir(), "open-brain-test-state-"));

// Filenames are kept identical to production — tests assert on them.
process.env.OPEN_BRAIN_SCORE_HISTORY = join(stateDir, "score-history.jsonl");
process.env.OPEN_BRAIN_SHADOW_LOG = join(stateDir, "shadow-recall.jsonl");
process.env.OPEN_BRAIN_ACTIVE_SESSION = join(stateDir, "active-session.json");

// The v2 DB was the one piece of state still left pointing at $HOME, which made
// the suite environment-dependent in both directions: on a machine with a real
// ~/.claude/open-brain/ the score tests read production stats (Knowledge Quality
// could push the total past 100), and on one without it — a CI runner, a fresh
// clone — better-sqlite3 threw "Cannot open database because the directory does
// not exist" and four tests in server.test.ts failed. server.ts reads this at
// import time, so it must be set here rather than inside a test.
process.env.KNOWLEDGE_V2_DB = join(stateDir, "knowledge-v2.db");

// T-331 (Aaron 11-01, the withheld arm ON at 0.5): the shipped recall-trigger.json withholds about half of all
// would-be injections, drawn by a hash of the session uuid and the ids. A spawned hook reads TRIGGER_POLICY_DIR before
// the shipped file, so every hook a test spawns gets the shipped policy with the arm OFF, and a test of injection
// mechanics does not pass or fail on its fixed session's draw (the SIM found 11 such rows, docs/loops/t331on-sim.md).
// In-process loadPolicy() ignores the variable, so t331-withheld-arm W3 still reads the shipped 0.5, and a test that
// passes its own TRIGGER_POLICY_DIR still wins. The arm itself is pinned by tests/trigger/t331-withheld-arm.test.ts.
const armOffPolicyDir = join(stateDir, "trigger-policy-arm-off");
mkdirSync(armOffPolicyDir);
const shippedPolicy = JSON.parse(
  readFileSync(new URL("../src/trigger/policies/recall-trigger.json", import.meta.url), "utf-8"),
) as Record<string, unknown>;
writeFileSync(
  join(armOffPolicyDir, "recall-trigger.json"),
  JSON.stringify({ ...shippedPolicy, withhold_fraction: 0 }),
  "utf-8",
);
process.env.TRIGGER_POLICY_DIR = armOffPolicyDir;

// The vault was the last unredirected write target. Every session-end run writes
// a summary named after its project, so the server tests — which use temp
// projects like `ob-server-rhgw2s` — had been depositing summaries straight into
// the real Obsidian vault since April; 57 had accumulated, and they were pushed
// to the backup remote before anyone spotted them. Individual tests can still
// point OPEN_BRAIN_VAULT_DIR at their own fixture, but the default is isolated,
// so forgetting to override leaks into tmp rather than into the user's notes.
const testVaultDir = join(stateDir, "vault");
process.env.OPEN_BRAIN_VAULT_DIR = testVaultDir;

// …but setting it once was not enough, and 13 more summaries reached the real
// vault on 2026-08-31 with the isolation above already in place. Three suites
// (index-v2, skill-scan-runner, apoptosis-reachability) point the vault at their
// own fixture in `beforeEach` and then `delete` the variable in `afterEach`.
// `delete` does not restore this default — it removes it, so from the first such
// teardown onward every later test in that worker resolved to the user's actual
// vault. Which files leaked depended on suite ordering, which is why the count
// varied between runs rather than looking like a constant bug.
//
// Re-asserting after every test means no teardown can leave the process
// unprotected, whatever it does to the variable. obsidianVaultDir() refuses the
// real vault under test as the backstop, so a regression here fails loudly
// instead of writing into the user's notes.
afterEach(() => {
  if (process.env.OPEN_BRAIN_VAULT_DIR === undefined) {
    process.env.OPEN_BRAIN_VAULT_DIR = testVaultDir;
  }
});
