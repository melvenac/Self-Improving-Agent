#!/usr/bin/env node
// Sync project PRDs and READMEs into Obsidian vault Projects/ folder.
// Copies are wrapped with vault frontmatter so Smart Connections indexes them.
// Usage: node vault-sync-projects.mjs
// Also called from vault-writer.mjs on SessionEnd.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { log } from './vault-utils.mjs';

const PROJECTS_SOURCE = join(homedir(), 'Projects');
const VAULT_PROJECTS = join(homedir(), 'Obsidian Vault', 'Projects');

// Map of project folder name -> { vault name, docs to sync }
const PROJECT_MAP = {
  'Open-Brain': {
    vault: 'open-brain',
    docs: [
      { src: 'README.md', label: 'README' },
      { src: '.agents/SYSTEM/PRD.md', label: 'PRD' },
      { src: '.agents/SYSTEM/SUMMARY.md', label: 'Summary' },
    ]
  },
  'Tarrant County Makerspace': {
    vault: 'tarrant-county-makerspace',
    docs: [
      { src: 'README.md', label: 'README' },
      { src: '.agents/SYSTEM/PRD.md', label: 'PRD' },
      { src: '.agents/SYSTEM/SUMMARY.md', label: 'Summary' },
    ]
  },
  'AI-First-Developement-Framwork': {
    vault: 'ai-first-framework',
    docs: [
      { src: 'README.md', label: 'README' },
      { src: '.agents/SYSTEM/PRD.md', label: 'PRD' },
      { src: '.agents/SYSTEM/SUMMARY.md', label: 'Summary' },
    ]
  },
  'banderwocky-pipeline': {
    vault: 'banderwocky-pipeline',
    docs: [
      { src: 'README.md', label: 'README' },
    ]
  },
  'Mail-Server': {
    vault: 'mail-server',
    docs: [
      { src: 'README.md', label: 'README' },
    ]
  },
  'Voice-Assistant': {
    vault: 'voice-assistant',
    docs: [
      { src: 'PRD.md', label: 'PRD' },
      { src: 'CLAUDE.md', label: 'README' },
    ]
  },
};

export function syncProjects() {
  let synced = 0;
  let skipped = 0;

  for (const [folder, config] of Object.entries(PROJECT_MAP)) {
    const projectDir = join(PROJECTS_SOURCE, folder);
    if (!existsSync(projectDir)) continue;

    const vaultDir = join(VAULT_PROJECTS, config.vault);
    if (!existsSync(vaultDir)) {
      mkdirSync(vaultDir, { recursive: true });
    }

    for (const doc of config.docs) {
      const srcPath = join(projectDir, doc.src);
      if (!existsSync(srcPath)) continue;

      const srcContent = readFileSync(srcPath, 'utf-8');
      const vaultFile = join(vaultDir, `${doc.label}.md`);

      // Check if content has changed (skip if identical)
      if (existsSync(vaultFile)) {
        const existing = readFileSync(vaultFile, 'utf-8');
        // Extract just the body (after frontmatter) for comparison
        const existingBody = existing.replace(/^---[\s\S]*?---\n\n/, '');
        if (existingBody.trim() === srcContent.trim()) {
          skipped++;
          continue;
        }
      }

      // Write with vault frontmatter
      const wrapped = `---
type: project-doc
project: ${config.vault}
source: "${srcPath.replace(/\\/g, '/')}"
doc_type: ${doc.label.toLowerCase()}
synced: ${new Date().toISOString().slice(0, 10)}
---

${srcContent}`;

      writeFileSync(vaultFile, wrapped);
      synced++;
    }
  }

  return { synced, skipped };
}

// Run standalone
if (process.argv[1]?.includes('vault-sync-projects')) {
  console.log('=== Syncing project docs to vault ===');
  const result = syncProjects();
  console.log(`Done: ${result.synced} synced, ${result.skipped} unchanged`);
}
