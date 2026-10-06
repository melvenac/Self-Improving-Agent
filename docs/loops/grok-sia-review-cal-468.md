# grok-sia-review calibration 1: PR #468 (HUBROOM-GUARD), scored against QA 283

**Planner s163, 2026-10-06.** This file holds an advisory review by grok-sia-review (D-125), committed **verbatim**
below, and the planner's score against QA 283's findings on the same PR (`docs/loops/s162d-qa-report.md` at 29a398b3,
K1 and K2). The review is not QA evidence.

**Job:** `REVIEW JOB: loop/hubroom-guard@25ba1d4cc84fb97fefe77d4199a010333031b66a`, posted by atlas as turn 1 of room
`k57c639j4wkyp3y3vhfxxytn1s8fsdx6`. The diff was `5309fc2c^1..25ba1d4c`, with the reviewer told not to read QA 283, #472
or the PR comments. Reply: turns 2-4, `REVIEW 1/3` to `3/3`, about 15 minutes.

## Score

| QA 283 finding | grok-sia-review | match |
|---|---|---|
| K1(a) negation is sentence-wide, `do not` added | F2 (two planted positives that pass) | found |
| K1(b) the verb regex misses inflections and synonyms | F4 | found |
| K1(c) hub term and verb must share a sentence | F3(a), F3(c) | found |
| K2 no check has its own positive; any one check deletable | F1 (mutations run) | found |
| K2 dead allowlist entries (exit-2 phrase can't survive the splitter) | F7 | found |

**Beyond QA 283:**
- F3(b): the splitter cuts at the `.` in `hub-talk.mjs`, so the talk line's own spelling evades the check.
- F5: false positives on `Don't wait …` and on any exit-3 backoff wording other than the exact phrase.
- F6: nothing pins the removed seat-file `wait` key, and a missed section lookup returns `""` vacuously.

**Planner verification (first-hand):** the planner planted each of the reviewer's sentences after the hub-room.mdc
anchor and ran `hubRoomGuardViolations` at 25ba1d4c. Every positive was MISSED, and both F5 sentences were flagged,
just as the review claims. Run against #472 at 7248d9a3, the same set gives F2's two sentences caught and F5b ok, but
F3(a-c) and F4(a-b) still missed and F5a still a false positive. #472 went back to cursor-infra as r3 (infra room turn 68).

**Calibration result:** 5 of 5 QA 283 findings recovered blind, plus 3 not in QA's report, with no false finding
in the planner's check. Severities run higher than QA's (major vs Medium/Low).

## The review, verbatim

```
--- grok-sia-review ---
REVIEW 1/3 25ba1d4
Scope: git diff 5309fc2c^1 25ba1d4c (3 files: open-brain/src/pipelines/sync/hub-room-guard.ts new, open-brain/tests/pipelines/sync/hub-talk-exit-codes.test.ts, .agents/SYSTEM/hub-partner-seats.json). Tree read only at 25ba1d4c; ran the test file (11/11 pass) plus throwaway probes/mutations in a scratch clone (deleted). Findings: 0 blocking, 3 major, 3 minor, 1 nit.

F1 [major] open-brain/tests/pipelines/sync/hub-talk-exit-codes.test.ts:99 at 25ba1d4
claim: The R1-R4 test only asserts "some violation", and every rewording trips two or more independent checks, so any single check in the guard can be deleted with the suite staying green. The headline sentence-level check is pinned by nothing.
evidence: L99 `expect(hubRoomGuardViolations(plantMdc(mdc, line)), `${id} mdc`).not.toEqual([]);` / L100 same `.not.toEqual([])` for start. R1/R2/R4 contain `--wait` (count check, guard L78) and R3 has "`wait` suffix" plus "keep listening ... talk line".
scenario: Mutations run at 25ba1d4: deleting guard L92-94 (the hub-invocation+verb check) gives 11/11 pass. Deleting the --wait count check L78-82 gives 11/11 pass. Deleting the count check and the seat-file check L85-87 together still gives 11/11. Deleting the allowlist call on L93 also gives 11/11. Only removing several checks at once fails a test. Fix: assert the specific violation per rewording, and add one rewording per check that only that check catches, e.g. "keep listening on hub-talk for the next atlas turn" with no --wait.

F2 [major] open-brain/src/pipelines/sync/hub-room-guard.ts:51 at 25ba1d4
claim: Negation exempts the whole sentence if "never", "do not" or "does not" appears anywhere in it, even when it doesn't modify the wait verb. A positive wait instruction with any negated clause gets through.
evidence: L51 `return /\bnever\b/i.test(sentence) || /\bdoes not\b/i.test(sentence) || /\bdo not\b/i.test(sentence);` and L93 `if (sentenceIsAllowlisted(sentence) || sentenceIsNegated(sentence)) continue;`
scenario: Planted after the mdc anchor ("Post when the work is done, not a bare acknowledgement."), these both return [] (verified): "Keep polling hub-talk until atlas replies, and do not end the turn before then." and "Keep listening on the talk line and never end the turn before atlas answers." Both tell a waker seat to block in-run, which is the failure this guard exists to stop.
--- grok-sia-review ---
REVIEW 2/3 25ba1d4
F3 [major] open-brain/src/pipelines/sync/hub-room-guard.ts:30 at 25ba1d4
claim: The verb check fires only when a hub-invocation token and a wait verb land in the same fragment. The splitter cuts on every "." outside backticks, including the "." in "hub-talk.mjs" and after a period, so splitting the instruction across sentences, or naming the script by file name, gets past it.
evidence: L30 `if (!inTick && (ch === "\n" || ch === ";" || ch === ".")) {`; L15 `const HUB_INVOKE_RE = /hub-talk|talk line|`talk`/i;`; L92 `if (!HUB_INVOKE_RE.test(sentence) || !FORBIDDEN_VERB_RE.test(sentence)) continue;`. The seat file's own talk line names the script: .agents/SYSTEM/hub-partner-seats.json:4 `"talk": "HUB_URL={hub_url} node <A2A-Hub>/scripts/hub-talk.mjs --as {hub_name} --session {room}",`
scenario: All of these return [] when planted in hub-room.mdc (verified): (a) "After posting, run the talk line again. Wait for the next atlas turn and act on it before you end the turn." (b) "Run node scripts/hub-talk.mjs --as you --session room and wait for the reply." The split gives "...scripts/hub-talk" and "mjs ... and wait for the reply". (c) "Then keep listening for atlas's next turn before you end the turn." This one names no hub token at all. (a) is R2 without the literal --wait.

F4 [minor] open-brain/src/pipelines/sync/hub-room-guard.ts:16 at 25ba1d4
claim: The verb list misses inflections and the actual busy-wait mechanism, so it catches only the listed words.
evidence: L16 `const FORBIDDEN_VERB_RE = /\b(wait(?:ing|s)?|listen(?:ing)?|block(?:ing)?|poll(?:ing)?)\b/i;`. There is no "waited", "listens", "blocks", "polls", "stay", "until", or repeated `--inbox`.
scenario: Both return [] (verified): "After posting, run hub-talk with `--inbox` again until the next atlas turn arrives, then handle it in this run." (an in-run poll loop with no forbidden word) and "Once hub-talk has waited for atlas, act on its reply."

F5 [minor] open-brain/src/pipelines/sync/hub-room-guard.ts:51 at 25ba1d4
claim: False positives. The negation list leaves out contractions and other phrasings, and any wait advice that differs from the one exact exit-3 phrase is flagged.
evidence: L51 (above) matches only never / does not / do not. L46 `if (sentence.includes(EXIT3_WAIT_PHRASE)) return true;` with L10 `const EXIT3_WAIT_PHRASE = "wait `retry-after` seconds";`
scenario: Both are flagged (verified): "Don't wait on hub-talk after you post." (a correct prohibition) and "If hub-talk is throttled, wait 5 seconds and retry." (legitimate exit-3 backoff). An editor tightening the rule text gets a red CI for correct wording.
--- grok-sia-review ---
REVIEW 3/3 25ba1d4
F6 [minor] open-brain/tests/pipelines/sync/hub-talk-exit-codes.test.ts:80 at 25ba1d4
claim: The guard scans only the two mdc copies and start.md's "### Hub room" section. The seat file this PR edits is not scanned, nothing pins that its removed "wait" key stays gone, and a section lookup that misses returns "" (which passes the guard vacuously).
evidence: test L80 `const guardTargets: { label: string; text: () => string }[] = [` lists only hub-room.mdc x2 and `hubRoomSectionFromStart(read("project-template/.cursor/commands/start.md"))`; guard L58 `if (at < 0) return "";`; the diff removes `"wait": "--wait --wait-timeout 3500",` from hub-partner-seats.json, and no test asserts its absence.
scenario: (1) Someone restores the seat file's `"wait": "--wait --wait-timeout 3500"` (the seats validator at hub-seats.ts reads talk/seats/readers only), or adds a hub-talk wait sentence under "### 6. Present the briefing" in start.md. The suite stays green. (2) In the tracked-copies test (L89-93) on its own, a renamed heading makes the start.md target vacuous. Other tests (L74, L127) assert the heading exists today, so this is latent.

F7 [nit] open-brain/src/pipelines/sync/hub-room-guard.ts:44 at 25ba1d4
claim: The allowlist is dead code. EXIT2_WAIT_PHRASE contains ";" and ".", so no fragment from the splitter can ever contain the whole phrase. The other two entries are already covered by "never", or sit in fragments with no hub token.
evidence: L7 `"Exit 2 comes only from --wait, which a seat with a waker does not run; if you see it, end the turn.";` L44 `if (sentence.includes(EXIT2_WAIT_PHRASE)) return true;`. The splitter returns ["Exit 2 comes only from --wait, which a seat with a waker does not run","if you see it, end the turn"] (verified).
scenario: Removing `sentenceIsAllowlisted(sentence) ||` from L93 leaves the suite 11/11 green. The exit-2 sentence actually passes because of "does not" (F2's broad negation), not because of the allowlist the comment describes.

looked: guard sentence splitter / allowlist / negation (hub-room-guard.ts L18-52) — F2, F3, F7
looked: verb + hub-invocation regexes (L12-16, L84-95) — F3, F4, F5
looked: --wait count vs EXIT2 phrase check (L68-82) — found nothing (robust: each EXIT2 phrase carries exactly one --wait, `--wait\b` also counts --wait-timeout)
looked: hubRoomSectionFromStart (L55-62) — F6
looked: tests: R1-R4 plants, tracked-copies pass, mutation survival — F1, F6
looked: hub-partner-seats.json "wait" key removal: consumers in open-brain/src, .agents/roles, project-template (none read it) — found nothing beyond F6
looked: current tracked copies (both hub-room.mdc identical, start.md Hub room L105-112) pass guard and say turn-end correctly — found nothing
time: ~15 min
```
