/**
 * Paths `state import --commit` writes or re-renders. Shared by the importer and
 * `bootstrap install-commands` (IMPORT-CMDS r2 L1) without importing either pipeline.
 */
export const STATE_REL = ".agents/state.json";

/** What `state import --draft` writes. Here, not in state-import, so bootstrap can name them without an import cycle (T-251). */
export const DRAFT_REL = ".agents/state.draft.json";
export const REPORT_REL = ".agents/state.import-report.md";
export const DRAFT_INPUTS_REL = ".agents/state.draft.inputs.json";

/** The role-file stubs from project-template; `--commit` installs the ones a project lacks, never over its own (T-251). */
export const ROLE_STUB_RELS: readonly string[] = [
  ".agents/roles/shared.md",
  ".agents/roles/planner.md",
  ".agents/roles/developer.md",
  ".agents/roles/qa.md",
];

export const STATE_IMPORT_COMMIT_OUTPUTS: readonly string[] = [
  STATE_REL,
  ".agents/TASKS/INBOX.md",
  ".agents/TASKS/task.md",
  ".agents/SESSIONS/next-session.md",
  ".agents/SYSTEM/SUMMARY.md",
  ...ROLE_STUB_RELS,
  // T-297: --commit merges the template's into these, as scaffold does.
  ".gitignore",
  ".gitattributes",
];
