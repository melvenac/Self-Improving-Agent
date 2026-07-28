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
      "Maturity boosts entrench whatever was recalled early. Removing them tests whether they help or just compound.",
    overrides: { matureBoost: 1.0, provenBoost: 1.0 },
  },
  {
    name: "maturity_strong",
    hypothesis: "Proven/mature entries are under-weighted; feedback should count for more than 1.5x.",
    overrides: { matureBoost: 2.5, provenBoost: 1.6 },
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
