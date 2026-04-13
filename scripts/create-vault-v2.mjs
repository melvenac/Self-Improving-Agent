#!/usr/bin/env node
/**
 * create-vault-v2.mjs
 * One-time scaffolding script for Obsidian Vault v2.
 * Run manually: node scripts/create-vault-v2.mjs
 */

import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const vaultDir = join(homedir(), 'Obsidian Vault v2');

if (existsSync(vaultDir)) {
  console.log(`Vault already exists at: ${vaultDir}`);
  console.log('Nothing to do — exiting without changes.');
  process.exit(0);
}

const dirs = [
  'Experiences/Self-Improving-Agent',
  'Experiences/Tarrant-County-Makerspace',
  'Experiences/Trading-Bot',
  'Experiences/General',
  'Skills',
  'Summaries',
  'Archive',
];

console.log(`Creating vault at: ${vaultDir}`);

for (const dir of dirs) {
  const fullPath = join(vaultDir, dir);
  mkdirSync(fullPath, { recursive: true });
  console.log(`  created: ${dir}/`);
}

const readme = `# Obsidian Vault v2

Knowledge base for the Self-Improving Agent memory protocol.

## Directory Structure

### Hot Tier — Actively indexed and recalled

- **Experiences/** — Proven knowledge organized by project domain.
  Each file is a discrete experience: a lesson learned, a decision made,
  or a pattern observed. Tagged with YAML frontmatter for filtering.
  - \`Self-Improving-Agent/\` — Protocol development experiences
  - \`Tarrant-County-Makerspace/\` — Makerspace operations experiences
  - \`Trading-Bot/\` — Trading bot development experiences
  - \`General/\` — Cross-domain experiences

- **Skills/** — Distilled principles extracted from experience clusters.
  Skills are higher-order abstractions: reusable workflows, heuristics,
  and decision frameworks. Created only with explicit approval.

### Warm Tier — Retained but lower recall priority

- **Summaries/** — Per-session summaries generated at session end.
  Provide context for what was worked on and what was learned.

- **Archive/** — Demoted experiences that are outdated or superseded.
  Kept for historical reference but excluded from active recall.

## Metadata Convention

All files use YAML frontmatter:

\`\`\`yaml
---
tags: [domain:self-improving-agent, outcome:positive]
created: 2026-04-12
maturity: progenitor   # progenitor | proven | mature
---
\`\`\`

## Indexing

- **SQLite + FTS5** (\`knowledge.db\`) indexes this vault for fast keyword recall.
- **Smart Connections** provides semantic (vector) search across all files.
- The Knowledge MCP server (\`kb_recall\`) federates across both indexes.

## Migration Note

This vault runs parallel to \`~/Obsidian Vault\` for a 30-day transition period.
After validation, the old vault will be archived.
`;

writeFileSync(join(vaultDir, 'README.md'), readme, 'utf8');
console.log('  created: README.md');

console.log('\nVault v2 created successfully.\n');
console.log('Next steps:');
console.log('  1. Open Obsidian and add this folder as a new vault:');
console.log(`       ${vaultDir}`);
console.log('  2. Install the Smart Connections plugin if not already installed.');
console.log('  3. In Smart Connections settings, point it at this vault directory.');
console.log('  4. Run the Knowledge MCP indexer to seed the SQLite index:');
console.log('       KB_DIR="~/Obsidian Vault v2" node ~/.claude/knowledge-mcp/scripts/session-end.mjs');
console.log('  5. Verify recall works: kb_recall("test query") in a new session.');
