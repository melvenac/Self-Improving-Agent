import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveHookProjectDir } from "../shared/repo-root.js";
import { detectBashWriteTargets, BASH_WRITE_LIMIT } from "./bash.js";
import {
  consumeOutwardGrant,
  grantMatchesCommand,
  readOutwardGrant,
} from "./grant.js";
import { analyzeGhMerge, isRestrictedOutwardBash, pathOnDocsMergeAllowlist } from "./git.js";
import { NOT_PARSEABLE, parseGate } from "./parse-gate.js";
import type { Flavor } from "./shell-words.js";
import {
  isAllowedDocsLoopsPath,
  isProtectedArtifactPath,
  isRenderedViewPath,
  isSummaryPath,
  nonLiteralCause,
  SUMMARY_PATH,
  toRepoRelative,
} from "./paths.js";
import { fetchPrChangedPaths, type PrFilesDeps } from "./prfiles.js";
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
  prChangedPaths?: (prRef: string) => string[] | "fail" | { failed: string; pending?: true };
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
  cwd: string,
  tool: string,
  input: Record<string, unknown>,
  deps: PlannerHookDeps,
): PlannerHookResult | null {
  const rawPath = toolPath(input);
  if (!rawPath) {
    return { decision: "deny", reason: "Planner hook: tool input has no target path — denied (fail closed)." };
  }

  // r5 P1: the same literal-path rule as a shell target. A file tool expands nothing, but a `~`, a
  // pattern character or a brace is not a path the hook can locate, so it is refused with its cause.
  const nonLiteral = nonLiteralCause(rawPath, false);
  if (nonLiteral) {
    return {
      decision: "deny",
      reason: `Planner hook: denied — ${rawPath} (${nonLiteral}, so its location cannot be determined) (fail closed).`,
    };
  }

  // D1/D3: resolve against the tool's cwd, then make it repo-relative. A path outside the repo is
  // not the hook's business; one whose location cannot be determined is denied, not waved through.
  const resolved = toRepoRelative(rawPath, repoRoot, cwd);
  if (!resolved.ok) {
    return { decision: "deny", reason: `Planner hook: denied — ${resolved.cause} (fail closed). Path: ${rawPath}` };
  }
  if (resolved.outside) return null;
  const relPath = resolved.rel;
  const ci = resolved.ci;

  if (isProtectedArtifactPath(relPath, ci)) {
    return {
      decision: "deny",
      reason: `Planner hook: denied — ${PH1_RULE}. Path: ${rawPath}`,
    };
  }

  if (isRenderedViewPath(relPath, ci)) {
    return {
      decision: "deny",
      reason: `Planner hook: denied — ${PH2_RULE}. Path: ${rawPath}`,
    };
  }

  if (isSummaryPath(relPath, ci)) {
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

  if (tool === "Write" && !isAllowedDocsLoopsPath(rawPath) && rawPath.replace(/\\/g, "/").startsWith("docs/")) {
    // Other docs paths are allowed; only docs/loops/ is the standing brief path in PH-4,
    // but any docs write outside PH-1 is fine for the planner.
  }

  return null;
}

function checkBash(
  command: string,
  repoRoot: string,
  cwd: string,
  deps: PlannerHookDeps,
  flavor: Flavor = "bash",
): PlannerHookResult | null {
  const shell = flavor === "powershell" ? "PowerShell" : "Bash";
  // r6, P0: the hook decides only about what it can fully parse. Everything else is refused, with the construct named.
  const gate = parseGate(command, flavor);
  if (gate) {
    return {
      decision: "deny",
      reason:
        `Planner hook: denied — ${NOT_PARSEABLE}: ${gate}. The ${shell} command is outside the grammar the hook can check, so it ` +
        "is refused rather than guessed at; rewrite it in plain words (split compound commands, write long text to a file). " +
        BASH_WRITE_LIMIT,
    };
  }
  const writeTargets = detectBashWriteTargets(command, repoRoot, cwd, flavor);
  if (writeTargets.length > 0) {
    return {
      decision: "deny",
      reason:
        `Planner hook: denied — ${PH1_RULE} / ${PH2_RULE} via ${shell} write (${writeTargets.join(", ")}). ` +
        BASH_WRITE_LIMIT,
    };
  }

  if (!isRestrictedOutwardBash(command, flavor)) return null;

  // D-032/D-055 (Aaron 2026-09-30): a docs-only merge needs no grant. Anything else that
  // reaches here — unlisted path, unreadable list, unparseable ref — is grant-required,
  // and the refusal names which. r5 P2: only ONE exact grammar is ever read as a docs-only merge.
  let mergeCause: string | null = null;
  const gh = analyzeGhMerge(command, flavor);
  if (gh.isMerge && deps.prChangedPaths) {
    if (!gh.single) {
      mergeCause = "the command is not a single gh pr merge invocation (chained, piped, substituted or prefixed)";
    } else if (gh.repoFlag) {
      // --repo would merge another repository's PR N; the list read is origin's PR N. Never mix them.
      mergeCause = "--repo/-R names another repository, and the docs-only check reads origin's pull requests only";
    } else if (!gh.exact) {
      mergeCause =
        "the command is outside the one no-grant grammar: gh pr merge <number or origin pull URL>, optionally followed " +
        "only by --squash, --merge, --rebase, --delete-branch, -s, -m, -r, -d";
    } else if (!gh.exact.ref) {
      mergeCause = "could not parse the gh pr merge target";
    } else {
      const paths = deps.prChangedPaths(gh.exact.ref);
      if (typeof paths === "object" && !Array.isArray(paths)) {
        // Pass one of runPlannerHookAsync: the list is not fetched yet, so decide nothing and
        // touch no grant. A docs-only merge must never read or burn a code merge's grant.
        if (paths.pending) return { decision: "deny", reason: "Planner hook: changed-file list pending" };
        mergeCause = paths.failed;
      } else if (paths === "fail") {
        mergeCause = "the changed-file list could not be read";
      } else {
        const unlisted = paths.filter((p) => !pathOnDocsMergeAllowlist(p));
        if (paths.length === 0) mergeCause = "the changed-file list is empty";
        else if (unlisted.length > 0) mergeCause = `unlisted path ${unlisted[0]}`;
        else return null;
      }
    }
  }

  const grant = readOutwardGrant(repoRoot);
  if (grant && grantMatchesCommand(grant, command)) {
    consumeOutwardGrant(repoRoot);
    return null;
  }

  return {
    decision: "deny",
    reason:
      `Planner hook: denied — ${PH3_RULE}. Command: ${command.trim()}` +
      (mergeCause
        ? ` gh pr merge is not on the D-032/D-055 docs-only allowlist, so a grant is required: ${mergeCause}.`
        : ""),
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
    const fileResult = checkFileTool(repoRoot, cwd, tool, input, deps);
    if (fileResult) return fileResult;
    if (tool === "Write") {
      const rawPath = toolPath(input);
      if (rawPath && !isAllowedDocsLoopsPath(rawPath) && !rawPath.replace(/\\/g, "/").startsWith("docs/")) {
        // Writes outside docs/ that are not PH-1/PH-2 are allowed (e.g. .agents/roles is prose).
      }
    }
  }

  // r5 P3: every shell tool the seat has is checked, not only Bash. Tool names are compared without case.
  const shellTool = tool.toLowerCase() === "bash" ? "Bash" : tool.toLowerCase() === "powershell" ? "PowerShell" : null;
  if (shellTool) {
    const command = typeof input.command === "string" ? input.command : "";
    if (!command.trim()) {
      return { decision: "deny", reason: `Planner hook: denied — empty ${shellTool} command (fail closed).` };
    }
    const shellResult = checkBash(command, repoRoot, cwd, deps, shellTool === "PowerShell" ? "powershell" : "bash");
    if (shellResult) return shellResult;
  }

  return { decision: "allow" };
}

/**
 * The live entry point: `runPlannerHook` is synchronous, and the docs-only merge check needs a
 * network read. Pass one runs the policy with a recorder standing in for the file list; the
 * recorder is only reached when the role is planner and every earlier rule has passed, and it
 * returns before the grant is read, so pass one never consumes one. The list is then fetched —
 * no child process — and pass two decides with it. Any failure to fetch is a `{ failed }` list, which
 * the policy treats as grant-required and names.
 */
export async function runPlannerHookAsync(
  payload: PlannerHookPayload,
  deps: PlannerHookDeps = {},
  fetchDeps: PrFilesDeps = {},
): Promise<PlannerHookResult> {
  if (deps.prChangedPaths) return runPlannerHook(payload, deps);

  let pendingRef: string | undefined;
  const first = runPlannerHook(payload, {
    ...deps,
    prChangedPaths: (ref) => {
      pendingRef = ref;
      return { failed: "the changed-file list was not fetched", pending: true };
    },
  });
  if (pendingRef === undefined) return first;

  const cwd = typeof payload.cwd === "string" ? payload.cwd : process.cwd();
  const listed = await fetchPrChangedPaths(pendingRef, resolveHookProjectDir(cwd), fetchDeps);
  return runPlannerHook(payload, {
    ...deps,
    prChangedPaths: () => (listed.ok ? listed.paths : { failed: listed.cause }),
  });
}
