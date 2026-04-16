import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

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
  const vaultPath = join(homePath, "Obsidian Vault");
  if (existsSync(join(vaultPath, ".git"))) {
    try {
      const lastCommit = execSync(`git -C "${vaultPath}" log -1 --format=%ct 2>/dev/null`, {
        encoding: "utf-8",
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

  // 2. Vault-writer health — check if recent sessions are being captured
  const sessionsDbDir = join(homePath, ".claude", "context-mode", "sessions");
  const vaultSessionsDir = join(vaultPath, "Sessions");
  if (existsSync(sessionsDbDir) && existsSync(vaultSessionsDir)) {
    try {
      const dbFiles = readdirSync(sessionsDbDir).filter((f) => f.endsWith(".db"));
      let newestDb: string | null = null;
      let newestMtime = 0;
      for (const f of dbFiles) {
        const s = statSync(join(sessionsDbDir, f));
        if (s.mtimeMs > newestMtime) {
          newestMtime = s.mtimeMs;
          newestDb = f;
        }
      }

      if (newestDb) {
        const vaultFiles = readdirSync(vaultSessionsDir).filter((f) => f.endsWith(".md"));
        let found = false;
        for (const vf of vaultFiles) {
          try {
            const content = readFileSync(join(vaultSessionsDir, vf), "utf-8").slice(0, 500);
            if (content.includes(newestDb)) {
              found = true;
              break;
            }
          } catch { /* skip */ }
        }

        if (!found) {
          const hoursStale = (Date.now() - newestMtime) / (1000 * 60 * 60);
          if (hoursStale > 1) {
            warnings.push({
              category: "pipeline",
              message: `session-end may be failing — session ${newestDb} (${Math.round(hoursStale)}h old) has no Obsidian capture.`,
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
