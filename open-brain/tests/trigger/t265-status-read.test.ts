import { describe, it, expect } from 'vitest';
import * as query from '../../src/trigger/query.js';

/**
 * T-265 — the status-read element fires only on a real mistake.
 *
 * T-264 measured 1,025 injected fires: 6.4% landed on a `$?` read of a trimmed
 * pipeline, and 85% on commands that already read PIPESTATUS or captured the
 * status from a different statement. Every row here asserts the classifier AND
 * what `deriveQuery` then asks, because a classifier nothing calls is a test of
 * nothing (the trimmer element still decides whether "tail" is in the query).
 *
 * Imported as a namespace so the red commit runs: a missing export is a failing
 * row, not a file that cannot load.
 */

const UNSAFE: Array<[string, string]> = [
  ['npm run build 2>&1 | tail -5; echo $?', '"tail" "exit" "code"'],
  ['npx vitest run | tail -8 && echo $?', '"tail" "exit" "code"'],
  ['cmd | grep x\necho $?', '"tail" "exit" "code"'],
  ["ssh h 'npm test | tail -5; echo rc=$?'", '"tail" "exit" "code"'],
  ['(make | tail -3); echo $?', '"tail" "exit" "code"'],
];

const SAFE: Array<[string, string]> = [
  ['npm test | tail -5; echo "${PIPESTATUS[0]}"', '"tail"'],
  ["ssh h 'npm test | tail -5; echo ${PIPESTATUS[0]}'", '"tail"'],
  ['node b.js; rc=$?; git log | head -3', '"tail"'],
  ['set -o pipefail; npm test | tail -5; echo $?', '"tail"'],
  ['tail -f build.log; echo $?', ''],
  ["echo '$?' | tail -1", '"tail"'],
  ["grep 'a|b' f; echo $?", ''],
  ["cat > f <<'EOF'\nx | tail -1; echo $?\nEOF", '"tail"'],
];

describe('T-265 — a $? read of a pipeline whose last stage is a trimmer', () => {
  it.each(UNSAFE)('unsafe: %j', (command, derived) => {
    expect(query.isUnsafeStatusRead(command)).toBe(true);
    expect(query.deriveQuery(command)).toBe(derived);
  });

  it.each(SAFE)('safe: %j', (command, derived) => {
    expect(query.isUnsafeStatusRead(command)).toBe(false);
    expect(query.deriveQuery(command)).toBe(derived);
  });
});
