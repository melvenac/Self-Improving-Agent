import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Repo root (sia-builder), not open-brain/. */
export const REPO_ROOT = join(import.meta.dirname, "../../..");

export function gitStatusPorcelain(cwd: string): string {
  return execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" }).trim();
}

function gitMerging(cwd: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "-q", "--verify", "MERGE_HEAD"], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function expectRepoClean(cwd: string): void {
  if (gitMerging(cwd)) return;
  const st = gitStatusPorcelain(cwd);
  const fleetPaths = [".agents/roles/developer.md", ".cursor/rules/developer-building-checks.mdc"];
  const dirtyFleet = st
    .split("\n")
    .filter((l) => l.trim() !== "")
    .filter((l) => fleetPaths.some((p) => l.includes(p)));
  if (dirtyFleet.length > 0) {
    throw new Error(`fleet-ae tests must not dirty tracked cursor-rule files:\n${dirtyFleet.join("\n")}`);
  }
}

/** Minimal tree for gen-cursor-rules / cursor-rules-current tests; writes nothing under REPO_ROOT. */
export function seedFleetAeCursorProject(dir: string, opts: { developerMd?: string } = {}): void {
  mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(dir, ".cursor", "rules"), { recursive: true });
  const dev =
    opts.developerMd ?? readFileSync(join(REPO_ROOT, ".agents/roles/developer.md"), "utf8");
  writeFileSync(join(dir, ".agents/roles/developer.md"), dev);
  cpSync(join(REPO_ROOT, ".agents/SYSTEM/required-block.json"), join(dir, ".agents/SYSTEM/required-block.json"));
}

export function mkFleetAeTemp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}
