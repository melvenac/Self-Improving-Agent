/**
 * QA 174 controls for R95's "not removed" note.
 *
 * The note must describe only the absent-at-open path whose close-time lstat
 * failed. A created file that can be observed is removed, and a changed
 * baseline file is restored; neither may receive that note.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigWatch, resolveGitDirs } from "../../src/harness/configwatch.js";
import { makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const NOTE = "absent at the open; cannot be lstat'd at close";

describe("QA 174 A13 R95 note truth controls", () => {
  let repo: RepoFixture;

  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("q174-note-");
  });
  afterEach(async () => {
    await repo.cleanup();
  });

  const openWatch = (): ConfigWatch => {
    const watch = new ConfigWatch(resolveGitDirs(repo.root), repo.root);
    watch.captureBase();
    watch.begin("developer");
    return watch;
  };

  it("Q174-R95-REMOVED-CONTROL: an observable created hook is removed and never gets the not-removed note", () => {
    const plant = join(repo.root, ".git", "hooks", "post-checkout");
    const watch = openWatch();
    writeFileSync(plant, "#!/bin/sh\necho planted\n");

    const verdict = watch.closeAndRestore();
    const change = verdict.changes.find((c) => c.path === plant);
    const observed = {
      kind: change?.kind ?? null,
      existsAfter: existsSync(plant),
      unrestored: verdict.unrestored,
      noteInMessage: verdict.message.includes(NOTE),
    };
    console.log(`Q174-R95-REMOVED-CONTROL ${JSON.stringify(observed)}`);

    expect(observed).toEqual({
      kind: "created",
      existsAfter: false,
      unrestored: [],
      noteInMessage: false,
    });
  });

  it("Q174-R95-RESTORED-CONTROL: a changed baseline hook is restored and never gets the absent/not-removed note", () => {
    const hook = join(repo.root, ".git", "hooks", "pre-commit");
    const before = "#!/bin/sh\necho baseline\n";
    writeFileSync(hook, before);
    const watch = openWatch();
    writeFileSync(hook, "#!/bin/sh\necho changed\n");

    const verdict = watch.closeAndRestore();
    const change = verdict.changes.find((c) => c.path === hook);
    const observed = {
      kind: change?.kind ?? null,
      bytesRestored: readFileSync(hook, "utf8") === before,
      unrestored: verdict.unrestored,
      noteInMessage: verdict.message.includes(NOTE),
    };
    console.log(`Q174-R95-RESTORED-CONTROL ${JSON.stringify(observed)}`);

    expect(observed).toEqual({
      kind: "modified",
      bytesRestored: true,
      unrestored: [],
      noteInMessage: false,
    });
  });
});
