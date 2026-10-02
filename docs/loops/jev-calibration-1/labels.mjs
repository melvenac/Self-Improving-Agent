// labels.mjs — the ground truth. Separate from inputs.mjs on purpose: this script reads QA reports and
// rulings; inputs.mjs reads neither.
//   ACCEPT -> proceed, REJECT -> reject, with the source of the label.
// Exclusion tags are decided HERE, before the freeze. Excluded cases stay in labels.json, marked, and are
// not scored: environmental, unrelated-test, superseded-unruled, ambiguous-verdict, leak-later-ruling.
import { git, readJson, writeJson } from "./lib.mjs";

const { cases } = readJson("collect.json");

/**
 * Where a ruling DECIDED the outcome differently from, or more precisely than, the report's own verdict line.
 * Each entry names the ruling. A case with no entry is labelled from its report's Verdict section alone.
 * (Filled from the rulings files; see RULINGS-NOTES in the handoff for how each was read.)
 */
const RULING_OVERRIDES = {};

/** Cases excluded by tag, with the reason read from the report or ruling that justifies it. */
const EXCLUSIONS = {};

/** The verdict section's decisive text: the first bold or heading verdict in the report. */
function verdictText(text) {
  const lines = text.split("\n");
  // 1. "## Verdict: X" / "## VERDICT — X" / "# ... : ACCEPTED" headings carrying the answer.
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    let m = /^#{1,3}\s*(?:VERDICT|Verdict)\s*[:—-]\s*(.+)$/.exec(l);
    if (m) return m[1];
    m = /^\*{2}\s*(?:VERDICT|Verdict)\s*[:—-]\s*([^*]+)\*{0,2}/.exec(l);
    if (m) return m[1];
    if (/^#{1,3}\s*(?:VERDICT|Verdict)\s*$/.test(l)) {
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j += 1) {
        if (lines[j].trim() !== "") return lines.slice(j, j + 3).join(" ");
      }
    }
  }
  // 2. A title ending in the verdict word, e.g. "...: ACCEPTED".
  const t = lines.slice(0, 3).join(" ");
  const m = /\b(ACCEPTED|REJECTED|ACCEPT|REJECT)\b/.exec(t);
  return m ? m[0] : null;
}

function classify(v) {
  if (v === null) return { label: null, why: "no-verdict-text" };
  const s = v.replace(/[*`]/g, " ");
  if (/\bnot\s+accepted\b/i.test(s) || /\bREJECT(?:ED)?\b/.test(s) || /return to Forge/i.test(s)) return { label: "REJECT", text: s.trim().slice(0, 160) };
  if (/\bACCEPT(?:ED)?\b/.test(s)) {
    if (/\bwith\b[^.]*\bdefects?\b/i.test(s) || /\bwith\b[^.]*\b(?:one|two|three)\b[^.]*\b(?:defect|gap)/i.test(s)) return { label: null, why: "accept-with-defects", text: s.trim().slice(0, 160) };
    return { label: "ACCEPT", text: s.trim().slice(0, 160) };
  }
  return { label: null, why: "unclassified-verdict", text: s.trim().slice(0, 160) };
}

const out = [];
for (const c of cases) {
  const text = git(["show", `${c.qa_report_ref.commit}:${c.qa_report_ref.path}`]);
  const v = classify(verdictText(text));
  const leak = Date.parse(c.dispatch_commit_date) > Date.parse(c.qa_report_ref.commit_date);
  const o = RULING_OVERRIDES[c.case_id];
  const base = {
    case_id: c.case_id,
    case_no: c.case_no,
    candidate_sha: c.candidate_sha,
    report_verdict_text: v.text ?? null,
    dispatch_commit_date: c.dispatch_commit_date,
    qa_report_commit_date: c.qa_report_ref.commit_date,
  };
  let label = null;
  let source = null;
  let excluded = null;
  if (o) { label = o.label; source = o.source; }
  else if (v.label) { label = v.label; source = `${c.qa_no === null ? "QA" : `QA ${c.qa_no}`} report ${c.qa_report_ref.commit.slice(0, 8)}`; }
  else { excluded = v.why; }
  if (EXCLUSIONS[c.case_id]) excluded = EXCLUSIONS[c.case_id];
  if (!excluded && leak) excluded = "leak-later-ruling";
  out.push({ ...base, label, expected_decision: label === "ACCEPT" ? "proceed" : label === "REJECT" ? "reject" : null, source, excluded });
}
writeJson("labels.json", out);
const n = (f) => out.filter(f).length;
console.log(`labels: ${out.length} case(s); ACCEPT ${n((x) => x.label === "ACCEPT" && !x.excluded)}, REJECT ${n((x) => x.label === "REJECT" && !x.excluded)}, excluded ${n((x) => x.excluded)}`);
