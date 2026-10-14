/**
 * T-194 r6: EVERY case QA 237 ran against r5 is a row here. The rows are in docs/loops/t194-r6/qa237-rows.json, produced
 * by docs/loops/t194-r6/extract-qa237-rows.mjs from QA 237's own probe scripts and seeded generators (probe-holes.mjs,
 * probe-holes2.mjs, gen-p1/p2/p2b/p3.mjs, fail-closed.mjs), so they are QA's cases and not a paraphrase of them.
 *
 * A row passes when the hook decides what QA's oracle required, OR when the P0 parse gate refuses it ("superseded by P0":
 * the construct is outside the grammar, so refusing is the r6 answer, and for a row QA expected to ALLOW it is the
 * fail-closed cost, listed in the handoff). Because "refused by P0" satisfies any expectation, the test also pins how many
 * rows P1-P3 still decide: if the gate swallowed everything this would go red.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFixture, type Fixture } from "./r5-fixture.js";
import { GATE_PREFIX } from "./r6-cases.js";

interface Row {
  source: string;
  id: string;
  tool: "Bash" | "PowerShell" | "Write" | "Edit";
  command: string | null;
  file_path: string | null;
  cwd: string;
  expect: string | null;
  extra?: { how?: string[] };
}

const ROWS: Row[] = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../docs/loops/t194-r6/qa237-rows.json"), "utf8"));
const NOT_PARSEABLE = "not statically parseable";

let fx: Fixture;
beforeAll(() => {
  // QA's rows carry absolute fixture paths and no spaces, so this fixture keeps the temp dir as the OS names it.
  fx = makeFixture("r6qa", false);
});
afterAll(() => fx.dispose());
beforeEach(() => fx.resetGrant());

/** QA 237's fixture root, in the spellings its rows use, replaced by this fixture's root in the same spelling. */
function relocate(text: string): string {
  // QA's generators sometimes quote INSIDE the root (C:/q'a-scratch'/qa237-fx); the whole relocated root is then quoted.
  text = text.replace(/[A-Za-z]:[\\/]q['"]?a['"]?-['"]?s['"]?c['"]?r['"]?a['"]?t['"]?c['"]?h['"]?[\\/]qa237-fx/gi, (m) => {
    if (!/['"]/.test(m)) return m; // no quote inside the root: the plain replacement below handles it
    const root = m.includes("\\") ? fx.repo : fx.fwd;
    return `"${m === m.toUpperCase() ? root.toUpperCase() : root}"`;
  });
  const gitBash = fx.windows ? fx.fwd.replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`) : fx.fwd;
  return text
    .replace(/\/c\/qa-scratch\/qa237-fx/gi, (m) => (m === m.toUpperCase() ? gitBash.toUpperCase() : gitBash))
    .replace(/[A-Za-z]:[\\/]qa-scratch[\\/]qa237-fx/gi, (m) => {
      const back = m.includes("\\");
      const root = back ? fx.repo : fx.fwd;
      return m === m.toUpperCase() ? root.toUpperCase() : root;
    });
}

interface Outcome {
  decision: string;
  reason: string;
  fetches: number;
}

async function run(row: Row): Promise<Outcome> {
  const cwd = row.cwd ? fx.sub(row.cwd) : fx.fwd;
  if (row.tool === "Write" || row.tool === "Edit") {
    const p = relocate(row.file_path ?? "");
    const r = row.tool === "Write" ? fx.write(p, cwd) : fx.edit(p, cwd);
    return { decision: r.decision, reason: r.reason ?? "", fetches: 0 };
  }
  const r = await fx.merge(row.tool, relocate(row.command ?? ""), cwd);
  return { decision: r.decision, reason: r.reason ?? "", fetches: fx.calls.length };
}

const isP0 = (o: Outcome): boolean => o.decision === "deny" && o.reason.includes(GATE_PREFIX);

function judge(row: Row, o: Outcome): string | null {
  const want = row.expect;
  if (isP0(o)) return null; // superseded by P0 (a refusal with a named construct)
  // r7, CI on Linux: QA 237 generated these on a case-INSENSITIVE Windows file system, where `PACKAGE.json` IS the protected package.json.
  // On a case-sensitive file system it is a different file, and the hook correctly allows it, so the expectation is Windows-only.
  if (!fx.windows && row.extra?.how?.includes("case") && want !== null && want.startsWith("deny")) return null;
  // Open 5 (Atlas ruling): git -c core./alias./remote./url./include. needs a grant, so QA's r5-era "standing push" rows that carry
  // such a key are superseded: a refusal naming the grant is the r6 answer.
  if (want === "allow" && o.decision === "deny" && /\s-c\s+(?:core|alias|remote|url|include|includeif)\./i.test(row.command ?? "") && /D-038/.test(o.reason)) return null;
  switch (want) {
    case "deny":
    case "deny-named":
    case "deny-grammar":
    case "deny-token":
      // QA 237 drove the CLI with no GitHub token, so an exact-grammar control was refused for want of a read. Here a fake
      // GitHub answers, so the same control is allowed after a read: that is the control working, not a hole.
      if (/control|exact|origin URL|& gh pr merge 1|gh\.exe pr merge 1/i.test(row.id) && o.decision === "allow" && o.fetches > 0) return null;
      return o.decision === "deny" ? null : `expected deny, got ${o.decision}`;
    case "allow":
      return o.decision === "allow" ? null : `expected allow, got ${o.decision} (${o.reason.slice(0, 120)})`;
    case "read":
      return o.decision === "allow" && o.fetches > 0 ? null : `expected an allow after a read, got ${o.decision} with ${o.fetches} fetch(es) (${o.reason.slice(0, 100)})`;
    case "grant":
      return o.decision === "deny" && o.fetches === 0 ? null : `expected a refusal with no read, got ${o.decision} with ${o.fetches} fetch(es)`;
    case null:
      // probe-holes2 / fail-closed carry no expectation: the former are fail-open probes (must be denied) except the one
      // "only-if" control, which may be allowed; the latter are cost rows and are only recorded.
      if (row.source === "fail-closed") return null;
      return /only-if/i.test(row.id) ? null : o.decision === "deny" ? null : `a fail-open probe was ${o.decision}`;
    default:
      return `unknown expectation ${String(want)}`;
  }
}

describe("QA 237: every probe and generated case, against r6", () => {
  it("loaded every row QA's scripts produce", () => {
    const by: Record<string, number> = {};
    for (const r of ROWS) by[r.source] = (by[r.source] ?? 0) + 1;
    expect(by).toEqual({
      "probe-holes": 64, "probe-holes2": 29, "gen-p1": 400, "gen-p2": 380, "gen-p2b": 300, "gen-p3": 360, "fail-closed": 22,
    });
  });

  for (const source of ["probe-holes", "probe-holes2", "gen-p1", "gen-p2", "gen-p2b", "gen-p3", "fail-closed"]) {
    it(`${source}: every row is decided as QA's oracle requires, or refused by P0`, async () => {
      const rows = ROWS.filter((r) => r.source === source);
      const wrong: string[] = [];
      let byGate = 0;
      for (const row of rows) {
        if (/\s/.test(fx.fwd) && /qa237-fx/i.test(`${row.command ?? ""}${row.file_path ?? ""}`)) continue;
        const o = await run(row);
        if (isP0(o)) byGate++;
        const bad = judge(row, o);
        if (bad) wrong.push(`${row.id} :: ${(row.command ?? row.file_path ?? "").replace(/\n/g, "\\n").slice(0, 100)} @${row.cwd || "."} -> ${bad}`);
      }
      // eslint-disable-next-line no-console
      console.log(`QA237 ${source}: ${rows.length} rows, ${byGate} refused by P0, ${rows.length - byGate} decided by P1-P3`);
      expect(wrong, `${wrong.length} of ${rows.length} rows:\n${wrong.slice(0, 30).join("\n")}`).toEqual([]);
    }, 120_000);
  }

  it("the gate does not swallow the corpus: P1-P3 still decide most of QA's allow, read and grant rows", async () => {
    const wanted = ROWS.filter((r) => ["allow", "read", "grant"].includes(r.expect ?? ""));
    let decidedElsewhere = 0;
    for (const row of wanted) {
      if (/\s/.test(fx.fwd) && /qa237-fx/i.test(`${row.command ?? ""}${row.file_path ?? ""}`)) continue;
      if (!isP0(await run(row))) decidedElsewhere++;
    }
    // r6 refuses comments, backslashes, $ and the like, so a share of QA's allow rows is superseded; most are plain.
    expect(decidedElsewhere).toBeGreaterThan(wanted.length * 0.5);
  }, 120_000);
});
