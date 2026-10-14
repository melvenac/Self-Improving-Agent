import { describe, it, expect } from 'vitest';
import { isUnsafeStatusRead, deriveQuery } from '../../src/trigger/query.js';

/**
 * T-288 — three shapes of the `$?` mistake the parser missed (T-286's second
 * review, F2): a trailing `|` that continues onto the next line, a `{ ...; }`
 * group whose status is its last command's, and an inner shell's `-c` script.
 * Since T-286 the trigger asks only when `isUnsafeStatusRead` holds, so each
 * missed shape asked nothing.
 */

const UNSAFE: Array<[string, string]> = [
  ['U1', 'npm test 2>&1 |\n  tail -5\necho $?'],
  ['U2', 'npm test |\ntail -5; echo $?'],
  ['U3', '{ npm test | tail -5; }; echo $?'],
  ['U4', '{ npm test | tail -5; } && echo "rc=$?"'],
  ['U5', "bash -c 'npm test | tail -5; echo $?'"],
  ['U6', "bash -lc 'npm test | tail -5; echo $?'"],
  ['U7', "wsl bash -c 'npm test | tail -5; echo $?'"],
  ['U8', "docker exec app sh -c 'npm test | tail -5; echo $?'"],
];

const SAFE: Array<[string, string]> = [
  ['S1', 'npm test |\ntail -5'],
  ['S2', '{ npm test; }; echo $?'],
  ['S3', "bash -c 'npm test; echo $?'"],
  ['S4', "echo 'npm test | tail -5; echo $?'"],
  ['S5', "bash -c 'set -o pipefail; npm test | tail -5; echo $?'"],
  ['S6', "grep -c 'x | tail; echo $?' f.txt"],
  ['S7', "printf '%s\\n' a |\n  wc -l"],
  ['S8', "bash -c 'true' 'npm test | tail -5; echo $?'"],
];

describe('T-288: the parser reads three more shapes of the $? mistake', () => {
  it.each(UNSAFE)('%s is an unsafe status read and asks "tail" "exit" "code": %j', (_id, cmd) => {
    expect(isUnsafeStatusRead(cmd)).toBe(true);
    expect(deriveQuery(cmd)).toBe('"tail" "exit" "code"');
  });

  it.each(SAFE)('%s is not an unsafe status read and asks nothing: %j', (_id, cmd) => {
    expect(isUnsafeStatusRead(cmd)).toBe(false);
    expect(deriveQuery(cmd)).toBe('');
  });
});
