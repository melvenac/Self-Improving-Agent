# Shadow merge procedure

The runtime never merges. This is the human step, run from a checkout of the repository.

1. Before `gh pr merge`, record the verdict:

   `npx tsx open-brain/src/harness/cli.ts shadow-verdict prepare --loop <id> --candidate <sha> --criteria-sha <sha> --criteria <path> --evidence <E_t.json>`

2. After the merge, the sha is the one now on `origin/master`:

   `npx tsx open-brain/src/harness/cli.ts shadow-verdict decide --loop <id> --candidate <sha> --merged <sha>`

   `decide --merged` refuses a sha that `git merge-base --is-ancestor` cannot reach from `origin/master`.

3. A decline or a replacement is `decide --declined` or `decide --replaced <new-sha>` against the original candidate sha.
