import { describe, it, expect } from 'vitest';
import { isUnsafeStatusRead, deriveQuery } from '../../src/trigger/query.js';

/**
 * T-290 — five more shapes of the `$?` mistake the parser missed (T-288's
 * second review, F1 and F5): a backslash continuation after `|`, a `{ ...; }`
 * group closed by `}` with redirections, flags split before an inner shell's
 * `-c`, an inner shell after `(` (`$(bash -c …)`), and ksh.
 */

const UNSAFE: Array<[string, string]> = [
  ['U9', 'npm test 2>&1 | \\\n  tail -5\necho $?'],
  ['U10', '{ npm test | tail -5; } 2>&1; echo $?'],
  ['U11', '{ npm test | tail -5; } > log.txt; echo $?'],
  ['U12', "bash -e -c 'npm test | tail -5; echo $?'"],
  ['U13', "bash --norc -c 'npm test | tail -5; echo $?'"],
  ['U14', "x=$(bash -c 'npm test | tail -5; echo $?')"],
  ['U15', "ksh -c 'npm test | tail -5; echo $?'"],
];

const SAFE: Array<[string, string]> = [
  ['S9', 'npm test | \\\n  wc -l\necho $?'],
  ['S10', '{ npm test; } 2>&1; echo $?'],
  ['S11', "bash -c 'true' -x 'npm test | tail -5; echo $?'"],
  ['S12', 'echo a \\\nb; echo $?'],
];

describe('T-290: the parser reads five more shapes of the $? mistake', () => {
  it.each(UNSAFE)('%s is an unsafe status read and asks "tail" "exit" "code": %j', (_id, cmd) => {
    expect(isUnsafeStatusRead(cmd)).toBe(true);
    expect(deriveQuery(cmd)).toBe('"tail" "exit" "code"');
  });

  it.each(SAFE)('%s is not an unsafe status read and asks nothing: %j', (_id, cmd) => {
    expect(isUnsafeStatusRead(cmd)).toBe(false);
    expect(deriveQuery(cmd)).toBe('');
  });
});
