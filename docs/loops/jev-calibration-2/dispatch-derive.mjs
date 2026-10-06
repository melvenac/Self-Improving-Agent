// Mechanical D_t derivation from dispatch markdown (jev-calibration-1/inputs.mjs, without zod validate).

const TASK_HEADINGS = /(rows?\b.*\bscore|score\b|\bcheck|what to (?:read|do)|the design|procedure|task|goal|scope|requirements?|rows)/i;
const OUT_HEADINGS = /(out of scope|not in scope|non-goals?|do not|what not)/i;
const PRESERVE_HEADINGS = /(preserve|regression|unchanged|must not change)/i;
const REPAIR_HEADINGS = /(what changed since|defects? to|findings?|repair)/i;

const clean = (s) => s.replace(/[*`]/g, "").replace(/\s+/g, " ").trim();

function sections(text) {
  const out = [];
  let cur = { heading: "", level: 0, lines: [] };
  for (const line of text.split("\n")) {
    const m = /^(#{1,3})\s+(.*)$/.exec(line);
    if (m) {
      out.push(cur);
      cur = { heading: m[2], level: m[1].length, lines: [] };
    } else cur.lines.push(line);
  }
  out.push(cur);
  return out;
}

function items(lines) {
  const res = [];
  let last = null;
  let inTable = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const li = /^\s{0,3}(?:[-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) {
        inTable = true;
        continue;
      }
      if (!inTable) {
        last = null;
        continue;
      }
      res.push({ kind: "row", cells });
      last = null;
      continue;
    }
    inTable = false;
    if (li) {
      res.push({ kind: "item", text: li[1] });
      last = res[res.length - 1];
      continue;
    }
    if (last && /^\s{2,}\S/.test(line)) {
      last.text += ` ${line.trim()}`;
      continue;
    }
    last = null;
  }
  return res;
}

const itemText = (it) => clean(it.kind === "item" ? it.text : it.cells.join(" | "));
const looksLikeId = (c) =>
  /^[A-Za-z][A-Za-z0-9_.-]*\d[A-Za-z0-9_.-]*$/.test(clean(c)) || /^[A-Z]{1,6}-?\d+[A-Za-z0-9.-]*$/.test(clean(c));

/**
 * @param {string} text dispatch markdown
 * @param {{ case_no: number, case_id: string, dispatch_path: string, dispatch_blob: string }} entry
 */
export function derivePlanFromDispatch(text, entry) {
  const secs = sections(text);
  const h1 = secs.find((s) => s.level === 1);
  if (!h1 || clean(h1.heading) === "") return null;
  const objective = clean(h1.heading);
  const under = (re) => secs.filter((s) => s.level > 1 && re.test(s.heading)).flatMap((s) => items(s.lines));
  let taskItems = under(TASK_HEADINGS);
  if (taskItems.length === 0) taskItems = secs.flatMap((s) => items(s.lines));
  if (taskItems.length === 0) return null;
  const tasks = taskItems.map(itemText).filter((t) => t !== "");
  const rowAcc = taskItems.filter((it) => it.kind === "row" && it.cells.length >= 2 && looksLikeId(it.cells[0]));
  const acceptance =
    rowAcc.length > 0
      ? rowAcc.map((it) => ({ id: clean(it.cells[0]), observable: clean(it.cells.slice(1).join(" | ")), type: "blackbox" }))
      : tasks.map((t, i) => ({ id: `T${i + 1}`, observable: t, type: "blackbox" }));
  const seen = new Set();
  const acc = acceptance.filter((a) => a.observable !== "" && !seen.has(a.id) && seen.add(a.id));
  return {
    loop: `${entry.case_no}-${entry.case_id}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""),
    objective,
    tasks,
    out_of_scope: under(OUT_HEADINGS).map(itemText).filter(Boolean),
    preserve: under(PRESERVE_HEADINGS).map(itemText).filter(Boolean),
    acceptance: acc,
    repair_targets: under(REPAIR_HEADINGS).map(itemText).filter(Boolean),
    new_capability: objective,
    reconstructed_by: "jev-calibration-2/dispatch-derive.mjs",
    reconstructed_from: { path: entry.dispatch_path, blob: entry.dispatch_blob },
  };
}
