# QA 208: T-176 index-direction check

**Seat:** QA, record session 208, scoring developer record 200. **Model:** GPT-5.6 Sol.
**Machine:** `DESKTOP-0GV3HAD`, Windows 10.0.19045, Node 22.
**Candidate:** product `6adc07ef34e9021765adacb7816bc0f213806a3c` on
`origin/loop/t176-index-direction`; docs-only branch tip
`8d3143cadd209d92aaebd0111d267e0c2c75c03d`. Base:
`origin/master` `d1e86740bd68827979cfbd5757034f849c38ad41`.

## Verdict

**ACCEPT.** The check now measures both commit directions. At HEAD is PASS; behind is WARN;
ahead-only, diverged, and an indexed commit absent from the repository are ISSUE. Diverged and
unknown outputs identify the indexed and HEAD commits. A dead recorded branch does not override a
current indexed SHA. No index remains a reasoned SKIP, and an independent whole-`runSync`
`checkOnly: true` probe changed no fixture byte.

## Acceptance

| # | Result | Evidence |
|---|---|---|
| 1. Ahead, behind, diverged, unknown | **MET (shown)** | Independent QA probe built separate real repositories for all five graph states. Behind was WARN with `behind=1 ahead=0`; ahead was ISSUE; diverged was ISSUE with both abbreviated SHAs; unknown was ISSUE with indexed and HEAD SHAs. Candidate `staleness.test.ts` passed all 19 rows. |
| 2. Preserve HEAD, no index, `--check` read-only | **MET (shown)** | At-HEAD was PASS even with a dead recorded branch; no `.gitnexus` was SKIP with “not a pass”; `runSync({checkOnly:true})` left an all-files snapshot byte-identical. |
| 3. Detached-branch trap | **MET (shown)** | A current SHA with `branch: "deleted-recorded-branch"` remained PASS and said the branch is not evidence of staleness. |
| 4. Red, green, developer mutants | **MET (shown)** | Local base run failed the final rows (3 failed: behind provenance, ahead verdict, diverged verdict). Candidate passed. Developer mutants failed locally on their intended rows. CI: red `36386952159` **failure** (3 intended failures, 1809 passed); green `36386954884` **success** (1812 passed, 6 skipped); behind mutant `36386957786` **failure** (3 direction rows); unknown mutant `36386960517` **failure** (the unknown-SHA row only). |
| 5. QA mutants | **MET (shown)** | `qa/t176-mut-ahead-warn` `02e09eadb9a5db6bbd3ea028d9e29f23a64b7f54`: typecheck passed, ahead row failed (`warn` vs `issue`). `qa/t176-mut-no-index-pass` `d1686ea55306e2d64dde072e6853ee6ff275bb5f`: typecheck passed, absent-index row failed (`pass` vs `skip`). |

## Local evidence

- `npm run typecheck`: exit 0.
- Candidate final rows plus the first independent-probe revision: candidate `staleness.test.ts`
  passed 19/19; the independent graph-state row passed, while its first read-only row failed because
  the fixture did not satisfy `resolveRepoRoot`. After adding a fixture `package.json` and
  `open-brain/`, the independent probe passed 2/2.
- The corrected independent probe created a fresh repository per state and used no repository
  history from SIA.
- Base with final tests: exit 1, 3 failed / 16 passed. The two contract failures were ahead
  (`pass` vs `issue`) and diverged (`warn` vs `issue`); the third pinned the candidate's new
  `ahead=0` provenance on behind output.
- Developer mutant `08f9176`: exit 1 on diverged (`warn` vs `issue`).
- Developer mutant `aca9911`: exit 1 on unknown SHA (`pass` vs `issue`).

## CI

All four runs were dispatched by QA with `gh workflow run ci.yml --ref …`; no Windows input was
used.

| Run | Ref / SHA | Expected | Conclusion |
|---|---|---|---|
| `36386952159` | `qa/t176-red` / `6770797a35666e2e15097f7badbfcfb334a369a4` | red | **failure** — 3 intended `staleness.test.ts` rows; 1809 passed, 6 skipped |
| `36386954884` | `loop/t176-index-direction` / `8d3143cadd209d92aaebd0111d267e0c2c75c03d` | green | **success** — 131 files; 1812 passed, 6 skipped |
| `36386957786` | `loop/t176-index-direction-mutant-behind` / `08f9176bfe88483d6e4bc23a76fca180cb631995` | red | **failure** — behind provenance, ahead, and diverged rows; 1809 passed, 6 skipped |
| `36386960517` | `loop/t176-index-direction-mutant-unknown` / `aca9911d79fb9fa9ef0581fadb9d5cff2f5c66ea` | red | **failure** — unknown-SHA row only; 1811 passed, 6 skipped |

## Scope and review

The product changes one exported function, `checkGitNexusIndex`, plus its real-repository tests.
Its direct callers are `/sync` and the session-start derived-artifact reporter. The candidate
preserves the latter's severity mapping: ISSUE becomes `STALE`, WARN becomes `AGEING`, and PASS/SKIP
stay silent. GitNexus impact tooling was unavailable in this checkout, so no indexed call-graph
blast radius could be obtained; the source-level caller search above was used and no product code
was edited by QA.

## Evidence file

`docs/loops/t176-index-direction-qa-report.E_t.json` validates with the candidate build:
`node build/harness/cli.js validate evidence <file>` exited **0** with no diagnostics.

## Error entries

1. The isolated clone had no local git identity. The first red-branch commit failed, but the push
   wrapper then pushed the unchanged base SHA. No CI was dispatched at that SHA. I configured the
   clone from the repository's last commit identity, committed the staged final tests, pushed the
   fast-forward, read back `6770797`, and only then dispatched CI.
2. The first independent read-only probe made a real git repository but not a shape accepted by
   `resolveRepoRoot`; `runSync` refused before checking writes. I added the minimum project markers
   to the fixture and reran it. The corrected 2/2 run is the evidence.
3. PowerShell 5.1 does not support `Get-Date -AsUTC`; that timestamp-only command failed and had no
   repository effect.
4. The required pre-commit `sync --check` ran and exited 1 on three unrelated checkout conditions:
   two retired-name hits in `ENTITIES.md`, the deliberately candidate-built `build/` not matching
   this report branch, and the already-over-limit greeting size. It reported `gitnexus-index` as the
   expected no-index SKIP. None concerns or was changed by the two report files.

## Open for the planner

None. The candidate meets all five dispatched items.

QA-208: REPORT COMPLETE
