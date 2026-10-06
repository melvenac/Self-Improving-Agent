import { basename, isAbsolute, join, relative, resolve } from "node:path";

/** Thrown when a vault path segment or resolved path would escape its intended folder. */
export class VaultPathRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultPathRefusal";
  }
}

/**
 * A single directory name safe to join under a vault folder (Experiences/, etc.).
 * Basename only — rejects traversal, separators, absolute paths, and drive paths.
 */
export function safeVaultPathSegment(label: string, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new VaultPathRefusal(`${label}: empty path segment`);
  }
  if (isAbsolute(trimmed) || /^[a-zA-Z]:[/\\]/.test(trimmed)) {
    throw new VaultPathRefusal(`${label}: absolute path not allowed`);
  }
  if (/[/\\]/.test(trimmed)) {
    throw new VaultPathRefusal(`${label}: path separators not allowed`);
  }
  const base = basename(trimmed);
  if (!base || base === "." || base === "..") {
    throw new VaultPathRefusal(`${label}: invalid segment "${raw}"`);
  }
  return base;
}

/** Ensure `filePath` resolves under `intendedDir` (same pattern as archiveVaultNote). */
export function assertPathUnderDir(intendedDir: string, filePath: string): void {
  const root = resolve(intendedDir);
  const resolved = resolve(filePath);
  const rel = relative(root, resolved);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
    throw new VaultPathRefusal(`refused vault write outside ${intendedDir}`);
  }
}

export function joinUnderVaultDir(intendedDir: string, ...segments: string[]): string {
  const path = join(intendedDir, ...segments);
  assertPathUnderDir(intendedDir, path);
  return path;
}
