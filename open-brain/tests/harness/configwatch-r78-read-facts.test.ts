/**
 * R78. A READ record prints its hash and its facts on both sides.
 * These two rows are QA 104's R73-READ-STABLE-FACTS and R73-READ-CHANGE-FACTS.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { appendFileSync, lstatSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MachineConfigWatch } from "../../src/harness/configwatch.js";
import { requireGit } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const h16 = (b: string) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const facts = (p: string) => {
  const s = lstatSync(p, { bigint: true });
  return { ino: String(s.ino), size: String(s.size) };
};

describe("R78 read records carry facts", () => {
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    tmp = scratch("r78-");
  });
  afterEach(async () => {
    await tmp.cleanup();
  });

  const one = (path: string) => new MachineConfigWatch([{ scope: "global", path, source: "r78" }]);
  const home = (name: string) => {
    const h = join(tmp.dir, name);
    mkdirSync(h);
    return join(h, ".gitconfig");
  };

  it("R73-READ-STABLE-FACTS: an untouched read carries the hash and the facts", () => {
    const cfg = home("rsf");
    const body = "[user]\n\tname = rsf\n";
    writeFileSync(cfg, body);
    const f = facts(cfg);
    const watch = one(cfg);
    watch.captureBase();
    watch.begin("developer");
    const d = watch.compare().find((x) => x.path === cfg)!;
    expect(d.after, "the hash").toContain(h16(body));
    expect(d.changed, "no change").toBe(false);
    expect(d.after, "ino").toContain(f.ino);
    expect(d.after, "type").toMatch(/type file/);
    expect(d.before, "the same facts on the other side").toContain(f.ino);
  });

  it("R73-READ-CHANGE-FACTS: an in-place append carries the facts on both sides", () => {
    const cfg = home("rcf");
    writeFileSync(cfg, "[user]\n\tname = rcf\n");
    const watch = one(cfg);
    watch.captureBase();
    const start = facts(cfg);
    watch.begin("developer");
    appendFileSync(cfg, "[core]\n\tqa = rcf\n");
    const end = facts(cfg);
    const d = watch.compare().find((x) => x.path === cfg)!;
    expect(d.changed, "a change").toBe(true);
    expect(d.before, "stage-start size").toContain(`size ${start.size}`);
    expect(d.after, "current size").toContain(`size ${end.size}`);
  });
});
