# Loop 12 — C2 boundary report: extend the checkable set

**Commits:** `9be93f5` (check, red) → `ccb5807` (repair, green). Branch `loop/12-deletion`, worktree.
**Tests:** 594 (588 + 6). **`sync --check`:** 23 passed, 0 issues, 3 pre-existing warnings.

---

## What shipped

**`command-names`** — resolves every `` `/name` `` in the instruction surface against the command
files that actually exist, across the same five mirrors `command-tool-names` reads. Same mechanism,
second referent.

**It was seen to fail on a real defect, not a scratch input**, per the Planner's ruling. At `9be93f5`
the repo is red and reproducible:

```
command-names: instructions name commands that do not exist:
  README.md: /skill-scan;
  .agents/skills/self-improving-agent-gotchas/SKILL.md: /recall
```

Two findings, both genuine, no false positives. `ccb5807` repairs them and the head is green:
**62 command references across 35 instruction files, 0 issues.**

**What it found is worse than the brief knew.** `/skill-scan` is the headline — the front door kept
it in the live Commands table for two loops after the cut, while `e0b2fc8` repaired the
*distributable* copy (`grep -c skill-scan project-template/README.md` → 0). **The repair reached what
ships and missed what runs**, exactly inverting Loop 11's finding that only the distributable was
tracked.

**`/recall` is the older one.** Cut in **v0.2.0**, when the session lifecycle was unified. The
reference survived to **v0.36.0** — thirty-four minor versions, through eleven loops and an audit of
77 instruction files that was looking for precisely this. Nobody found it by reading. The check
found it in one run.

## What did NOT ship, and why that is the result

**C2 was ordered to lead with file and command paths. Paths were built first and are not shipped.**

Over the same surface a path check produced **six distinct findings, of which one was real** —
`sync.md` naming `docs/PRD.md`, which lives at `.agents/SYSTEM/PRD.md`. The other five were prose
naming a non-existent path **correctly**:

| form | instance |
|---|---|
| **obituary** | `test.md` citing `.agents/workflows/test.md` *inside the sentence explaining that it exists in no mirror* |
| **example** | `` e.g. `src/components/BookingDrawer.tsx` `` |
| **conditional** | `` if `.agents/META/` exists `` → `META/SUMMARY.md` |

**Separating those three from a dangling reference means parsing intent, which this loop is forbidden
to attempt.** 1-in-6 precision fails the ship gate, and the gate is right: a check that cries wolf
gets switched off, and then it occupies the slot a real check would have had.

### The first attempt hid the defects instead of reporting them

The gate I tried first was *"only flag a path whose parent directory exists"* — plausible, cheap, and
it dropped the noise from 28 to 0. **It also suppressed `.agents/workflows/test.md` and
`.agents/skills/playwright-tester/SKILL.md` — the two paths Loop 11 explicitly names as what a path
check would have caught.**

**A gate that hides the defect class the check exists to find is worse than no check**, and the only
reason it was caught is that the suppressed set was *listed* rather than trusted as a smaller number.
Rule 9 generalised: for a filter that removes things, look at what it removed.

### The generalisation, and it is C3's

**The difference is a registry.**

| referent | registry | checkable |
|---|---|---|
| tool names | `server.ts` registration sites | yes — shipped Loop 11 |
| command names | the command directories | **yes — shipped here** |
| file paths | none | **no** |

**The filesystem is not a registry of what prose may mention.** A registry is a closed list of what
exists *and is allowed to be named*; the filesystem answers only the first half. **Extend this
mechanism to a referent only where a registry exists, and report why where one does not.**

That is also the honest amendment to C1's ceiling. C1 said ~58% of the worked example was
machine-checkable. **That number counted file paths as reachable and they are not** — not without the
retirement record C3 builds. The reachable set is the referents with registries.

## The check caught its own repair

The first `/recall` fix wrote the obituary in place: *"a `` `/recall` `` command was named here too;
it was cut in v0.2.0."* **`command-names` fired on it, correctly.** A backticked `/recall` inside a
sentence explaining that `/recall` is gone is textually identical to a dangling reference.

**C1.3 arriving inside C2, on the commit that ships it.** The obituary was **dropped from the prose
rather than reworded to dodge the check** — a retirement's record belongs in the retirement record,
not smuggled into a skill file where the next check has to special-case it.

**This is the concrete argument for `allowed_referrers` captured at retirement time.** Not a design
preference: a live instance, found by the mechanism, on itself, within an hour of the ruling.

## `BUILTINS`

Two entries, `compact` and `init` — the host's own commands that this repo's prose actually names.
**It grows by explicit act and never by inference**, the same shape the Planner chose for
`allowed_referrers`, and the failure message names `BUILTINS` so the reader knows the repair is a
decision someone makes rather than one the check should have drawn. Listing every command the host
ships would be inventing a registry this project does not own.

## Reported, not repaired

- **`open-brain/package-lock.json` is stale against `package.json`**, which declares an
  `open-brain-server` bin the lock does not carry. `npm install` regenerates it. Pre-existing on
  master, out of C2's scope, left as found rather than folded into a commit about instructions.
- **`README.md:159`'s "(38 checks)" is corrected to 26 and nothing keeps it correct.** A count in
  prose has no registry to resolve against — the same class C2 just declined to check. Named so the
  next reader knows it is unguarded rather than guarded.
- **For Aaron, phrased as a question and not a recommendation:** `enableHeuristicRatings` is gated
  off for a reason that has been cut. Loop 10 removed `success_rate` and the maturity lifecycle,
  which is what the gate protected; D-004 is recommended and not adopted. **Nobody has ruled whether
  the gate should stay.**

## What C3 inherits

1. **Build the record around registries.** A retirement names a thing; the record makes that name
   resolvable again as *retired*. That is the registry file paths never had.
2. **`allowed_referrers` is not optional and now has an instance**, not an argument.
3. **Prefer making a missed copy fail over reporting that it exists** — the Planner's principle, and
   `project.version` is the working precedent: a file still carrying it does not parse.
4. **When a filter suppresses, list what it suppressed.** The parent-exists gate would have shipped
   looking clean.
