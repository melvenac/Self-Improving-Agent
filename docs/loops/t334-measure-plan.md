# T-334 measure plan: recall trigger arms, fixed before the data is read

Written s177, 11-05, three days into the arm (ON at 0.5 since 6c98303b; first withheld fire 2026-11-02T11:04:52Z).
**Nothing here compares the arms' outcomes.** It fixes how they will be compared, so the rule cannot be fitted to the
answer. What was already seen is listed under "Seen before this plan".

## Do not read raw fire counts

Fires are not the unit. An injected entry joins `already` and stops producing fires for that session; a withheld entry
stays eligible and fires again on every match (`open-brain/src/trigger/run.ts`). On 11-05: **42 injected fires against
184 withheld fires, from 42 and 58 draws.** A fire-count comparison shows a large "effect" of injection that is only this
dedup. **Any dashboard count must be per draw, not per fire** (T-334's item 1, Prism).

## Instrument check (live store, read-only, 11-05)

| Check | Result |
|---|---|
| Draw reproduces the recorded arm at 0.5 (`withholdDraw`) | 100/100 |
| Split by draw | 42 injected, 58 withheld: consistent with 0.5 |
| A session-entry pair in both arms | 0 of 100 |
| Draws with more than one id (`max_injected` is 1) | 0 |
| Arm sessions with a transcript on the desktop | 24 of 25 |
| Draws by path, both arms (11-06, corrected) | injected 45: match 37, path 6, element 2; withheld 62: match 51, path 10, element 1 |
| A later match visible after injection | yes: the `match:` token is built before the dedup, so a silent fire carries it |

`trigger_fires.command` holds only the first word (longest 10 chars, 454 of them `?`), so a "same pattern in a later
command" measure cannot be read from it. The tokens below replace it. No code change is needed.

## The measure

- **Unit:** one draw, a (session, entry) pair, taken at its first exposure. Sessions from the first withheld fire on.
- **Arm:** injected when the first-exposure row is `state='injected'`; withheld when its query has `withheld:<id>`.
- **Primary outcome, binary per pair:** does any LATER fire in the same session carry `match:` or `error-match:` naming
  that entry? Read the token only. Ignore `state` and the `withheld:` token, because using either breaks the symmetry
  above. The token comes from the prefilter in both arms, so it is equally loose in both.
- **Primary comparison:** injected share minus withheld share, with a session-cluster bootstrap 95% CI; repeat with
  entry 299 removed, since it has dominated injections.
- **Secondary:** `error-match:` alone (closest to "the failure came back", likely sparse); `path-match:` alone.
- **Excluded:** element-path pairs (no id in the query, so a repeat after injection cannot be seen). Report their count.
  Replaying the matcher over transcripts could recover them; not planned.

## When to read, and what a result allows

- **First reading on or after 2026-11-16, and only with at least 200 draws in the primary classes (`match:` or `error-match:`; 88 on 11-06).** Otherwise wait to 11-23 and read what
  exists, saying the count is short.
- One reading of the primary. A second look at later data is reported as a second look.
- CI excludes 0: report an association in this direction. CI includes 0: "no detectable difference at this n", not "no
  effect". **Either way nothing changes on the result alone:** turning the arm off or changing the fraction is a separate ruling.

## Limits to carry into the reading

1. **A re-match is not a repeated mistake.** A key matches a command shape. For some lessons that shape is the mistake; for
   others it is routine and the lesson only asks for care. The measure is "the pattern recurred", which is why `error-match:`
   is reported separately. A lower rate under injection could also come from work ending, not from the lesson.
2. **The arms interfere.** With `max_injected` 1, a withheld entry occupies the slot on each matching command, while an
   injected one is deduped and frees it. So a lower-ranked entry reaches a draw less often beside a withheld one. Read
   from the code, not measured. It changes which pairs exist, not how any pair is assigned.
3. **Fires cluster.** A few sessions and entries carry much of the volume, hence the session-cluster interval.

## Seen before this plan

The fire totals and draw split above; withheld fires per pair (median 2, max 28, 35 of 58 pairs above 1); top ids per arm;
one example of a later `match:` after an injection. The same-rule recurrence share for the injected arm was NOT computed, so
the comparison itself has not been seen. The withheld figures are a partial look at one arm and are declared for that reason.

## Correction, 11-06

The first version said keyed 34, element 9, and the T-334 note said keyed draws were about 80%. Both were wrong: the classifier's
regex lost its backslashes in a shell heredoc, and the figure covered one arm only. Recounted with plain token parsing and a
self-test: 104 of 107 draws are keyed. The read gate now names the primary classes instead of "keyed". No outcome was computed
for either version.
