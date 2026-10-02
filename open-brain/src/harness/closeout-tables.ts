/**
 * The close-out's threshold tables, GENERATED from the gate records (S4-5a).
 *
 * A table typed by hand can drift from the records it describes. This module builds the tables from
 * the records on disk, so QA regenerates them at the close-out SHA and diffs the result against the
 * report: any difference fails the row. Nothing here is typed in. The label that names the sample
 * (`PROVISIONAL (N=<k> seat-built, <r> runtime)`) is computed from the records' own `source`
 * fields, and the output carries no timestamp, so two runs over the same records are identical.
 *
 * For each threshold the table gives its name and value, N, the scored SHAs, every per-diff value,
 * min and max, and the count on each side of the threshold.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { jevModelAtLeast, JEV_MIN_MODEL } from "./gate.js";
import { recordFiles, validateGateRecord, type ShadowDoneRecord, type ShadowQaRecord } from "./gate-records.js";
import { loadPolicies, loadQaScorePolicy, policiesDir } from "./policies.js";

type Side = "below" | "above" | "at-or-above";

interface ThresholdSpec {
  name: string;
  /** Which side of the value a record is on when it would be rejected. */
  rejects: Side;
  /** The per-record value the threshold is applied to, or null when the record has none. */
  value: (r: ShadowDoneRecord | ShadowQaRecord) => number | null;
}

const answerNumber = (r: { answer: Record<string, unknown> | null }, q: string, key: "noul" | "score"): number | null => {
  const a = r.answer?.[q] as Record<string, unknown> | undefined;
  return a !== undefined && a !== null && typeof a[key] === "number" ? (a[key] as number) : null;
};

const DONE_SPECS: readonly ThresholdSpec[] = [
  { name: "diff_matches_plan_min", rejects: "below", value: (r) => answerNumber(r, "diff_matches_plan", "noul") },
  { name: "touches_out_of_scope_max", rejects: "above", value: (r) => answerNumber(r, "touches_out_of_scope", "noul") },
  { name: "local_tests_support_claim_min", rejects: "below", value: (r) => answerNumber(r, "local_tests_support_claim", "noul") },
  { name: "stuck_repeating_prior_failure_max", rejects: "above", value: (r) => answerNumber(r, "stuck_repeating_prior_failure", "noul") },
  { name: "risk_of_regression_rollback_at_or_above", rejects: "at-or-above", value: (r) => answerNumber(r, "risk_of_regression", "score") },
];

const QA_SPECS: readonly ThresholdSpec[] = [
  { name: "regression_of_validated_max", rejects: "above", value: (r) => (r as ShadowQaRecord).regression_of_validated },
  { name: "artifact_complete_enough_to_stop_min", rejects: "below", value: (r) => (r as ShadowQaRecord).artifact_complete_enough_to_stop },
  {
    name: "fail_severity_reject_at_or_above",
    rejects: "at-or-above",
    value: (r) => {
      const sev = (r as ShadowQaRecord).results.filter((x) => x.result === "fail" && x.severity !== null).map((x) => x.severity as number);
      return sev.length === 0 ? null : Math.max(...sev);
    },
  },
];

const sideCounts = (values: readonly number[], threshold: number, rejects: Side): { reject: number; other: number } => {
  const reject = values.filter((v) => (rejects === "below" ? v < threshold : rejects === "above" ? v > threshold : v >= threshold)).length;
  return { reject, other: values.length - reject };
};

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

export interface CloseoutInput {
  recordsDir: string;
  policiesDir?: string;
  /** The criteria file whose Terms table says which diffs have an E_t. Default: beside the records directory. */
  criteriaPath?: string;
}

/**
 * Which diffs have an E_t, from the criteria's Terms table: `| diff | #PR | merge | head | E_t |`.
 * A last cell that starts with `none` means no E_t on any qa branch. Null when the file or the table
 * is missing, so a caller never reads "no rows" as "no E_t".
 */
export function readTermsTable(path: string): Map<number, boolean> | null {
  if (!existsSync(path)) return null;
  const facts = new Map<number, boolean>();
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const pr = cells.length >= 5 ? cells[1]!.match(/^#(\d+)$/) : null;
    if (pr === null) continue;
    facts.set(Number(pr[1]), !/^none\b/i.test(cells[cells.length - 1]!));
  }
  return facts.size === 0 ? null : facts;
}

export interface CloseoutResult {
  markdown: string;
  /** Records the schema refused; the table excludes them and the command exits 1. */
  refused: string[];
  doneN: number;
  qaN: number;
}

interface Loaded {
  path: string;
  rec: ShadowDoneRecord | ShadowQaRecord;
}

const prOf = (rec: ShadowDoneRecord | ShadowQaRecord, path: string): number => {
  if ("pr" in rec) return rec.pr;
  const m = basename(path).match(/^pr-(\d+)\./);
  return m === null ? 0 : Number(m[1]);
};

/** The label, computed from the records' own `source` fields. */
export function provisionalLabel(records: readonly { source: string }[]): string {
  const seat = records.filter((r) => r.source === "seat").length;
  const runtime = records.filter((r) => r.source === "runtime").length;
  return `PROVISIONAL (N=${seat} seat-built, ${runtime} runtime)`;
}

function modelLine(records: readonly Loaded[]): string {
  const models = [...new Set(records.map((l) => String(l.rec.model_resolved)))].sort();
  const below = records.filter((l) => !jevModelAtLeast(l.rec.model_resolved)).map((l) => `PR ${prOf(l.rec, l.path)}`);
  const same = models.length === 1 ? `all records report ${models[0]}` : `the records DIFFER in model_resolved (${models.join(", ")}), so their scores cannot be compared`;
  return `${same}; ${below.length === 0 ? `every one is at or above ${JEV_MIN_MODEL}` : `BELOW ${JEV_MIN_MODEL}: ${below.join(", ")}`}`;
}

function thresholdTable(
  title: string,
  records: readonly Loaded[],
  specs: readonly ThresholdSpec[],
  policy: Record<string, unknown>,
  shaOf: (l: Loaded) => string,
  flags: readonly string[],
  shaHeader = "scored SHA",
): string[] {
  const out: string[] = [`### ${title} — ${provisionalLabel(records.map((l) => l.rec))}`, ""];
  out.push(`N = ${records.length}. ${records.length === 0 ? "No scored records." : `${modelLine(records)}.`}`, "");
  out.push(`| PR | ${shaHeader} | model_resolved |`, "| --- | --- | --- |");
  for (const l of records) out.push(`| ${prOf(l.rec, l.path)} | ${shaOf(l)} | ${String(l.rec.model_resolved)} |`);
  out.push("", "| threshold | value | rejects | N | per-diff values | min | max | reject side | other side |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const spec of specs) {
    const threshold = policy[spec.name] as number;
    const per = records.map((l) => ({ pr: prOf(l.rec, l.path), v: spec.value(l.rec) })).filter((x): x is { pr: number; v: number } => x.v !== null);
    const values = per.map((x) => x.v);
    const c = sideCounts(values, threshold, spec.rejects);
    out.push(
      `| ${spec.name} | ${threshold} | ${spec.rejects} | ${values.length} | ` +
        `${per.length === 0 ? "none" : per.map((x) => `PR ${x.pr}: ${x.v}`).join("; ")} | ` +
        `${values.length === 0 ? "n/a" : Math.min(...values)} | ${values.length === 0 ? "n/a" : Math.max(...values)} | ${c.reject} | ${c.other} |`,
    );
  }
  out.push("", "Switches (no per-diff value):", "");
  for (const f of flags) out.push(`- ${f}: ${String(policy[f])}`);
  out.push("");
  return out;
}

/** Build the close-out tables from the records under `recordsDir`. */
export function buildCloseoutTables(input: CloseoutInput): CloseoutResult {
  const recordsDir = resolve(input.recordsDir);
  const pDir = input.policiesDir ?? policiesDir();
  const refused: string[] = [];
  const done: Loaded[] = [];
  const qa: Loaded[] = [];
  let live = 0;
  for (const file of recordFiles(recordsDir)) {
    if (!/\.G_(done|qa)\./.test(basename(file))) continue;
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      refused.push(`${basename(file)}: not JSON`);
      continue;
    }
    const v = validateGateRecord(json);
    if (!v.ok) {
      refused.push(`${basename(file)}: ${v.problems.join("; ")}`);
      continue;
    }
    if (v.kind === "runtime-done") continue;
    const rec = v.value as ShadowDoneRecord | ShadowQaRecord;
    if (rec.mode !== "live" || rec.outcome_class !== "answered" || rec.answer === null) continue;
    live += 1;
    (rec.gate === "qa-score" ? qa : done).push({ path: file, rec });
  }
  done.sort((a, b) => prOf(a.rec, a.path) - prOf(b.rec, b.path));
  qa.sort((a, b) => prOf(a.rec, a.path) - prOf(b.rec, b.path));

  const doneRaw = loadPolicies(pDir).done as unknown as Record<string, unknown>;
  const qaRaw = loadQaScorePolicy(pDir) as unknown as Record<string, unknown>;
  const doneHash = sha256(join(pDir, "developer-done.json"));
  const qaHash = sha256(join(pDir, "qa-score.json"));

  const lines: string[] = ["# Slice four: threshold tables, generated from the gate records", ""];
  lines.push(`Records read: ${live} live answered record(s).`, "");
  lines.push(
    ...thresholdTable(
      "4.3 developer done-gate (developer-done.json)",
      done,
      DONE_SPECS,
      doneRaw,
      (l) => (l.rec as ShadowDoneRecord).scored_sha,
      ["hand_to_qa_requires_green_checks"],
    ),
  );
  const staleDone = done.filter((l) => l.rec.policy_hash !== doneHash).map((l) => `PR ${prOf(l.rec, l.path)}`);
  lines.push(`policy_hash: ${staleDone.length === 0 ? "every G_done carries the sha256 of developer-done.json as it is now" : `MISMATCH on ${staleDone.join(", ")}`}.`, "");

  lines.push(
    ...thresholdTable(
      "4.4 QA-score gate (qa-score.json)",
      qa,
      QA_SPECS,
      qaRaw,
      (l) => (l.rec as ShadowQaRecord).e_t_ref.commit,
      ["any_fail_is_reject", "untested_is_reject"],
      "E_t commit",
    ),
  );
  const staleQa = qa.filter((l) => l.rec.policy_hash !== qaHash).map((l) => `PR ${prOf(l.rec, l.path)}`);
  lines.push(`policy_hash: ${staleQa.length === 0 ? "every G_qa carries the sha256 of qa-score.json as it is now" : `MISMATCH on ${staleQa.join(", ")}`}.`, "");

  // The diffs with no E_t get no call: they are listed, never silently dropped.
  const diffs = existsSync(recordsDir)
    ? readdirSync(recordsDir)
        .map((n) => n.match(/^pr-(\d+)\.D_t\.json$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => Number(m[1]))
        .sort((a, b) => a - b)
    : [];
  const scored = new Set(qa.map((l) => prOf(l.rec, l.path)));
  // Whether a diff HAS an E_t comes from the criteria's Terms table, which does not depend on a G_qa
  // having run (T-220, D-092 F2). Only a G_qa run writes the `pr-<n>.E_t.json` copy, so the copy's
  // presence alone mislabelled every diff that has an E_t but had not been called.
  const criteriaPath = resolve(input.criteriaPath ?? join(recordsDir, "..", "loop-15-slice-4-criteria.md"));
  const facts = readTermsTable(criteriaPath);
  const hasCopy = (pr: number): boolean => existsSync(join(recordsDir, `pr-${pr}.E_t.json`));
  const qaLabel = (pr: number): string => {
    if (scored.has(pr)) return "scored";
    if (facts === null) return hasCopy(pr) ? "not scored" : "not scored: no E_t";
    const has = facts.get(pr);
    if (has === undefined) return "not scored: E_t unknown";
    return has ? "not called" : "not scored: no E_t";
  };
  lines.push("### Diffs and what was scored", "", "| PR | 4.3 G_done | 4.4 G_qa |", "| --- | --- | --- |");
  const doneSet = new Set(done.map((l) => prOf(l.rec, l.path)));
  for (const pr of diffs) {
    lines.push(`| ${pr} | ${doneSet.has(pr) ? "scored" : "not scored"} | ${qaLabel(pr)} |`);
  }
  lines.push("", facts === null ? "E_t source: none (the criteria Terms table was not readable; the records directory alone was used)." : `E_t source: the criteria Terms table (${facts.size} rows).`);
  lines.push("");

  return { markdown: `${lines.join("\n")}\n`, refused, doneN: done.length, qaN: qa.length };
}
