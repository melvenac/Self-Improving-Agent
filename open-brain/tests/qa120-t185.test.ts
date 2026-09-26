import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, realpathSync, rmSync } from "node:fs";
import { join, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * QA 120 (T-185): rows beyond the developer's. Harness copied from tests/cli-flags.test.ts at 9473b0d.
 * Every spawn has its cwd inside a scratch dir under the OS temp dir, and every positional is relative
 * to it or a file inside it. Copy into open-brain/tests/ of a scratch clone or a qa/t185-* branch.
 *
 * EXPECTED at 9473b0d: every row passes EXCEPT "state migrate <em dash>dry-run", which fails because
 * the file IS migrated (D1 in docs/loops/t185-qa-report.md).
 */

const cliEntry = join(import.meta.dirname, "../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../node_modules/tsx/dist/cli.mjs");
const TMP = realpathSync(tmpdir());
interface Run { status: number | null; stdout: string; stderr: string }
function inScratch(dir: string): void {
  const real = realpathSync(dir);
  if (!real.startsWith(TMP + sep)) throw new Error(`refusing to run the CLI outside the temp dir: ${real}`);
}
function cli(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]): Run {
  inScratch(cwd);
  const r = spawnSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, encoding: "utf8", env, timeout: 90_000 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

let root: string;
beforeEach(() => { root = mkdtempSync(join(TMP, "qa120-t185-")); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

function v1File(): string {
  const f = join(root, "state.json");
  writeFileSync(f, JSON.stringify({
    schema_version: 1, revision: 52, project: { name: "fixture" },
    objective: { text: "do the thing", since_session: 1 }, tasks: [], verified: [], gaps: [], decisions: [],
    handoff: { pick_up: "p", watch_out: [], open_questions: [], session: 70 },
    last_session: { n: 70, date: "2026-09-20", uuid: "abc" },
  }, null, 2) + "\n");
  return f;
}

describe("QA 120: the refusal happens before the database is opened", () => {
  // A DB path of this test's own, so "not created" is a fact about this spawn alone.
  it.each([
    [["relocate", "--from", "a", "--to", "b", "--aply"]],
    [["relocate", "--aply"]],
    [["topics", "--aply"]],
  ])("%j refuses and the DB file is never created", (argv) => {
    const db = join(root, "knowledge-v2.db");
    const r = cli(root, { ...process.env, KNOWLEDGE_V2_DB: db }, ...argv);
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(existsSync(db)).toBe(false);
  }, 120_000);
});

describe("QA 120: typos the developer did not try", () => {
  it.each([["--dry_run"], ["-n"], ["-"], ["--dry-run=1"]])("state migrate %s refuses and the file is byte-identical", (tok) => {
    const f = v1File();
    const before = readFileSync(f);
    const r = cli(root, process.env, "state", "migrate", "--seat", "developer", tok, "state.json");
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(r.stderr).toContain(`"${tok}"`);
    expect(readFileSync(f).equals(before)).toBe(true);
  }, 120_000);

  it("state migrate with the typo AFTER the positional refuses", () => {
    const f = v1File();
    const before = readFileSync(f);
    const r = cli(root, process.env, "state", "migrate", "--seat", "developer", "state.json", "--dry-rn");
    expect(r.status, r.stdout + r.stderr).toBe(2);
    expect(readFileSync(f).equals(before)).toBe(true);
  }, 120_000);

  it("state migrate —dry-run (an em dash, as autocorrect writes it) leaves the file byte-identical", () => {
    // D1: the em dash is not "-", so the token is a positional; state migrate's positionals are
    // "any", so it is taken as a second FILE, refused as missing, and state.json IS migrated.
    const f = v1File();
    const before = readFileSync(f);
    const r = cli(root, process.env, "state", "migrate", "--seat", "developer", "—dry-run", "state.json");
    expect(readFileSync(f).equals(before), `status ${r.status}\n${r.stdout}\n${r.stderr}`).toBe(true);
  }, 120_000);
});
