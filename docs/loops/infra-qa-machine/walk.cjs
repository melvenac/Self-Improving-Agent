// Diagnostic: replicate existsCaseInsensitive's walk for paths.test.ts:117, printing each level.
const { mkdtempSync, mkdirSync, readdirSync, existsSync, rmSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const base = mkdtempSync(join(tmpdir(), 'ob-Case-'));
try {
  const real = join(base, 'Mixed-Case', 'Deeper');
  mkdirSync(real, { recursive: true });
  const lowered = real.split('\\').join('/').toLowerCase();
  console.log('real   =', real);
  console.log('lowered=', lowered);
  const parts = lowered.split('/').filter(p => p.length > 0);
  let current = parts.shift() + '/';
  for (const part of parts) {
    let entries;
    try { entries = readdirSync(current); } catch (e) { console.log(`readdir(${current}) THREW ${e.code}`); break; }
    const m = entries.find(e => e === part) ?? entries.find(e => e.toLowerCase() === part);
    console.log(`level ${JSON.stringify(current)} want ${JSON.stringify(part)} -> ${m === undefined ? 'NO MATCH among ' + entries.length + ' entries' : JSON.stringify(m)}`);
    if (m === undefined) break;
    current = current.endsWith('/') ? current + m : `${current}/${m}`;
  }
  console.log('final existsSync:', existsSync(current), current);
} finally { rmSync(base, { recursive: true, force: true }); }
