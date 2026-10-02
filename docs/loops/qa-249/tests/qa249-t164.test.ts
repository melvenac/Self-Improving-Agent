// QA 249's own tests for T-164 (rows 3 and 4 of docs/loops/qa-249-t164-t211-dispatch.md). Not for merge.
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleStart, handleSetSession } from "../../src/server.js";
import { applyStateOps } from "../../src/shared/state-writer.js";
import { byPidDir, processStartTime, writeProcessSession } from "../../src/shared/process-session.js";

const UUID_A = "aaaaaaaa-0000-4000-8000-000000000249";
const UUID_B = "bbbbbbbb-0000-4000-8000-000000000249";

let ppidStart: string | null | undefined;
function proveOwn(id: string): void {
  if (ppidStart === undefined) ppidStart = processStartTime(process.ppid);
  writeProcessSession(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), {
    session_id: id, claude_pid: process.ppid, proc_start: ppidStart!, ide: "claude", written_at: new Date().toISOString(),
  });
}
const text = (r: { content: { type: string; text: string }[] }): string => r.content[0].text;

const roots: string[] = [];
afterEach(() => {
  rmSync(byPidDir(process.env.OPEN_BRAIN_ACTIVE_SESSION!), { recursive: true, force: true });
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function checkout(name: string, sessionNs: number[], localLogs: number): string {
  const root = mkdtempSync(join(tmpdir(), `qa249-${name}-`));
  roots.push(root);
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.0.0" }));
  mkdirSync(join(root, ".agents", "SESSIONS"), { recursive: true });
  mkdirSync(join(root, ".agents", "TASKS"), { recursive: true });
  mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
  for (let i = 1; i <= localLogs; i++) writeFileSync(join(root, ".agents", "SESSIONS", `Session_${i}.md`), `# Session ${i}\n`);
  const sessions = sessionNs.map((n, i) => ({
    n, date: "2026-10-01", uuid: `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`, seat: "planner", checkout: "sia-planner", first_rev: i + 1,
  }));
  const state = { schema_version: 3, revision: 300, project: { name: "fixture" }, objective: null, tasks: [], verified: [], gaps: [], decisions: [], handoffs: [], sessions };
  writeFileSync(join(root, ".agents", "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  return root;
}

async function greet(root: string, id: string): Promise<string> {
  proveOwn(id);
  await handleSetSession({ session_id: id, project_dir: root });
  return text(await handleStart({ project_root: root }));
}

/** SC-2, QA's own: two checkouts at the same revision; A writes first, B's write is refused naming N+1. */
async function sc2(sessionNs: number[]): Promise<{ n: number; refusal: string | undefined; ok: boolean }> {
  const a = checkout("sc2-a", sessionNs, 3);
  const b = checkout("sc2-b", sessionNs, 9);
  const ga = await greet(a, UUID_A);
  const gb = await greet(b, UUID_B);
  const n = Math.max(...sessionNs) + 1;
  expect(ga).toContain(`Session #${n}\n`);
  expect(gb).toContain(`Session #${n}\n`);
  const first = applyStateOps(a, { expected_revision: 300, session: n, session_uuid: UUID_A, checkout: "a", ops: [{ op: "set_objective", text: "A" }] });
  expect(first.ok, first.error).toBe(true);
  // B pulls A's write (the shared record), then writes with its own greeting number.
  copyFileSync(join(a, ".agents", "state.json"), join(b, ".agents", "state.json"));
  const second = applyStateOps(b, { expected_revision: 301, session: n, session_uuid: UUID_B, checkout: "b", ops: [{ op: "set_objective", text: "B" }] });
  return { n, refusal: second.error, ok: second.ok };
}

describe("QA 249 row 3: SC-2, QA's own test", () => {
  it("contiguous record 1..5: both greet 6; B is refused and the refusal names 7", async () => {
    const r = await sc2([1, 2, 3, 4, 5]);
    expect(r.ok).toBe(false);
    expect(r.refusal).toContain(UUID_A);
    expect(r.refusal).toContain(`next free number is ${r.n + 1}`);
  });

  it("record shaped like the live one (76, 147..155): both greet 156; B is refused and the refusal names 157", async () => {
    const r = await sc2([76, 147, 148, 149, 150, 151, 152, 153, 154, 155]);
    expect(r.ok).toBe(false);
    expect(r.refusal).toContain(UUID_A);
    expect(r.refusal).toContain(`next free number is ${r.n + 1}`);
  });
});

describe("QA 249 row 4: the live case through ob_start", () => {
  it("16 local logs, record last 155: greets 156, creates Session_156.md; a second ob_start reuses it", async () => {
    const root = checkout("live", [153, 154, 155], 16);
    const first = await greet(root, UUID_A);
    expect(first).toContain("Session #156\n");
    expect(first).not.toContain("(local —");
    const logs1 = readdirSync(join(root, ".agents", "SESSIONS")).filter((f) => /^Session_\d+\.md$/.test(f));
    expect(logs1).toContain("Session_156.md");
    expect(logs1).not.toContain("Session_17.md");
    expect(logs1.length).toBe(17);
    expect(readFileSync(join(root, ".agents", "SESSIONS", "Session_156.md"), "utf-8")).toContain(UUID_A);

    const second = text(await handleStart({ project_root: root }));
    expect(second).toContain("Session #156 (existing log for this session id — reused, nothing created)");
    const logs2 = readdirSync(join(root, ".agents", "SESSIONS")).filter((f) => /^Session_\d+\.md$/.test(f));
    expect(logs2.sort()).toEqual(logs1.sort());
    console.log("QA249-LIVE-FIRST:\n" + first.split("\n").filter((l) => /Session #|Log:|Session ID/.test(l)).join("\n"));
    console.log("QA249-LIVE-SECOND:\n" + second.split("\n").filter((l) => /Session #|Log:|Session ID/.test(l)).join("\n"));
  });
});
