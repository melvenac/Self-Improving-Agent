#!/usr/bin/env node

/**
 * PreToolUse hook — planner seat boundary (T-194).
 *
 * Keyed on `role: planner` in the checkout's `.agents/AGENT.local.md`.
 * Deny-wins on PreToolUse: a refusal blocks the tool call (exit 2).
 *
 * Parses stdin as JSON — never pattern-matches over the JSON text (PH-7).
 * Registration is Aaron's hand; run with --print-registration for the snippet.
 */

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { resolveHookProjectDir } from "./shared/repo-root.js";
import { formatDeny } from "./planner-hook/emit.js";
import {
  allPathsOnDocsMergeAllowlist,
  extractGhPrMergeRef,
} from "./planner-hook/git.js";
import { formatRegistrationSnippet } from "./planner-hook/registration.js";
import { runPlannerHook, type PlannerHookDeps } from "./planner-hook/run.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8").trim();
}

function ghPrChangedPaths(prRef: string): string[] | "fail" {
  const gh = process.env.PLANNER_HOOK_GH || "gh";
  try {
    const out = execFileSync(
      gh,
      ["pr", "view", prRef, "--json", "files", "-q", ".files[].path"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const paths = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return paths;
  } catch {
    return "fail";
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--print-registration")) {
    const repoRoot = resolveHookProjectDir(process.cwd());
    const openBrainDir = join(repoRoot, "open-brain");
    process.stdout.write(`${formatRegistrationSnippet(openBrainDir)}\n`);
    return;
  }

  const raw = await readStdin();
  if (!raw) {
    process.stdout.write(formatDeny("Planner hook: denied — empty hook payload (fail closed)."));
    process.exit(2);
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    process.stdout.write(formatDeny("Planner hook: denied — hook payload is not valid JSON (fail closed)."));
    process.exit(2);
    return;
  }

  const deps: PlannerHookDeps = {
    prChangedPaths: (ref) => {
      const paths = ghPrChangedPaths(ref);
      if (paths === "fail") return "fail";
      return allPathsOnDocsMergeAllowlist(paths) ? paths : [];
    },
  };

  const result = runPlannerHook(payload, deps);

  if (result.decision === "passthrough" || result.decision === "allow") {
    process.exit(0);
    return;
  }

  process.stdout.write(formatDeny(result.reason ?? "Planner hook: denied."));
  process.exit(0);
}

main().then(
  () => undefined,
  (err) => {
    process.stdout.write(
      formatDeny(
        `Planner hook: denied — unhandled error (fail closed): ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    process.exit(2);
  },
);
