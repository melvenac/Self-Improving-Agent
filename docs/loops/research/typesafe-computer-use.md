# Research 2: `awlevin/typesafe-computer-use`, and what it means for SIA's use of Jev

**By:** Scout (`sia-research`, `role: none`), 2026-09-26. **Model:** Claude Opus 5.5 (1M context). **Effort:** as
configured for this session; not independently measured.
**Asked by:** Aaron, directly in this session: "https://github.com/awlevin/typesafe-computer-use here is another repo to
research". **There is no written brief**, so I have assumed the question of research 1
(`docs/loops/research/jev-mcp.md`): what is it, is it sound, and should SIA use it, and where. The candidate uses are
the same: T-155, T-173, T-191 and the D-033 calibration slice.
**Source read:** `github.com/awlevin/typesafe-computer-use` at **`2fc5efa`** (2026-09-25 23:39 −0600, v0.2.0), cloned
to `~/Third-Party/typesafe-computer-use`. **Read only:** no `uv sync`, no run, no tests run, no Jev or Anthropic call,
no key.

**Labels.** **READ** means I opened the source: the repo's code and docs, the GitHub API, or SIA's record. **TOLD**
means the repo claims something I could not check, such as its measured costs or benchmark results. **INFERENCE** marks
my own reasoning.

---

## 0. The answer in three sentences

**Don't use it: SIA does not drive screens, and this is a computer-use agent. But it is the best design reference for
SIA's Jev plans I have found, better than jev-mcp.** It is a working, tested loop built on the rule SIA's plans assume
but have not yet built: *"the classifier picks, code decides facts, and the writer only writes free text"* (README,
READ). Almost every design problem the calibration slice and T-173 will hit is solved there in code. **What would
change my mind:** SIA taking on a task that needs a GUI driven, such as UI QA of one of Aaron's web projects under
T-181. Even then the Windows adapter is experimental, and this desktop is Windows 10.

---

## 1. What the repo is

| Fact | Value | Label |
|---|---|---|
| Owner | `awlevin` (Aaron Levin), a GitHub **user**. Profile company: **Vellum**. His one public org is `UW-UPL`. **Not TypeSafe.** | READ (GitHub API) |
| Official TypeSafe? | **No.** The `typesafe-ai` org has no computer-use repo (research 1's org listing). The README links TypeSafe's docs as a badge only. | READ |
| Licence | MIT | READ (`LICENSE`, `pyproject.toml`) |
| Age / activity | Created 2026-09-16; 78 commits; last push 2026-09-26 05:39Z. 72 commits by the owner, 6 outside contributors | READ (git log, GitHub API) |
| Popularity | 980 stars, 86 forks, 9 open issues/PRs | READ (GitHub API) |
| Status | "**Beta.** This is under heavy development... It drives your real mouse and keyboard." Not on PyPI (404) | READ (README, PyPI) |
| Stack | Python ≥ 3.12, `uv`, exact-pinned deps: `typesafe-sdk==0.6.0` (official), `anthropic==1.6.0`, `openai==2.54.0`, pyobjc on macOS, `uiautomation`/`pywin32`/`winocr` on Windows, optional RapidOCR | READ (`pyproject.toml`) |
| Size | ~6,800 lines of package code and docs; 427 `def test_` across `tests/` | READ (counted with `wc`/`grep`; **not run**) |

**What it does (READ, README and `docs/how-a-step-works.md`).** You type a goal in plain English (`clicker "go to
techcrunch and ... cheapest tickets" --act`) and it drives a Mac toward it. Each step:

1. **Reads the screen deterministically:** Vision OCR on a crop of the frontmost window, plus labelled controls from
   the accessibility tree.
2. **Code adds facts:** each date and how far off it is, the row of a repeated label, the focused field, the app and
   URL, and the actions already tried on this screen.
3. **Asks one TypeSafe request with three or four `Choice`s:** which kind of action, which item, which site, and which
   off-screen control.
4. **Acts deterministically, then treats the next capture as "the only witness of what it did".**
5. **A writer model** (Anthropic by default) is called only to compose free text, or when the classifier stops, to read
   the screen and either answer or hand back **one move** ("focus") or **one question for the user**. It "never picks
   an action".

## 2. Soundness and safety

**What it sends where (READ).**
- **TypeSafe** gets the goal, the OCR'd screen items, the focused field's summary, recent actions and dates
  (`decide.py` `base_state`). **All of it is screen text.**
- **The writer** (Anthropic, or any Anthropic/OpenAI-compatible endpoint) gets small packets for typing. **At the
  answer step it also gets the capture image itself** plus up to 600 lines of prior screen text
  (`how-a-step-works.md`, "The answer").
- **Issue #5 is still open** (READ, issues API): "README says no screenshot is sent, but the final answer includes
  one". The current `how-a-step-works.md` does say the capture is sent. The **README** I read no longer says either
  way.
- **Anything on screen during a run leaves the machine.** The README says to clear the terminal first, because "it is
  on screen, so its text is OCR input".

**Credentials (READ).** Passwords are "never typed", enforced two ways:
- The writer is told to decline credential fields.
- A **code-side guard**, `writer.py:188-220` `looks_credential`, matches the field label against 24 substrings
  ("password", "otp", "cvv", "token"…).

That guard is a label heuristic, not a property of the field. **PR #22 is open**: "never type into a macOS password
field", i.e. check the field's secure type. INFERENCE: a password field with an unusual or missing label is typed into
by the writer path today. Also, `"pin"` as a substring matches "shipping" and "spinner", so the guard fails *closed*
(declines to type), which is the safe direction.

**Machine-safety discipline (READ), which is strong:**
- An abort corner, checked "before every click, key, scroll ... and between typed characters".
- **Tests stay off the machine.** `tests/conftest.py` makes every real-machine call refuse, and
  `test_no_real_machine.py` asserts that each one does.
- `AGENTS.md`: "Approval covers that command once, not the kind of command from then on."

**Nothing runs at install** beyond `uv sync` of pinned packages (READ: `pyproject.toml` has no install hooks; hatchling
build). I did not audit the pinned dependencies' own install behaviour.

**Evidence quality (mixed):**
- **Cost and latency are TOLD.** The README's table ($0.0002 per decision against $0.032 for Claude Opus 5 on a bare
  screenshot, 0.13–0.38 s model latency against 5.2 s) is "measured on the same screenshot and goal, one decision
  each". That is **one screenshot**.
- **The benchmark is n = 1.** The latest commit's title says jev scored **1 on one OSWorld Chrome task** "after the
  first real runs". The OSWorld integration is days old, with no results table (READ: `docs/osworld.md` describes how
  to run, not results).
- **The README's honest caveat is the load-bearing sentence** (READ): "Every piece of reasoning the frontier model does
  for free has to be rebuilt here as deterministic state." That is TypeSafe's jaggedness list (numbers, dates,
  indirection; research 1 §2) met in practice.

## 3. Fit for SIA

**As a dependency: no, for any of the four.** It is an application, not a library. Its Jev use is `typesafe-sdk`
calls inside its own loop. SIA already has the equivalent in `harness/gate.ts` (research 1 §3).

**As a design reference: yes. Here is what transfers, each tied to the source line and the SIA task it informs.**

| Pattern in the repo (READ) | Where it applies in SIA | Why it matters (INFERENCE) |
|---|---|---|
| **"Keep the action set mutually exclusive."** "Every stall found while building this came from two options that meant the same thing. Confidence measures concentration, so overlapping options always read as doubt." | **T-173** (effort policy), **calibration** | Effort levels `low…max` are *ordered and overlapping*. As a `Choice` they will split probability between neighbours and read as low confidence for the wrong reason. Ask Jev about **mutually exclusive plan properties** (for example "mechanical edit / novel reasoning / security-relevant primitive"), or use a `Score` over an ordinal legend, and **map to an effort level in code**. |
| **Split one decision into several Choices** (kind, item, site). "Splitting the decision into three questions keeps screen noise out of the action choice." | **T-155**, **T-191** | A merge verdict should not be one Choice over the whole situation. Separate, independent questions (claims against evidence, scope against the brief, test log against assertion) keep one noisy input from diluting the others. jev-mcp's `jev_gate` does the same (research 1). |
| **Only consequential answers gate.** `Decision.confidence` is the *min* over the kind and the target answer, and the site answer is excluded "because every outcome of it is a page the next step can leave" (`decide.py`). | **T-155**, **calibration** | This decides *which* answer's confidence a threshold binds to. SIA should rule it per question: an irreversible act (merge, delete) binds, and a reversible ranking does not. That is the Loop 15 brief's "fail closed on anything destructive, open only on optional ranking", made concrete. |
| **Code computes the facts; Jev only picks.** Dates are parsed and "in 27 days" is handed over as state. Row-mates, "already tried on this screen", and URL cleanliness are all computed in code. | **all four** | For a merge gate: the test counts, exit codes, changed paths and allowlist membership are **state computed by code**, never questions for Jev. That is deterministic-first at the level of the payload, not just the gate. |
| **The run folder**: each step writes the **exact payload sent** (`step-NNN-payload.txt`) and **every probability returned** (`step-NNN-answers.json`), and any step can be **replayed offline** from its saved capture (`docs/run-folder.md`). | **calibration**, **T-155**, **T-173** | This is the calibration slice's instrument, already built. Record the full payload and the full distribution for every shadow call, with the candidate SHA. Later threshold sweeps then replay the record **without new Jev calls**, and a changed question can be re-asked against the same states. T-155's `artifacts/iterations/tNNN/` should hold exactly this. |
| **The "who did the work" meter**: `calls: classifier 14 (82%) writer 3 (18%)`, "the number the design stands on" (`calls.py`). | **T-173**, **T-155** | A one-line per-run meter for a shadow: how often Jev had a verdict, how often it was UNDEFINED, and how often it disagreed. Counted per run, not claimed. |
| **Low confidence hands off; it does not guess.** Under `--min-confidence` (0.4) the run stops. A stronger model gives **one move**, the classifier resumes, and the trips are bounded (`--handoffs 10`, three questions). "The fix belongs in the state the classifier reads, not in more hand-offs." | **T-173** | The shape of an effort escalation: low Jev confidence on a plan raises the effort level or routes to a stronger reasoning pass, never a coin-flip. The bound on trips is the part SIA would need to copy. |
| **A simulated world for the real loop**: `tests/world.py` fakes only the screen and the machine and runs the shipped `runner.run`. Its scenarios are "kept as written and marked xfail with the reason, **never weakened until it passes**". | **calibration** | Aaron's "never widen the criteria until a candidate passes", written as a test rule. A calibration set of known-good and known-bad merges, kept xfail where Jev fails, is the same shape. |
| **The test guard refuses real-machine calls**, and a test proves each refusal (`test_no_real_machine.py`). | SIA's test harness (G-044, V-069) | The same shape as SIA's network tripwire (V-069). It is a second outside example that a fail-closed guard **with a test for each refusal** is the durable form. |

**Per candidate, in short.** **T-155:** borrow the run-folder record and the per-question gating. **T-173:** borrow
mutually-exclusive properties mapped to effort in code, and the bounded hand-off. **T-191:** little here beyond
"code computes the facts": exact-match inclusion first, as the planner ordered. **Calibration:** the run folder and
offline replay are the instrument, and the xfail rule is the discipline.

## 4. Cost and operation

- **Jev price** is as in research 1 ($0.042 per Mtok input, output free; READ `models.md`). The repo's "$0.0002 per
  decision" for ~4,900 input tokens is consistent with that (4,882 × $0.042/1e6 ≈ $0.0002; INFERENCE from READ numbers).
- **Running it here** would need macOS for the supported path. **Windows is experimental** (README badge, READ), and
  it takes over the real mouse and keyboard of a desktop that the charter says is never quiet and crashed on
  2026-09-26. **OSWorld** needs a Linux host with KVM or a GCP machine (READ `docs/osworld.md`), which costs money:
  Aaron's call.
- **For SIA's reference use** it costs nothing: the lessons are in the files cited above.

## 5. Recommendation

**Do not adopt it. Do cite it as the reference design for the calibration slice and T-173, ahead of jev-mcp.** It is
the only source I read that has *run* a Jev-decides-code-acts loop against a real environment and written down what
broke. The four findings most worth carrying into a brief:
1. mutually exclusive options, because confidence is concentration;
2. the payload and the full distribution recorded per call, with offline replay;
3. only consequential answers bind a threshold;
4. facts computed into state, never asked.

**What would change my mind:** a SIA task that needs a GUI driven (UI QA for a T-181 project), on a machine that is
not this desktop, with the Windows adapter out of experimental or a Mac available. That would also need PR #22 or an
equivalent secure-field check first.

## 6. What I did not do, and what is open

- **I ran nothing:** not the tests (427 counted, not run), not the loop, and no OSWorld. Every quality claim about the
  code rests on reading, and every performance claim is TOLD.
- **I read the core** (`decide.py`, `calls.py`, the credential guard in `writer.py`, the tests' machine guard, and
  `tests/world.py`'s header) and the docs. **I did not read** `runner.py`, `perception.py`, `actions.py`, the Windows
  adapter or the browser backend line by line.
- **This had no written brief.** If the planner meant a different question (for example "could a SIA seat use this to
  test Aaron's web projects?"), §5's change-my-mind clause is the start of that answer, not the answer.
