/**
 * QA PROBE, NOT FOR MERGE. QA record session 149, candidate A12 7200e1c.
 *
 * 1. Check 6 (the re-done R85 search). The handoff's table gives `baseText :1335` "—" for a failed lstat and "absent at
 *    loop base" for an absent path. The code prints "absent at loop base" whenever the loop base's resolvedPath is null
 *    and the path is not a link, and observe() sets resolvedPath null for a realpath that FAILED (errno EACCES) as well
 *    as for an absence. Shape: the loop base cannot be resolved (EACCES), the stage start reads the file (R69's
 *    "appeared"), and the role gives it a second name, so the close is not read and the final
 *    `not read: loop base ${baseText(base)}` branch prints the base. The real chmod shape (POSIX, tcm) and the same with
 *    realpath made to fail by a wrapper (every platform).
 * 2. R90's record text, pinned on every platform with lstat made to fail by a wrapper (text only: this row does not
 *    assert the restore claim or the git calls, which qa149-a12-probe/-mock do, so it is green on A12 and can kill a
 *    text mutant on win32).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

const fsm = vi.hoisted(() => ({ realpathOn: false, lstatOn: false, suffix: "", hits: 0 }));
vi.mock("node:fs", async (importOriginal) => {
  const m = await importOriginal<typeof import("node:fs")>();
  const eacces = (p: unknown, syscall: string) => {
    fsm.hits += 1;
    const e = new Error(`EACCES: permission denied, ${syscall} '${String(p)}'`) as NodeJS.ErrnoException;
    e.code = "EACCES";
    e.errno = -13;
    e.syscall = syscall;
    return e;
  };
  const hit = (p: unknown) => String(p).replace(/\\/g, "/").toLowerCase().endsWith(fsm.suffix) && fsm.suffix !== "";
  const native = ((p: unknown, ...rest: unknown[]) => {
    if (fsm.realpathOn && hit(p)) throw eacces(p, "realpath");
    return (m.realpathSync.native as (...x: unknown[]) => unknown)(p, ...rest);
  }) as typeof m.realpathSync.native;
  const realpathSync = Object.assign(((p: unknown, ...rest: unknown[]) => {
    if (fsm.realpathOn && hit(p)) throw eacces(p, "realpath");
    return (m.realpathSync as (...x: unknown[]) => unknown)(p, ...rest);
  }) as typeof m.realpathSync, { native });
  const lstatSync = ((p: unknown, ...rest: unknown[]) => {
    if (fsm.lstatOn && hit(p)) throw eacces(p, "lstat");
    return (m.lstatSync as (...x: unknown[]) => unknown)(p, ...rest);
  }) as typeof m.lstatSync;
  return { ...m, default: { ...m, realpathSync, lstatSync }, realpathSync, lstatSync };
});

import { chmodSync, linkSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const say = (tag: string, o: unknown) =>
  console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);

describe("QA 149 probe 2 (not for merge): A12 baseText for a loop base whose realpath failed", () => {
  let tmp: { dir: string; cleanup: () => Promise<void> };
  const undo: string[] = [];
  beforeEach(() => { tmp = scratch("q149b-"); undo.length = 0; fsm.realpathOn = false; fsm.lstatOn = false; fsm.suffix = ""; fsm.hits = 0; });
  afterEach(async () => {
    fsm.realpathOn = false;
    for (const p of undo) { try { chmodSync(p, 0o755); } catch { /* gone */ } }
    await tmp.cleanup();
  });

  const shape = (name: string) => {
    const xdg = join(tmp.dir, `${name}-xdg`);
    const git = join(xdg, "git");
    mkdirSync(git, { recursive: true });
    const cfg = join(git, "config");
    writeFileSync(cfg, "[user]\n\tname = q149\n");
    return { git, cfg, watch: new MachineConfigWatch([{ scope: "xdg", path: cfg, source: "q149" }]) };
  };
  const assertRow = (tag: string, row: ReturnType<MachineConfigWatch["compare"]>[number] | undefined, notes: string[], extra: object) => {
    say(tag, { row, notes, ...extra });
    expect(notes.join("\n"), "the base note names the failure").toContain("EACCES");
    expect(row?.changed).toBe(true);
    expect(row?.after ?? "", "R79/R85: a loop base whose realpath failed with EACCES was not absent").not.toContain("absent at loop base");
  };

  it.skipIf(isWin)("Q149-S6-BASE-EACCES: the XDG git dir is 000 at the loop base, 755 at the stage start; the role adds a second name", () => {
    const s = shape("real");
    chmodSync(s.git, 0o000);
    undo.push(s.git);
    let notes: string[] = [];
    try { notes = s.watch.baseNotes(); } finally { chmodSync(s.git, 0o755); }
    s.watch.begin("developer");
    linkSync(s.cfg, join(s.git, "config.second"));
    const row = s.watch.compare().find((f) => f.path === s.cfg);
    assertRow("Q149-S6-BASE-EACCES", row, notes, {});
  });

  it("Q149-S6-BASE-EACCES-MOCK: the same, with realpath of the path made to fail EACCES at the loop base only", () => {
    const s = shape("mock");
    fsm.suffix = "-xdg/git/config";
    fsm.realpathOn = true;
    let notes: string[] = [];
    try { notes = s.watch.baseNotes(); } finally { fsm.realpathOn = false; }
    s.watch.begin("developer");
    linkSync(s.cfg, join(s.git, "config.second"));
    const row = s.watch.compare().find((f) => f.path === s.cfg);
    assertRow("Q149-S6-BASE-EACCES-MOCK", row, notes, { realpathHits: fsm.hits });
  });
});

describe("QA 149 probe 2 (not for merge): A12 R90's record text, every platform", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("q149t-"); fsm.lstatOn = false; fsm.suffix = ""; fsm.hits = 0; });
  afterEach(async () => { fsm.lstatOn = false; await repo.cleanup(); });

  it("Q149-MOCK-R90-TEXT: a hook absent at the open whose lstat fails at close: `absent → unobservable (EACCES)`, the R90 side, never created", async () => {
    const hooks = join(repo.root, ".git", "hooks");
    for (const n of readdirSync(hooks)) rmSync(join(hooks, n), { recursive: true, force: true });
    const plant = join(hooks, "post-checkout");
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          writeFileSync(plant, "#!/bin/sh\necho planted\n");
          fsm.suffix = "/.git/hooks/post-checkout";
          fsm.lstatOn = true;
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let r;
    try { r = await runLoop(loop); } finally { fsm.lstatOn = false; }
    const dev = r.configVerdicts.find((v) => v.stage === "developer");
    const change = dev?.changes.find((c) => c.path === plant) ?? null;
    say("Q149-MOCK-R90-TEXT", { change, message: dev?.message ?? null, lstatHits: fsm.hits });
    expect(change?.kind, "R90: never created").not.toBe("created");
    expect(change?.before).toBe("absent");
    expect(change?.after, "R90: the code and the no-facts side").toBe("unobservable (EACCES); unreadable (EACCES); no facts: lstat failed");
    expect(dev?.message ?? "", "the message names the record").toContain("<common>/hooks/post-checkout (absent → unobservable (EACCES); unreadable (EACCES); no facts: lstat failed)");
  });
});
