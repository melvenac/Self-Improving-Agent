import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { obsidianVaultDir } from "../../shared/paths.js";

export interface HealthWarning {
  category: string;
  message: string;
}

export interface HealthCheckResult {
  warnings: HealthWarning[];
  pendingSkillProposals: number;
}

/**
 * Run lightweight health checks at session start.
 * These surface early warnings before the user types anything.
 */
export function runHealthChecks(homePath: string): HealthCheckResult {
  const warnings: HealthWarning[] = [];
  let pendingSkillProposals = 0;

  // 1. Obsidian backup freshness
  const vaultPath = obsidianVaultDir(homePath);
  if (existsSync(join(vaultPath, ".git"))) {
    try {
      // Suppress git's stderr via stdio, not a `2>/dev/null` redirect: execSync
      // runs through cmd.exe on Windows, where /dev/null is not a path, so the
      // redirect printed "The system cannot find the path specified." on every
      // SessionStart while failing to suppress anything.
      const lastCommit = execSync(`git -C "${vaultPath}" log -1 --format=%ct`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (lastCommit) {
        const hoursAgo = (Date.now() - parseInt(lastCommit) * 1000) / (1000 * 60 * 60);
        if (hoursAgo > 36) {
          warnings.push({
            category: "backup",
            message: `Obsidian Vault last backed up ${Math.round(hoursAgo)}h ago (expected nightly). Check backup task.`,
          });
        }
      }
    } catch { /* git not available */ }
  }

  // 2. Vault-writer health — is the most recent session actually being captured?
  //
  // This keyed off context-mode session .db filenames matched against a
  // Sessions/ folder. Neither is how v2 works: captures are written to
  // Summaries/ with the session UUID in frontmatter, and v2 has no Sessions/
  // directory at all. The old shape therefore reported a permanent false
  // "session-end may be failing", and once the vault path was corrected it
  // silently stopped running instead — an existsSync guard over a directory
  // that never exists is a check that can only ever pass.
  //
  // Session identity here is the transcript UUID under ~/.claude/projects.
  const transcriptsDir = join(homePath, ".claude", "projects");
  const summariesDir = join(vaultPath, "Summaries");
  if (existsSync(transcriptsDir)) {
    try {
      let newestSession: string | null = null;
      let newestMtime = 0;
      for (const projectDir of readdirSync(transcriptsDir)) {
        const full = join(transcriptsDir, projectDir);
        let files: string[];
        try {
          files = readdirSync(full).filter((f) => f.endsWith(".jsonl"));
        } catch { continue; }
        for (const f of files) {
          const s = statSync(join(full, f));
          if (s.mtimeMs > newestMtime) {
            newestMtime = s.mtimeMs;
            newestSession = f.replace(/\.jsonl$/, "");
          }
        }
      }

      const hoursStale = (Date.now() - newestMtime) / (1000 * 60 * 60);

      // The current session is still open and has no summary yet by definition,
      // so only judge a transcript once it has gone quiet for an hour.
      if (newestSession && hoursStale > 1) {
        if (!existsSync(summariesDir)) {
          warnings.push({
            category: "pipeline",
            message: `vault has no Summaries/ directory at ${summariesDir} — session captures cannot be verified.`,
          });
        } else {
          let found = false;
          for (const sf of readdirSync(summariesDir).filter((f) => f.endsWith(".md"))) {
            try {
              if (readFileSync(join(summariesDir, sf), "utf-8").slice(0, 500).includes(newestSession)) {
                found = true;
                break;
              }
            } catch { /* skip unreadable */ }
          }
          if (!found) {
            warnings.push({
              category: "pipeline",
              message: `session-end may be failing — session ${newestSession} (${Math.round(hoursStale)}h old) has no Obsidian capture.`,
            });
          }
        }
      }
    } catch { /* don't block startup */ }
  }

  // 3. Pending skill proposals
  const pendingPath = join(vaultPath, ".skill-proposals-pending.json");
  if (existsSync(pendingPath)) {
    try {
      const pending = JSON.parse(readFileSync(pendingPath, "utf-8"));
      if (Array.isArray(pending) && pending.length > 0) {
        pendingSkillProposals = pending.length;
      }
    } catch { /* ignore parse errors */ }
  }

  return { warnings, pendingSkillProposals };
}
