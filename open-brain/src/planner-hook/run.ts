import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveHookProjectDir } from "../shared/repo-root.js";
import { detectBashWriteTargets, BASH_WRITE_LIMIT } from "./bash.js";
import {
  consumeOutwardGrant,
  grantMatchesCommand,
  readOutwardGrant,
} from "./grant.js";
import {
  allPathsOnDocsMergeAllowlist,
  extractGhPrMergeRef,
  isGhPrMerge,
  isRestrictedOutwardBash,
} from "./git.js";
import {
  isAllowedDocsLoopsPath,
  isProtectedArtifactPath,
  isRenderedViewPath,
  SUMMARY_PATH,
} from "./paths.js";
import { editTouchesSummaryRegion, writeTouchesSummaryRegion } from "./summary.js";

export type PlannerHookDecision = "allow" | "deny" | "passthrough";

export interface PlannerHookResult {
  decision: PlannerHookDecision;
  reason?: string;
}

export interface PlannerHookPayload {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
}

export interface PlannerHookDeps {
  /** When set, used instead of reading AGENT.local.md from disk (tests). */
  role?: string;
  /** When set, used instead of reading SUMMARY.md from disk (tests). */
  summaryContent?: string | null;
  /** When set, answers gh pr merge allowlist checks (tests). */
  prChangedPaths?: (prRef: string) => string[] | "fail";
}

const PH1_RULE = 'planner.md, "Authority"';
const PH2_RULE = "state changes go through `ob_state`";
const PH3_RULE =
  'shared.md, "Each outward-facing act needs authority for THAT act" (D-038 / D-032)';

function readFileOrNull(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function toolPath(input: Record<string, unknown>): string | null {
  const keys = ["file_path", "notebook_path", "path"];
  for (const k of keys) {
    const v = input[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function parseLocalRole(content: string): string | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^role\s*:\s*(.+)$/i);
    if (m) {
      const value = m[1].trim();
      return value || null;
    }
  }
  return null;
}

function resolveRole(repoRoot: string, deps: PlannerHookDeps): string | "missing" | "malformed" {
  if (deps.role !== undefined) return deps.role;
  const local = join(repoRoot, ".agents", "AGENT.local.md");
  if (!existsSync(local)) return "missing";
  const raw = readFileOrNull(local);
  if (raw === null) return "missing";
  const role = parseLocalRole(raw);
  if (!role) return "malformed";
  return role;
}

function checkFileTool(
  repoRoot: string,
  tool: string,
  input: Record<string, unknown>,
  deps: PlannerHookDeps,
): PlannerHookResult | null {
  const rawPath = toolPath(input);
  if (!rawPath) {
    return { decision: "deny", reason: "Planner hook: tool input has no target path — denied (fail closed)." };
  }

  // MUTANT PH-4: wrongly denies the standing docs/loops brief path.
  if (tool === "Write" && isAllowedDocsLoopsPath(rawPath)) {
    return { decision: "deny", reason: "mutant ph4: docs/loops write denied" };
  }

  if (isProtectedArtifactPath(rawPath)) {
    return {
      decision: "deny",
      reason: `Planner hook: denied — ${PH1_RULE}. Path: ${rawPath}`,
    };
  }

  if (isRenderedViewPath(rawPath)) {
    return {
      decision: "deny",
      reason: `Planner hook: denied — ${PH2_RULE}. Path: ${rawPath}`,
    };
  }

  if (rawPath.replace(/\\/g, "/").endsWith(SUMMARY_PATH)) {
    const existing =
      deps.summaryContent !== undefined
        ? deps.summaryContent
        : readFileOrNull(join(repoRoot, SUMMARY_PATH));
    if (tool === "Write") {
      const content = typeof input.content === "string" ? input.content : "";
      if (writeTouchesSummaryRegion(existing, content)) {
        return {
          decision: "deny",
          reason: `Planner hook: denied — ${PH2_RULE} (SUMMARY.md marked region). Path: ${rawPath}`,
        };
      }
    } else if (tool === "Edit") {
      const oldString = typeof input.old_string === "string" ? input.old_string : "";
      const newString = typeof input.new_string === "string" ? input.new_string : "";
      const base = existing ?? "";
      if (editTouchesSummaryRegion(base, oldString, newString)) {
        return {
          decision: "deny",
          reason: `Planner hook: denied — ${PH2_RULE} (SUMMARY.md marked region). Path: ${rawPath}`,
        };
      }
    }
  }

  return null;
}

function checkBash(command: string, repoRoot: string, deps: PlannerHookDeps): PlannerHookResult | null {
  const writeTargets = detectBashWriteTargets(command);
  if (writeTargets.length > 0) {
    return {
      decision: "deny",
      reason:
        `Planner hook: denied — ${PH1_RULE} / ${PH2_RULE} via Bash write (${writeTargets.join(", ")}). ` +
        BASH_WRITE_LIMIT,
    };
  }

  if (!isRestrictedOutwardBash(command)) return null;

  if (isGhPrMerge(command) && deps.prChangedPaths) {
    const ref = extractGhPrMergeRef(command);
    if (!ref) {
      return {
        decision: "deny",
        reason: `Planner hook: denied — ${PH3_RULE}. Could not parse gh pr merge target.`,
      };
    }
    const paths = deps.prChangedPaths(ref);
    if (paths === "fail" || !allPathsOnDocsMergeAllowlist(paths)) {
      return {
        decision: "deny",
        reason: `Planner hook: denied — ${PH3_RULE}. gh pr merge is not on the D-032 docs-only allowlist.`,
      };
    }
    return null;
  }

  const grant = readOutwardGrant(repoRoot);
  if (grant && grantMatchesCommand(grant, command)) {
    consumeOutwardGrant(repoRoot);
    return null;
  }

  return {
    decision: "deny",
    reason: `Planner hook: denied — ${PH3_RULE}. Command: ${command.trim()}`,
  };
}

/**
 * Core planner-seat PreToolUse policy. Returns passthrough when role is not planner.
 */
export function runPlannerHook(
  payload: PlannerHookPayload,
  deps: PlannerHookDeps = {},
): PlannerHookResult {
  const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
  const repoRoot = resolveHookProjectDir(cwd);

  const role = resolveRole(repoRoot, deps);
  if (role === "missing") {
    return {
      decision: "deny",
      reason: "Planner hook: denied — .agents/AGENT.local.md is missing or unreadable (fail closed).",
    };
  }
  if (role === "malformed") {
    return {
      decision: "deny",
      reason: "Planner hook: denied — AGENT.local.md frontmatter has no readable role (fail closed).",
    };
  }
  if (role !== "planner") {
    return { decision: "passthrough" };
  }

  const tool = payload.tool_name;
  if (typeof tool !== "string" || !tool.trim()) {
    return { decision: "deny", reason: "Planner hook: denied — payload has no tool_name (fail closed)." };
  }

  const input = payload.tool_input;
  if (!input || typeof input !== "object") {
    return { decision: "deny", reason: "Planner hook: denied — payload has no tool_input (fail closed)." };
  }

  if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit") {
    const fileResult = checkFileTool(repoRoot, tool, input, deps);
    if (fileResult) return fileResult;
    if (tool === "Write") {
      const rawPath = toolPath(input);
      if (rawPath && !isAllowedDocsLoopsPath(rawPath) && !rawPath.replace(/\\/g, "/").startsWith("docs/")) {
        // Writes outside docs/ that are not PH-1/PH-2 are allowed (e.g. .agents/roles is prose).
      }
    }
  }

  if (tool === "Bash") {
    const command = typeof input.command === "string" ? input.command : "";
    if (!command.trim()) {
      return { decision: "deny", reason: "Planner hook: denied — empty Bash command (fail closed)." };
    }
    const bashResult = checkBash(command, repoRoot, deps);
    if (bashResult) return bashResult;
  }

  return { decision: "allow" };
}
