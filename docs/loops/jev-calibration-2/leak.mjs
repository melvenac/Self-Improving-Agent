/** Verdict wording in a D_t VALUE (same rule as jev-calibration-1/sample.mjs). */
export const LEAK_RE = /(?<![-\w])(reject(?:ed|s|ion)?|accept(?:ed|s)?|accept)(?![-\w])/i;

export function strings(v, out = []) {
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

/** Verdict wording anywhere in a gate request object (values only). */
export function leakHitsFromRequest(request) {
  const all = strings(request).flatMap((s) =>
    [...s.matchAll(new RegExp(LEAK_RE.source, "gi"))].map((m) => m[0].toLowerCase()),
  );
  return [...new Set(all)].sort();
}

/** Map a JSON path to plan / diff / checks for calibration reports. */
export function leakSourceBucket(fieldPath) {
  const f = fieldPath.toLowerCase();
  if (f.includes("checks")) return "checks";
  if (f.includes("requirement_rows") || f.includes("hunks") || f.includes("diffstat") || f.includes("scored_diff")) {
    return "diff";
  }
  if (f.includes("plan") || f.includes("questions") || f.includes("observable")) return "plan";
  return "other";
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {{ field: string; source: string; phrase: string }[]} out
 */
function leakHitsWalk(value, path, out) {
  if (typeof value === "string") {
    for (const m of value.matchAll(new RegExp(LEAK_RE.source, "gi"))) {
      out.push({ field: path, source: leakSourceBucket(path), phrase: m[0].toLowerCase() });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) leakHitsWalk(value[i], `${path}[${i}]`, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, x] of Object.entries(value)) {
      if (k.startsWith("reconstructed_")) continue;
      leakHitsWalk(x, path ? `${path}.${k}` : k, out);
    }
  }
}

/** Detailed leak hits from a gate request (field + source bucket + phrase). */
export function leakHitsDetailedFromRequest(request) {
  const raw = [];
  leakHitsWalk(request, "request", raw);
  const seen = new Set();
  const out = [];
  for (const h of raw) {
    const key = `${h.source}\0${h.phrase}\0${h.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  out.sort((a, b) => a.source.localeCompare(b.source) || a.phrase.localeCompare(b.phrase) || a.field.localeCompare(b.field));
  return out;
}

/** Detailed leak hits from plan object only. */
export function leakHitsDetailedFromPlan(plan) {
  const raw = [];
  leakHitsWalk(plan, "plan", raw);
  const seen = new Set();
  const out = [];
  for (const h of raw) {
    const key = `${h.source}\0${h.phrase}\0${h.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...h, source: "plan" });
  }
  out.sort((a, b) => a.phrase.localeCompare(b.phrase) || a.field.localeCompare(b.field));
  return out;
}

export function mergeLeakDetails(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const h of list) {
      const key = `${h.source}\0${h.phrase}\0${h.field}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
    }
  }
  return out;
}
