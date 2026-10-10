/** Verdict wording in a D_t VALUE (same rule as jev-calibration-1/sample.mjs). */
export const LEAK_RE = /(?<![-\w])(reject(?:ed|s|ion)?|accept(?:ed|s)?|accept)(?![-\w])/i;

function strings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("reconstructed_")) strings(x, out);
  return out;
}

/** @param {Record<string, unknown>} plan */
export function leakHitsFromPlan(plan) {
  const all = strings(plan).flatMap((s) =>
    [...s.matchAll(new RegExp(LEAK_RE.source, "gi"))].map((m) => m[0].toLowerCase()),
  );
  return [...new Set(all)].sort();
}
