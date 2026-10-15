import { join } from "node:path";

/**
 * Settings snippet for Aaron to paste into the planner checkout's
 * `.claude/settings.local.json`. Registration is Aaron's hand (T-194).
 */
export function plannerHookRegistration(openBrainDir: string, opts: { fileOnly?: boolean } = {}): object {
  const command = `node "${join(openBrainDir, "build", "cli-planner-hook.js")}"`;
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: opts.fileOnly ? "Edit|Write|NotebookEdit" : "Edit|Write|NotebookEdit|Bash|PowerShell",
          hooks: [{ type: "command", command, timeout: 10 }],
        },
      ],
    },
  };
}

export function formatRegistrationSnippet(openBrainDir: string, opts: { fileOnly?: boolean } = {}): string {
  const snippet = plannerHookRegistration(openBrainDir, opts);
  return [
    "# Paste under the planner checkout's .claude/settings.local.json (merge with existing hooks).",
    "# Registration is Aaron's hand — this repo ships the snippet only.",
    ...(opts.fileOnly ? ["# D-157: the file half only; --print-registration --all prints the Bash/PowerShell half too."] : []),
    JSON.stringify(snippet, null, 2),
  ].join("\n");
}
