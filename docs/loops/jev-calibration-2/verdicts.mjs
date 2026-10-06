// verdicts.mjs — one verdict per PR (or per task, when a report names no PR) from a QA report's own text.
// Pure: takes the report text, returns rows and the lines it refused. No git, no files.
//
// Two shapes occur in the QA reports since QA 250:
//   (T) a verdict TABLE whose header names a PR column, a verdict column and a head column;
//   (L) verdict LINES: "- **T-221 (`9ab021fd`): ACCEPT.**", "**#287 verdict: ACCEPT.**", "- #287: **ACCEPT**",
//       "`QA-251 T-164 892f...: ACCEPT`".
// A row that is a pair or a batch-merge verdict is not a PR case and is returned in `skipped`, not in `rows`.
// A head that cannot be read from the row, or from a place that names it for THAT item, is left null and the row
// says why: this file never fills a head in by guessing.

const HEX = /`([0-9a-f]{7,40})`/g;
const ITEM = /(#\d+|\b[TG]-\d+[a-z]?)/;
const VERDICT_WORD = /\b(ACCEPT(?:ED)?|REJECT(?:ED)?)\b/;
const RULE = /^\s*\|[\s:|-]+\|\s*$/;

const strip = (s) => s.replace(/[*`_]/g, "").replace(/\s+/g, " ").trim();
const hexes = (s) => [...s.matchAll(HEX)].map((m) => m[1]);
// A bare hash in a label ("`QA-251 T-164 892f...: ACCEPT`"): 7 to 40 hex digits holding a digit, so a word is not one.
const looseHexes = (s) => [...s.matchAll(/\b(?=[0-9a-f]*\d)([0-9a-f]{7,40})\b/g)].map((m) => m[1]);
const same = (a, b) => a.startsWith(b) || b.startsWith(a);

/** "ACCEPT ..." / "REJECT ..." at the START of a verdict cell. Anything mixed or unfinished is null. */
export function labelOf(cell) {
  const t = strip(cell);
  const m = /^(ACCEPT|REJECT)(?:ED)?\b/.exec(t);
  if (!m) return null;
  if (/\b(INCOMPLETE|BLOCKED|PARTIAL)\b/i.test(t)) return null;
  return m[1];
}

function isGroupLabel(text) {
  return /^(pair|batch|batch[- ]merge|merge order|the batch)\b/i.test(strip(text));
}

function itemOf(text) {
  const t = strip(text);
  const pr = /#(\d+)/.exec(t);
  const task = /\b([TG]-\d+[a-z]?)\b/.exec(t);
  const round = /\b(r\d+)\b/i.exec(t);
  const r = round ? round[1].toLowerCase() : null;
  if (pr) return { item: `#${pr[1]}`, kind: "pr", task: task ? task[1] : null, round: r };
  if (task) return { item: task[1], kind: "task", task: task[1], round: r };
  return null;
}

function splitRow(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

/** Table rows: columns are located by the header, never by position. */
function fromTables(lines) {
  const rows = [];
  const skipped = [];
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i]) || !RULE.test(lines[i + 1])) continue;
    const head = splitRow(lines[i]).map((h) => strip(h).toLowerCase());
    const vi = head.findIndex((h) => /^verdict\b/.test(h));
    const pi = head.findIndex((h) => /^(pr|item|case)\b/.test(h));
    if (vi < 0 || pi < 0) continue;
    let hi = head.findIndex((h) => /^(pinned( new)? )?head( \(full sha\))?$|^pinned\b/.test(h));
    if (hi < 0) hi = head.findIndex((h) => /\bhead\b/.test(h) && !/\bround\b/.test(h));
    const ti = head.findIndex((h) => /^task\b/.test(h));
    for (let j = i + 2; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const cells = splitRow(lines[j]);
      if (cells.length <= Math.max(vi, pi)) continue;
      if (isGroupLabel(cells[pi])) { skipped.push({ line: strip(lines[j]).slice(0, 120), why: "group verdict, not a PR" }); continue; }
      const id = itemOf(`${cells[pi]} ${ti >= 0 ? cells[ti] ?? "" : ""}`);
      if (!id) { skipped.push({ line: strip(lines[j]).slice(0, 120), why: "no PR or task id in the row" }); continue; }
      const cellHexes = hi >= 0 ? hexes(cells[hi] ?? "") : hexes(cells.filter((_, k) => k !== vi).join(" | "));
      rows.push({
        ...id,
        sha: cellHexes[0] ?? null,
        sha_from: cellHexes[0] ? "verdict-table" : null,
        label: labelOf(cells[vi]),
        verdict_text: strip(cells[vi]).slice(0, 160),
        shape: "table",
      });
    }
  }
  return { rows, skipped };
}

/** Verdict lines outside tables. */
function fromLines(lines) {
  const rows = [];
  const skipped = [];
  for (const raw of lines) {
    if (/^\s*\|/.test(raw)) continue;
    const t = raw.replace(/^\s*(?:[-*]\s+|\d+[.)]\s+)?/, "").replace(/^`?QA[- ]?\d+\s+/, "").replace(/^[*`\s]+/, "");
    if (t === "") continue;
    const m = ITEM.exec(t);
    if (!m || m.index > 3) continue;
    const w = VERDICT_WORD.exec(t);
    if (!w || w.index > 170) continue;
    const before = t.slice(0, w.index);
    if (/\b(if|would|overturns?|because|was|were|since|so|then)\b/i.test(before)) continue;
    if (isGroupLabel(before)) { skipped.push({ line: strip(t).slice(0, 120), why: "group verdict, not a PR" }); continue; }
    // The verdict word must close the label: "T-221 (`sha`): ACCEPT.", "#287 verdict: ACCEPT.", "#287: ACCEPT".
    if (!/:\s*\**\s*$/.test(before.replace(/\*+$/, "")) && !/\bverdict\b/i.test(before) && !/`:?\s*$/.test(before)) continue;
    const id = itemOf(before);
    if (!id) continue;
    const afterAt = /^\W*(?:at|@)\s+`?([0-9a-f]{7,40})`?/.exec(t.slice(w.index + w[0].length));
    const lineHex = [...hexes(before), ...looseHexes(before), ...(afterAt ? [afterAt[1]] : [])];
    rows.push({
      ...id,
      sha: lineHex[0] ?? null,
      sha_from: lineHex[0] ? "verdict-line" : null,
      label: labelOf(t.slice(w.index)),
      verdict_text: strip(t.slice(w.index)).slice(0, 160),
      shape: "line",
    });
  }
  return { rows, skipped };
}

/** Does `text` open with this item ("#287", "T-209", "PR #287")? A mention later in the line does not count. */
function leadsWith(text, item) {
  const t = strip(text).replace(/^PR\s+/i, "");
  const m = ITEM.exec(t);
  return m !== null && m.index === 0 && m[1] === item;
}

/**
 * Heads the report names FOR this item, only where the item leads: a heading, or the first cell of a table row (read
 * through that table's own head/pinned/candidate column when it has one). "PR #287." inside a sentence that also names
 * a branch tip and a base is not such a place, and a paragraph that names a merge base beside the item is not either.
 */
function headsLedBy(lines, item) {
  const out = [];
  let header = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const h = /^#{1,4}\s+(.*)$/.exec(l);
    if (h && leadsWith(h[1], item)) out.push(...hexes(h[1]));
    if (/^\s*\|/.test(l)) {
      if (RULE.test(lines[i + 1] ?? "")) { header = splitRow(l).map((c) => strip(c).toLowerCase()); continue; }
      if (RULE.test(l)) continue;
      const cells = splitRow(l);
      if (!leadsWith(cells[0] ?? "", item)) continue;
      const hi = header ? header.findIndex((c) => /\b(head|pinned|candidate)\b/.test(c) && !/\bround\b/.test(c)) : -1;
      out.push(...(hi >= 0 ? hexes(cells[hi] ?? "") : hexes(cells.slice(1).join(" | ")).slice(0, 1)));
    } else header = null;
  }
  return out;
}

/** The task id a heading the item leads names ("## #287: T-209 gaps newest-first ..."), when exactly one. */
function taskLedBy(lines, item) {
  const found = new Set();
  for (const l of lines) {
    const h = /^#{1,4}\s+(.*)$/.exec(l);
    if (!h || !leadsWith(h[1], item)) continue;
    for (const m of strip(h[1]).matchAll(/\b([TG]-\d+[a-z]?)\b/g)) found.add(m[1]);
  }
  return found.size > 0 ? [...found][0] : null;
}

/** The report's own "**Candidate:**" field, when it names one commit. */
function candidateField(lines) {
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /\*\*Candidates?:?\*\*:?\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const first = hexes(`${m[1]} ${lines[i + 1] ?? ""}`)[0];
    if (first) found.push(first);
  }
  return found;
}

const distinct = (list) => {
  const out = [];
  for (const h of list) {
    const i = out.findIndex((x) => same(x, h));
    if (i < 0) out.push(h);
    else if (h.length > out[i].length) out[i] = h;
  }
  return out;
};

/**
 * @param {string} text the report
 * @returns {{ rows: object[], skipped: object[] }}
 *   rows: one per head. A head comes from the verdict row itself, else from where the report names it for that item
 *   (a heading or table row the item leads), else from a single "**Candidate:**" field. Otherwise it is null and
 *   `head_note` says why. A head-less row that restates the one row of the same item that has a head, with the same
 *   label, is folded into it. Rows that share one head are ONE case: REJECT when any of them is a REJECT.
 */
export function parseVerdicts(text) {
  const lines = text.split("\n");
  const t = fromTables(lines);
  // Tables are the report's own verdict table when it has one; verdict lines fill in only when it has none.
  const picked = t.rows.length > 0 ? t : fromLines(lines);
  const skipped = [...picked.skipped];
  const cand = distinct(candidateField(lines));
  const resolved = picked.rows.map((r0) => {
    const r = r0.task === null && r0.kind === "pr" ? { ...r0, task: taskLedBy(lines, r0.item) } : r0;
    if (r.sha) return { ...r };
    const led = distinct(headsLedBy(lines, r.item));
    if (led.length === 1) return { ...r, sha: led[0], sha_from: "led-by-item" };
    if (cand.length === 1 && led.length === 0) return { ...r, sha: cand[0], sha_from: "candidate-field" };
    return { ...r, head_note: led.length > 1 ? `ambiguous: ${led.length} heads led by ${r.item}` : `no head named for ${r.item}` };
  });
  const folded = resolved.filter((r) => {
    if (r.sha) return true;
    const withHead = resolved.filter((x) => x.sha && x.item === r.item);
    return !(withHead.length === 1 && withHead[0].label === r.label);
  });
  const byKey = new Map();
  for (const r of folded) {
    const key = `${r.item}|${r.round ?? ""}|${r.sha ? r.sha.slice(0, 7) : ""}`;
    const prior = byKey.get(key);
    if (prior) {
      if (prior.label !== r.label) { prior.conflict = true; prior.label = null; }
      continue;
    }
    byKey.set(key, { ...r, conflict: false });
  }
  const byHead = [];
  const out = [];
  for (const r of byKey.values()) {
    const hit = r.sha ? byHead.find((x) => same(x.sha, r.sha)) : undefined;
    if (!hit) {
      const row = { ...r, items: [r.item] };
      out.push(row);
      if (r.sha) byHead.push(row);
      continue;
    }
    hit.round = hit.round ?? r.round;
    hit.label = hit.label === "REJECT" || r.label === "REJECT" ? "REJECT" : hit.label === r.label ? hit.label : null;
    if (!hit.items.includes(r.item)) {
      hit.items.push(r.item);
      hit.verdict_text = `${hit.verdict_text} | ${r.item}: ${r.verdict_text}`.slice(0, 240);
    }
  }
  return { rows: out, skipped };
}
