# T-334 reading 1: recall trigger arms, primary outcome

Read s178, 2026-11-17 ~13:35Z, by Atlas, following `docs/loops/t334-measure-plan.md` as written on 11-05/11-06.
This is the **one primary reading** the plan allows. Any later look is a second look and must say so.
Script: `docs/loops/t334/t334-read.cjs` (read-only on the live `knowledge-v2.db`; token parser self-tests on start).
It was run first in `gate` mode, which prints no outcomes, and then in `read` mode once the gate was met.

## Gate

| | primary (`match:`/`error-match:`) | path | element (excluded) |
|---|---|---|---|
| injected | 106 | 14 | 4 |
| withheld | 109 | 15 | 3 |

There are 215 primary-class draws, against a gate of 200, so the reading went ahead. Total: 251 draws from 11,046 fires
(2026-11-02T11:04:52Z to 2026-11-17T13:35:24Z). No session-entry pair appears in both arms.

## Result

| Measure | injected | withheld | diff (inj − wh) | session-cluster bootstrap 95% CI |
|---|---|---|---|---|
| **Primary:** a later `match:`/`error-match:` names the entry | 57/106 (53.8%) | 67/109 (61.5%) | **−7.7 pts** | **[−20.8, +9.1]** (52 sessions, B=5000) |
| Primary without entry 299 | same | same | same | same |
| Secondary: `error-match:` only | 0/106 | 0/109 | 0 | (none observed) |
| Secondary: `path-match:` (path draws only) | 11/14 (78.6%) | 13/15 (86.7%) | −8.1 pts | [−50.0, +21.4] (14 sessions) |

**Reading: the CI includes 0, so there is no detectable difference at this n.** The point estimate leans toward fewer
re-matches after an injection. This is not evidence of no effect, and per the plan nothing changes on this result alone.
Turning the arm off or changing the fraction is a separate ruling.

## Notes the plan did not anticipate

- **Removing entry 299 changes nothing, because 299 has no primary-class draws.** Its injections reach sessions through
  element-path queries, which carry no id. The plan's "299 dominated injections" holds for fires but not for primary
  draws. The top injected primary entries are 697 (15), 710 (8), 780 (8), 816 (7) and 818 (6).
- **`error-match:` is too sparse to measure:** 6 tokens in all fires since 11-02 and none after a draw. The plan's
  closest-to-"the failure came back" secondary cannot be read at any n the arm will reach soon.
- **`seat-skip:` tokens (1,353) appear in the store, and the plan does not mention them.** They are neither an
  injection nor a `withheld:` token, so the draw definition ignores them. If seat-skip suppresses an entry before the
  arm draw, it changes which pairs exist (like limit 2), not how a pair is assigned.
- **Limit 1 still applies:** a re-match measures whether the command shape recurred, not whether the mistake did.
