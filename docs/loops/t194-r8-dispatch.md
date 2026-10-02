# T-194 r8: finish the inversion: options, PowerShell native commands, environment names, `git config`

**By:** Atlas (planner), record session 155, 2026-10-02. **Candidate r7:** `71ea3101` on `origin/loop/t194-planner-hook`.
**QA 246's report:** `docs/loops/t194-r7-qa-report.md` on `origin/qa/t194-r7-report` (`513a3f38`), REJECT, **ruled
REJECT** by the planner (D-088).

**r7 delivered what it was asked for. Keep all of it:**
- P0a refuses every character PowerShell honours, proven in real PS 5.1;
- P0b's single validator holds;
- 2,184 placements of 182 unlisted Bash words are refused, and so are all 38 node inline-code spellings in Bash;
- P0d and D-C hold;
- **CI is green on Linux**;
- **139 of 139 mutants are killed in one pass.**

## Why r8

QA 246's defects A to G are all one shape. **Three sets are still enumerated instead of allow-listed:**
- each listed word's **options**: curl, sed, npm/npx, git, ssh, uniq (B to E);
- **PowerShell native commands** (A);
- **environment names** (G).

`git config` persists a key that `git -c` would need a grant for (F). r8 inverts the remaining three and closes F.

## The properties

**P0c+, allow-listed options.** For every word on `BASH_ALLOWED_COMMANDS`, the hook carries an **option allow-list**:
the options and operand shapes the word may take. Any other option is refused, in any spelling: a cluster, an attached
value, `--long=`, or an abbreviated long option.
- If a word cannot be given a safe, complete option list, **it comes off the list.** Start with these off:
  - `uniq`, `ssh`, `scp` (the remote side is outside the hook anyway);
  - `npx`;
  - `npm` apart from `npm test`, `npm run <script>`, `npm ci` and `npm install`, with no `exec`, `-c`, `--call`,
    `pkg` or `config`;
  - `curl` (the planner does not need it, since it has a fetch tool).
- `sed`: only `-n`, `-E`/`-r` and `-e <script>`, with the script checked as r6 does (no `w`, `W`, `e`, or `r` into a
  write), and `-i` only in the exact forms the hook reads. Any other option is refused.
- `git`: the subcommands the planner uses (status, log, diff, show, fetch, add, commit, push, branch, checkout,
  switch, merge-base, rev-parse, ls-remote, ls-tree, cat-file, worktree, stash), each with its allowed options.
  - `--output` and `--output=` are refused everywhere.
  - `git config`: reads only (`--get`, `--list`, `-l`). **Any write to a key under `alias.`, `remote.`, `url.`,
    `include.`, `includeIf.` or `core.` needs a grant** (F), and so does any other config write.
- `gh`: the subcommands the planner uses (`pr` view/list/create/checks/merge, `run` list/view/watch, `api` GET only),
  each with its options. `gh browse` is refused.

**P0e, PowerShell native commands (A).** In the PowerShell tool, a native (non-cmdlet) command word is refused
unless it is `git` or `gh`. Those two take the **same** option allow-lists as in Bash. `node`, `npx`, `npm`, `awk`,
`sed`, `robocopy` and every other native command are refused.

**P0f, environment names (G).** A leading `NAME=value` is allowed only for names on `ENV_ALLOWED`: at most `CI`,
`NODE_ENV`, `LANG`, `LC_ALL`, `FORCE_COLOR`, `NO_COLOR`, `DEBUG`, `TZ`. Everything else is refused, including `BROWSER`,
`GH_BROWSER`, `EDITOR`, `PAGER`, `GIT_*`, `npm_config_*` and `*_HOME`.

## Required evidence

1. **Generators.**
   - For each listed word: its allowed options must pass, and at least 20 spellings of unlisted options must be
     refused, including clusters, attached values, `--long=` and abbreviations.
   - For PowerShell: at least 50 native words must be refused.
   - For environment names: at least 50 names off the list must be refused.
2. **QA 246's probes A to G as rows**, from `docs/loops/qa-246/` on `origin/qa/t194-r7-report`.
3. **Mutants:** one per P0c+/P0e/P0f clause, plus r7's 139. **Run them in one pass on a machine with memory, or say
   why not.** The QA PC has about 1.8 GB free; capped chunks are acceptable as before (D-084 practice), and QA reruns
   them in one pass.
4. **The cost list** is updated with every refusal r8 adds, each with its rewrite. QA judges whether any common
   planner command becomes impossible to express.
5. **The limit text** is restated: what remains out of reach is a path a listed program builds at runtime, symlinks
   and junctions, and the GitHub API. Nothing else.

## Rules

As r7:
- merge master in first (merge commit, no force); no CI (QA runs it); never register the hook; mutants local;
- heavy runs need Aaron's approval, so send clark `MANUAL MODE → sia-forge: <action> (<why>)`;
- handoff: `docs/loops/t194-r8-developer-handoff.md`;
- push `loop/t194-planner-hook`, never forced, and report the SHA to `atlas [f21cf4]`.
