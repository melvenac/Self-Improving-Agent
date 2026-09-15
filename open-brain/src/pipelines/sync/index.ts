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
  checkVaultIndexParity,
  checkVaultPathRefs,
  checkSkillIndex,
  checkTemplatePersonalNames,
  checkSchemaVersion,
  checkProjectDirsExist,
  checkTemplate,
  checkSpecProvenance,
  checkRules,
  checkMirrorParity,
  checkStateSchema,
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
  checks.push(checkVaultIndexParity(paths.obsidianVault, paths.knowledgeV2Db));
  checks.push(checkVaultPathRefs(options.projectRoot));
  checks.push(checkSkillIndex(paths.obsidianVault));
  checks.push(checkTemplatePersonalNames(options.projectRoot));
  checks.push(checkSchemaVersion(paths.knowledgeV2Db));
  checks.push(checkProjectDirsExist(paths.knowledgeV2Db));
  checks.push(checkTemplate(options.projectRoot));
  checks.push(checkSpecProvenance(options.projectRoot));
  checks.push(checkRules(options.projectRoot));
  checks.push(checkMirrorParity(options.projectRoot));
  checks.push(checkStateSchema(version, options.projectRoot));
  // Loop 4: R6 view headers vs state.json revision, R4 master CI conclusion,
  // R7 conflict markers in tracked files. Each prints its number unconditionally.
  checks.push(checkStateViews(options.projectRoot));
  checks.push(checkCiStatus(options.projectRoot));
  checks.push(checkMergeMarkers(options.projectRoot));

  const fixed = checks.filter((c) => c.severity === "fixed");
  const issues = checks.filter((c) => c.severity === "issue");
  const warnings = checks.filter((c) => c.severity === "warn");
  const passed = checks.filter((c) => c.severity === "pass");
  const skipped = checks.filter((c) => c.severity === "skip");

  return { version, projectRoot: root, checks, fixed, issues, warnings, passed, skipped };
}

export type { SyncOptions, SyncResult, CheckResult } from "./types.js";
