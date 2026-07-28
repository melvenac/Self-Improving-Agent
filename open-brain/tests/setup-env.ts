// Global test setup: redirect writable state away from the real ~/.claude.
//
// resolvePaths() keys score history and the shadow log off $HOME rather than
// the project root, so a test calling handleSync({project_root: tmp, score:
// true}) still appended to the PRODUCTION score history — silently, on every
// full test run. That corrupts the trend, which Pipeline Health scores against.
//
// Redirecting here rather than per-test means no future test can reintroduce
// the leak by forgetting to opt out.

import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const stateDir = mkdtempSync(join(tmpdir(), "open-brain-test-state-"));

// Filenames are kept identical to production — tests assert on them.
process.env.OPEN_BRAIN_SCORE_HISTORY = join(stateDir, "score-history.jsonl");
process.env.OPEN_BRAIN_SHADOW_LOG = join(stateDir, "shadow-recall.jsonl");
