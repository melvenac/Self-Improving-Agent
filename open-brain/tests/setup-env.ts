// Global test setup: redirect writable state away from the real ~/.claude.
//
// resolvePaths() keys score history and the shadow log off $HOME rather than
// the project root, so a test calling handleSync({project_root: tmp, score:
// true}) still appended to the PRODUCTION score history — silently, on every
// full test run. That corrupts the trend, which Pipeline Health scores against.
//
// Redirecting here rather than per-test means no future test can reintroduce
// the leak by forgetting to opt out.

import { afterEach } from "vitest";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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
