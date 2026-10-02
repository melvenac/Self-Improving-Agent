import { readdirSync } from "node:fs";
import { join } from "node:path";
import { obsidianVaultDir } from "../../shared/paths.js";
import type { CheckResult } from "./types.js";

/**
 * T-042: test artifacts in the REAL Obsidian vault.
 *
 * The suite once wrote session summaries named `<date>-ob-server-<slug>.md` into the developer's real vault: 57 files
 * before April, 13 more on 2026-08-31, both found by accident (an /end step happened to list `Summaries/`), never by a
 * check. There is a preventer (`tests/setup-env.ts`, and `obsidianVaultDir()` throws under vitest when it would resolve to
 * the real vault) and, until this, no detector. `server.test.ts` names its temp project `ob-server-<mkdtemp slug>`, and
 * `writeSummary` names the note for it.
 *
 * LIMIT: a file NAME rule (`ob-server-<slug>.md`, any folder, dot-folders skipped). A test artifact named any other way is
 * not seen, and nothing is read from inside a note. The vault is the directory `obsidianVaultDir()` resolves.
 */
const ARTIFACT = /(^|-)ob-server-[a-z0-9]+\.md$/i;
const MAX_LISTED = 10;

export interface VaultScan {
  /** Vault-relative, forward-slash paths of the artifacts. */
  found: string[];
  /** `.md` notes examined. */
  notes: number;
  /** Directories that could not be listed, with the error code. They are not a clean bill. */
  unreadable: string[];
}

type ReadDir = (path: string, options: { withFileTypes: true }) => import("node:fs").Dirent[];

export function scanVaultForTestArtifacts(vaultDir: string, readDir: ReadDir = readdirSync as unknown as ReadDir): VaultScan {
  const scan: VaultScan = { found: [], notes: 0, unreadable: [] };
  const walk = (abs: string, rel: string): void => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readDir(abs, { withFileTypes: true });
    } catch (err) {
      scan.unreadable.push(`${rel || "."} (${(err as NodeJS.ErrnoException).code ?? "error"})`);
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith(".")) continue; // .obsidian, .git: not notes
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(join(abs, ent.name), childRel);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".md")) {
        scan.notes += 1;
        if (ARTIFACT.test(ent.name)) scan.found.push(childRel);
      }
    }
  };
  walk(vaultDir, "");
  scan.found.sort();
  return scan;
}

export function checkVaultPollution(_projectRoot: string, vaultDir?: string): CheckResult {
  const name = "vault-pollution";
  let dir: string;
  try {
    dir = vaultDir ?? obsidianVaultDir();
  } catch (err) {
    return { name, report: true, severity: "skip", message: `not checked: the vault path could not be resolved (${(err as Error).message.split("\n")[0]})` };
  }
  const shown = dir.replace(/\\/g, "/");
  try {
    readdirSync(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "error";
    return { name, report: true, severity: "skip", message: `not checked: no readable vault at ${shown} (${code}), so ob-server-* artifacts were not looked for. This is not a pass.` };
  }
  const scan = scanVaultForTestArtifacts(dir);
  const unreadable = scan.unreadable.length > 0 ? `; ${scan.unreadable.length} director${scan.unreadable.length === 1 ? "y" : "ies"} unreadable (${scan.unreadable.join(", ")})` : "; 0 directories unreadable";
  if (scan.found.length === 0) {
    return { name, report: true, severity: "pass", message: `0 ob-server-* files in ${scan.notes} .md files under the vault${unreadable}` };
  }
  const listed = scan.found.slice(0, MAX_LISTED).join("; ");
  const more = scan.found.length > MAX_LISTED ? `; +${scan.found.length - MAX_LISTED} more` : "";
  return {
    name,
    report: true,
    severity: "warn",
    message: `${scan.found.length} ob-server-* file(s) in the vault at ${shown} (of ${scan.notes} .md files): ${listed}${more}. These are test artifacts written outside isolation; delete them with Aaron's approval${unreadable}`,
  };
}
