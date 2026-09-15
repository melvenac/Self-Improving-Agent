// Shadow-recall ranking strategies.
//
// Each strategy is a config override applied to recallRankExpr() — never a
// separate ranking implementation. That was the flaw in the v1 harness: it
// carried its own RRF/vector code, so it measured a code path production did
// not use, and it died the moment that path was removed.
//
// Every constant here is currently an unvalidated guess. The point of the
// harness is to replace guesses with evidence, so each strategy states the
// hypothesis it exists to test.

import type { RankConfig } from "../../lifecycle.js";

export interface ShadowStrategy {
  /** Stable identifier — used as the JSONL key, so do not rename casually. */
  name: string;
  /** What this variant is testing. Written for whoever reads the report later. */
  hypothesis: string;
  overrides: Partial<RankConfig>;
}

export const SHADOW_STRATEGIES: ShadowStrategy[] = [
  {
    name: "live",
    hypothesis: "Control. Byte-identical to production ranking; every other strategy is scored against this.",
    overrides: {},
  },
  {
    name: "no_recency",
    hypothesis:
      "Recency decay is doing nothing useful. If this ties with live, the decay constant is noise and can be dropped.",
    overrides: { recencyDecayPerDay: 0 },
  },
  {
    name: "recency_strong",
    hypothesis:
      "0.005/day is too weak. At 0.02/day a 50-day-old entry is doubly penalised rather than 1.25x.",
    overrides: { recencyDecayPerDay: 0.02 },
  },
  {
    name: "no_maturity",
    hypothesis:
      "Maturity boosts entrench whatever was recalled early. Removing them tests whether they help or just compound. " +
      "DEGENERATE SINCE LOOP 8 R1: live now sets both boosts to 1.0, so this strategy is byte-identical to the control. " +
      "Kept rather than deleted because the name is a JSONL key with history behind it, and because it is now a second " +
      "free consistency check — it must tie with `live` exactly, and any gap between them means the harness is not deterministic.",
    overrides: { matureBoost: 1.0, provenBoost: 1.0 },
  },
  {
    name: "maturity_strong",
    hypothesis: "Proven/mature entries are under-weighted; feedback should count for more than 1.5x.",
    overrides: { matureBoost: 2.5, provenBoost: 1.6 },
  },
  // ── Loop 8 R2: the recency sweep ──────────────────────────────────────────
  //
  // Loop 7 found `no_recency` lost 11-22 against live on the repaired harness
  // and landed level with the `bm25_only` floor, so the decay term is the one
  // ranking input with evidence behind it. That says the constant matters; it
  // does not say 0.005 is the right value. These three bracket it — one step
  // below the current value is not offered because `no_recency` already covers
  // the zero end and 0.005 is itself the low point of the useful range.
  //
  // ADOPT NOTHING AUTOMATICALLY. Report where the gain peaks or turns over and
  // leave the constant to Aaron. A number being bigger is not a reason.
  //
  // Note `recency_strong` above is also 0.02 and is deliberately NOT renamed —
  // its name is a JSONL key with history behind it. The duplication is useful:
  // `recency_0_02` and `recency_strong` must produce identical results, so any
  // divergence between them is a nondeterministic harness, not a finding.
  {
    name: "recency_0_01",
    hypothesis: "2x the live decay. Tests whether the gain from decay is still climbing just above 0.005.",
    overrides: { recencyDecayPerDay: 0.01 },
  },
  {
    name: "recency_0_02",
    hypothesis: "4x the live decay. Duplicates recency_strong on purpose as an internal consistency check.",
    overrides: { recencyDecayPerDay: 0.02 },
  },
  {
    name: "recency_0_04",
    hypothesis: "8x the live decay. Tests for a turnover — the point where freshness starts outranking relevance.",
    overrides: { recencyDecayPerDay: 0.04 },
  },
  {
    name: "bm25_only",
    hypothesis:
      "Floor. All boosts off — pure lexical relevance. Any strategy that cannot beat this is not earning its complexity.",
    overrides: {
      matureBoost: 1.0,
      provenBoost: 1.0,
      lowSuccessPenalty: 1.0,
      recencyDecayPerDay: 0,
      failureBoost: 1.0,
    },
  },
];

export function resolveStrategy(name: string): ShadowStrategy | undefined {
  return SHADOW_STRATEGIES.find((s) => s.name === name);
}
