#!/usr/bin/env node
/**
 * D-110: proves the shared.md split moved text and lost none.
 *
 *   node docs/loops/shared-md-split-check.mjs [base-ref]      (default origin/master)
 *
 * OLD is `.agents/roles/shared.md` at the base ref, read with git (execFileSync, no shell). NEW is the working
 * copy of shared.md, and PROV is docs/loops/shared-md-provenance.md. Checks:
 *   1. every bold span of OLD survives verbatim in NEW (one explicit exclusion, which must then be in PROV);
 *   2. every sentence of OLD is found verbatim in NEW or PROV, so nothing was dropped or reworded;
 *   3. it LISTS every sentence NEW and PROV contain that OLD does not, so each addition is reviewed, not assumed.
 * Whitespace is normalised (line wraps differ); words, punctuation and markdown are compared exactly.
 * A detector must be shown a known positive: --self-test mutates NEW in memory and requires checks 1 and 2 to fail.
 * LIMIT: this proves text survives. It cannot prove a moved sentence was not a rule: that is the reviewer's call.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'origin/master';
const SHARED = '.agents/roles/shared.md';
const PROV = 'docs/loops/shared-md-provenance.md';
const EXCLUDED_BOLD = ['This step had been run by hand more than twenty times'];

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const oldText = execFileSync('git', ['show', `${base}:${SHARED}`], { cwd: root, encoding: 'utf8' });
const newText = readFileSync(join(root, SHARED), 'utf8');
const provText = readFileSync(join(root, PROV), 'utf8');

// Code spans are masked first: a span like `docs/**` holds a literal `**` that is not bold and would flip every pairing after it.
const bolds = (t) => {
  const masks = [];
  const masked = t.replace(/`[^`\n]*`/g, (m) => `\u0000${masks.push(m) - 1}\u0000`);
  return [...masked.matchAll(/\*\*(.+?)\*\*/gs)].map((m) => norm(m[1].replace(/\u0000(\d+)\u0000/g, (_, i) => masks[Number(i)])));
};
// Blocks first (so an inserted line under a heading cannot join two blocks), then sentences within a block.
const sentences = (t) =>
  t.split(/\n\s*\n/).flatMap((block) => norm(block).split(/(?<=[.!?)][)*"\]]*)\s+(?=[A-Z`*(\[“"])/)).filter((s) => s !== '');

function run(newT, provT) {
  const nN = norm(newT);
  const nP = norm(provT);
  const missingBold = [];
  for (const b of bolds(oldText)) {
    if (nN.includes(`**${b}**`)) continue;
    if (EXCLUDED_BOLD.some((e) => b.startsWith(e)) && nP.includes(b)) continue;
    missingBold.push(b);
  }
  const pieces = sentences(oldText);
  let inNew = 0;
  let inProv = 0;
  const missing = [];
  for (const p of pieces) {
    if (nN.includes(p)) inNew++;
    else if (nP.includes(p)) inProv++;
    else missing.push(p);
  }
  return { missingBold, pieces: pieces.length, inNew, inProv, missing };
}

const r = run(newText, provText);
const oldNorm = norm(oldText);
const added = (t) => sentences(t).filter((s) => !oldNorm.includes(s));

console.log(`base ${base}: ${SHARED} = ${Buffer.byteLength(oldText)} bytes`);
console.log(`after: ${SHARED} = ${Buffer.byteLength(newText)} bytes; ${PROV} = ${Buffer.byteLength(provText)} bytes`);
console.log(`bold spans in OLD: ${bolds(oldText).length}; missing from NEW: ${r.missingBold.length}; excluded (moved, must be in PROV): ${EXCLUDED_BOLD.length}`);
for (const b of r.missingBold) console.log(`  MISSING BOLD: ${b}`);
console.log(`sentences in OLD: ${r.pieces}; verbatim in NEW: ${r.inNew}; moved verbatim to PROV: ${r.inProv}; found nowhere: ${r.missing.length}`);
for (const m of r.missing) console.log(`  MISSING SENTENCE: ${m}`);
for (const [label, t] of [['NEW', newText], ['PROV', provText]]) {
  const a = added(t);
  console.log(`added in ${label} (not in OLD): ${a.length}`);
  for (const s of a) console.log(`  + ${s.length > 110 ? `${s.slice(0, 107)}...` : s}`);
}

let failed = r.missingBold.length > 0 || r.missing.length > 0;

if (process.argv.includes('--self-test')) {
  // Known positives: each mutation MUST be caught, or this script is not a detector.
  const firstBold = bolds(oldText)[0];
  const cases = [
    ['reworded bold rule', newText.replace(firstBold, `${firstBold} (edited)`), provText, (x) => x.missingBold.length > 0],
    ['dropped sentence', newText.replace('Point at them.', ''), provText, (x) => x.missing.length > 0],
    ['moved sentence deleted from PROV', newText, provText.replace('`gh pr merge` has printed', 'gh pr merge printed'), (x) => x.missing.length > 0],
  ];
  for (const [name, n, p, caught] of cases) {
    const edited = n !== newText || p !== provText;
    const ok = edited && caught(run(n, p));
    console.log(`self-test: ${name}: ${edited ? (ok ? 'caught' : 'NOT CAUGHT') : 'edit did not land'}`);
    if (!ok) failed = true;
  }
}

console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
