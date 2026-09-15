# Shadow recall ranking — re-asked on the repaired instrument

**Date:** 2026-09-15 · **Loop:** 6 · **Session:** 57
**Supersedes:** `shadow-recall-ranking-2026-09-14.md`. That report's numbers were
produced on an instrument with three confounds in it and **must not be pooled with
these**. It is kept for the record, not for its conclusions.

---

## What was wrong, and what was repaired

Three present-tense inputs had leaked into the replay, each standing in for an
as-of-then value. All three are fixed in this run.

| # | Input | Was | Now | Which rows it distorted |
|---|-------|-----|-----|------------------------|
| 1 | Lifecycle state | `maturity` / `success_rate` as they are **today** | reconstructed as of the replayed session | maturity pair — circular, since helpful ratings are what promote maturity |
| 2 | Candidate pool | every entry, including ones created **after** the session | only entries that existed at the session | recency pair — penalised high decay, which is what surfaces new entries |
| 3 | Ranking clock | `julianday('now')` | `julianday(<session's first recall>)` | recency pair — **pushed the opposite way** to (2) |

**(2) and (3) pushed opposite ways on the same rows.** That is worse than either
alone: partial cancellation manufactures a plausible-looking middle that reads as
a measurement rather than as noise. They had to be fixed together, which is why
the clock was added to this loop rather than deferred.

Production ranking is **unchanged**. `recallRankExpr` defaults to `'now'` and
production passes no override — in live recall, "now" genuinely *is* recall time.
This is purely a replay defect. Pinned by test.

---

## The run

```
eligible=37  evaluated=37  skipped=0  limit=5
replay anchoring: 37/37 sessions anchored to their own recall time
entries excluded as not-yet-created, summed over sessions: 4047
feedback_log coverage: 580 logged ratings; 342 non-neutral ratings known to the
  live counters but NOT in the log — replayed maturity is a LOWER BOUND
```

Directions: nDCG / MRR / precision **higher is better**; harmful **lower is better**.

| strategy | sessions | nDCG | MRR | prec | harmful | labeled/returned |
|---|---|---|---|---|---|---|
| `recency_strong` | 37 | **0.2218** | 0.3654 | 0.1584 | 3 | 459/1254 |
| `no_maturity` | 37 | 0.2075 | 0.3422 | 0.1460 | 3 | 464/1254 |
| `live` | 37 | 0.2064 | 0.3271 | 0.1479 | 2 | 460/1254 |
| `maturity_strong` | 37 | 0.2039 | 0.3316 | 0.1454 | 2 | 442/1254 |
| `no_recency` | 37 | 0.1772 | 0.2943 | 0.1234 | 2 | 423/1254 |
| `bm25_only` | 37 | 0.1766 | 0.2913 | 0.1227 | 2 | 433/1254 |

Paired per-session head-to-head vs `live`, on nDCG:

| strategy | win | loss | tie | mean nDCG diff | reordered at all |
|---|---|---|---|---|---|
| `recency_strong` | 21 | 11 | 5 | **+0.0153** | 32/37 |
| `no_maturity` | 12 | 10 | 15 | +0.0010 | 22/37 |
| `maturity_strong` | 10 | 16 | 11 | −0.0025 | 26/37 |
| `no_recency` | 11 | 22 | 4 | −0.0293 | 33/37 |
| `bm25_only` | 11 | 23 | 3 | −0.0298 | 34/37 |

**Reading rule, unchanged from `evaluate.ts`.** Labels exist only for entries the
live ranking actually showed the agent, so the metric is biased **in live's
favour**. A variant *beating* live is therefore strong evidence; a variant merely
tying or losing is weak evidence and does **not** establish that live is better.

---

## Per question: is it answerable now?

### Recency — **YES, answerable.** Decay is doing real work, and 0.005/day is too weak.

Both recency hypotheses are now testable, because the recency signal depends on
`created_at`, which is complete for all 552 entries. Nothing about this question
routes through `feedback_log`.

- `no_recency`'s hypothesis was *"the decay constant is noise and can be dropped."*
  **Refuted.** It loses to live 11–22 with a mean nDCG diff of −0.0293, and lands
  level with the `bm25_only` floor (0.1772 vs 0.1766). Turning decay off is
  equivalent to turning every boost off. Decay is carrying essentially the whole
  benefit the ranking currently delivers over pure lexical match.
- `recency_strong`'s hypothesis was *"0.005/day is too weak."* **Supported.** It is
  the only strategy that beats live, 21–11–5, +0.0153 nDCG — and it does so
  *against* the presentation bias, which is the strong-evidence case.

**Worked example of the metric's direction**, as the acceptance criteria require.
Two entries, 10 and 60 days old at the replayed session, `bm25` equal:

- At `recencyDecayPerDay = 0.005`: divisors `1 + 10(0.005) = 1.05` and
  `1 + 60(0.005) = 1.30`. Ratio **1.238**.
- At `0.02`: divisors `1.20` and `2.20`. Ratio **1.833**.

`recallRankExpr` **divides** by this term and `bm25` is negative with ascending
sort, so a larger divisor pulls a score toward zero and sorts it later. A higher
ratio therefore means a wider separation between fresh and stale. nDCG rising
under the wider separation means the session's own helpful labels sat on the
fresher entries. Higher nDCG = better; the constant moved **up**; the two agree.

This is also the confound that the old clock hid. Replaying from `now` added the
same constant to both ages — 190 and 240 days rather than 10 and 60 — which
collapses the `0.02` ratio from 1.833 to 1.208 and the `0.005` ratio from 1.238 to
1.128. It flattened the strong variant hardest, biasing the instrument toward
exactly `no_recency`'s hypothesis.

### Maturity — **NO, still unanswerable.** New reason, not the old one.

The circularity is genuinely gone. It has been replaced by a sparsity limit that
the repair exposed rather than caused:

- `feedback_log` holds **154** non-neutral ratings. The live counters hold **496**.
  **69% of the evidence that drove historical promotions was never logged** — the
  table postdates it (earliest row 2026-07-28; earliest knowledge entry 2026-03-17).
- So the replay under-promotes, badly. Measured at three points across the run:

  | as of | corpus | entries with maturity > progenitor |
  |---|---|---|
  | 2026-08-29 | 441 | 5 |
  | 2026-09-03 | 497 | 11 |
  | 2026-09-10 | 516 | 11 |
  | **today** | **552** | **39** |

At 1–2% of the corpus carrying any maturity at all, `matureBoost` and `provenBoost`
have almost nothing to act on. `no_maturity` ties live (12–10–**15 ties**) not
because maturity boosts are useless but because in this replay they are nearly
no-ops. The instrument is now **biased toward concluding that maturity does
nothing**, and I cannot distinguish that bias from the finding.

Stating it plainly: **Loop 5 could not answer the maturity question because the
measurement was circular. Loop 6 cannot answer it because the historical record
needed to de-circularise it is 31% complete.** That is progress — the bias is now
one-way and quantified rather than circular and unquantifiable — but it is not an
answer, and no maturity constant should move on these numbers.

The honest sample size for the maturity questions is **not 37 sessions**. It is the
11 or so entries per session that carry a reconstructable maturity at all.

---

## Recommendation

**Change no constant in `LIFECYCLE_CONFIG` in this loop.** Two reasons, and the
first is not caution:

1. `recency_strong` tests **one** alternative point (0.02) against **one** incumbent
   (0.005). That 0.02 beats 0.005 is evidence that the constant is too low. It is
   **not** evidence that 0.02 is right — nothing between or beyond was measured, and
   the optimum could be anywhere above 0.005. Flipping to the one other number that
   happened to be tried is the "constant flipped because the new number is bigger"
   outcome the brief rules out, even though here the bigger number did win.
2. `shadow/index.ts` states the contract directly: *"Changing production constants
   stays a human decision; this only supplies the evidence."* The evidence is now
   worth supplying, which it was not yesterday.

**What to put to Aaron:** `recencyDecayPerDay` is too low, on a repaired instrument
across 37 sessions, with the one clear win in the table. The next measurement worth
running is a sweep — 0.01 / 0.02 / 0.04 as separate strategies — to find where the
gain turns over, rather than adopting 0.02 because it is the value someone guessed
in the strategy list.

---

## Known limits, stated rather than fixed

- **Pre-Stage-2 is not recall time.** The production snapshot is captured before the
  feedback stage, not at the moment of recall. Another session writing between this
  session's `/start` and its `/end` is not captured. This removes the circularity,
  which was the bug; it does not make the signal exact. Exact would need maturity
  and `success_rate` recorded into `recall_log` at recall time — new instrumentation
  that helps no historical session.
- **`feedback_log` is 31% complete** for non-neutral ratings, as above. Unrecoverable;
  there is no record to reconstruct from. Reported by the backfill on every run.
- **Presentation bias is unchanged and unfixable here.** Labels only exist for what
  live showed. These metrics compare re-orderings of a shared candidate pool; they
  cannot discover relevance that was never presented.
- **Maturity is monotonic.** `evaluateLifecycle` advances maturity and never walks it
  back, so an entry promoted while its rate was high stays promoted after the rate
  collapses. The replay reproduces this faithfully. Noted, not changed — nothing
  currently demotes, and whether it should is a Loop 7 question.
- **`maturityBoost()` at `lifecycle.ts:110`** remains referenced only in comments,
  with a docstring that says divide where `recallRankExpr` multiplies. Untouched:
  C1 did not need it.
