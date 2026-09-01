import type Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, basename, relative } from 'node:path';

/**
 * Generate Topic notes — one per subject tag, linking every note that carries it.
 *
 * `vault-writer` emits no wikilinks, so every note it writes is born an orphan.
 * The v1 vault hid this behind 21 hand-written Maps of Content; they were last
 * touched in March, never regenerated, and their links point at v1's old
 * date-and-hash filenames, so they could not be carried across. The v2 graph was
 * therefore one hub (`SKILL-CANDIDATES.md`, 1,354 links) surrounded by isolated
 * nodes — accurate, and useless to browse.
 *
 * None of this affects retrieval. `ob_recall` reads SQLite FTS5 and skill-scan
 * clusters by tag; nothing in the system follows an Obsidian wikilink. This is a
 * human browsing affordance, and it is worth keeping that straight so a sparse
 * graph is never mistaken for broken memory.
 */

/** Marker in generated frontmatter. Only files carrying it are ever rewritten or removed. */
export const TOPICS_MARKER = 'open-brain-topics';

/** Where a note with no qualifying tag and no project lands, so nothing is orphaned. */
export const UNSORTED_TOPIC = 'unsorted';

/**
 * Project names that are not really projects and must not become a Topic.
 *
 * `General` is the fallback `projectDisplayName` returns when there is no
 * project at all — a `General` topic would be a bucket of everything unfiled,
 * which is what `unsorted` already is, named honestly.
 */
const NON_PROJECTS = new Set(['general', '']);

/**
 * Tags describing what KIND of note something is rather than what it is ABOUT.
 *
 * A Topic note for `gotcha` would link 177 entries sharing nothing but their
 * genre — the mega-cluster shape from entry 303, where a group too large to read
 * is a group nobody reads. Subject tags cluster; type tags only pile up.
 */
export const TYPE_TAGS = new Set([
  'gotcha', 'pattern', 'fix', 'reference', 'spec', 'experience',
  'checkpoint', 'session', 'note', 'research', 'paper', 'decision',
  'session-summary',
]);

export interface TopicPlan {
  tag: string;
  /** Vault-relative link targets, without the .md extension. */
  links: string[];
}

export interface TopicsOptions {
  /** Minimum notes a tag needs before it earns a Topic note. */
  min?: number;
}

/** One linkable note, whatever folder it came from. */
interface Linkable {
  vaultPath: string;
  tags: string[];
  project: string | null;
  /** Summaries group by project first; experiences group by tag first. */
  projectFirst: boolean;
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeProject(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slug = raw.trim().toLowerCase().replace(/\s+/g, '-');
  return NON_PROJECTS.has(slug) ? null : slug;
}

/**
 * Summary notes, which are not knowledge entries.
 *
 * `writeSummary` files one note per session per project and, before v0.25.0,
 * gave it only `sessionId`, `project` and `date` — no tags and no links, which
 * is why all 158 of them sat in the orphan ring. Their `project` frontmatter has
 * always been there and is the reliable grouping; tags are read too, for the
 * ones that have them.
 */
function readSummaries(vaultDir: string): Linkable[] {
  const dir = join(vaultDir, 'Summaries');
  if (!existsSync(dir)) return [];

  const out: Linkable[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.toLowerCase().endsWith('.md')) continue;
    const path = join(dir, file);
    let head = '';
    try {
      head = readFileSync(path, 'utf8').slice(0, 2000);
    } catch {
      continue;
    }
    // `[ \t]*`, not `\s*`: \s matches newlines, so an empty `project:` swallowed
    // the line break and captured the NEXT frontmatter line as the project name
    // — a summary with no project would have been filed under "date: 2026-09-01".
    // `(.*)` rather than `(.+)` so an empty value is captured as empty instead of
    // failing to match and falling through to the same wrong answer.
    const project = head.match(/^project:[ \t]*(.*)$/m)?.[1];
    const tags = head.match(/^tags:[ \t]*(.*)$/m)?.[1];
    out.push({
      vaultPath: path,
      tags: parseTags(tags),
      project: normalizeProject(project),
      projectFirst: true,
    });
  }
  return out;
}

function readEntries(db: Database.Database): Linkable[] {
  const rows = db
    .prepare(`
      SELECT vault_path, tags, project_dir FROM knowledge_index
      WHERE archived_into IS NULL AND vault_path IS NOT NULL
    `)
    .all() as { vault_path: string; tags: string | null; project_dir: string | null }[];

  return rows.map((r) => ({
    vaultPath: r.vault_path,
    tags: parseTags(r.tags),
    project: normalizeProject(r.project_dir?.split(/[\\/]/).filter(Boolean).pop() ?? null),
    projectFirst: false,
  }));
}

export function planTopics(
  db: Database.Database,
  vaultDir: string,
  opts: TopicsOptions = {},
): TopicPlan[] {
  const min = opts.min ?? 5;
  const items = [...readEntries(db), ...readSummaries(vaultDir)];

  // Basename is the idiomatic Obsidian link, but it only resolves when unique.
  // Count first, then fall back to the vault-relative path for duplicates — an
  // ambiguous link silently resolves to the wrong note.
  const nameCount = new Map<string, number>();
  for (const item of items) {
    const name = basename(item.vaultPath).replace(/\.md$/i, '');
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }
  const targetFor = (item: Linkable): string => {
    const name = basename(item.vaultPath).replace(/\.md$/i, '');
    return (nameCount.get(name) ?? 0) > 1
      ? relative(vaultDir, item.vaultPath).replace(/\\/g, '/').replace(/\.md$/i, '')
      : name;
  };

  const subjectTags = (item: Linkable) => item.tags.filter((t) => !TYPE_TAGS.has(t));

  // Pass 1 — how common is each subject tag? A tag only earns a Topic at `min`.
  const tagCount = new Map<string, number>();
  for (const item of items) {
    for (const tag of new Set(subjectTags(item))) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
  }
  const qualifies = (tag: string) => (tagCount.get(tag) ?? 0) >= min;

  // Pass 2 — assign. Every item lands somewhere, by construction: qualifying
  // subject tags, else its project, else `unsorted`. The fallbacks are NOT
  // gated by `min` — a threshold that can strand a note would make "no orphans"
  // a hope rather than a guarantee.
  const byTag = new Map<string, string[]>();
  const add = (tag: string, target: string) => {
    const list = byTag.get(tag) ?? [];
    if (!list.includes(target)) list.push(target);
    byTag.set(tag, list);
  };

  for (const item of items) {
    const target = targetFor(item);
    let placed = false;

    // A summary's project is its primary home; a session belongs to the work it
    // was part of far more than to any tag it happens to mention.
    if (item.projectFirst && item.project) {
      add(item.project, target);
      placed = true;
    }

    for (const tag of new Set(subjectTags(item))) {
      if (!qualifies(tag)) continue;
      add(tag, target);
      placed = true;
    }

    if (!placed && item.project) {
      add(item.project, target);
      placed = true;
    }
    if (!placed) add(UNSORTED_TOPIC, target);
  }

  return [...byTag.entries()]
    .map(([tag, links]) => ({ tag, links: links.sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => b.links.length - a.links.length || a.tag.localeCompare(b.tag));
}

/** Notes that no generated Topic links to. Should always be empty. */
export function findOrphans(db: Database.Database, vaultDir: string, opts: TopicsOptions = {}): string[] {
  const linked = new Set(planTopics(db, vaultDir, opts).flatMap((p) => p.links));
  const items = [...readEntries(db), ...readSummaries(vaultDir)];
  const nameCount = new Map<string, number>();
  for (const item of items) {
    const name = basename(item.vaultPath).replace(/\.md$/i, '');
    nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
  }
  return items
    .filter((item) => {
      const name = basename(item.vaultPath).replace(/\.md$/i, '');
      const target = (nameCount.get(name) ?? 0) > 1
        ? relative(vaultDir, item.vaultPath).replace(/\\/g, '/').replace(/\.md$/i, '')
        : name;
      return !linked.has(target);
    })
    .map((item) => relative(vaultDir, item.vaultPath).replace(/\\/g, '/'));
}

/** Filename-safe form of a tag. */
function topicFileName(tag: string): string {
  return tag.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || UNSORTED_TOPIC;
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
    `> Generated from the \`${plan.tag}\` tag. Edits are overwritten — retag the notes instead.`,
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
