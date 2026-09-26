#!/usr/bin/env node
// QA 114 (T-183): the candidate's renderState against this repository's REAL record at every
// revision git holds, for every seat. Not fixtures.
//
// Per record, per seat (planner, developer, qa, unresolved):
//   V1  the own handoff's pick-up, every watch-out, every open question and every loop-state item
//       appear as whole lines, byte-identical to state.json and in order.
//   V2  every line OUTSIDE the Verified and Gaps sections is identical to the base (48acaa8)
//       renderer's output for the same record (tasks, objective, handoffs, other seats' lines, ...).
//   V3  each gap line: either the whole `what` (<= 140, one line, no marker) or a prefix of it
//       plus `… (N chars; full text: state.json gaps[<id>])` with N = what.length. Never silent.
//   V4  verified: shown = newest 10 ∪ every reopened claim, in record order; each line whole or
//       clipped under V3's rule at 100 with its evidence count; the omission line counts exactly
//       the rest and names `node open-brain/build/cli.js state show --json`.
//
// Usage: node verbatim-revisions.mjs <cand-open-brain-dir> <base-open-brain-dir> <repo>
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const [candDir, baseDir, repo] = process.argv.slice(2);
const imp = (d, rel) => import(pathToFileURL(join(d, "build", rel)).href);
const cand = await imp(candDir, "pipelines/session-start/state-render.js");
const base = await imp(baseDir, "pipelines/session-start/state-render.js");
const { parseState } = await imp(candDir, "shared/state-schema.js");

const git = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", maxBuffer: 1 << 28 });
const commits = git("log", "--all", "--format=%H", "--", ".agents/state.json").trim().split("\n");
const seen = new Map(); // blob -> first commit
for (const c of commits) {
  let blob;
  try { blob = git("rev-parse", `${c}:.agents/state.json`).trim(); } catch { continue; } // deleted there
  if (!seen.has(blob)) seen.set(blob, c);
}

const failures = [];
const fail = (ctx, msg) => failures.push(`${ctx}: ${msg}`);
let parsed = 0, unparsed = 0, renders = 0, wo = 0, oq = 0, gapClipped = 0, gapWhole = 0, vShown = 0, vOmitLines = 0, reopenedOld = 0;
const unparsedWhy = new Map();
const revs = [];

const sectionSplit = (lines) => {
  // Returns lines outside Verified/Gaps, and the lines inside each.
  // By the section headers, not by indentation: the BASE renderer prints a multi-line gap's
  // continuation lines unindented (the defect T-183 removes), so indentation cannot delimit it.
  const t = lines.join("\n");
  const iv = t.search(/\nVerified \(\d+\):\n/), ig = t.search(/\nGaps \(\d+\):\n/), id = t.indexOf("\nDecisions: ");
  if (iv < 0 || ig < iv || id < ig) throw new Error("section headers not found in order");
  const hv = t.indexOf("\n", iv + 1), hg = t.indexOf("\n", ig + 1);
  const out = (t.slice(0, hv) + t.slice(ig, hg) + t.slice(id)).split("\n");
  const ver = t.slice(hv + 1, ig).split("\n").filter((l) => l !== "");
  const gaps = t.slice(hg + 1, id).split("\n").filter((l) => l !== "");
  return { out, ver, gaps };
};

const checkClip = (ctx, text, rendered, limit, where) => {
  const marker = `… (${text.length} chars; full text: state.json ${where})`;
  if (rendered === text) {
    if (text.length > limit || /[\r\n]/.test(text)) fail(ctx, `printed whole but is ${text.length} chars / multi-line with no marker`);
    return "whole";
  }
  if (!rendered.endsWith(marker)) { fail(ctx, `cut without the exact marker: ${JSON.stringify(rendered.slice(-80))}`); return "bad"; }
  const cut = rendered.slice(0, -marker.length);
  if (!text.startsWith(cut)) fail(ctx, `cut is not a prefix of the full text`);
  if (cut.length > limit) fail(ctx, `cut longer than the limit (${cut.length})`);
  if (/[\r\n]/.test(cut)) fail(ctx, `cut carries a line break`);
  return "clipped";
};

for (const [blob, commit] of seen) {
  const raw = git("cat-file", "blob", blob);
  const p = parseState(raw);
  if (!p.ok) {
    unparsed++;
    const why = (p.error ?? JSON.stringify(p)).toString().slice(0, 100);
    unparsedWhy.set(why, (unparsedWhy.get(why) ?? 0) + 1);
    continue;
  }
  parsed++;
  const s = p.data;
  revs.push(s.revision);
  for (const seat of ["planner", "developer", "qa", null]) {
    const ctx = `${commit.slice(0, 7)} rev ${s.revision} seat ${seat}`;
    const c = cand.renderState(s, "9.9.9", { seat });
    const b = base.renderState(s, "9.9.9", { seat });
    renders++;
    const cText = c.join("\n");
    const cLines = cText.split("\n");

    // V1
    const own = seat ? s.handoffs.find((h) => h.seat === seat) : null;
    if (own) {
      const expect = [`  pick up: ${own.pick_up}`];
      if (own.watch_out.length) expect.push("  watch out:", ...own.watch_out.map((w) => `    - ${w}`));
      if (own.open_questions.length) expect.push("  open questions:", ...own.open_questions.map((q) => `    - ${q}`));
      const block = expect.join("\n");
      if (!cText.includes(block)) fail(ctx, "own handoff block (pick-up, watch-outs, open questions) not byte-identical and contiguous");
      for (const w of own.watch_out) { wo++; if (!cText.includes(`\n    - ${w}\n`)) fail(ctx, `watch-out not whole: ${w.slice(0, 60)}`); }
      for (const q of own.open_questions) { oq++; if (!cText.includes(`\n    - ${q}\n`) && !cText.endsWith(`\n    - ${q}`)) fail(ctx, `open question not whole: ${q.slice(0, 60)}`); }
      if (own.loop_state) {
        for (const x of [...own.loop_state.questions_for_aaron, ...own.loop_state.rulings]) {
          if (!cText.includes(`\n      - ${x}`)) fail(ctx, `loop-state item not whole: ${x.slice(0, 60)}`);
        }
      }
    }

    // V2
    const cs = sectionSplit(c), bs = sectionSplit(b);
    if (cs.out.join("\n") !== bs.out.join("\n")) {
      const n = Math.min(cs.out.length, bs.out.length);
      let i = 0; while (i < n && cs.out[i] === bs.out[i]) i++;
      fail(ctx, `outside Verified/Gaps differs from base at line ${i}: cand ${JSON.stringify(cs.out[i]?.slice(0, 80))} base ${JSON.stringify(bs.out[i]?.slice(0, 80))}`);
    }

    // V3
    if (cs.gaps.filter((l) => l !== "  (none)").length !== s.gaps.length) fail(ctx, `gap lines ${cs.gaps.length} != gaps ${s.gaps.length}`);
    s.gaps.forEach((g, i) => {
      const line = cs.gaps[i] ?? "";
      const pre = `  ${g.id} — `, post = ` (opened session ${g.opened_session})`;
      if (!line.startsWith(pre) || !line.endsWith(post)) { fail(ctx, `gap ${g.id} line shape`); return; }
      const r = checkClip(`${ctx} gap ${g.id}`, g.what, line.slice(pre.length, -post.length), 140, `gaps[${g.id}]`);
      if (seat === "planner") r === "clipped" ? gapClipped++ : gapWhole++;
    });

    // V4
    const newest = new Set(s.verified.slice(-10));
    const want = s.verified.filter((v) => newest.has(v) || v.status === "reopened");
    const vLines = cs.ver.filter((l) => !l.startsWith("  … ") && l !== "  (none)");
    if (vLines.length !== want.length) fail(ctx, `verified shown ${vLines.length}, expected ${want.length}`);
    want.forEach((v, i) => {
      const line = vLines[i] ?? "";
      const flag = v.status === "reopened" ? " [REOPENED]" : "";
      const pre = `  ${v.id} — `, post = ` (${v.evidence.length} evidence)${flag}`;
      if (!line.startsWith(pre) || !line.endsWith(post)) { fail(ctx, `verified ${v.id} line shape: ${line.slice(0, 60)}`); return; }
      checkClip(`${ctx} verified ${v.id}`, v.claim, line.slice(pre.length, -post.length), 100, `verified[${v.id}]`);
      if (seat === "planner") { vShown++; if (v.status === "reopened" && !newest.has(v)) reopenedOld++; }
    });
    const omitted = s.verified.length - want.length;
    const omitLine = cs.ver.filter((l) => l.startsWith("  … "));
    if (omitted > 0) {
      const exp = `  … ${omitted} older verified claim(s) not shown (${s.verified.length} total); all of them: node open-brain/build/cli.js state show --json`;
      if (omitLine.length !== 1 || omitLine[0] !== exp) fail(ctx, `omission line wrong: ${JSON.stringify(omitLine)}`);
      if (seat === "planner") vOmitLines++;
    } else if (omitLine.length) fail(ctx, "omission line with nothing omitted");

    // Stray marker anywhere else (a clip in a section that must be verbatim).
    cLines.forEach((l) => {
      if (/… \(\d+ chars; full text: state\.json/.test(l) && !cs.gaps.includes(l) && !cs.ver.includes(l)) fail(ctx, `marker outside gaps/verified: ${l.slice(0, 60)}`);
    });
  }
}

revs.sort((a, b) => a - b);
console.log(JSON.stringify({
  distinct_state_json_blobs: seen.size, parsed, unparsed, unparsed_reasons: Object.fromEntries(unparsedWhy),
  revisions_parsed: revs.length ? `${revs[0]}..${revs[revs.length - 1]} (${new Set(revs).size} distinct)` : "none",
  renders, watch_outs_checked: wo, open_questions_checked: oq,
  planner_gap_lines: { clipped: gapClipped, whole: gapWhole }, planner_verified_lines: vShown,
  planner_reopened_older_than_newest10: reopenedOld, planner_omission_lines: vOmitLines,
  failures: failures.length,
}, null, 2));
for (const f of failures.slice(0, 60)) console.log("FAIL", f);
process.exit(failures.length ? 1 : 0);
