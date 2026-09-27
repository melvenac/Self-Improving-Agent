// QA 132: red-at-base probe. Runs master's validateEvidence (schema.ts blob e7ea3c7) on one document per
// R10 rule, plus the StubQa document shape. Prints one line per case: name, ok, first problem.
import { validateEvidence, jsonSchemas } from "C:/Users/Aaron Melven/Worktrees/sia-qa/open-brain/src/harness/schema.ts";

const check = { command: "node -e 0", exit_code: 0, passed: true, duration_ms: 1, detail: "exit 0" };
const base = (): Record<string, unknown> => ({
  loop: "t001",
  candidate_git: { sha: "a".repeat(40), branch: "main", frozen_at: "2026-09-26T00:00:00.000Z" },
  runtime_checks: { build: check, unit: check },
  requirements: [],
  acceptance: [{ id: "A1", status: "met", evidence: "observed" }],
  regressions: [],
  gaps: [],
  notes: "",
});

const cases: Array<[string, Record<string, unknown>]> = [
  ["control: t001, met, no order", base()],
  ["(a) human-seat loop 15-slice-3", { ...base(), loop: "15-slice-3" }],
  ["(a) human-seat loop loop-15-slice-3-b", { ...base(), loop: "loop-15-slice-3-b" }],
  ["(a) traversal ../x", { ...base(), loop: "../x" }],
  ["(b) met + order: attributed", { ...base(), acceptance: [{ id: "A1", status: "met", evidence: "e", order: "attributed" }] }],
  ["(b) met + order: shown", { ...base(), acceptance: [{ id: "A1", status: "met", evidence: "e", order: "shown" }] }],
  ["(b) status attributed", { ...base(), acceptance: [{ id: "A1", status: "attributed", evidence: "e" }] }],
  ["(c) status pending", { ...base(), acceptance: [{ id: "A1", status: "pending", evidence: "CI run not yet dispatched" }] }],
  ["(c) requirements pending", { ...base(), requirements: [{ id: "R1", status: "pending", evidence: "e", severity: "info" }] }],
  ["(d) status out_of_scope", { ...base(), acceptance: [{ id: "A1", status: "out_of_scope", evidence: "e" }] }],
  ["(d) top-level out_of_scope[]", { ...base(), out_of_scope: ["A4"] }],
  ["(d) top-level invisible[]", { ...base(), invisible: ["U1"] }],
  ["dup acceptance id", { ...base(), acceptance: [{ id: "A1", status: "met", evidence: "e" }, { id: "A1", status: "unmet", evidence: "e" }] }],
];

for (const [name, doc] of cases) {
  const r = validateEvidence(doc);
  console.log(`${name} | ok=${r.ok}${r.ok ? "" : ` | ${r.problems[0]}`}`);
}

const ev = jsonSchemas().evidence as { properties: { acceptance: { items: { properties: { status: { enum: string[] } } } } } };
console.log(`json acceptance.status enum = ${JSON.stringify(ev.properties.acceptance.items.properties.status.enum)}`);
