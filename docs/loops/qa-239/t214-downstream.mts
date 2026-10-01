// QA 239, downstream (report only): does shadow-verdict change any outcome for a criteria file with blank lines,
// and can prepare rewrite an existing artifact? Usage: tsx t214-downstream.mts <shadow-merge.ts> <repo> <fixtures dir>
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [modPath, repo, fixDir] = process.argv.slice(2);
const sm = await import(pathToFileURL(modPath!).href);

const blanked = (t: string) =>
  t.replace(/```(qa-declared|qa-unrunnable)\n/, (m) => `${m}\n \t\n`).replace(/\n\[out-of-scope]/, "\n\n[out-of-scope]");

for (const f of readdirSync(fixDir!).filter((x) => x.endsWith(".json")).sort()) {
  const fx = JSON.parse(readFileSync(join(fixDir!, f), "utf8"));
  const go = (criteriaText: unknown) => sm.computeShadowMergeVerdict({
    evidence: fx.evidence, candidateSha: fx.evidence?.candidate_git?.sha ?? "", loop: fx.evidence?.loop ?? "",
    criteriaText, policy: fx.policy, doneGate: fx.doneGate ?? null, planGate: fx.planGate ?? null, gateMode: fx.gateMode ?? "skip",
  });
  const plain = go(fx.criteriaText);
  const withBlanks = typeof fx.criteriaText === "string" ? go(blanked(fx.criteriaText)) : null;
  console.log(JSON.stringify({ fixture: f, plain: [plain.verdict, plain.reasons[0]], withBlanks: withBlanks && [withBlanks.verdict, withBlanks.reasons[0]] }));
}

// A criteria file shaped like C's: an unmet row declared out-of-scope after a blank line.
const wm = JSON.parse(readFileSync(join(fixDir!, "would-merge.json"), "utf8"));
const ev = structuredClone(wm.evidence);
ev.acceptance.push({ id: "A3", status: "unmet", evidence: "shown", order: "shown" });
const cText = "```qa-declared\n[unrunnable]\n\n[out-of-scope]\nA3: not this loop\n```\n";
const r = sm.computeShadowMergeVerdict({ evidence: ev, candidateSha: ev.candidate_git.sha, loop: ev.loop, criteriaText: cText,
  policy: wm.policy, doneGate: null, planGate: null, gateMode: "skip" });
console.log(JSON.stringify({ case: "C-shaped: unmet A3 declared out-of-scope after a blank line", verdict: r.verdict, reasons: r.reasons }));

// prepare on C's existing artifact: must refuse before writing.
try {
  sm.prepareShadowVerdict({ repo, loop: "15-slice-3-c", candidateSha: "c33942725c73b1aa91ceb46458e6ea7d11c70dcd",
    criteriaSha: "a4205c9cf2a559de0c3933f409ce30259e5262ca", criteriaPath: "docs/loops/loop-15-slice-3-c-criteria.md",
    evidence: {}, gateMode: "skip", policy: wm.policy });
  console.log(JSON.stringify({ case: "prepare over C's artifact", result: "WROTE (defect)" }));
} catch (e) {
  console.log(JSON.stringify({ case: "prepare over C's artifact", result: "refused", message: (e as Error).message }));
}
