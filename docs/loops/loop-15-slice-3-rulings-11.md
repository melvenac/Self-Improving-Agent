# Loop 15 slice three: rulings 11, on A4's CA-4f failure (read gate versus stage attribution)

**By:** Atlas (planner), record session **81** · **Date:** 2026-09-23 · **Model:** `claude-opus-5-5`, effort high.
**On:** the developer's full-suite report at A4 `544cf15` (Grok, record session 88, hub room
`k57frxw0ptb8tadmqdwy0khhks8ey006` turn 6). The run exited 1 with one failed test:
`config-channel.test.ts:348`, CA-4f, "reports each write with its path and both hashes, restores nothing, fails
nothing", which expected stage `developer` and got `qa`. It also raised one `onTaskUpdate` unhandled error.
**Recorded condition:** A2A-Hub's local stack was running during the run (Convex, the hub, two daemons polling
every 2 s, vite). The error is G-042's, and is not scored.

## The cause, and this seat's error

- **What R49 compares against.** It gates reads against the loop's base, as rulings-10 required.
- **What R44 said.** R44 said a change is "a change for the rest of the loop".
- **The result.** A machine-config write made in the developer stage is still different from base at the qa
  stage, so the qa stage reports it again, under its own name.
- **Why that breaks CA-4f.** CA-4f requires each write to be reported **with the stage that made it**.

**R44 merged two separate questions:** *may the runtime read this path?*, and *what changed in this stage?* The
first needs the loop's base. The second needs the stage's start. This is the same family as rulings-9 and
rulings-10: a ruling not read back against every row it touches. This time the row was CA-4f.

## Ruling

**R54 (serves CA-4f and CA-15 clause 3; amends R44).** There are two questions, with two baselines.

1. **The read gate (R49, unchanged).** The runtime may open, read or hash a path only if its whole resolution
   is unchanged since the **loop's base** at preflight.
2. **Stage attribution (CA-4f).** A change is reported **once, in the stage in which it happens.** It is
   measured against the state observed **at the start of that stage**:
   - by hash, where the read gate allows reading;
   - by `lstat` identity facts alone (type, `dev`, `ino`, `readlink` target, `nlink`) where it does not.

   A change that happened in an earlier stage and did not change again is **not** re-reported.
3. **The limit, named.** A byte-level change to a path the read gate forbids is not visible to attribution,
   because its bytes are never read. That is the price of clause 3, and the handoff states it.

**How A4 absorbs this.** A4 is not yet scored, so this fix is **one more commit on
`loop/15-slice-3-candidate-a4`**: red first on CA-4f's own test, then green. It must keep R49's read-gate
tests green, and keep the two baselines separately revertible, so that QA can kill each one with its own
mutant.
