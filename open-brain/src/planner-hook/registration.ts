import { join } from "node:path";

/**
 * Settings snippet for Aaron to paste into the planner checkout's
 * `.claude/settings.local.json`. Registration is Aaron's hand (T-194).
 */
export function plannerHookRegistration(openBrainDir: string): object {
  const command = `node "${join(openBrainDir, "build", "cli-planner-hook.js")}"`;
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: "Edit|Write|NotebookEdit|Bash",
          hooks: [{ type: "command", command, timeout: 10 }],
        },
      ],
    },
  };
}

export function formatRegistrationSnippet(openBrainDir: string): string {
  const snippet = plannerHookRegistration(openBrainDir);
  return [
    "# Paste under the planner checkout's .claude/settings.local.json (merge with existing hooks).",
    "# Registration is Aaron's hand — this repo ships the snippet only.",
    JSON.stringify(snippet, null, 2),
  ].join("\n");
}
