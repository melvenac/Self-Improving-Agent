// sample.mjs: draw the scored set. Reads labels.json, inputs.json and the D_t files; writes sample.json.
//
// Groups (rulings-1 item 5):
//   headline    a labelled, non-excluded case whose D_t carries NO verdict wording. ALL of them (rulings-2:
//               N outranks balance; the ACCEPT/REJECT split is whatever the pool is). The set the headline uses.
//   leak_group  a labelled, non-excluded case whose D_t carries verdict wording (a re-dispatch written after a
//               REJECT quotes it). Scored in full, as its own group; the report compares it with the headline.
// The wording rule is not relaxed and the text is not edited. If the headline set is under 50, the real N is
// what sample.json says and what the report must print.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, SEED, readJson, writeJson } from "./lib.mjs";

/** Verdict wording in a D_t VALUE (keys are skipped, so the field name "acceptance" never counts). Case-insensitive; "accept-stale", "acceptance" and "acceptable" do not match. */
const LEAK_RE = /(?<![-\w])(reject(?:ed|s|ion)?|accept(?:ed|s)?|accept)(?![-\w])/i;
const MIN_SCORED = 50;

const MUST_INCLUDE = {
  "slice-four (all ACCEPTED)": ["s3-b-step1", "s3-a13", "s3-b2", "s3-c-r4", "t195-r2", "t158-r2", "t196-t197-r2", "t198-r2"],
  "candidate A rejected rounds": ["s3-a4", "s3-a5", "s3-a6", "s3-a7", "s3-a8", "s3-a9", "s3-a10", "s3-a11", "s3-a12"],
  "T-194 r1..r8": ["t194-r1", "t194-r2", "t194-r3", "t194-r4", "t194-r5", "t194-r6", "t194-r7", "t194-r8"],
};

function strings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!k.startsWith("reconstructed_")) strings(x, out);
  return out;
}

{
  const labels = readJson("labels.json");
  const { built, dropped } = readJson("inputs.json");
  const dtFile = new Map(built.map((b) => [b.case_id, b.file]));
  const dtDropped = new Map(dropped.map((d) => [d.case_id, d.reason]));

  const rows = labels.map((l) => {
    let status;
    let leak_hits = [];
    let leak_count = 0;
    // Wording is measured on every D_t, excluded or not, so the manifest can report it for the whole pool.
    if (dtFile.has(l.case_id)) {
      const plan = JSON.parse(readFileSync(join(HERE, dtFile.get(l.case_id)), "utf-8"));
      const all = strings(plan).flatMap((s) => [...s.matchAll(new RegExp(LEAK_RE.source, "gi"))].map((m) => m[0].toLowerCase()));
      leak_count = all.length;
      leak_hits = [...new Set(all)].sort();
    }
    if (l.excluded) status = `excluded: ${l.excluded}`;
    else if (dtDropped.has(l.case_id)) status = `dropped: ${dtDropped.get(l.case_id)}`;
    else if (!dtFile.has(l.case_id)) status = "dropped: no-D_t";
    else status = leak_hits.length > 0 ? "leak-wording" : "headline-pool";
    return { case_id: l.case_id, label: l.label, status, leak_hits, leak_count };
  });

  const pool = rows.filter((r) => r.status === "headline-pool");
  const side = (lab) => pool.filter((r) => r.label === lab);
  const acc = side("ACCEPT");
  const rej = side("REJECT");
  // Rulings-2 (D-098): N >= 50 outranks balance, so the headline is EVERY eligible case. No draw, no seed use.
  const headline = pool.map((r) => r.case_id).sort();

  const leak_group = rows.filter((r) => r.status === "leak-wording" && r.label).map((r) => r.case_id).sort();
  const status_of = (id) => rows.find((r) => r.case_id === id)?.status ?? null;
  const must_include = Object.fromEntries(
    Object.entries(MUST_INCLUDE).map(([group, ids]) => [
      group,
      ids.map((id) => ({
        case_id: id,
        placed: headline.includes(id) ? "headline" : leak_group.includes(id) ? "leak_group" : status_of(id) ?? "not-in-pool",
      })),
    ]),
  );
  const count = (ids, lab) => ids.filter((id) => rows.find((r) => r.case_id === id)?.label === lab).length;
  writeJson("sample.json", {
    seed: SEED,
    min_scored_required: MIN_SCORED,
    headline_n: headline.length,
    headline_meets_minimum: headline.length >= MIN_SCORED,
    headline_accept: count(headline, "ACCEPT"),
    headline_reject: count(headline, "REJECT"),
    headline,
    leak_group_n: leak_group.length,
    leak_group_accept: count(leak_group, "ACCEPT"),
    leak_group_reject: count(leak_group, "REJECT"),
    leak_group,
    leak_rule: LEAK_RE.source,
    headline_pool_unsampled: { accept: acc.length, reject: rej.length },
    must_include,
    status_by_case: Object.fromEntries(rows.map((r) => [r.case_id, { status: r.status, label: r.label, leak_hits: r.leak_hits, leak_count: r.leak_count }])),
  });
  console.log(`headline ${headline.length} (ACCEPT ${count(headline, "ACCEPT")}, REJECT ${count(headline, "REJECT")}); pool ACCEPT ${acc.length}, REJECT ${rej.length}; leak group ${leak_group.length}`);
  if (headline.length < MIN_SCORED) console.log(`!! headline set is ${headline.length}, below ${MIN_SCORED}: report the real N`);
}
