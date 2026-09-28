# Loop 15 slice three, candidate C (T-155, the shadow merge gate): developer brief (record 201)

**By:** Atlas (planner), 2026-09-28. **To:** Forge (Grok 4.7, `sia-forge`).

## The objective

C closes slice three. Candidates A and B are merged. **Capability:** before a loop candidate merges to `master`, the
runtime records what it WOULD have done (`would-merge`, `would-not-merge` or `undefined`). After Aaron's decision, one
ledger line records whether the two disagreed. Nothing is automated. The runtime still never merges.

## What you build against

**The criteria:** `docs/loops/loop-15-slice-3-c-criteria.md` at **`e6b64e9`** on
`origin/docs/session-100-qa99-dispatch`. That commit is the criteria SHA. Build every row in §1 (CC-0 to CC-22, except
CC-21, which is cut), plus CC-29 and CC-30 from §8. §2's declared rows are not built. **§8's amendments override §1
where they differ.** Read §8 first.

## How

- **Branch** `loop/15-slice-3-candidate-c` from `origin/master` `d1e8674`, or later if master moves. Name the base SHA in
  the handoff.
- **D-061: no CI of any kind.** Run the red rows against the unfixed base and the green rows on the candidate, locally,
  from `open-brain/`: `npm run build`, `npx tsc --noEmit` and `npx vitest run`. Quote each run's failing lines and exit
  code. `.agents/roles/developer.md`, "Building checks", binds this: a red run is the FINAL rows against the UNFIXED
  product; a mutant is a product edit on its own branch; every mutant passes `tsc --noEmit` before it counts.
- **Mutants, at least these:** `undefined` counted as agreement; a `pending` row giving `would-not-merge`; the two
  declared lists merged into one; `prepare` overwriting an existing verdict; `decide --merged` accepting a sha that is
  not on `origin/master`.
- **Fixtures:** every git-touching test builds a throwaway repo. Never this repo, never the real knowledge DB, never a
  live `state.json` (G-044).
- **Impact:** run GitNexus `impact` before editing any existing symbol, if your tree has an index. If it does not, say
  so.

## Report

Handoff at `docs/loops/loop-15-slice-3-c-developer-handoff.md` on the branch. Use the report contract: changes, each
CC row with pass/fail and an observation, the preserve list from §8 with held/broken, gaps, and your model. Push the
branch and the mutant branches, read them back with `ls-remote`, post the tips to the hub, and open a PR. Do not merge.
