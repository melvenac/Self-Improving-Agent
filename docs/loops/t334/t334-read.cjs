// T-334 reading per docs/loops/t334-measure-plan.md. Usage: node t334-read.cjs gate|read
const D = require('C:/Users/melve/Projects/Self-Improving-Agent/open-brain/node_modules/better-sqlite3');
const db = new D(process.env.USERPROFILE + '/.claude/open-brain/knowledge-v2.db', { readonly: true });
const MODE = process.argv[2] || 'gate';
const START = '2026-11-02T11:04:52';
const rows = db.prepare('select id, session_uuid s, query q, state, injected_ids inj, created_at t from trigger_fires where created_at >= ? order by id').all(START);

function ids(q, key) { // ids listed under token key, e.g. match:766,714
  const out = new Set();
  for (const tok of q.split(/\s+/)) {
    const i = tok.indexOf(':');
    if (i < 0 || tok.slice(0, i) !== key) continue;
    for (const x of tok.slice(i + 1).split(',')) if (/^[0-9]+$/.test(x)) out.add(Number(x));
  }
  return out;
}
// self-test of the parser (backslash-loss guard, see feedback memory)
const st = ids('"tail" match:766,714 withheld:766 path-match:5', 'match');
if (!(st.has(766) && st.has(714) && st.size === 2)) throw new Error('parser self-test failed');
if (!ids('error-match:12', 'error-match').has(12)) throw new Error('parser self-test 2 failed');

// first exposure per (session, entry)
const draws = new Map();
for (const r of rows) {
  const exposed = [];
  if (r.state === 'injected') for (const x of JSON.parse(r.inj)) exposed.push([x, 'injected']);
  for (const x of ids(r.q, 'withheld')) exposed.push([x, 'withheld']);
  for (const [e, arm] of exposed) {
    const k = r.s + '|' + e;
    if (draws.has(k)) { const d = draws.get(k); if (d.arm !== arm) d.conflict = true; continue; }
    let path = 'element';
    if (ids(r.q, 'match').has(e) || ids(r.q, 'error-match').has(e)) path = 'primary';
    else if (ids(r.q, 'path-match').has(e)) path = 'path';
    draws.set(k, { s: r.s, e, arm, path, firstId: r.id });
  }
}
const all = [...draws.values()];
const cnt = (f) => all.filter(f).length;
console.log('fires read', rows.length, '| last fire', rows[rows.length - 1].t);
console.log('draws', all.length, '| conflicts (pair in both arms)', cnt(d => d.conflict));
for (const arm of ['injected', 'withheld']) console.log(arm, ['primary', 'path', 'element'].map(p => p + ' ' + cnt(d => d.arm === arm && d.path === p)).join(', '));
const prim = all.filter(d => d.path === 'primary');
console.log('PRIMARY-CLASS DRAWS', prim.length, prim.length >= 200 ? '(gate met)' : '(gate NOT met: plan says wait to 11-23)');
if (MODE !== 'read') process.exit(0);

// outcomes
const bySess = new Map();
for (const r of rows) { if (!bySess.has(r.s)) bySess.set(r.s, []); bySess.get(r.s).push(r); }
function later(d, key) { return bySess.get(d.s).some(r => r.id > d.firstId && ids(r.q, key).has(d.e)); }
for (const d of prim) { d.m = later(d, 'match') || later(d, 'error-match'); d.em = later(d, 'error-match'); }
const pathDraws = all.filter(d => d.path === 'path');
for (const d of pathDraws) d.pm = later(d, 'path-match');

function diff(ds, f) {
  const a = ds.filter(d => d.arm === 'injected'), b = ds.filter(d => d.arm === 'withheld');
  const pa = a.filter(f).length / a.length, pb = b.filter(f).length / b.length;
  return { na: a.length, nb: b.length, ka: a.filter(f).length, kb: b.filter(f).length, pa, pb, d: pa - pb };
}
function boot(ds, f, B = 5000) {
  const sess = [...new Set(ds.map(d => d.s))];
  const g = new Map(sess.map(s => [s, ds.filter(d => d.s === s)]));
  let seed = 334; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const v = [];
  for (let i = 0; i < B; i++) {
    const smp = [];
    for (let j = 0; j < sess.length; j++) smp.push(...g.get(sess[Math.floor(rnd() * sess.length)]));
    const r = diff(smp, f); if (Number.isFinite(r.d)) v.push(r.d);
  }
  v.sort((x, y) => x - y);
  return [v[Math.floor(0.025 * v.length)], v[Math.floor(0.975 * v.length)], sess.length];
}
function report(label, ds, f) {
  const r = diff(ds, f), [lo, hi, ns] = boot(ds, f);
  const p = (x) => (100 * x).toFixed(1) + '%';
  console.log(`${label}: injected ${r.ka}/${r.na} ${p(r.pa)} | withheld ${r.kb}/${r.nb} ${p(r.pb)} | diff ${p(r.d)} CI95 [${p(lo)}, ${p(hi)}] (${ns} sessions)`);
}
report('PRIMARY (later match/error-match)', prim, d => d.m);
report('PRIMARY without entry 299', prim.filter(d => d.e !== 299), d => d.m);
report('SECONDARY error-match only', prim, d => d.em);
if (pathDraws.length) report('SECONDARY path-match (path draws)', pathDraws, d => d.pm);
const top = {}; for (const d of prim.filter(d => d.arm === 'injected')) top[d.e] = (top[d.e] || 0) + 1;
console.log('injected primary draws by entry (top 5)', Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5));
