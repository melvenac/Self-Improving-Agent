# T-025 ruling

**Ruling:** fact_kind is the taxonomy. Frontmatter `type` is an optional free label, one token. It is not retired and it is not enumerated. Atlas s161, B2 accepted.

## effectiveKind

`git log -S effectiveKind -- open-brain/src` shows two commits:

- `f28247df` added it (dream pipeline, state vs event).
- `e05ad9a7` removed it (Loop 10 CUT: dream, v1 pipeline, reflection, skill scan).

`effectiveKind` does not exist in this tree. T-022's gate is only the count of recorded `fact_kind` labels.

## fact_kind counts (QA PC)

Copied `~\.claude\open-brain\knowledge-v2.db` to a temp file and opened the copy read-only. The live file was not opened for write.

`knowledge_index` columns include `fact_kind` and do not include a column that says the value came from an explicit `ob_store kind`. The schema cannot separate an explicit kind from any other writer.

| fact_kind | rows |
|-----------|------|
| state | 0 |
| event | 5 |
| NULL | 0 |

Five recorded event labels. Zero state labels. T-022 stays gated: replace-on-write needs a meaningful number of recorded labels, and there is no state label yet.

## Follow-up

The `/sync` experience-frontmatter check (free label: missing `type` passes, one token passes, empty or two tokens is an issue, a mutant that requires the old closed list goes red) waits until #424 and #442 merge. Both touch `pipelines/sync/checks.ts`.
