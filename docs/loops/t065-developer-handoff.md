# T-065: drop `paths.knowledgeDb`

**By:** Forge (builder, sia-builder), 2026-10-02. **Branch:** `loop/t065-drop-knowledgedb` from `origin/master` `5ec37cdf`. **Code SHA to freeze: `3b3b6c2a6242712bde4a6d9c672566609e6c88ea`.** Not merged. LIGHT: one test file, `tsc --noEmit`.

## The check you asked for first: does anything read it?
No live caller. `git grep -n knowledgeDb` over the whole repository (fixtures-import excluded) found exactly: the interface field and its definition in `open-brain/src/shared/paths.ts:92,114`, one assertion at `open-brain/tests/shared/paths.test.ts:54`, and two *text* mentions in the record and INBOX view (the T-065 title). `scripts/`, `hooks/`, `.claude/`, `project-template/` and `open-brain/src` outside `paths.ts` have **no** reference, and no code reads `~/.claude/context-mode/knowledge.db` by path either. The `createDb()` the old comment says still expects the v1 schema does not exist in `open-brain/src`. `cli.ts` scores against `knowledgeV2Db` (`cli.ts:142` says so).

## Change
`shared/paths.ts`: the `knowledgeDb` field, its definition and the NOTE comment that justified it are gone. `tests/shared/paths.test.ts`: the `knowledgeDb` assertion is replaced by "the resolved set has no such key" (spelled `"know" + "ledgeDb"` so the acceptance grep stays empty) and "`knowledgeV2Db` is `knowledge-v2.db`".

## Evidence
- **Red before:** `paths.test.ts` 1 failed | 13 passed (`expected [ 'projectRoot', 'packageJson', …(11) ] to not include 'knowledgeDb'`). **Green after:** 14 passed (14).
- **Acceptance grep:** `git grep -n knowledgeDb open-brain/src open-brain/tests ':!open-brain/tests/fixtures-import'` prints nothing (exit 1).
- `tsc --noEmit` exit 0: no consumer of the field exists.
- Not done, by the task's own wording: the v1 file `~/.claude/context-mode/knowledge.db` on disk is outside the repo and is Aaron's to delete.
