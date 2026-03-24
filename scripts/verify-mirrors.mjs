#!/usr/bin/env node
import Database from 'better-sqlite3';
import { readdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';

const VAULT_EXPERIENCES = join(homedir(), 'Obsidian Vault', 'Experiences');
const KNOWLEDGE_DB = join(homedir(), '.claude', 'knowledge-mcp', 'knowledge.db');

// Count Obsidian experiences
const obsidianFiles = readdirSync(VAULT_EXPERIENCES).filter(f => f.endsWith('.md'));
const obsidianKeys = new Set(obsidianFiles.map(f => basename(f, '.md')));

// Count Knowledge MCP mirrors
const db = new Database(KNOWLEDGE_DB);
const obRows = db.prepare("SELECT key FROM knowledge WHERE source='vault-mirror'").all();
const obKeys = new Set(obRows.map(r => r.key));
db.close();

// Compare
const inObsidianOnly = [...obsidianKeys].filter(k => !obKeys.has(k));
const inOBOnly = [...obKeys].filter(k => !obsidianKeys.has(k));

console.log(`Obsidian Experiences: ${obsidianKeys.size}`);
console.log(`Knowledge MCP mirrors:   ${obKeys.size}`);
console.log(`In sync:              ${obsidianKeys.size - inObsidianOnly.length}`);

if (inObsidianOnly.length > 0) {
  console.log(`\nMissing from Knowledge MCP (${inObsidianOnly.length}):`);
  inObsidianOnly.forEach(k => console.log(`  - ${k}`));
}

if (inOBOnly.length > 0) {
  console.log(`\nOrphaned in Knowledge MCP (${inOBOnly.length}):`);
  inOBOnly.forEach(k => console.log(`  - ${k}`));
}

if (inObsidianOnly.length === 0 && inOBOnly.length === 0) {
  console.log('\nMirrors are in sync.');
}
