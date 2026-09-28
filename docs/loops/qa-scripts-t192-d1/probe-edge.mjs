#!/usr/bin/env node
// Edge-case probes for T192-D1 checkCiStatus. Run from open-brain with built sources.
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ob = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "../../../../cand/open-brain");
const tmp = join(ob, "tests/pipelines/sync/t192-d1-edge.probe.test.ts");
const body = `import { describe, it, expect } from "vitest";
import { checkCiStatus, type CommandRunner } from "../../../src/pipelines/sync/checks-state.js";

describe("T192-D1 edge probes (QA 196)", () => {
  const root = "/tmp";
  const failed = [{ conclusion: "failure", headSha: "deadbeefcafe", status: "completed", databaseId: 1 }];
  function gh(view: unknown): CommandRunner {
    return (_cmd, args) => {
      if (args[1] === "list") return { ok: true, stdout: JSON.stringify(failed) };
      if (args[1] === "view") return { ok: true, stdout: JSON.stringify(view) };
      return { ok: false, error: "unexpected" };
    };
  }

  it("dual test: first empty, second has steps", () => {
    const r = checkCiStatus(root, gh({ jobs: [
      { name: "test", conclusion: "failure", steps: [] },
      { name: "test", conclusion: "failure", steps: [{ name: "s" }] },
    ] }));
    console.log("dual-first-empty:", r.message);
    expect(r.message).toContain("never-started");
  });

  it("dual test: first has steps, second empty", () => {
    const r = checkCiStatus(root, gh({ jobs: [
      { name: "test", conclusion: "failure", steps: [{ name: "s" }] },
      { name: "test", conclusion: "failure", steps: [] },
    ] }));
    console.log("dual-first-steps:", r.message);
    expect(r.message).toBe("master deadbee conclusion: failure");
  });

  it("steps with null entry reports failure without reading entries", () => {
    const r = checkCiStatus(root, gh({ jobs: [{ name: "test", conclusion: "failure", steps: [null] }] }));
    console.log("steps-null-entry:", r.message);
    expect(r.message).toBe("master deadbee conclusion: failure");
  });

  it("steps string is steps field missing", () => {
    const r = checkCiStatus(root, gh({ jobs: [{ name: "test", conclusion: "failure", steps: "oops" }] }));
    console.log("steps-string:", r.message);
    expect(r.message).toContain("steps field missing");
  });
});
`;
writeFileSync(tmp, body);
const r = spawnSync("npm", ["test", "--", "tests/pipelines/sync/t192-d1-edge.probe.test.ts"], {
  cwd: ob,
  encoding: "utf8",
  shell: true,
});
console.log(r.stdout);
if (r.stderr) console.error(r.stderr);
try { unlinkSync(tmp); } catch {}
process.exit(r.status ?? 1);
