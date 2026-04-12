import { homedir } from "node:os";
import { resolvePaths } from "../../shared/paths.js";
import { readJson } from "../../shared/fs-utils.js";
import { syncReadmeVersion, syncPrdVersion, syncKmcpVersion, checkChangelog, checkReadmeRefs, checkHookConfigs, checkSummary, checkClaudeMd, checkObsidianVault, checkTemplate, checkInstalledDrift, checkSpecProvenance, checkRules, } from "./checks.js";
export function runSync(options) {
    const paths = resolvePaths(options.projectRoot);
    const home = homedir();
    const pkg = readJson(paths.packageJson);
    const version = pkg?.version ?? "0.0.0";
    const checks = [];
    // Auto-fix checks
    checks.push(syncReadmeVersion(version, options.projectRoot, options.checkOnly));
    checks.push(syncPrdVersion(version, options.projectRoot, options.checkOnly));
    checks.push(syncKmcpVersion(version, options.projectRoot, options.checkOnly));
    // Validation checks
    checks.push(checkChangelog(version, options.projectRoot));
    checks.push(checkReadmeRefs(options.projectRoot));
    checks.push(checkHookConfigs(paths.settingsJson));
    checks.push(checkSummary(version, options.projectRoot));
    checks.push(checkClaudeMd(options.projectRoot));
    checks.push(checkObsidianVault(paths.obsidianVault));
    checks.push(checkTemplate(options.projectRoot));
    checks.push(checkInstalledDrift(options.projectRoot, home, options.checkOnly));
    checks.push(checkSpecProvenance(options.projectRoot, paths.knowledgeDb));
    checks.push(checkRules(options.projectRoot));
    const fixed = checks.filter((c) => c.severity === "fixed");
    const issues = checks.filter((c) => c.severity === "issue");
    const warnings = checks.filter((c) => c.severity === "warn");
    const passed = checks.filter((c) => c.severity === "pass");
    return { version, checks, fixed, issues, warnings, passed };
}
//# sourceMappingURL=index.js.map