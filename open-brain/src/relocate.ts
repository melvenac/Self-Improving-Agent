import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { canonicalizeProjectDir, projectDisplayName } from './shared/paths.js';

/**
 * Fold a project's stored history onto a renamed directory.
 *
 * `project_dir` is an identity key, and a key derived from a path breaks the
 * moment the path is renamed. Renaming `Tarrant County Makerspace` to
 * `Tarrant-County-Makerspace` — a reasonable thing to do, spaces are miserable
 * to `cd` into — left 16 knowledge rows, 8 sessions and 15 vault notes keyed to
 * a directory that no longer exists. A project-scoped `ob_recall` from the real
 * repo then returned about 60% of that project's memory and looked healthy
 * doing it, because a partial result and a complete one are the same shape.
 *
 * `canonicalizeProjectDir` deliberately does NOT fix this: it normalizes
 * separators and drive-letter case, and it must not go further. Folding spaces
 * to hyphens would corrupt every project whose directory legitimately contains
 * a space. A rename is information the filesystem cannot supply — someone has
 * to say "these two are the same project", which is what this command is for.
 */
export interface NoteMove {
  from: string;
  to: string;
}

export interface RelocatePlan {
  fromCanonical: string;
  toCanonical: string;
  toDisplay: string;
  knowledgeRows: number;
  sessionRows: number;
  noteMoves: NoteMove[];
  /** Target paths already occupied — never overwritten, reported instead. */
  collisions: NoteMove[];
  targetExistsOnDisk: boolean;
}

export function planRelocate(
  db: Database.Database,
  vaultDir: string,
  fromRaw: string,
  toRaw: string,
): RelocatePlan {
  const fromCanonical = canonicalizeProjectDir(fromRaw);
  const toCanonical = canonicalizeProjectDir(toRaw);
  if (!fromCanonical || !toCanonical) {
    throw new Error('relocate: both --from and --to must be non-empty project directories');
  }
  if (fromCanonical === toCanonical) {
    throw new Error(`relocate: --from and --to canonicalize to the same value (${fromCanonical})`);
  }

  const fromDisplay = projectDisplayName(fromRaw);
  const toDisplay = projectDisplayName(toRaw);

  const knowledgeRows = (db
    .prepare(`SELECT COUNT(*) AS c FROM knowledge_index WHERE project_dir = ?`)
    .get(fromCanonical) as { c: number }).c;

  const sessionRows = (db
    .prepare(`SELECT COUNT(*) AS c FROM sessions WHERE project_dir = ?`)
    .get(fromCanonical) as { c: number }).c;

  const oldFolder = join(vaultDir, 'Experiences', fromDisplay);
  const newFolder = join(vaultDir, 'Experiences', toDisplay);

  const noteMoves: NoteMove[] = [];
  const collisions: NoteMove[] = [];

  const rows = db
    .prepare(`SELECT vault_path FROM knowledge_index WHERE project_dir = ? AND vault_path IS NOT NULL`)
    .all(fromCanonical) as { vault_path: string }[];

  for (const row of rows) {
    // Only notes actually sitting in the old project folder move. A note filed
    // elsewhere keeps its path; re-parenting it would invent a location the
    // rename never implied.
    if (dirname(row.vault_path).toLowerCase() !== oldFolder.toLowerCase()) continue;
    const move = { from: row.vault_path, to: join(newFolder, basename(row.vault_path)) };
    // A same-name note already in the target folder is two different notes, not
    // one to overwrite. Report and leave both alone.
    if (existsSync(move.to) && move.to.toLowerCase() !== move.from.toLowerCase()) collisions.push(move);
    else noteMoves.push(move);
  }

  return {
    fromCanonical,
    toCanonical,
    toDisplay,
    knowledgeRows,
    sessionRows,
    noteMoves,
    collisions,
    targetExistsOnDisk: existsSync(toRaw),
  };
}

export interface RelocateResult {
  knowledgeRows: number;
  sessionRows: number;
  notesMoved: number;
  noteFailures: { path: string; reason: string }[];
}

/**
 * Apply a plan. Rows and note paths move in one transaction so a half-relocated
 * project cannot outlive the command; filesystem moves happen first, and any
 * note that fails to move is reported rather than swallowed — its row keeps the
 * old `vault_path` so the pair stays consistent.
 */
export function applyRelocate(
  db: Database.Database,
  plan: RelocatePlan,
): RelocateResult {
  const noteFailures: { path: string; reason: string }[] = [];
  const moved: NoteMove[] = [];

  for (const move of plan.noteMoves) {
    if (!existsSync(move.from)) {
      // The row points at a note that is already gone. Still relocate the row —
      // a dangling path under the new name is no worse than under the old, and
      // dropping it here would silently strip the entry from its project.
      moved.push(move);
      continue;
    }
    try {
      mkdirSync(dirname(move.to), { recursive: true });
      renameSync(move.from, move.to);
      moved.push(move);
    } catch (e) {
      noteFailures.push({ path: move.from, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  const run = db.transaction(() => {
    const updatePath = db.prepare(`UPDATE knowledge_index SET vault_path = ?, updated_at = datetime('now') WHERE vault_path = ?`);
    for (const move of moved) updatePath.run(move.to, move.from);

    const k = db
      .prepare(`UPDATE knowledge_index SET project_dir = ?, updated_at = datetime('now') WHERE project_dir = ?`)
      .run(plan.toCanonical, plan.fromCanonical).changes;

    const s = db
      .prepare(`UPDATE sessions SET project_dir = ? WHERE project_dir = ?`)
      .run(plan.toCanonical, plan.fromCanonical).changes;

    return { k, s };
  });

  const { k, s } = run();
  return { knowledgeRows: k, sessionRows: s, notesMoved: moved.length, noteFailures };
}

export interface MissingProject {
  projectDir: string;
  entries: number;
  sessions: number;
}

/**
 * Project directories that no longer resolve on disk.
 *
 * This is the detector the rename above needed and did not have. It catches any
 * rename, move or deletion — not just the space-to-hyphen case — because it
 * asks the filesystem rather than guessing a normalization rule. Reported, never
 * auto-repaired: a directory can be legitimately absent (archived project, another
 * machine), and only a person knows whether a missing path means "renamed to
 * that one" or "gone".
 */
export function detectMissingProjects(db: Database.Database): MissingProject[] {
  const rows = db
    .prepare(`
      SELECT project_dir AS p, COUNT(*) AS c
      FROM knowledge_index
      WHERE project_dir IS NOT NULL AND project_dir != '' AND project_dir LIKE '%/%'
      GROUP BY project_dir
    `)
    .all() as { p: string; c: number }[];

  const out: MissingProject[] = [];
  for (const row of rows) {
    if (existsSync(row.p)) continue;
    const s = (db
      .prepare(`SELECT COUNT(*) AS c FROM sessions WHERE project_dir = ?`)
      .get(row.p) as { c: number }).c;
    out.push({ projectDir: row.p, entries: row.c, sessions: s });
  }
  return out.sort((a, b) => b.entries - a.entries);
}
