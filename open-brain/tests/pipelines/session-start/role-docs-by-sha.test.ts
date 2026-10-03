import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleStart } from "../../../src/server.js";
import { composeGreeting } from "../../../src/pipelines/sync/checks.js";
import { blobSha, ROLE_READS_REL } from "../../../src/pipelines/session-start/role-files.js";

/**
 * T-236 slice 1 (closes T-183). With `role_docs_by_sha` on in .agents/SYSTEM/greeting.json, ob_start
 * prints a role doc in FULL only when its content sha differs from the one THIS seat last read in THIS
 * checkout, else one line. Fail toward reading: first read, unknown seat, unreadable record = FULL.
 * Off (absent file or key), the role section is exactly the pre-T-236 render.
 */
const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
const SIA_STATE = join(FIXTURES, "state.json");
const A2A_STATE = join(FIXTURES, "a2a-state-1c200b41.json");
const SHARED = "# Shared rules\nSHARED-BODY-MARKER\n";
const DEV = "# Developer seat\nDEV-BODY-MARKER\n";
/** Literal, not the export: the flag-OFF rows must also run against the pre-T-236 product. */
const STORE = ".agents/role-reads.local.json";

let root: string;

function project(opts: { flag?: boolean | "absent"; seat?: string | null; state?: string } = {}): void {
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
  for (const d of ["SYSTEM", "TASKS", "SESSIONS", "roles"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
  writeFileSync(join(root, ".agents", "roles", "shared.md"), SHARED);
  writeFileSync(join(root, ".agents", "roles", "developer.md"), DEV);
  if (opts.state) cpSync(opts.state, join(root, ".agents", "state.json"));
  const flag = opts.flag ?? true;
  if (flag !== "absent") writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify({ role_docs_by_sha: flag }));
  const seat = opts.seat === undefined ? "Infra" : opts.seat;
  if (seat !== null) setSeat(seat);
}

function setSeat(name: string): void {
  writeFileSync(join(root, ".agents", "AGENT.local.md"), `---\nname: ${name}\nrole: developer\npartner: Atlas\n---\n`);
}

async function start(): Promise<string> {
  return (await handleStart({ project_root: root })).content[0].text;
}

/** The role-doc section exactly as the pre-T-236 loop rendered it (no git here, so no commit suffix). */
function oldRoleSection(files: Array<[string, string]>): string {
  return files.map(([rel, body]) => `\n## ${rel}\n${body.replace(/\s+$/, "")}`).join("\n");
}

/** From the first role doc to the line before the total, which is where the role docs render. */
function roleSection(text: string): string {
  const from = text.indexOf("\n\n## .agents/roles/");
  const to = text.lastIndexOf("\n\nTotal returned words:");
  return text.slice(from + 1, to);
}

const sha12 = (s: string) => blobSha(s).slice(0, 12);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "t236-roles-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("T-236 slice 1: role docs by changed sha", () => {
  it("first read prints both docs in FULL and records this seat's read of each", async () => {
    project();
    const text = await start();
    expect(text).toContain("SHARED-BODY-MARKER");
    expect(text).toContain("DEV-BODY-MARKER");
    const store = JSON.parse(readFileSync(join(root, STORE), "utf8"));
    expect(ROLE_READS_REL).toBe(STORE);
    expect(Object.keys(store.seats)).toEqual(["Infra/developer"]);
    expect(store.seats["Infra/developer"][".agents/roles/shared.md"].sha).toBe(blobSha(SHARED));
    expect(store.seats["Infra/developer"][".agents/roles/developer.md"].sha).toBe(blobSha(DEV));
  });

  it("unchanged since this seat's last read prints ONE line per doc and no body", async () => {
    project();
    await start();
    const text = await start();
    expect(text).not.toContain("SHARED-BODY-MARKER");
    expect(text).not.toContain("DEV-BODY-MARKER");
    expect(text).toMatch(new RegExp(`\\n\\.agents/roles/shared\\.md @ ${sha12(SHARED)} \\(unchanged since your last read: \\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}Z\\)`));
    expect(text).toContain(`.agents/roles/developer.md @ ${sha12(DEV)} (unchanged since your last read: `);
  });

  it("a changed doc prints in FULL; the unchanged one stays one line; the new sha is recorded", async () => {
    project();
    await start();
    const dev2 = "# Developer seat\nDEV-BODY-MARKER-V2\n";
    writeFileSync(join(root, ".agents", "roles", "developer.md"), dev2);
    const text = await start();
    expect(text).toContain("DEV-BODY-MARKER-V2");
    expect(text).not.toContain("SHARED-BODY-MARKER");
    const store = JSON.parse(readFileSync(join(root, STORE), "utf8"));
    expect(store.seats["Infra/developer"][".agents/roles/developer.md"].sha).toBe(blobSha(dev2));
    expect(await start()).not.toContain("DEV-BODY-MARKER-V2");
  });

  it("another seat in the same checkout has its own last read: it gets FULL", async () => {
    project();
    await start();
    setSeat("Builder");
    const text = await start();
    expect(text).toContain("SHARED-BODY-MARKER");
    expect(text).toContain("DEV-BODY-MARKER");
  });

  it("an unknown seat prints FULL every time, says why, and records nothing", async () => {
    project({ seat: null });
    for (let i = 0; i < 2; i++) {
      const text = await start();
      expect(text).toContain("SHARED-BODY-MARKER");
      expect(text).toContain("(Role docs in full: no seat resolved, so there is no last read to compare with.)");
    }
    expect(existsSync(join(root, STORE))).toBe(false);
  });

  it("an unreadable record prints FULL, says why, and is replaced so the next read is one line", async () => {
    project();
    writeFileSync(join(root, STORE), "{ not json");
    const text = await start();
    expect(text).toContain("SHARED-BODY-MARKER");
    expect(text).toMatch(/\(Role docs in full: \.agents\/role-reads\.local\.json unreadable \(/);
    expect(await start()).not.toContain("SHARED-BODY-MARKER");
  });

  it("measuring the greeting (composeGreeting, /sync greeting-size) never records a read", async () => {
    project();
    composeGreeting(root, "1.0.0");
    expect(existsSync(join(root, STORE))).toBe(false);
    expect(await start()).toContain("SHARED-BODY-MARKER");
  });

  describe("flag OFF: the role section is byte-identical to the pre-T-236 render, on both fixtures", () => {
    it.each([
      ["SIA", SIA_STATE, "absent" as const],
      ["SIA", SIA_STATE, false],
      ["A2A @ 1c200b41", A2A_STATE, "absent" as const],
      ["A2A @ 1c200b41", A2A_STATE, false],
    ])("%s state, greeting.json %s", async (_name, state, flag) => {
      project({ flag, state });
      const expected = oldRoleSection([[".agents/roles/developer.md", DEV], [".agents/roles/shared.md", SHARED]]);
      const first = await start();
      expect(roleSection(first)).toBe(expected);
      const second = await start();
      expect(roleSection(second)).toBe(expected);
      expect(existsSync(join(root, STORE))).toBe(false);
    });
  });
});
