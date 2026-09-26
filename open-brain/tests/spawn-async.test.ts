import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { spawnAsync } from './spawn-async.js';

/**
 * The helper replaces spawnSync in the harness (G-042), so every channel a test asserts on is checked here to carry
 * a value, against spawnSync's own answer for the same child. A channel that came back '' regardless would make every
 * `toBe('')` on it pass without looking.
 */
const SCRIPT = [
  "let s = '';",
  "process.stdin.on('data', (c) => { s += c; });",
  "process.stdin.on('end', () => { process.stdout.write('out:' + s); process.stderr.write('err:' + s.length); process.exit(3); });",
].join(' ');

describe('spawnAsync', () => {
  it('carries stdout, stderr, the exit status and stdin exactly as spawnSync does', async () => {
    const sync = spawnSync(process.execPath, ['-e', SCRIPT], { input: 'héllo', encoding: 'utf-8' });
    const got = await spawnAsync(process.execPath, ['-e', SCRIPT], { input: 'héllo' });

    expect(got.stdout).toBe('out:héllo');
    expect(got.stderr).toBe('err:5');
    expect(got.status).toBe(3);
    expect({ stdout: got.stdout, stderr: got.stderr, status: got.status })
      .toEqual({ stdout: sync.stdout, stderr: sync.stderr, status: sync.status });
  });

  it('closes stdin when no input is given, so a child reading it still ends', async () => {
    const got = await spawnAsync(process.execPath, ['-e', SCRIPT]);
    expect(got).toMatchObject({ stdout: 'out:', stderr: 'err:0', status: 3 });
  });

  it('a command that cannot start settles with an error and a null status, and does not hang', async () => {
    const got = await spawnAsync('no-such-command-g042-xyz', []);
    expect(got.status).toBeNull();
    expect(got.error).toBeDefined();
  });

  it('returns to the event loop while the child runs', async () => {
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 20);
    await spawnAsync(process.execPath, ['-e', 'setTimeout(() => {}, 400)']);
    clearInterval(timer);
    expect(ticks).toBeGreaterThan(3);
  });
});
