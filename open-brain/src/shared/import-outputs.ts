/**
 * Paths `state import --commit` writes or re-renders. Shared by the importer and
 * `bootstrap install-commands` (IMPORT-CMDS r2 L1) without importing either pipeline.
 */
export const STATE_REL = ".agents/state.json";

export const STATE_IMPORT_COMMIT_OUTPUTS: readonly string[] = [
  STATE_REL,
  ".agents/TASKS/INBOX.md",
  ".agents/TASKS/task.md",
  ".agents/SESSIONS/next-session.md",
  ".agents/SYSTEM/SUMMARY.md",
];
