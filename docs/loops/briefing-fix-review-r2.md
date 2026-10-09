# BRIEFING-FIX re-review r2+r3 (grok-sia-review), verbatim

Room k57c639j4wkyp3y3vhfxxytn1s8fsdx6, job turn 46 (atlas); replies REVIEW 1/2 and 2/2. Committed verbatim by Atlas (s165) per D-127. Delta reviewed: 19cb1e5f..3ded135d (PR #545). Planner ruling: ACCEPT-level (0 blocking, 0 major); F1-F4 go to a follow-up task, not a round.

```text
--- grok-sia-review ---
REVIEW 1/2 3ded135
Blind re-review of PR #545 delta 19cb1e5f..3ded135d (4 commits: r2 tests red, r2 fix, r3 test red, r3 vtag). Linux box, token-free scratch clone, Node v22.23.3 (`node --version`). At the head: briefing-fix, briefing-fix-sync, briefing-fix-install and record-source tests 4 files 41/41 pass; `npx tsc --noEmit` EXIT=0; `npm run build` EXIT=0. I did not re-run the full 14-file block (the planner reported it as 177/177).

FINDINGS
F1 [minor] open-brain/src/pipelines/session-start/fleet.ts:181 at 3ded135
claim: When the cap loop drops to shown === 0, the budget line says "seats none +K more". That contradicts itself: there are seats, they just don't fit.
evidence: `const namePart = names.length > 0 ? names.join(", ") : "none";` (181), `budget = `${budgetCore}${namePart}${more}${suffix}`;` (182), `if (budget.length <= FLEET_LINE_CHARS || shown === 0) break;` (183). On the box, a 190-char coordinator name with 2 matching seats printed `FLEET: coordinator c×190 · hub ? · dashboard ? · seats none +2 more (verified ?)` (265 chars).
scenario: This is rare, since it needs a long core. When it happens, the reader is told there are no seats. Fix: use "none" only when allNames.length === 0. Otherwise print "+K more" alone, or the first name truncated.

F2 [minor] open-brain/src/pipelines/session-start/fleet.ts:72 at 3ded135
claim: fleetProjectKey dereferences each projects[] entry without a guard, so a null or non-object entry throws. describeFleet's catch then makes the WHOLE fleet "unavailable", so a single bad projects entry hides every seat. R2-2 guards seats, hub and dashboard but leaves projects out.
evidence: `for (const p of fleet.projects) {` / `if (repoName !== null && typeof p.repo === "string" && ...` (72-73). The box run `fleetProjectKey(R,"x",{projects:[null]})` gave `THROWS: Cannot read properties of null (reading 'repo')`.
scenario: In a half-edited fleet.json with `"projects":[null, {...}]`, every seat's briefing shows FLEET: unavailable (invalid shape: Cannot read properties of null ...). It is not fatal, but it is the same class of bug as r1 F2. Fix: `if (!p || typeof p !== "object") continue;` in both loops.

F3 [minor] open-brain/tests/pipelines/session-start/briefing-fix.test.ts:420 at 3ded135
claim: Mutant 9 (remove describeFleet's try/catch, fleet.ts:197/214) stays GREEN. The shape guards make the catch unreachable for all four BF-F7 bodies, so BF-F7 cannot detect it. BF-F10's null case is also green under M12; only its seat-without-project case goes red.
evidence: Q4 M9 below: `Tests  20 passed (20)`. BF-F7 cases: "null", "[]", '{"seats":[{"name":"a"}]}', '{"seats":"x"}'. All four are handled before the catch, by parseFleetRoot and normalizedSeats.
scenario: A later refactor that drops the catch passes CI. F2's `projects:[null]` is exactly the kind of input that reaches the catch. Fix: add a BF-F7 case such as `{"projects":[null]}` (or `{"coordinator":null,...}` style cases that bypass the guards) asserting `FLEET: unavailable (… invalid shape …)`.

F4 [nit] open-brain/src/server.ts:443 at 3ded135
claim: The handleStart fallback prints "fleet.json" when FLEET_JSON is unset, not the real default path (~/Projects/fleet/fleet.json) that fleetPath uses.
evidence: `const path = process.env.FLEET_JSON ?? "fleet.json";` (443)
scenario: Only reachable if describeFleet itself throws, which is unlikely now. If it does, the message points at the wrong file.

SUMMARY: 0 blocking, 0 major, 3 minor, 1 nit. r1 F1-F7 all hold at the head. M8, M10, M11, M12 and M13 go red; M9 survives (F3).

--- grok-sia-review ---
REVIEW 2/2 3ded135
ROWS
Q1. Do F1-F7 hold at 3ded135? (method: `git diff 19cb1e5f..HEAD -- open-brain/src`, reading lines at the head)
- F1 HOLDS. fleet.ts:59 `export function fleetProjectKey(projectRoot, recordName, fleet)`; :62 `execFileSync("git", ["-C", projectRoot, "rev-parse", "--path-format=absolute", "--git-common-dir"], ...)` with timeout 3000; repo match at :72-73, then the name match at :77; projectSeats matches against the key. server.ts:441 `describeFleet(projectRoot, projectName, process.env, startNow)`. Headers use `Seats (${fleetKey})`.
- F2 HOLDS (with the F2/F3 gaps above). fleet.ts:197 try / :214 catch → invalidShape. parseFleetRoot rejects null and arrays ("not an object"). normalizedSeats skips non-string name/project and treats non-array seats as []. hubFields guards hub and dashboard. server.ts:440-445 has its own try/catch.
- F3 HOLDS. briefing.ts:303-310: with SEATS, `Latest brief · Skills` then readsOwed (305); without, latestBrief, readsOwed (308), then skills.
- F4 HOLDS. briefing-fix-sync.test.ts:23-41 empties PATH in try and restores it in finally. It asserts FIXED_SHA, and that the committed .mdc header equals FIXED_SHA. The source-regex `it` is kept (:43).
- F5 HOLDS. fleet.ts:181 prints "none" when the list is empty (but see F1).
- F6 HOLDS. fleet.ts:48-51 urlWithOptionalSlash appends "/" only when it is missing. Used for both hub and dashboard; legacy line :165 `Hub: ${hubV} ${hubUrl} · Dashboard: ${dashV} ${dashUrl}`.
- F7 HOLDS. bootstrap/index.ts:345-358 cleanupStaleWriteProbes (prefix `.sia-write-probe-`, mtime < now-10min, all in try/catch); :364 `.sia-write-probe-${process.pid}-${randomBytes(4).toString("hex")}`.

Q2. Real ob_start over MCP stdio (my JSON-RPC client: initialize, then tools/call ob_start {project_root}) against build/server.js, on a temp clone of the head, with HOME, KNOWLEDGE_V2_DB, FLEET_JSON and SIA_USAGE_FILE in a temp dir:
$ for body in null [] '{"seats":[{"name":"a"}]}' '{"seats":"x"}'; do ... node mcp.mjs build/server.js <tmp>/repo; done
== FLEET_JSON=null
isError=false rpcError=null
hasBriefing=true hasEnd=true stack=false
FLEET: unavailable (<tmp>/f.json: invalid shape: not an object)
== FLEET_JSON=[]
isError=false rpcError=null
hasBriefing=true hasEnd=true stack=false
FLEET: unavailable (<tmp>/f.json: invalid shape: not an object)
== FLEET_JSON={"seats":[{"name":"a"}]}
isError=false rpcError=null
hasBriefing=true hasEnd=true stack=false
FLEET: coordinator ? · hub ? · dashboard ? · seats none (verified ?)
== FLEET_JSON={"seats":"x"}
isError=false rpcError=null
hasBriefing=true hasEnd=true stack=false
FLEET: coordinator ? · hub ? · dashboard ? · seats none (verified ?)
PASS on all 4. ("stack" = regex `\n\s+at .+:\d+:\d+` over the full text. The repo is budgeted, so only the FLEET: line shows.)

Q3. Temp repo MyRepo, `git worktree add ../MyRepo-wt -b wt`, fleet {projects:[{name:"SIA",repo:"myrepo"}]}, built fleet.js:
<tmp>/MyRepo -> SIA
<tmp>/MyRepo/sub -> SIA
<tmp>/MyRepo-wt -> SIA
/tmp -> self-improving-agent
null entry -> THROWS: Cannot read properties of null (reading 'repo')   (F2)
PASS: main checkout, subdirectory and a sibling linked worktree give the same key, matched case-insensitively. Outside a repo it falls back to recordName.

Q4. Each mutant applied on the scratch head, then `npx vitest run <file> --testTimeout=20000`, then `git checkout -- src` (porcelain empty after each).
Assumption, since the brief has no M12/M13 text: M12 = remove both catches (server.ts throws again; describeFleet's try removed) plus the seat guard (normalizedSeats returns raw seats). M13 = delete vtag's `startsWith("v")` early return.
M8 fleetProjectKey returns recordName first. RED "BF-F6: fleetProjectKey maps repo folder to fleet name from main and linked worktree". AssertionError: expected 'self-improving-agent' to be 'SIA'. Tests 1 failed | 19 passed (20)
M9 describeFleet try/catch removed. GREEN: Tests 20 passed (20)  ← survives, F3
M10 READS OWED pushed after Skills again (no-SEATS branch). RED "BF-F8 ... without SEATS, READS OWED is directly after Latest brief". AssertionError: expected 'Skills: none' to be 'READS OWED: none'. Tests 1 failed | 19 passed
M11 sha = execFileSync("git",["hash-object","--stdin"],...). RED "BF-N4 ... PATH emptied: ..." Error: spawnSync git ENOENT; plus "source does not call git hash-object". Tests 2 failed (2)
M12 (as assumed above). RED "BF-F10: invalid fleet.json shape does not fail ob_start > seat without project: briefing completes with End Briefing". AssertionError: expected true to be falsy. Tests 1 failed | 14 passed (15). The null case stays green, since parseFleetRoot catches it.
M13 vtag always prefixes. RED "BF-F11: version strings are not double-prefixed with v". AssertionError: expected '## Fleet (fleet.json, verified 10-08 …' to contain 'Hub: v1.22.0 '. Tests 1 failed | 19 passed

Q5. New in the delta:
- Security, the execFileSync in fleetProjectKey (fleet.ts:62): argv array, no shell, stdio ignore/pipe, 3 s timeout, and a try/catch that falls back to null. projectRoot goes to -C as a single argument, so there is no injection. It costs one sync git spawn per ob_start, which is acceptable. Found nothing.
- Probe cleanup (bootstrap/index.ts:345-358): readdirSync on that one dir, a literal startsWith prefix (no glob), and unlink of entries over 10 min old, all per-entry in try/catch. No recursion, no traversal. A symlink named .sia-write-probe-* would have the link removed (statSync follows the link for its mtime), not the target. Found nothing.
- Regressions: legacy and budget lines are unchanged apart from the vtag/slash fixes; existing BF-F rows are updated; tsc 0; my 4 files 41/41. Found F1 (none +K), F2 (projects guard), F4 (fallback path).
- Nits: the double space is gone (`seats none`, BF-F9 `not.toMatch(/seats  +/)`). The slash is gone: urlWithOptionalSlash, and the BF-F rows expect `http://…:4000/ · Dashboard: v1.15.0 http://…:4100/`, each with exactly one "/". The vv is gone (vtag, BF-F11). All three FIXED.

looked: r1 F1-F7 fixes — found nothing beyond F1-F4
looked: fleetProjectKey and worktrees — F2
looked: describeFleet never-throw and shape guards — F2, F3
looked: budget cap and "none" text — F1
looked: READS OWED placement — found nothing
looked: BF-N4 behavioural — found nothing
looked: probe cleanup security — found nothing
looked: execFileSync security — found nothing
looked: handleStart fallback — F4
looked: test quality / mutants 8-13 — F3
time spent: ~35 min


```
