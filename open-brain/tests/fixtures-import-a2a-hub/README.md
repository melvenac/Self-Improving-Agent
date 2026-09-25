# Known-positive fixture for the importer's staleness check (T-180)

Copied from `~/Projects/A2A-Hub` at commit `e0bc3f8` with
`git archive e0bc3f8 .agents`. The content is unchanged. Line endings are LF, per this repo's `.gitattributes`. The one other change is `package.json`, which is
cut down to `name` and `version`, the two fields the importer reads.

Only the importer's inputs are here: INBOX, task, next-session, SUMMARY and
DECISIONS. Of the session logs, only the latest two (13 and 14) are kept,
because `findLastSession` reads only the highest `Session_N.md`.

What makes it a known positive: `next-session.md` says "Updated at end of
Session 13", but `SESSIONS/Session_14.md` exists and records Session 14 as
completed. Its INBOX was last updated at Session 11.
A2A-Hub is a public repository.
