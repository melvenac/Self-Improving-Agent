#!/usr/bin/env node
// Planner push stopgap (until dashboard t015 / A2A Loop 18 push).
// Run by a PLANNER as ITSELF under Claude Code's Monitor, so it is interrupted the moment one of its
// seats does something, instead of sitting idle not knowing whether work is happening.
// It polls `hub-talk --as <me> --list --json` and prints ONE line per change:
//   NEW TURN   <peer> posted in your room (YOUR unread for that room went up) → read it now
//   RUN START  <seat> began a run (seatState → working)                   → work IS happening
//   RUN END    <seat> run ended (working → idle); owes <turn> if still owed → check its reply / CONTINUE
//   NO WAKER   <seat> lost its waker                                       → tell clark
// Usage (from the planner's own window, via Monitor):
//   node scripts/planner-watch.mjs --as atlas --hub-talk <A2A-Hub>/scripts/hub-talk.mjs [--peers forge,cursor-infra] [--interval 30]
// --peers limits it to the agents you care about (default: every agent you share a room with).
// --hub-talk (or HUB_TALK) is the A2A-Hub checkout's hub-talk.mjs; there is no machine-specific default.
// The hub URL is HUB_URL, else hub_url from .agents/SYSTEM/hub-partner-seats.json.
// It reads the hub with YOUR key through hub-talk; it never prints a key.
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const me = opt('--as');
if (!me) { console.error('usage: planner-watch.mjs --as <your hub name> [--peers a,b] [--interval 30]'); process.exit(2); }
const peers = opt('--peers', '') ? new Set(opt('--peers').split(',').map((s) => s.trim())) : null;
const intervalS = Number(opt('--interval', '30')) || 30;
const HUB_TALK = opt('--hub-talk', process.env.HUB_TALK);
if (!HUB_TALK || !existsSync(HUB_TALK)) { console.error(`planner-watch: hub-talk.mjs not found (${HUB_TALK ?? 'pass --hub-talk or set HUB_TALK'})`); process.exit(2); }
const seatFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.agents', 'SYSTEM', 'hub-partner-seats.json');
let seatHubUrl;
try { seatHubUrl = JSON.parse(readFileSync(seatFile, 'utf8')).hub_url; } catch {}
const HUB_URL = process.env.HUB_URL || seatHubUrl;
if (!HUB_URL) { console.error('planner-watch: no hub URL (set HUB_URL, or hub_url in .agents/SYSTEM/hub-partner-seats.json)'); process.exit(2); }
const STATE = join(tmpdir(), `planner-watch-${me}.json`);
const once = argv.includes('--once');

const cdt = () => new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hour12: false });
const say = (tag, msg) => console.log(`${tag} ${cdt()} ${msg}`);

function list() {
  return new Promise((res, rej) => execFile(process.execPath, [HUB_TALK, '--as', me, '--list', '--json'], { env: { ...process.env, HUB_URL }, timeout: 25000, maxBuffer: 4 << 20 },
    (err, out) => { if (err) return rej(err); try { const j = JSON.parse(out); res(Array.isArray(j) ? j : j.agents || []); } catch (e) { rej(e); } }));
}

// NEW TURN comes from YOUR OWN row: rooms[].unread there counts turns in that room you have not
// read yet, so it rises when a PEER posts and stays put when you post (a peer's row counts the PEER's
// unread, which rises on YOUR posts: the defect Relay found in v1). Each room is named after the
// peer(s) whose rows list the same sessionId.
function snap(rows) {
  const s = { _own: {}, _roomPeer: {} };
  const mine = rows.find((a) => a?.name === me);
  for (const r of mine?.rooms || []) s._own[r.sessionId] = r.unread || 0;
  for (const a of rows) {
    if (!a?.name || a.name === me) continue;
    const rooms = a.rooms || [];
    for (const r of rooms) if (r.sessionId in s._own && !/-waker$/.test(a.name)) (s._roomPeer[r.sessionId] ||= []).push(a.name);
    if (!rooms.length) continue; // only agents you share a room with
    if (peers && !peers.has(a.name) && !peers.has(a.name.replace(/-waker$/, ''))) continue;
    s[a.name] = { seat: a.seat?.seatState ?? null, owes: a.seat?.owesSinceTurn ?? null, presence: a.state };
  }
  return s;
}

function diff(prev, cur) {
  for (const [sid, u] of Object.entries(cur._own || {})) {
    const was = prev._own?.[sid];
    if (was == null || u <= was) continue;
    const who = (cur._roomPeer[sid] || []).join('+') || 'unknown peer';
    if (peers && !(cur._roomPeer[sid] || []).some((n) => peers.has(n))) continue;
    say('NEW TURN', `${who} posted in room ${sid.slice(0, 8)} (${u - was} new; you have ${u} unread) → read it`);
  }
  for (const [n, c] of Object.entries(cur)) {
    if (n.startsWith('_')) continue;
    const p = prev[n];
    if (!p) continue;
    if (c.seat !== p.seat) {
      if (c.seat === 'working') say('RUN START', `${n} is working${c.owes ? ` (owes turn ${c.owes})` : ''}`);
      else if (p.seat === 'working') say('RUN END', `${n} ${c.seat ?? 'state unknown'}${c.owes ? `, still owes turn ${c.owes}` : ''} → check its reply`);
      else if (c.seat === 'waker_down' || c.seat === 'no waker') say('NO WAKER', `${n} lost its waker → tell clark`);
      else say('SEAT', `${n} ${p.seat ?? '-'} → ${c.seat ?? '-'}`);
    }
    if (/-waker$/.test(n) && p.presence === 'seen' && c.presence !== 'seen') say('NO WAKER', `${n} ${c.presence} (was seen) → tell clark`);
  }
}

let fails = 0;
async function tick() {
  let prev = null; try { prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null; } catch {}
  try {
    const cur = snap(await list());
    if (!prev || !prev._own) say('WATCH', `started as ${me}: watching ${Object.keys(cur).filter((n) => !n.startsWith('_') && !n.endsWith('-waker')).join(', ') || '(no rooms)'}; ${Object.keys(cur._own).length} rooms`);
    else diff(prev, cur);
    if (fails >= 3) say('WATCH', 'hub reachable again');
    fails = 0;
    writeFileSync(STATE, JSON.stringify(cur));
  } catch (e) {
    fails += 1;
    if (fails === 3) say('WATCH', `hub-talk --list failing 3 times in a row (${String(e.message || e).slice(0, 80)}) → tell clark`);
  }
}

await tick();
if (!once) setInterval(tick, intervalS * 1000);
