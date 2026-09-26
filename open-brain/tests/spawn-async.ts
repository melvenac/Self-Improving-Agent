import { spawn, type SpawnOptions } from 'node:child_process';

/**
 * spawnSync's result, from an awaited spawn. G-042 (candidate B, Step 1).
 *
 * A test file that spawns synchronously never yields a macrotask while the child
 * runs, and vitest does not yield between the tests of one file, so the file's
 * spawns add up to one stretch the worker cannot answer birpc in. Under load that
 * stretch passed 60 s and the suite exited 1 on `Timeout calling "onTaskUpdate"`
 * with every test green. Awaiting the child instead returns to the event loop for
 * every chunk of output and for its exit.
 *
 * Same shape as spawnSync's (`status` null when the child was killed by a signal,
 * `error` set when it could not be started), so a call site changes by one
 * `await` and nothing it asserts on changes meaning. stdout and stderr are both
 * captured, always: a harness that drops one makes every assertion on it vacuous
 * (hook.test.ts's own header).
 */
export interface SpawnAsyncResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export interface SpawnAsyncOptions extends Omit<SpawnOptions, 'stdio'> {
  /** Written to the child's stdin, which is then closed. Omitted: stdin is closed at once. */
  input?: string;
}

export function spawnAsync(
  command: string,
  args: readonly string[],
  options: SpawnAsyncOptions = {},
): Promise<SpawnAsyncResult> {
  const { input, ...rest } = options;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { ...rest, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ status: null, signal: null, stdout: '', stderr: '', error: error as Error });
      return;
    }
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let startError: Error | undefined;
    child.stdout!.on('data', (c: Buffer) => out.push(c));
    child.stderr!.on('data', (c: Buffer) => err.push(c));
    // A child that never started may not emit 'close', so settle here too. A later 'close' cannot overwrite this:
    // a promise settles once.
    child.on('error', (e) => {
      startError = e;
      if (child.pid === undefined) resolve({ status: null, signal: null, stdout: '', stderr: '', error: e });
    });
    // An EPIPE on stdin (the child exited without reading it) is not the test's result; the exit status is.
    child.stdin!.on('error', () => {});
    child.on('close', (status, signal) => {
      resolve({
        status,
        signal,
        stdout: Buffer.concat(out).toString('utf-8'),
        stderr: Buffer.concat(err).toString('utf-8'),
        ...(startError ? { error: startError } : {}),
      });
    });
    child.stdin!.end(input ?? '');
  });
}

/**
 * execSync's contract, awaited: the command runs through the shell, stdout comes back, and a non-zero exit, a signal
 * or a failure to start THROWS, with the command and its stderr in the message. It throws rather than returning a
 * status on purpose: fixtures built on execSync rely on a broken git failing the test (G-029), and a helper that
 * returned a result would let a caller drop it.
 */
export async function execAsync(
  command: string,
  options: Omit<SpawnAsyncOptions, 'shell'> = {},
): Promise<string> {
  const r = await spawnAsync(command, [], { ...options, shell: true });
  if (r.error || r.status !== 0) {
    const why = r.error ? r.error.message : r.status === null ? `signal ${r.signal}` : `exit ${r.status}`;
    throw new Error(`Command failed (${why}): ${command}\n${r.stderr}`);
  }
  return r.stdout;
}
