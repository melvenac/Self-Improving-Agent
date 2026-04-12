import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function deriveProjectKey(projectPath: string): string {
  return projectPath
    .replace(/:\\/g, "--")
    .replace(/:\//g, "--")
    .replace(/[\\/]/g, "-");
}

export function discoverSessionUuid(projectPath: string, homePath: string): string | null {
  const projectsDir = join(homePath, ".claude", "projects");
  if (!existsSync(projectsDir)) return null;

  const expectedKey = deriveProjectKey(projectPath).toLowerCase();

  // Case-insensitive directory match
  let matchedDir: string | null = null;
  try {
    const dirs = readdirSync(projectsDir);
    for (const dir of dirs) {
      if (dir.toLowerCase() === expectedKey) {
        matchedDir = join(projectsDir, dir);
        break;
      }
    }
  } catch {
    return null;
  }

  if (!matchedDir || !existsSync(matchedDir)) return null;

  // Find newest UUID-shaped .jsonl file
  try {
    const files = readdirSync(matchedDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.replace(".jsonl", ""))
      .filter((f) => UUID_PATTERN.test(f));

    if (files.length === 0) return null;

    // Sort by mtime descending
    const sorted = files.sort((a, b) => {
      const aStat = statSync(join(matchedDir!, `${a}.jsonl`));
      const bStat = statSync(join(matchedDir!, `${b}.jsonl`));
      return bStat.mtimeMs - aStat.mtimeMs;
    });

    return sorted[0];
  } catch {
    return null;
  }
}
