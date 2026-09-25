import { homedir } from "node:os";
import { resolvePaths } from "../../shared/paths.js";
import { readJson } from "../../shared/fs-utils.js";
import { resolveRepoRoot, describeNoRoot } from "../../shared/repo-root.js";
import type { SyncOptions, SyncResult, CheckResult } from "./types.js";
import {
  syncReadmeVersion,
  syncPrdVersion,
  checkChangelog,
  checkReadmeRefs,
  checkHookConfigs,
  checkHookRegistration,
  checkSummary,
  checkClaudeMd,
  checkObsidianVault,
  checkVaultPathRefs,
  checkSkillIndex,
  checkTemplatePersonalNames,
  checkTemplate,
  checkSpecProvenance,
  checkRules,
  checkMirrorParity,
  checkStateSchema,
  checkGreetingSize,
  checkCommandParity,
  checkCommandToolNames,
  checkCommandNames,
  checkRetirements,
  checkModuleBoundary,
  checkGitNexusIndex,
  checkBuildFreshness,
} from "./checks.js";
import { checkCiStatus, checkStateViews, checkMergeMarkers } from "./checks-state.js";

export function runSync(input: SyncOptions): SyncResult {
  // R4 (Loop 3): the given root may be a subdirectory (open-brain/ has its
  // own package.json); walk up to the real project root or refuse.
  const root = resolveRepoRoot(input.projectRoot);
  if (!root) throw new Error(describeNoRoot(input.projectRoot));
  const options: SyncOptions = { ...input, projectRoot: root };
  const paths = resolvePaths(options.projectRoot);
  const home = homedir();

  const pkg = readJson<{ version: string }>(paths.packageJson);
  const version = pkg?.version ?? "0.0.0";

  const checks: CheckResult[] = [];

  // Auto-fix checks
  checks.push(syncReadmeVersion(version, options.projectRoot, options.checkOnly));
  checks.push(syncPrdVersion(version, options.projectRoot, options.checkOnly));

  // Validation checks
  checks.push(checkChangelog(version, options.projectRoot));
  checks.push(checkReadmeRefs(options.projectRoot));
  checks.push(checkHookConfigs(paths.settingsJson));
  checks.push(checkHookRegistration(paths.settingsJson));
  checks.push(checkSummary(version, options.projectRoot, options.checkOnly));
  checks.push(checkClaudeMd(options.projectRoot));
  checks.push(checkObsidianVault(paths.obsidianVault));
  checks.push(checkVaultPathRefs(options.projectRoot));
  checks.push(checkSkillIndex(paths.obsidianVault));
  checks.push(checkTemplatePersonalNames(options.projectRoot));

  // The memory module's three checks, supplied rather than imported (Loop 13).
  // When it is absent they are reported as SKIPPED with the reason — never as
  // passing. "No memory module installed" and "database is healthy" are
  // different facts and must not render identically.
  const mem = options.memoryChecks;
  if (mem) {
    checks.push(mem.checkVaultIndexParity(paths.obsidianVault, paths.knowledgeV2Db));
    checks.push(mem.checkSchemaVersion(paths.knowledgeV2Db));
    checks.push(mem.checkProjectDirsExist(paths.knowledgeV2Db));
  } else {
    for (const name of ["vault-index-parity", "schema-version", "project-dirs"]) {
      checks.push({
        name,
        severity: "skip",
        message: "memory module not installed — this check reads the knowledge database and was not run",
      });
    }
  }
  checks.push(checkTemplate(options.projectRoot));
  checks.push(checkSpecProvenance(options.projectRoot));
  checks.push(checkRules(options.projectRoot));
  checks.push(checkCommandParity(options.projectRoot));
  checks.push(checkCommandToolNames(options.projectRoot));
  checks.push(checkCommandNames(options.projectRoot));
  checks.push(checkRetirements(options.projectRoot));
  // Loop 13 C3: the module boundary asserted mechanically rather than remembered.
  checks.push(checkModuleBoundary(options.projectRoot));
  // Derived artifacts: the index is advice, the build is EXECUTED by the MCP
  // server and both hooks. Separate checks — one severity for two artifacts
  // would report a single outcome for two independent claims.
  checks.push(checkGitNexusIndex(options.projectRoot));
  checks.push(checkBuildFreshness(options.projectRoot));
  checks.push(checkMirrorParity(options.projectRoot));
  // Loop 10 R1: the runtime label travels with the check, because the same code
  // passing in one process and failing in the other IS the signal.
  checks.push(checkStateSchema(version, options.projectRoot, options.runtime ?? "cli"));
  // Loop 4: R6 view headers vs state.json revision, R4 master CI conclusion,
  // R7 conflict markers in tracked files. Each prints its number unconditionally.
  checks.push(checkStateViews(options.projectRoot));
  checks.push(checkCiStatus(options.projectRoot));
  checks.push(checkMergeMarkers(options.projectRoot));
  // T-183: does the greeting still fit one tool result? Prints its count every run.
  checks.push(checkGreetingSize(version, options.projectRoot));

  const fixed = checks.filter((c) => c.severity === "fixed");
  const issues = checks.filter((c) => c.severity === "issue");
  const warnings = checks.filter((c) => c.severity === "warn");
  const passed = checks.filter((c) => c.severity === "pass");
  const skipped = checks.filter((c) => c.severity === "skip");

  return { version, projectRoot: root, checks, fixed, issues, warnings, passed, skipped };
}

export type { SyncOptions, SyncResult, CheckResult } from "./types.js";
