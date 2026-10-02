// labels.mjs: the ground truth. Separate from inputs.mjs on purpose: this script reads QA reports and
// rulings; inputs.mjs reads neither.
//   ACCEPT -> proceed, REJECT -> reject, with the source of the label.
// Exclusion tags are decided HERE, before the freeze. Excluded cases stay in labels.json, marked, and are
// not scored: environmental, unrelated-test, superseded-unruled, ambiguous-verdict, leak-later-ruling
// (plus the verdict-less / unclassifiable tags the classifier below emits). `leak-wording` is applied by
// sample.mjs, because it is a property of D_t, not of the label.
import { git, readJson, writeJson } from "./lib.mjs";

const { cases } = readJson("collect.json");

/**
 * Where a ruling DECIDED the outcome differently from, or more precisely than, the report's own verdict line.
 * Each entry names the ruling and quotes the deciding sentence. A case with no entry is labelled from its
 * report's Verdict section alone. The ruling files are read at origin/master f7ac983d.
 */
const RULING_OVERRIDES = {
  "s3-b-step1": { label: "ACCEPT", source: "rulings-qa129 (loop-15-slice-3-b-step1-rulings-qa129.md): \"ACCEPTED: the G-042 repair (e815e3d) passes B-0 to B-9.\"" },
  "importer-leftovers": { label: "ACCEPT", source: "rulings-qa138 (importer-leftovers-rulings-qa138.md): \"Verdict accepted: PASS. d500730 merges\"" },
  "importer-fixes-r4": { label: "ACCEPT", source: "rulings-qa122 (importer-fixes-r4-rulings-qa122.md): \"Accepted: round 4 is sound, and the importer (rounds 1-4) goes to merge\"" },
  "bootstrap-fix": { label: "REJECT", source: "rulings-qa135 (bootstrap-fix-rulings-qa135.md): \"the candidate does NOT merge until round 3\" (BF-1 to BF-8 PASS, but install (ii) FAIL blocks)" },
};

/**
 * Reports whose verdict is a bare PASS, or ACCEPT-with-defects. Rule (rulings-1 item 2, Atlas):
 *   a leading PASS with no defect named, or "No defects"          -> ACCEPT
 *   PASS or ACCEPT that also lists defects, or "not a clean pass" -> excluded: ambiguous-verdict
 * `trigger` is the sentence that decides it. The script checks that it is a verbatim substring of the report
 * (asterisks and backticks removed), so a mistyped quote fails the run rather than slipping through.
 */
const VERDICT_SENTENCES = {
  "importer-fixes": { ambiguous: true, trigger: "It is not a clean pass. There are two new defects in the code this candidate adds, and neither blocks an IF row:" },
  "importer-fixes-r2": { ambiguous: true, trigger: "Do not merge aba35de as it stands." },
  "importer-fixes-r3": { ambiguous: true, trigger: "It does not close D5's class. D8 (new to QA, present since round 2, medium" },
  "t183": { ambiguous: true, trigger: "so the verdict is ACCEPT WITH ONE DEFECT TO FIX OR RULE (D1, low-medium)" },
  "t185": { ambiguous: true, trigger: "ACCEPT T-185 at 9473b0d, with two defects to fix in a short test-and-code round (D1, D2) and two test gaps (D3, D4)." },
  "t003": { ambiguous: true, trigger: "PASS on what T-003 set out to fix, with five defects: fix D1 and D3 in this round." },
  "t048-r1": { ambiguous: true, trigger: "PASS, with three defects and a test gap." },
  "importer-leftovers-r5": { ambiguous: true, trigger: "There are three low defects." },
  "t003-r2": { label: "ACCEPT", trigger: "PASS. Every required fix and every ride-along holds, with no regression. There is one low test gap (QA154-1)." },
  "importer-leftovers-r6": { label: "ACCEPT", trigger: "PASS on QA 153 D1, the DECISIONS.md line, and every preserve. No defects." },
  "t048-r1b": { label: "ACCEPT", trigger: "PASS d5b78cb. Round 1b fixes all three QA 151 output defects (D1" },
  "t221-t222": { label: "ACCEPT", trigger: "Pair: ACCEPT." },
};

/**
 * Cases excluded by tag. `environmental`, `unrelated-test` and `superseded-unruled` need a human reading of
 * the report; none was applied in this build (the handoff says what was and was not checked).
 */
const EXCLUSIONS = {};

const flat = (x) => x.replace(/[*`]/g, "").replace(/\s+/g, " ");

/** The verdict section's decisive text: the first bold or heading verdict in the report. */
function verdictText(text) {
  const lines = text.split("\n");
  // 1. "## Verdict: X" / "## VERDICT - X" / "# ... : ACCEPTED" headings carrying the answer.
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
    if (/\bwith\b[^.]*\bdefects?\b/i.test(s) || /\bwith\b[^.]*\b(?:one|two|three)\b[^.]*\b(?:defect|gap)/i.test(s)) return { label: null, why: "ambiguous-verdict", text: s.trim().slice(0, 160) };
    return { label: "ACCEPT", text: s.trim().slice(0, 160) };
  }
  return { label: null, why: "unclassified-verdict", text: s.trim().slice(0, 160) };
}

const out = [];
for (const c of cases) {
  const text = git(["show", `${c.qa_report_ref.commit}:${c.qa_report_ref.path}`]);
  const v = classify(verdictText(text));
  // Conservative leak date: the FIRST commit of the report, not the last (QA 239 began as an INCOMPLETE stub).
  const firstDate = git(["show", "-s", "--format=%cI", c.qa_report_ref.first_commit]).trim();
  const leak = Date.parse(c.dispatch_commit_date) > Date.parse(firstDate);
  const o = RULING_OVERRIDES[c.case_id];
  const vs = VERDICT_SENTENCES[c.case_id];
  if (vs && !flat(text).includes(flat(vs.trigger))) throw new Error(`${c.case_id}: trigger sentence is not verbatim in the report`);
  const qa = c.qa_no === null ? "QA" : `QA ${c.qa_no}`;
  const base = {
    case_id: c.case_id,
    case_no: c.case_no,
    candidate_sha: c.candidate_sha,
    report_verdict_text: v.text ?? null,
    dispatch_commit_date: c.dispatch_commit_date,
    qa_report_commit_date: c.qa_report_ref.commit_date,
    qa_report_first_commit_date: firstDate,
  };
  let label = null;
  let source = null;
  let excluded = null;
  let ambiguous_trigger = null;
  if (o) { label = o.label; source = o.source; }
  else if (vs?.ambiguous) { excluded = "ambiguous-verdict"; ambiguous_trigger = vs.trigger; }
  else if (vs) { label = vs.label; source = `${qa} report ${c.qa_report_ref.commit.slice(0, 8)}: "${vs.trigger}"`; }
  else if (v.label) { label = v.label; source = `${qa} report ${c.qa_report_ref.commit.slice(0, 8)}`; }
  else { excluded = v.why; if (v.why === "ambiguous-verdict") ambiguous_trigger = v.text; }
  if (EXCLUSIONS[c.case_id]) excluded = EXCLUSIONS[c.case_id];
  if (!excluded && leak) excluded = "leak-later-ruling";
  out.push({ ...base, ambiguous_trigger, label, expected_decision: label === "ACCEPT" ? "proceed" : label === "REJECT" ? "reject" : null, source, excluded });
}
writeJson("labels.json", out);
const n = (f) => out.filter(f).length;
console.log(`labels: ${out.length} case(s); ACCEPT ${n((x) => x.label === "ACCEPT" && !x.excluded)}, REJECT ${n((x) => x.label === "REJECT" && !x.excluded)}, excluded ${n((x) => x.excluded)}`);
const by = {};
for (const x of out.filter((x) => x.excluded)) (by[x.excluded] ??= []).push(x.case_id);
for (const [k, ids] of Object.entries(by)) console.log(`  excluded ${k}: ${ids.join(", ")}`);
