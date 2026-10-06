import { basename, isAbsolute, join, relative, resolve } from "node:path";

/** Thrown when a vault path segment or resolved path would escape its intended folder. */
export class VaultPathRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultPathRefusal";
  }
}

const WINDOWS_RESERVED = new Set(
  ["CON", "PRN", "AUX", "NUL", ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`), ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)],
);

function segmentEscapesRoot(rel: string): boolean {
  const parts = rel.split(/[/\\]/).filter((p) => p.length > 0);
  return parts.some((p) => p === "..");
}

function rejectSegmentChars(label: string, raw: string, base: string): void {
  if (/[\n\r\u0000]/.test(raw)) {
    throw new VaultPathRefusal(`${label}: control characters not allowed`);
  }
  if (base.includes(":")) {
    throw new VaultPathRefusal(`${label}: colon not allowed in segment`);
  }
  if (/^[a-zA-Z]:$/.test(base)) {
    throw new VaultPathRefusal(`${label}: bare drive letter not allowed`);
  }
  if (/^[a-zA-Z]:[^/\\]/.test(base)) {
    throw new VaultPathRefusal(`${label}: drive-relative path not allowed`);
  }
  const reserved = base.replace(/\.+$/, "").toUpperCase();
  if (WINDOWS_RESERVED.has(reserved)) {
    throw new VaultPathRefusal(`${label}: reserved device name not allowed`);
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
  if (trimmed.includes(":")) {
    throw new VaultPathRefusal(`${label}: colon not allowed in segment`);
  }
  if (/^[a-zA-Z]:/.test(trimmed)) {
    throw new VaultPathRefusal(`${label}: drive-relative path not allowed`);
  }
  const base = basename(trimmed);
  if (!base || base === ".") {
    throw new VaultPathRefusal(`${label}: invalid segment "${raw}"`);
  }
  if (base === "..") {
    throw new VaultPathRefusal(`${label}: invalid segment "${raw}"`);
  }
  rejectSegmentChars(label, raw, base);
  return base;
}

/** Ensure `filePath` resolves under `intendedDir` (same pattern as archiveVaultNote). */
export function assertPathUnderDir(intendedDir: string, filePath: string): void {
  const root = resolve(intendedDir);
  const resolved = resolve(filePath);
  const rel = relative(root, resolved);
  if (!rel || segmentEscapesRoot(rel) || isAbsolute(rel)) {
    throw new VaultPathRefusal(`refused vault write outside ${intendedDir}`);
  }
}

export function joinUnderVaultDir(intendedDir: string, ...segments: string[]): string {
  const path = join(intendedDir, ...segments);
  assertPathUnderDir(intendedDir, path);
  return path;
}
