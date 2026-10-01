/**
 * T-194 r7: every case QA 241 ran against r6 is a row. docs/loops/t194-r7/qa241-rows.json is produced by
 * docs/loops/t194-r7/extract-qa241-rows.mjs from QA 241's own probe-r6.mjs and gen-p0.mjs (so they are QA's cases), plus the five
 * redirect probes of probe-ps-redirect.mjs, which are written out below because that script drives a real shell.
 *
 * gen-p0 is QA's generator of what P0 must REFUSE (339 cases, each with the construct it must name) and what must PARSE (170 cases).
 * r7 narrows the accepted grammar (an allow-list of Bash command words, printable ASCII in PowerShell), so an "accepted" case that r7
 * now refuses for one of THOSE reasons is "superseded by r7" and is counted and listed, not hidden.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFixture, type Fixture } from "./r5-fixture.js";
import { GATE_PREFIX } from "./r6-cases.js";

interface Row {
  source: "probe-r6" | "gen-p0";
  id: string;
  tool: "Bash" | "PowerShell";
  command: string;
  cwd: string;
  expect: string | null;
  kind: "refused" | "accepted" | null;
  construct: string | null;
}

const ROWS: Row[] = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../docs/loops/t194-r7/qa241-rows.json"), "utf8"));
const R7_NARROWING = /command not allowed|non-ASCII character|git\/gh config through the environment|environment variable that changes|a path, not a bare command|node is allowed only as|curl option|rg option|ssh option|scp option/;

let fx: Fixture;
beforeAll(() => {
  fx = makeFixture("r7qa", false);
});
afterAll(() => fx.dispose());
beforeEach(() => fx.resetGrant());

function relocate(text: string): string {
  return text.replace(/[A-Za-z]:[\\/]qa-scratch[\\/]qa241-[A-Za-z0-9-]+/g, (m) => (m.includes("\\") ? fx.repo : fx.fwd));
}

async function run(row: Row): Promise<{ decision: string; reason: string; fetches: number }> {
  const cwd = row.cwd ? fx.sub(row.cwd) : fx.fwd;
  const r = await fx.merge(row.tool, relocate(row.command), cwd);
  return { decision: r.decision, reason: r.reason ?? "", fetches: fx.calls.length };
}

const isP0 = (o: { decision: string; reason: string }): boolean => o.decision === "deny" && o.reason.includes(GATE_PREFIX);

describe("QA 241: probe-r6.mjs (the targeted probes)", () => {
  it("every row is decided as the property requires", async () => {
    const rows = ROWS.filter((r) => r.source === "probe-r6");
    const wrong: string[] = [];
    let superseded = 0;
    for (const row of rows) {
      const o = await run(row);
      const p0 = isP0(o);
      let ok: boolean;
      switch (row.expect) {
        case "grant":
          // QA 241 drove the CLI with no GitHub token, so a quoted-ref merge was refused for want of a read. A fake GitHub answers here,
          // so the same exact-grammar merge is allowed after a READ: the control working, not a hole.
          ok = o.decision === "deny" || (o.decision === "allow" && o.fetches > 0 && /gh pr merge/.test(row.command));
          break;
        case "deny":
        case "deny-or-limit":
          ok = o.decision === "deny";
          break;
        case "allow":
          ok = o.decision === "allow" || (p0 && R7_NARROWING.test(o.reason));
          if (o.decision !== "allow" && ok) superseded++;
          break;
        case "p0":
          ok = p0;
          break;
        default:
          ok = true; // allow-or-deny
      }
      if (!ok) wrong.push(`${row.id} :: ${JSON.stringify(row.command).slice(0, 110)} expected ${row.expect}, got ${o.decision} ${o.reason.slice(0, 100)}`);
    }
    // eslint-disable-next-line no-console
    console.log(`QA241 probe-r6: ${rows.length} rows, ${superseded} allow-rows superseded by r7`);
    expect(wrong, `${wrong.length} of ${rows.length}:\n${wrong.join("\n")}`).toEqual([]);
  }, 120_000);
});

describe("QA 241: gen-p0.mjs (what P0 must refuse, and what must parse)", () => {
  it("every REFUSED case is refused with `not statically parseable` and names its construct", async () => {
    const rows = ROWS.filter((r) => r.source === "gen-p0" && r.kind === "refused");
    const wrong: string[] = [];
    for (const row of rows) {
      const o = await run(row);
      const named = row.construct === null || o.reason.includes(row.construct) || o.reason.toLowerCase().includes(row.construct.toLowerCase());
      // a construct r6 named may now be refused first for an r7 reason (an earlier character or command-word check): still a refusal
      // two constructs QA named are met first by an EARLIER refusal (a brace inside `find -exec ... {}`): still a refusal, listed here
      const earlier = /find -exec/.test(row.construct ?? "") && /brace/.test(o.reason);
      if (!isP0(o) || !(named || earlier || R7_NARROWING.test(o.reason))) wrong.push(`${JSON.stringify(row.command).slice(0, 110)} want "${row.construct}" got ${o.decision} ${o.reason.slice(0, 120)}`);
    }
    // eslint-disable-next-line no-console
    console.log(`QA241 gen-p0 refused: ${rows.length} rows`);
    expect(rows.length).toBeGreaterThanOrEqual(337);
    expect(wrong, `${wrong.length} of ${rows.length}:\n${wrong.slice(0, 25).join("\n")}`).toEqual([]);
  }, 120_000);

  it("every ACCEPTED case parses, or is refused for an r7 reason that is listed", async () => {
    const rows = ROWS.filter((r) => r.source === "gen-p0" && r.kind === "accepted");
    const wrong: string[] = [];
    const superseded: string[] = [];
    for (const row of rows) {
      const o = await run(row);
      if (isP0(o)) {
        if (R7_NARROWING.test(o.reason)) superseded.push(`${row.command} -> ${o.reason.slice(o.reason.indexOf("parseable:") + 11, o.reason.indexOf("parseable:") + 70)}`);
        else wrong.push(`${JSON.stringify(row.command).slice(0, 110)} refused by P0: ${o.reason.slice(0, 120)}`);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`QA241 gen-p0 accepted: ${rows.length} rows, ${superseded.length} now refused by r7:\n  ${superseded.join("\n  ")}`);
    expect(rows.length).toBeGreaterThanOrEqual(170);
    expect(wrong, `${wrong.length} of ${rows.length}:\n${wrong.slice(0, 25).join("\n")}`).toEqual([]);
    // the corpus must still be mostly accepted: r7 narrows it, it does not swallow it
    expect(superseded.length).toBeLessThan(rows.length * 0.35);
  }, 120_000);
});

describe("QA 241: probe-ps-redirect.mjs (the provider-path and drive-relative redirect targets, D-A)", () => {
  it.each([
    ["provider-path redirect to a protected file", (abs: string) => `Write-Output x > FileSystem::${abs}`],
    ["full provider redirect", (abs: string) => `Write-Output x > Microsoft.PowerShell.Core\\FileSystem::${abs}`],
    ["provider-path append redirect", (abs: string) => `Write-Output x >> FileSystem::${abs}`],
    ["provider path as a Set-Content positional", (abs: string) => `Set-Content FileSystem::${abs} -Value x`],
    ["drive-relative redirect", () => "Write-Output x > C:open-brain/src/x.ts"],
  ])("%s is refused by P0", (_n, make) => {
    const abs = `${fx.repo}\\open-brain\\src\\x.ts`;
    const r = fx.ps(make(abs));
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain(GATE_PREFIX);
  });
});
