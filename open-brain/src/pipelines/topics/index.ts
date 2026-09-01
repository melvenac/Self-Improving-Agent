import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

/**
 * Generate Topic notes — one per subject tag, linking every entry that carries it.
 *
 * `vault-writer` emits no wikilinks, so every auto-written experience is born an
 * orphan. The v1 vault hid this behind 21 hand-written Maps of Content; they were
 * last touched in March, never regenerated, and their links point at v1's old
 * date-and-hash filenames, so they could not be carried across. The v2 graph is
 * therefore one hub (`SKILL-CANDIDATES.md`, 1,354 links) surrounded by isolated
 * nodes — accurate, and useless to browse.
 *
 * Tags are the signal to use: 460 of 464 entries carry them, against 170 with a
 * project. Generating from tags rather than by hand means the layer regenerates
 * with the corpus instead of freezing on the day someone got bored.
 *
 * None of this affects retrieval. `ob_recall` reads SQLite FTS5 and skill-scan
 * clusters by tag; nothing in the system follows an Obsidian wikilink. This is a
 * human browsing affordance, and it is worth keeping that straight so a broken
 * graph is never mistaken for broken memory.
 */

/** Marker in generated frontmatter. Only files carrying it are ever rewritten or removed. */
export const TOPICS_MARKER = 'open-brain-topics';

/**
 * Tags describing what KIND of note something is rather than what it is ABOUT.
 *
 * A Topic note for `gotcha` would link 177 entries that share nothing but their
 * genre — the mega-cluster shape from entry 303, where a group too large to read
 * is a group nobody reads. Subject tags cluster; type tags only pile up.
 */
export const TYPE_TAGS = new Set([
  'gotcha', 'pattern', 'fix', 'reference', 'spec', 'experience',
  'checkpoint', 'session', 'note', 'research', 'paper', 'decision',
]);

export interface TopicPlan {
  tag: string;
  /** Vault-relative link targets, without the .md extension. */
  links: string[];
}

export interface TopicsOptions {
  /** Minimum entries a tag needs before it earns a Topic note. */
  min?: number;
}

interface EntryRow {
  vault_path: string | null;
  tags: string | null;
}

export function planTopics(
  db: Database.Database,
  vaultDir: string,
  opts: TopicsOptions = {},
): TopicPlan[] {
  const min = opts.min ?? 5;
  const rows = db
    .prepare(`
      SELECT vault_path, tags FROM knowledge_index
      WHERE archived_into IS NULL AND vault_path IS NOT NULL AND tags IS NOT NULL AND tags != ''
    `)
    .all() as EntryRow[];

  // Basename is the idiomatic Obsidian link, but it only resolves when unique.
  // Count first, then fall back to the vault-relative path for duplicates —
  // an ambiguous link silently resolves to the wrong note.
  const nameCount = new Map<string, number>();
  for (const row of rows) {
    if (!row.vault_path) continue;
    const name = basename(row.vault_path).replace(/\.md$/i, '');
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }

  const byTag = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.vault_path) continue;
    const name = basename(row.vault_path).replace(/\.md$/i, '');
    const target =
      (nameCount.get(name) ?? 0) > 1
        ? relative(vaultDir, row.vault_path).replace(/\\/g, '/').replace(/\.md$/i, '')
        : name;

    for (const raw of (row.tags ?? '').split(',')) {
      const tag = raw.trim().toLowerCase();
      if (!tag || TYPE_TAGS.has(tag)) continue;
      const list = byTag.get(tag) ?? [];
      if (!list.includes(target)) list.push(target);
      byTag.set(tag, list);
    }
  }

  return [...byTag.entries()]
    .filter(([, links]) => links.length >= min)
    .map(([tag, links]) => ({ tag, links: links.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => b.links.length - a.links.length || a.tag.localeCompare(b.tag));
}

/** Filename-safe form of a tag. */
function topicFileName(tag: string): string {
  return tag.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'untagged';
}

function renderTopic(plan: TopicPlan): string {
  return [
    '---',
    'type: topic',
    `generated: ${TOPICS_MARKER}`,
    `tag: ${plan.tag}`,
    `count: ${plan.links.length}`,
    'aliases: []',
    '---',
    '',
    `# ${plan.tag}`,
    '',
    `> Generated from the \`${plan.tag}\` tag. Edits are overwritten — retag the entries instead.`,
    '',
    '## See Also',
    ...plan.links.map((l) => `[[${l}]]`),
    '',
  ].join('\n');
}

export interface TopicsResult {
  written: string[];
  removed: string[];
  /** Files in Topics/ we did not write and must not touch. */
  skippedForeign: string[];
}

export function writeTopics(vaultDir: string, plans: TopicPlan[]): TopicsResult {
  const dir = join(vaultDir, 'Topics');
  mkdirSync(dir, { recursive: true });

  const written: string[] = [];
  const removed: string[] = [];
  const skippedForeign: string[] = [];

  const wanted = new Map(plans.map((p) => [topicFileName(p.tag) + '.md', p]));

  // Anything already in Topics/ that we did not generate is someone's own note —
  // v1's hand-written MOCs were exactly that, and clobbering them would destroy
  // work no one asked us to touch.
  const existing = existsSync(dir) ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')) : [];
  const ours = new Set<string>();
  for (const file of existing) {
    let head = '';
    try {
      head = readFileSync(join(dir, file), 'utf8').slice(0, 400);
    } catch {
      skippedForeign.push(file);
      continue;
    }
    if (head.includes(`generated: ${TOPICS_MARKER}`)) ours.add(file);
    else skippedForeign.push(file);
  }

  for (const [file, plan] of wanted) {
    if (skippedForeign.includes(file)) continue; // never overwrite a hand-written note
    writeFileSync(join(dir, file), renderTopic(plan), 'utf8');
    written.push(file);
  }

  // A tag that fell below the threshold leaves a stale Topic behind unless we
  // remove it — only ever one of ours.
  for (const file of ours) {
    if (wanted.has(file)) continue;
    try {
      unlinkSync(join(dir, file));
      removed.push(file);
    } catch { /* leaving a stale topic is better than failing the run */ }
  }

  return { written, removed, skippedForeign };
}
