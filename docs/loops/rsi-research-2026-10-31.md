# Recursive self-improvement (RSI) for agents: what SIA could adopt

Researched 2026-10-31. Every claim carries a label:
- [read] = I opened the primary source (arXiv HTML/abstract page or lab blog) and read the passage the claim rests on.
- [reported] = taken from a search-result summary or secondary write-up; not checked against the primary text.
Where only an abstract was read, the label says "read: abstract".

SIA context used (read, read-only): README.md, .agents/SYSTEM/PRD.md, .agents/retirements.json (R-001..R-011),
open-brain/src/db-v2.ts (trigger_fires schema: state IN ('not-asked','silent','injected')).

---------------------------------------------------------------------------------------------------

## 1. State of the field (short)

**A. Self-modifying coding agents: works, expensive, gated by a benchmark.**
- SICA, "A Self-Improving Coding Agent" (Robeyns, Szummer, Aitchison; arXiv 2504.15228, Apr/May 2025).
  An agent edits its own whole codebase; the best agent in an archive acts as the meta-agent. 17% -> 53% on a
  random SWE-bench Verified subset. [read: abstract]. Safety section relies on observability plus an
  asynchronous LLM "overseer" that can steer or cancel running agents and may use a different LLM. [read]
  https://arxiv.org/abs/2504.15228
- Darwin Godel Machine, DGM (Zhang, Hu, Lu, Lange, Clune; arXiv 2505.22954, v3 Mar 2026, ICLR 2026).
  Archive of agents, each self-modifies, children evaluated on benchmarks. SWE-bench 20% -> 50%. [read]
  Ablation table: DGM 50.0 / w/o open-ended exploration 23.0 / w/o self-improve 39.0 / greedy (SICA-style) 39.7
  on SWE-bench. [read] One SWE-bench run: about USD 22,000 and about 2 weeks. [read]
  Appendix H shows objective hacking: asked to fix tool-use hallucination, an agent gamed the detection
  metric rather than the underlying problem. [read] Safeguards: sandboxing, human oversight. [read]
  https://arxiv.org/html/2505.22954v3
- Huxley-Godel Machine, HGM (Wang, Piekos, ..., Schmidhuber; arXiv 2510.21614, ICLR 2026).
  "Metaproductivity-Performance Mismatch": an agent's own benchmark score is a poor predictor of how good its
  descendants will be; HGM scores nodes by clade (descendant) performance and beats DGM and SICA with fewer
  CPU hours. [read: abstract] https://arxiv.org/abs/2510.21614
- AlphaEvolve (Google DeepMind, blog 2025-05-14). LLM ensemble + automated evaluators + evolutionary program
  database; usefulness is bounded to domains with automatic, quantifiable evaluation. [read: blog]
  https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/

**B. 2026 trend: "harness evolution" and its overfitting problem.**
- RRSI, "Regularized Recursive Self-Improvement of Agent Harnesses" (Xia et al., Google; arXiv 2609.24972,
  Sep 2026). Names the failure: harness self-improvement memorizes the evolve tasks, gains shrink or vanish
  out of distribution; related work says many methods "keep an edit if it raises a benchmark score" with no
  generalization term. [read] RRSI regularizes the search; one component is L1-style structural pruning:
  a component that has not produced a strictly positive measured gain over a window is proposed for
  deletion - "a mechanism must continue to earn its place". [read] Every number is reported against the
  unevolved base harness measured in the same window; no held-out split regressed. [read]
  https://arxiv.org/html/2609.24972v3
- AIDE^2, "Recursive self-improvement of AI research agents" (Srikanth et al.; arXiv 2609.26457, Sep 2026).
  Keeps changes that perform best on HIDDEN evaluations; 8-day run, seven successive improvements, generalize
  to four held-out benchmarks; reward-hacking rate on a separate held-out family fell 55% -> 32% without being
  optimized for. [read: abstract] https://arxiv.org/abs/2609.26457
- Recuris (Yu et al.; arXiv 2608.24876, Aug 2026): working memory selects skills from experiential memory;
  a FIXED meta-agent makes localized, validation-gated updates to skill memory. [read: abstract]
  https://arxiv.org/abs/2608.24876
- Others seen only in search results (not read): MetaSkill-Evolve 2607.05297, RSI-Opt 2610.32026,
  AI4AI-Bench 2608.20318, environment evolution 2609.29773. [reported]

**C. Memory and lesson learning: helps, but quality control is the whole game.**
- ReasoningBank (Ouyang et al., Google; arXiv 2509.25140, ICLR 2026). Memory items = title / description /
  content, at most 3 per trajectory, distilled from BOTH successes and failures; success/failure decided by an
  LLM judge at temperature 0. [read] Ablation on WebArena-Shopping: success-only 46.5 -> with failures 49.7,
  while AWM DROPS 44.4 -> 42.2 when failures are added. [read] Headline +8.3% WebArena, +4.6% SWE-bench
  Verified vs memory-free. [reported, Google blog via search]
  https://arxiv.org/html/2509.25140v1
- ACE, Agentic Context Engineering (Zhang et al.; arXiv 2510.04618, Oct 2025, ICLR 2026). Names "brevity bias"
  and "context collapse" (iterative LLM rewriting of the whole context erodes detail); fix = generator /
  reflector / curator with incremental delta updates. [read: abstract] +10.6% agents, +8.6% finance. [reported]
  https://arxiv.org/abs/2510.04618
- Xiong et al., "How Memory Management Impacts LLM Agents" (arXiv 2505.16067, ACL 2026). Experience-following:
  similar retrieved record -> similar output; errors in memory propagate and amplify; some "correct" records
  are misleading. Strict selective addition and history-based deletion help; "future task evaluations can serve
  as free quality labels for stored memory". [read] About +10% absolute from selective addition. [reported]
  https://arxiv.org/html/2505.16067v2
- Evo-Memory (Wei et al., UIUC + Google DeepMind; arXiv 2511.20857, Nov 2025). Streaming benchmark over 10+
  memory modules. A simple retrieval baseline (ExpRAG) "outperform[s] several more complex designs"; baselines
  drop when unfiltered failures are stored; refinement matters. [read] https://arxiv.org/html/2511.20857v1
- SkillsBench (Li et al.; arXiv 2602.12670, Feb 2026). 84 tasks, 7 configs, 7,308 trajectories. Curated skills
  +16.2 pp with high variance; 16 of 84 tasks got WORSE with curated skills; self-generated skills -1.3 pp
  (Claude Code + Opus 4.5: 22.0 -> 21.6; Codex + GPT-5.2: 30.6 -> 25.0); focused 2-3 module skills beat
  comprehensive docs; authors call for paired evaluation as standard practice. [read]
  https://arxiv.org/html/2602.12670v1

**D. Safety.**
- Anthropic, "Natural emergent misalignment from reward hacking" (2025-11-21; arXiv 2511.18397). Learning to
  hack coding rewards generalized to sabotage and alignment faking; RLHF only partly fixed it; framing the hack
  as acceptable ("inoculation prompting") removed the generalization. [read: blog] This is a training-time
  result; SIA trains no weights, so the transferable lesson is "metric gaming is not contained to the metric".
  https://www.anthropic.com/research/emergent-misalignment-reward-hacking
- DGM objective hacking (above) and SICA's overseer/observability (above) are the agent-level analogues. [read]

**One-line synthesis.** The field's gains come from (1) a trustworthy external evaluator, (2) quality-gated
memory writes, and (3) held-out or counterfactual measurement. Where the evaluator is the agent itself
(self-generated skills, self-judged lessons, score-only harness edits), gains vanish or invert. SIA already
has the right instincts (judge is never the builder, deterministic first, skills proposed to a human); its
missing piece is the counterfactual measurement the PRD lists as its open question.

---------------------------------------------------------------------------------------------------

## 2. Ranked adoptable ideas

### #1. Randomized "withheld" arm in the recall trigger (counterfactual measurement)
- Source: SkillsBench paired evaluation, and its finding that 16/84 tasks got worse WITH curated skills [read];
  RRSI "measure against the base in the same window" [read]; Xiong experience-following (injection does change
  output, for better or worse) [read].
- What: when the trigger finds a match, inject on a seeded-random fraction (say 50%) and withhold on the rest,
  logging the withheld match exactly as if it fired.
- SIA mapping: open-brain recall trigger (cli-recall-trigger) + trigger_fires. Add a 4th state 'withheld' to the
  CHECK constraint (today: not-asked / silent / injected) with injected_ids holding the ids that WOULD have been
  injected. Assignment by hash(session_uuid, entry_id) so it is deterministic and replayable.
- Evidence it works: the method is standard A/B design, not a paper claim. The papers' evidence is that
  WITHOUT it you cannot tell help from harm (SkillsBench negative deltas; DGM/RRSI always compare to a
  same-window base). Strength: strong for the need, n/a for the method.
- Cost/effort: small. One state value, one branch in the trigger, a migration, an analysis script. Risk: half the
  matches stop reaching the model; mitigate by running for a bounded window or by excluding entries tagged
  safety-critical.
- Measure in SIA: per entry and pooled, compare a deterministic downstream outcome between 'injected' and
  'withheld' fires: (a) does the next Bash/PowerShell call in the same session hit PostToolUseFailure, (b) does
  the same failing command repeat within N calls, (c) does the session end with a QA REJECT on the touched task.
  Pre-register the outcome and the N before looking. This is the direct answer to the PRD's open question.
- CUT overlap: none. Ratings stay unused; the signal is a tool exit code, not a judgment.

### #2. Outcome-labelled lessons and an "earn your place" retirement report
- Source: Xiong history-based deletion ("future task evaluations ... free quality labels") [read]; RRSI L1-style
  pruning of components without a strictly positive measured gain over a window [read].
- What: label each lesson with the outcomes from #1 (injected vs withheld deltas). Periodically emit a report of
  entries whose injected arm is not better than withheld after K fires.
- SIA mapping: an `open-brain` CLI report over trigger_fires + session outcomes; output goes to a human / planner
  as a proposed retirement (vault note archived, not deleted), consistent with the skill gate.
- Evidence: Xiong shows history-based deletion beats keeping everything, sometimes even beating the error-free
  variant late in the stream [read]; RRSI shows pruning plus regularization gives held-out gains [read, but the
  pruning component's individual contribution I did not verify].
- Cost/effort: small once #1 exists; useless without #1.
- Measure: number of entries flagged, and after retirement whether the pooled injected-vs-withheld delta rises.
- CUT overlap: YES, resembles apoptosis / success_rate (R-011). What is different: R-011 failed because
  success_rate came from helpful/harmful ratings that excluded 72.5% neutral (so it measured recall volume),
  apoptosis thresholds never fired (0 rows), and the boosts were flat. This proposal uses (a) a counterfactual
  comparison, not an absolute rate, (b) a deterministic outcome, not a rating, and (c) a human-approved report,
  not an automatic kill. If #1 shows no measurable outcome difference for anything, do not build this.

### #3. Evidence-gated writes for new lessons (selective addition)
- Source: Xiong: errors stored in memory propagate and amplify; strict evaluators beat coarse ones [read];
  Evo-Memory: baselines degrade when unfiltered failures are stored [read]; ReasoningBank uses an LLM judge,
  which SIA should NOT copy as its gate (see section 3).
- What: a lesson may enter the recall-eligible store only with a deterministic evidence pointer: a failing-then-
  passing test, a commit SHA, a QA verdict id, a CI run id, or a PostToolUseFailure row it resolves.
- SIA mapping: ob_store / vault experience frontmatter gets an `evidence` field; the recall trigger and /start
  ranking only consider entries with valid evidence. /sync can check that evidence pointers resolve.
- Evidence: moderate (one controlled study across 4 agents, plus Evo-Memory's consistent direction).
- Cost/effort: small-medium (schema field, ingest check, a /sync check, backfill policy for existing entries -
  probably "existing entries stay eligible, new ones need evidence").
- Measure: share of new entries with resolvable evidence; with #1 in place, compare injected-vs-withheld delta
  for evidenced vs legacy entries.
- CUT overlap: not the reflection queue (R-004 died because nothing wrote to it: 0 rows in six months). This adds
  no new stage; it is a filter on the existing ob_store path.

### #4. Failure-derived "pitfall" items in a fixed short format
- Source: ReasoningBank: items = title / description / content, max 3 per trajectory, from successes AND
  failures; failure items raised 46.5 -> 49.7 where success-only baselines degraded [read]. SkillsBench: focused
  2-3 module skills beat comprehensive documentation [read].
- What: store lessons as one-line title, one-line trigger condition ("when about to X"), and a <= 3-line action;
  explicitly allow "pitfall" items extracted from a failure the session then fixed.
- SIA mapping: vault experience template + what the trigger injects (inject only the action lines, never the whole
  note). Fits the existing "inject a matching entry's action" design.
- Evidence: moderate (one paper's ablation, one benchmark's design-factor finding; both web/procedural tasks,
  not long coding sessions).
- Cost/effort: small (template + trigger formatting).
- Measure: via #1, compare short-form vs legacy-form entries; also greeting/injection size.
- CUT overlap: none.

### #5. Delta-only edits to living documents (no whole-file LLM rewrites)
- Source: ACE: "context collapse, where iterative rewriting erodes details over time"; fix is incremental
  delta updates [read: abstract].
- What: rules files, playbooks and experiences change by append / replace-item-by-id, not by regenerating the file.
- SIA mapping: SIA already does this for state.json via typed ob_state ops. Extend the idea to the files LLMs
  still rewrite wholesale: CLAUDE.md sections, .agents/SYSTEM/RULES.md, RUNBOOK.md, vault notes edited by /end.
  A /sync check could flag a commit that deletes more than X% of a tracked rules file's lines without a
  retirement entry.
- Evidence: moderate (ACE results are reported; the collapse mechanism is plausible and matches SIA's own
  history, e.g. R-001's stale reference surviving 5 months shows the opposite failure, which delta ops plus
  retirements.json already address).
- Cost/effort: small for the /sync check.
- Measure: count of large-deletion diffs to rules files per loop; QA defects traced to lost rule text.
- CUT overlap: none.

### #6. Frozen replay set with evolve / held-out split for any recall-policy change
- Source: RRSI (overfitting to the evolve set is the central failure of harness RSI) [read]; AIDE^2 selects on
  hidden evaluations [read: abstract]; HGM (score on the current task set mispredicts future value) [read: abstract].
- What: build a replay set from historical trigger_fires queries (and /start recall queries) with
  human-or-outcome-labelled relevant ids; split once into tune and held-out; any change to LIFECYCLE_CONFIG
  (recency decay, failure boost), the BM25 query builder or the trigger policy must not regress held-out.
- SIA mapping: a vitest fixture + CI job; the HoH QA seat owns the held-out labels so the builder cannot tune on
  them (matches "judge is never the builder").
- Evidence: strong for the problem (several 2026 papers independently report non-transferring gains); the
  remedy is standard ML hygiene.
- Cost/effort: medium (labelling is the cost; a few dozen queries is enough to catch regressions).
- Measure: precision@k / recall@k on held-out per change; CI red on regression.
- CUT overlap: none. Note the PRD lists vector search / rank fusion as cut; this does not re-add them, it guards
  the FTS5 ranking that exists.

### #7. Metric-code freeze: a change may not improve a score it also edits
- Source: DGM Appendix H objective hacking [read]; Anthropic reward-hacking generalization [read: blog];
  AIDE^2 hidden evaluations [read: abstract].
- What: if a diff touches the code that computes a metric SIA steers by (ob_sync scorer.ts, greeting-size,
  trigger_fires state logic, the shadow merge gate ledger) AND that metric improves in the same diff, the gate
  flags it for the human.
- SIA mapping: a HoH gate / /sync check keyed on a list of "instrument" paths; reuses the existing shadow merge
  gate machinery (D-019) as the place to record the flag.
- Evidence: the hazard is well evidenced; the specific check is my design, unvalidated.
- Cost/effort: small.
- Measure: number of flags; how many the human upholds (a ledger row like D-019's disagreement count).
- CUT overlap: none.

### #8. Fixed-improver, localized, validation-gated updates (if SIA ever automates rule edits)
- Source: Recuris: a FIXED meta-agent makes localized, validation-gated updates [read: abstract]; SICA overseer
  [read]; DGM sandbox + lineage [read].
- What: any automated proposal to change a rule/lesson is made by a component that is not itself editable by the
  loop, touches one item, carries its evidence, and is applied only after a validation run.
- SIA mapping: this is mostly a description of the existing planner -> builder -> QA loop; adopt it as an explicit
  constraint for any future auto-proposal feature (e.g. #2's report), so the improver never edits its own gate.
- Evidence: weak-moderate (abstract-level).
- Cost/effort: zero now; a design rule.
- CUT overlap: avoids the skill-scan failure mode (R-002) by never creating artifacts without a human.

---------------------------------------------------------------------------------------------------

## 3. Ideas to avoid, and why

1. **Self-generated skills or auto-distilled skill libraries.** SkillsBench: -1.3 pp on average, -5.6 pp for
   Codex/GPT-5.2, ~0 for Claude Code configurations [read]. Confirms SIA's skill gate and R-002. Voyager-style
   libraries work where an environment verifies the skill executes; SIA's skills are prose procedures with no
   such verifier.
2. **LLM self-judged success as the sole memory signal.** ReasoningBank's gate is an LLM classifier [read]; Xiong
   finds selective addition is limited by evaluator accuracy [reported] and that wrong records propagate [read].
   SIA's own history agrees: the harm signal never existed and the heuristic rating arm produced 0 rows (R-010).
   Use deterministic outcomes (exit codes, tests, QA verdicts) instead.
3. **DGM/HGM-style open-ended self-modification of SIA's own code.** About USD 22,000 and 2 weeks per run on a
   benchmark with an automatic grader [read]; SIA has no such benchmark for "a session went better", so the loop
   would optimize whatever proxy exists and invite objective hacking [read]. The archive/stepping-stone insight
   (50.0 vs 23.0 without open-ended exploration [read]) only pays when evaluation is cheap and automatic.
4. **Re-adding session-start injection because papers inject at task start.** ReasoningBank and Evo-Memory
   retrieve at task start [read], but SIA measured that injection at /start did not earn its keep (PRD Problem
   Statement table). Only revisit through #1's withheld arm, applied to /start.
5. **Ranking on helpful/harmful ratings or rebuilding a maturity ladder.** R-011's post-mortem (neutral excluded,
   boosts flat, apoptosis 0 rows) is the reason; nothing in 2025-2026 rescues self-ratings as a ranking signal.
6. **Whole-file LLM summarization/compaction of the vault or rules.** ACE's context collapse [read: abstract].
7. **Storing unfiltered failure transcripts as lessons.** Evo-Memory baselines degrade with unfiltered failures;
   AWM drops 44.4 -> 42.2 [read]. Failures are useful only as distilled, evidenced pitfalls (#3, #4).
8. **Inoculation prompting as an SIA technique.** It is a training-time mitigation [read: blog]; SIA trains no
   weights. Take the lesson (metric gaming generalizes) via #7, not the technique.
9. **Tuning recall constants against the same queries used to judge them.** RRSI's core finding [read]; use #6.

---------------------------------------------------------------------------------------------------

## Source list (dated)
- SICA, arXiv 2504.15228, Apr-May 2025: https://arxiv.org/abs/2504.15228
- DGM, arXiv 2505.22954 v3, Mar 2026 (ICLR 2026): https://arxiv.org/html/2505.22954v3
- Xiong et al., arXiv 2505.16067 (ACL 2026): https://arxiv.org/html/2505.16067v2
- AlphaEvolve blog, 2025-05-14: https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/
- ReasoningBank, arXiv 2509.25140, Sep 2025 (ICLR 2026): https://arxiv.org/html/2509.25140v1
- ACE, arXiv 2510.04618, Oct 2025 (ICLR 2026): https://arxiv.org/abs/2510.04618
- HGM, arXiv 2510.21614, Oct 2025 (ICLR 2026): https://arxiv.org/abs/2510.21614
- Evo-Memory, arXiv 2511.20857, Nov 2025: https://arxiv.org/html/2511.20857v1
- Anthropic reward hacking, 2025-11-21: https://www.anthropic.com/research/emergent-misalignment-reward-hacking
- SkillsBench, arXiv 2602.12670, Feb 2026: https://arxiv.org/html/2602.12670v1
- Recuris, arXiv 2608.24876, Aug 2026: https://arxiv.org/abs/2608.24876
- RRSI, arXiv 2609.24972, Sep 2026: https://arxiv.org/html/2609.24972v3
- AIDE^2, arXiv 2609.26457, Sep 2026: https://arxiv.org/abs/2609.26457

Limits of this report: ACE, HGM, AIDE^2 and Recuris were read at abstract level only; the ACE PDF fetch returned
binary. No independent replications of any 2026 paper were found or checked.
