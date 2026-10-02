// QA 246: writes docs/loops/t194-r7-qa-report.E_t.json (same shape as QA 241's) from the run's numbers.
import { writeFileSync } from "node:fs";

const E = {
  loop: "t194",
  candidate_git: { sha: "71ea310188e14d530988c6b3cb17cb70e75997cc", branch: "origin/loop/t194-planner-hook", frozen_at: "2026-10-01T17:45:00-05:00" },
  runtime_checks: {
    build: {
      command: "npm ci; npm run build; npx tsc --noEmit; vitest run tests/planner-hook (open-brain/, candidate 71ea3101, laptop DESKTOP-0GV3HAD, TEMP/TMP=C:\\qa-tmp)",
      exit_code: 0, passed: true, duration_ms: 67000,
      detail: "npm ci exit 0 (185 pkgs); npm run build exit 0 'build stamped 71ea310'; tsc --noEmit exit 0; vitest tests/planner-hook exit 0, 14 files, 1101 passed. Red: the 4 r7 test files against the r6 product (git checkout 9cf8c7eb -- open-brain/src/planner-hook) exit 1, 4/4 files red, 201 failed / 86 passed (287); restored clean.",
    },
    unit: {
      command: "tcm CI run 36937767685 (qa/t194-r7-ci-candidate, headSha 71ea310188e14d530988c6b3cb17cb70e75997cc), job test 110621988386",
      exit_code: 0, passed: true, duration_ms: 150000,
      detail: "Run conclusion SUCCESS. test job 110621988386 SUCCESS on tcm-1 (Linux): 152 files passed; 3045 passed / 8 skipped (3053). changed success; test-windows skipped. 1 of 2 tcm runs used; windows=true not used.",
    },
    mutants: {
      command: "node docs/loops/qa-246/run-mutants.mjs <from> <to> in C:/qa-scratch/qa246-mut (candidate), 8 back-to-back slices, one sequential pass",
      exit_code: 0, passed: true, duration_ms: 4185000,
      detail: "Forge's 139 (specs.mjs; diffs regenerate byte-identical at the candidate): 139 killed, 0 survived, 0 typecheck failures, in ONE sequential pass. QA 246's own 8 (qa-mutants.mjs; 2 each P0a/P0b/P0c/P0d): 8 killed. Free RAM >= 2.7 GB of 8 GB at every mutant. Raw: out/mutants-pass.jsonl.",
    },
  },
  requirements: [],
  acceptance: [
    { id: "R7-P0a-characters", status: "met", evidence: "gen-r7.mjs, 42 characters (16 Zs + U+2028/2029 + NEL/VT/FF, dashes U+2013/4/5, quotes U+2018/9/A/B U+201C/D/E, 11 lookalikes/controls): PowerShell 882/882 refused naming the char (21 positions); Bash outside quotes 420/420 refused; Bash inside ASCII quotes in a non-target word 152/152 parsed and allowed. Real PS 5.1 (ps-honour.mjs) honours all 21 separators, 3 dashes and 7 curly quotes; all refused by the hook." },
    { id: "R7-P0b-one-validator", status: "met", order: "shown", evidence: "QA 241 probe-ps-redirect.mjs re-run: 5/5 D-A spellings refused (provider path / drive-relative), real PS still writes each. Own mutants qa-p0b-skip-append-redirect (17 failed) and qa-p0b-skip-mv-source (1 failed) killed." },
    { id: "R7-P0c-allow-list", status: "unmet", evidence: "Dispatch rows hold: 182 unlisted words x 12 placements = 2184 refused by P0; 10 case/quote/.exe spellings refused; every allowed word parses; 38/38 node inline spellings refused in Bash; QA 241 D-D/D-E refused. But 26 single-command fail-opens in real shells (probe-allow.mjs): PowerShell native commands have no allow-list (node -e/--eval=/-p, npx -c, awk.exe, sed.exe -i, robocopy, git diff --output); npx -c / npm exec -c / --call= run an ungated shell string; npm pkg set rewrites package.json; curl -oFILE, -sSoFILE, -sD, -w %output{}, -OJ, --etag-save; sed --expr='w ..', -ne 'w ..' -e p, --expr='1e ..', --in; uniq IN OUT; git diff --output=; ssh -E; GH_BROWSER + gh browse." },
    { id: "R7-P0d-environment", status: "met", order: "shown", evidence: "26 rows refused: GIT_CONFIG_COUNT/KEY/VALUE, GIT_CONFIG_PARAMETERS, GH_REPO, GH_HOST (any case, behind env/nohup env, in sh -c, after && and |). 4 benign assignments parse. Same act via `git config` (F) and GH_BROWSER (G) noted separately." },
    { id: "R7-D-C", status: "met", order: "shown", evidence: "17 PowerShell New-Item -Name rows (no -Path, protected cwd, prefixes, -Name:, ni, ../) decided as required; real PS 5.1 wrote 8/8 where the hook says." },
    { id: "R7-regression", status: "met", order: "shown", evidence: "QA 241 gen-p0: 339/339 refused by P0 (8 renamed by r7), 167/170 accepted not gated (3 refused on purpose). probe-r6: 86 ok + 1 superseded by P0a. QA 237 gen-p1/p2/p2b/p3 (1456 cases) 0 fail-open; probe-holes/holes2/merge-async/fail-closed/comma 0 allow. D8, D9, non-merge rule, git -c all met (probe-rulings.mjs)." },
    { id: "R7-CI-linux", status: "met", order: "shown", evidence: "tcm run 36937767685 test job 110621988386 success: 152 files, 3045 passed / 8 skipped." },
    { id: "R7-mutants", status: "met", order: "shown", evidence: "139/139 killed in one sequential pass, 0 typecheck failures; own 8 killed." },
    { id: "R7-limit-text", status: "partly met", order: "shown", evidence: "States ssh/scp remote sides and 'a program on the allow-list does what its own arguments say'. Omits that PowerShell native commands are unrestricted, and the handoff's claims that curl is read-only and sed's w/e/-f are refused are false (C, D)." },
    { id: "R7-cost", status: "reviewed", evidence: "53 data rows (dispatch says 49; node -e and xargs duplicated), all reproduce. Impossible to express: node --version (npm version is a rewrite, not listed), stopping a process, chmod, unpacking an archive. Bash sort has a PowerShell Sort-Object rewrite the list omits." },
  ],
  regressions: [],
  gaps: [
    "A: PowerShell native commands are not allow-listed: node -e / --eval= / -p, npx -c, Git's awk.exe and sed.exe -i by path, robocopy, git diff --output= all ALLOW and WRITE open-brain/src in real PS 5.1.",
    "B: npx -c, npm exec -c, npm exec --call= run a shell string the gate never reads (ALLOW, WRITE in Git Bash); npm pkg set rewrites the protected package.json.",
    "C: curl's write-option refusal misses attached -oFILE, clusters (-sSoFILE, -sD), -w %output{file}, -OJ, --etag-save; each ALLOWS and WRITES in Git Bash.",
    "D: sed: --expr='w f' and --expr='1e cmd' (unknown long option skipped), -ne 'w f' -e p (cluster script dropped once -e seen), --in (abbreviated --in-place, target unread); each ALLOWS and WRITES/RUNS in Git Bash.",
    "E: uniq IN OUT, git diff --output=, ssh -E LOG write a literal named target that is not read; ALLOW and WRITE (QA 241 D-E class).",
    "F (ruling): git config core.fsmonitor '<cmd>' then git status runs it; git config --add remote.origin.pushurl <foreign> then a standing push also pushes there. Both commands allowed; Open 5 / P0d act persisted.",
    "G (ruling): environment refusal is a deny-list; GH_BROWSER='sh -c ...' gh browse ALLOWS and WRITES; BROWSER, EDITOR, RIPGREP_CONFIG_PATH, CURL_HOME, npm_config_script_shell all allowed.",
  ],
  notes: "QA 246, Claude Code Opus (claude-opus-5-5), headless, laptop DESKTOP-0GV3HAD. Dispatch commit ea44065ba189885dfa4554b4f105c694e296032d. Hook never registered; no live Jev call; no live GitHub merge; TYPESAFE_API_KEY/GH_TOKEN/GITHUB_TOKEN stripped from every built env. Real-shell writes only under C:/qa-scratch/qa246-* and C:/qa-tmp. The PS sort.exe /O row is a harness artefact (Git Bash PATH inherited) and is not counted.",
};
writeFileSync("C:/qa-scratch/qa246-wt/docs/loops/t194-r7-qa-report.E_t.json", `${JSON.stringify(E, null, 2)}\n`);
console.log("wrote E_t.json");
