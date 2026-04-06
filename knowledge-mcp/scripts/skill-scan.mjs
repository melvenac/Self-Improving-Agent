/**
 * skill-scan.mjs — SessionEnd hook (runs after session-end.mjs)
 * Scans Obsidian Experiences/ for tag clusters, diffs against SKILL-CANDIDATES.md,
 * and writes proposals when new clusters cross the 3+ threshold.
 *
 * Domain scoping: if the current project has .agents/SYSTEM/domains.json,
 * only clusters matching those domains are reported. Without it, all clusters show.
 *
 * Usage:
 *   node skill-scan.mjs                    # uses cwd to find domains.json
 *   node skill-scan.mjs --project /path    # explicit project path
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

const VAULT = join(homedir(), 'Obsidian Vault');
const EXPERIENCES_DIR = join(VAULT, 'Experiences');
const CANDIDATES_FILE = join(VAULT, 'Skill-Candidates', 'SKILL-CANDIDATES.md');
const SKILL_INDEX_FILE = join(VAULT, 'Skill-Candidates', 'SKILL-INDEX.md');
const LOG_FILE = join(VAULT, '.vault-writer.log');
const PROPOSALS_FILE = join(VAULT, '.skill-proposals-pending.json');
const CLUSTER_THRESHOLD = 3;

// --- Domain tag expansion map (shared with backfill-concepts.mjs) ---
const TAG_EXPANSION = {
  stripe:       ['payments', 'billing'],
  checkout:     ['payments', 'billing'],
  subscription: ['payments', 'billing'],
  webhook:      ['event-handling', 'integration'],
  clerk:        ['authentication', 'identity'],
  oauth:        ['authentication', 'identity'],
  auth:         ['authentication', 'identity'],
  tailwind:     ['styling', 'frontend'],
  css:          ['styling', 'frontend'],
  shadcn:       ['styling', 'frontend', 'ui-components'],
  nextjs:       ['frontend', 'web-framework'],
  next:         ['frontend', 'web-framework'],
  react:        ['frontend', 'ui-components'],
  convex:       ['backend', 'database', 'serverless'],
  sqlite:       ['database', 'storage'],
  fts5:         ['search', 'database'],
  docker:       ['deployment', 'infrastructure', 'containers'],
  coolify:      ['deployment', 'infrastructure', 'hosting'],
  traefik:      ['deployment', 'networking', 'reverse-proxy'],
  aws:          ['deployment', 'cloud', 'infrastructure'],
  cloudflare:   ['deployment', 'networking', 'dns'],
  vps:          ['deployment', 'infrastructure', 'server'],
  git:          ['version-control', 'dev-tools'],
  github:       ['version-control', 'ci-cd'],
  typescript:   ['language', 'dev-tools'],
  windows:      ['platform', 'os-specific'],
  mcp:          ['ai-tooling', 'model-context-protocol'],
  agents:       ['ai-agents', 'automation'],
  claude:       ['ai-tooling', 'llm'],
  replicate:    ['ai-media', 'image-generation'],
  flux:         ['ai-media', 'image-generation'],
  lora:         ['ai-media', 'model-training'],
  notebooklm:   ['research', 'knowledge-management'],
  telegram:     ['messaging', 'communication'],
  roundcube:    ['email', 'self-hosted'],
};

function log(msg) {
  const line = `[skill-scan] ${new Date().toISOString()} ${msg}\n`;
  try { appendFileSync(LOG_FILE, line); } catch {}
}

function today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Noise tags that don't represent skill-worthy domains
 */
const NOISE_TAGS = new Set([
  'test', 'marker', 'green-flamingo', 'purple-octopus',
  'session-summary', 'gotcha', 'pattern', 'decision', 'fix', 'optimization'
]);

/**
 * Parse --project flag or use cwd, then load domains.json if it exists.
 * Returns null if no domain filtering (backward-compatible).
 */
function loadDomainFilter() {
  let projectPath = process.cwd();

  const projIdx = process.argv.indexOf('--project');
  if (projIdx !== -1 && process.argv[projIdx + 1]) {
    projectPath = resolve(process.argv[projIdx + 1]);
  }

  const domainsFile = join(projectPath, '.agents', 'SYSTEM', 'domains.json');
  if (!existsSync(domainsFile)) {
    log(`No domains.json at ${domainsFile} — scanning all domains`);
    return null;
  }

  try {
    const config = JSON.parse(readFileSync(domainsFile, 'utf8'));
    const domains = new Set(config.domains || []);

    // Forward-expand only: if an impl tag is directly listed in domains,
    // include its domain expansions. But do NOT reverse-map — if "database"
    // is listed, that doesn't mean "convex" (which also maps to "database")
    // becomes relevant. Only explicitly listed tags and their forward expansions.
    const allRelevant = new Set(domains);
    for (const [implTag, domainTags] of Object.entries(TAG_EXPANSION)) {
      if (domains.has(implTag)) {
        for (const dt of domainTags) allRelevant.add(dt);
      }
    }

    log(`Domain filter loaded: ${allRelevant.size} tags from ${domainsFile}`);
    return { relevant: allRelevant, includeUntagged: config.include_untagged || false };
  } catch (err) {
    log(`Error reading domains.json: ${err.message} — scanning all domains`);
    return null;
  }
}

/**
 * Check if a tag is relevant to the current project's domains.
 */
function isRelevantTag(tag, domainFilter) {
  if (!domainFilter) return true; // no filter = everything relevant
  return domainFilter.relevant.has(tag);
}

/**
 * Parse frontmatter tags from an experience .md file
 */
function parseTags(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const tagsMatch = fmMatch[1].match(/tags:\s*\[([^\]]*)\]/);
  if (!tagsMatch) return [];
  return tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
}

/**
 * Parse previous candidates file to get last scan's cluster counts
 */
function parsePreviousCounts(content) {
  const counts = {};
  const dateMatch = content.match(/date:\s*(\S+)/);
  const previousDate = dateMatch ? dateMatch[1] : null;

  const clusterRegex = /###\s+(\S+)\s+\((\d+)\s+experiences?\)/g;
  let match;
  while ((match = clusterRegex.exec(content)) !== null) {
    const tag = match[1];
    const count = parseInt(match[2]);
    if (!counts[tag]) counts[tag] = count;
  }
  return { counts, previousDate };
}

/**
 * Check which skills already exist in SKILL-INDEX.md
 */
function parseExistingSkills(content) {
  const skills = [];
  const lower = content.toLowerCase();
  const knownTags = ['convex', 'docker', 'deployment', 'python', 'ai-first', 'replicate', 'coolify', 'stripe',
    'sqlite', 'mcp', 'knowledge', 'embeddings', 'obsidian', 'typescript', 'agents'];
  for (const tag of knownTags) {
    if (lower.includes(tag)) skills.push(tag);
  }
  return skills;
}

function clusterFileOverlap(a, b) {
  const filesA = new Set(a.files || []);
  const filesB = new Set(b.files || []);
  if (filesA.size === 0 || filesB.size === 0) return 0;
  const intersection = [...filesA].filter(f => filesB.has(f));
  return intersection.length / Math.min(filesA.size, filesB.size);
}

function consolidateClusters(clusters, overlapThreshold = 0.6) {
  const merged = [...clusters.map(c => ({
    tags: c.tags || [c.tag],
    count: c.count || (c.files ? c.files.length : 0),
    files: [...(c.files || [])],
    date: new Date().toISOString().split('T')[0],
    consolidated_from: 1,
  }))];

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const overlap = clusterFileOverlap(merged[i], merged[j]);
        if (overlap > overlapThreshold) {
          merged[i] = {
            tags: [...new Set([...merged[i].tags, ...merged[j].tags])],
            count: new Set([...merged[i].files, ...merged[j].files]).size,
            files: [...new Set([...merged[i].files, ...merged[j].files])],
            date: merged[i].date,
            consolidated_from: merged[i].consolidated_from + merged[j].consolidated_from,
          };
          merged.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return merged;
}

function main() {
  log('Starting skill scan');

  const domainFilter = loadDomainFilter();

  // 1. Scan experiences
  if (!existsSync(EXPERIENCES_DIR)) {
    log('Experiences directory not found — skipping');
    return;
  }

  const files = readdirSync(EXPERIENCES_DIR).filter(f => f.endsWith('.md'));
  const clusters = {};         // all clusters (for full report)
  const filteredClusters = {}; // domain-filtered clusters (for proposals)

  for (const file of files) {
    try {
      const content = readFileSync(join(EXPERIENCES_DIR, file), 'utf8');
      const tags = parseTags(content);
      for (const tag of tags) {
        if (NOISE_TAGS.has(tag)) continue;
        if (!clusters[tag]) clusters[tag] = [];
        clusters[tag].push(file.replace('.md', ''));

        if (isRelevantTag(tag, domainFilter)) {
          if (!filteredClusters[tag]) filteredClusters[tag] = [];
          filteredClusters[tag].push(file.replace('.md', ''));
        }
      }
    } catch (err) {
      log(`Error reading ${file}: ${err.message}`);
    }
  }

  // 2. Filter to significant clusters (use filtered for proposals, all for report)
  const allSignificant = Object.entries(clusters)
    .filter(([_, files]) => files.length >= CLUSTER_THRESHOLD)
    .sort((a, b) => b[1].length - a[1].length);

  const significant = Object.entries(filteredClusters)
    .filter(([_, files]) => files.length >= CLUSTER_THRESHOLD)
    .sort((a, b) => b[1].length - a[1].length);

  const approaching = Object.entries(filteredClusters)
    .filter(([_, files]) => files.length === CLUSTER_THRESHOLD - 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  // 3. Diff against previous scan
  let previousCounts = {};
  let previousDate = null;
  if (existsSync(CANDIDATES_FILE)) {
    try {
      const prev = readFileSync(CANDIDATES_FILE, 'utf8');
      const parsed = parsePreviousCounts(prev);
      previousCounts = parsed.counts;
      previousDate = parsed.previousDate;
    } catch {}
  }

  let existingSkills = [];
  if (existsSync(SKILL_INDEX_FILE)) {
    try {
      existingSkills = parseExistingSkills(readFileSync(SKILL_INDEX_FILE, 'utf8'));
    } catch {}
  }

  const newClusters = [];
  const growingClusters = [];

  for (const [tag, tagFiles] of significant) {
    const prevCount = previousCounts[tag] || 0;
    if (prevCount === 0) {
      newClusters.push({ tag, count: tagFiles.length, files: tagFiles });
    } else if (tagFiles.length > prevCount) {
      growingClusters.push({ tag, count: tagFiles.length, prevCount, files: tagFiles });
    }
  }

  // 4. Write updated SKILL-CANDIDATES.md
  const filterLabel = domainFilter
    ? `Filtered to ${domainFilter.relevant.size} project-relevant domain tags.`
    : 'No domain filter — showing all clusters.';

  let md = `---\ndate: ${today()}\ntype: skill-scan\nprevious-scan: ${previousDate || 'none'}\n---\n\n`;
  md += `# Skill Candidates\n\n`;
  md += `> Auto-generated by \`skill-scan.mjs\` on ${today()}.\n`;
  md += `> Clusters of ${CLUSTER_THRESHOLD}+ experiences suggest a reusable skill could be distilled.\n`;
  md += `> ${filterLabel}\n\n`;

  if (domainFilter) {
    md += `## Project-Relevant Clusters\n\n`;
  } else {
    md += `## By Tag\n\n`;
  }

  for (const [tag, tagFiles] of significant) {
    const hasSkill = existingSkills.includes(tag);
    const isNew = !previousCounts[tag];
    const isGrowing = previousCounts[tag] && tagFiles.length > previousCounts[tag];
    const status = [];
    if (hasSkill) status.push('has skill');
    if (isNew) status.push('NEW');
    if (isGrowing) status.push('growing');

    md += `### ${tag} (${tagFiles.length} experiences)${status.length ? ' — ' + status.join(', ') : ''}\n\n`;
    if (hasSkill) {
      md += `**Status:** Skill exists — consider updating if new experiences add novel patterns\n\n`;
    } else {
      md += `**Potential skill:** "${tag}" patterns and gotchas\n\n`;
    }
    for (const f of tagFiles) {
      md += `- [[${f}]]\n`;
    }
    md += '\n';
  }

  // Show filtered-out clusters in a collapsed section
  if (domainFilter) {
    const filteredOut = allSignificant.filter(([tag]) => !filteredClusters[tag] || filteredClusters[tag].length < CLUSTER_THRESHOLD);
    if (filteredOut.length > 0) {
      md += `## Other Clusters (outside project domains)\n\n`;
      md += `> These clusters exist but aren't relevant to the current project's domains.\n\n`;
      for (const [tag, tagFiles] of filteredOut) {
        md += `- **${tag}** (${tagFiles.length})\n`;
      }
      md += '\n';
    }
  }

  if (approaching.length > 0) {
    md += `## Approaching Threshold (${CLUSTER_THRESHOLD - 1} experiences)\n\n`;
    for (const [tag, tagFiles] of approaching) {
      md += `- **${tag}** (${tagFiles.length}) — one more experience triggers proposal\n`;
    }
    md += '\n';
  }

  // Diff table
  if (previousDate) {
    md += `## Scan Diff (vs ${previousDate})\n\n`;
    md += `| Cluster | Previous | Current | Change |\n|---|---|---|---|\n`;
    const allTags = new Set([...Object.keys(previousCounts), ...significant.map(([t]) => t)]);
    for (const tag of [...allTags].sort()) {
      const prev = previousCounts[tag] || 0;
      const curr = filteredClusters[tag]?.length || 0;
      if (curr < CLUSTER_THRESHOLD && prev < CLUSTER_THRESHOLD) continue;
      const change = prev === 0 ? 'NEW' : curr === prev ? 'unchanged' : curr > prev ? `+${curr - prev}` : `${curr - prev}`;
      md += `| ${tag} | ${prev || '—'} | ${curr} | ${change} |\n`;
    }
    md += '\n';
  }

  md += `---\n\n*Last scan: ${today()}. Runs automatically at session end via skill-scan.mjs hook.*\n`;

  writeFileSync(CANDIDATES_FILE, md);
  log(`Updated SKILL-CANDIDATES.md — ${significant.length} relevant clusters (${allSignificant.length} total), ${newClusters.length} new, ${growingClusters.length} growing`);

  // 5. Log summary
  const summary = [
    `[skill-scan] ${today()}`,
    `Experiences scanned: ${files.length}`,
    `Domain filter: ${domainFilter ? `active (${domainFilter.relevant.size} tags)` : 'off (all domains)'}`,
    `Relevant clusters (${CLUSTER_THRESHOLD}+): ${significant.map(([t, f]) => `${t}(${f.length})`).join(', ') || 'none'}`,
    `Filtered out: ${domainFilter ? allSignificant.length - significant.length : 0} clusters`,
    `New proposals: ${newClusters.map(c => `${c.tag}(${c.count})`).join(', ') || 'none'}`,
    `Growth: ${growingClusters.map(c => `${c.tag} ${c.prevCount}→${c.count}`).join(', ') || 'none'}`,
    `Approaching: ${approaching.map(([t, f]) => `${t}(${f.length})`).join(', ') || 'none'}`
  ];

  for (const line of summary) log(line);

  // 6. Write proposals marker if new clusters found
  if (newClusters.length > 0) {
    const consolidated = consolidateClusters(newClusters);
    log(`Consolidated ${newClusters.length} tag clusters → ${consolidated.length} groups`);
    writeFileSync(PROPOSALS_FILE, JSON.stringify(consolidated, null, 2));
    log(`Wrote ${consolidated.length} pending proposal(s) to .skill-proposals-pending.json`);
  }

  // Print summary to stdout for hook output
  console.log(summary.join('\n'));
}

try {
  main();
} catch (err) {
  log(`FATAL: ${err.message}\n${err.stack}`);
  console.error(`[skill-scan] FATAL: ${err.message}`);
}
