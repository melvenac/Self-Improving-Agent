/**
 * QA verdict leak detector (JEV-CAL-2 r3). Wording that states or implies a QA verdict —
 * not ordinary accept/reject verbs in code or tests.
 */

export function strings(v, out = []) {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) if (!k.startsWith("reconstructed_")) strings(x, out);
  return out;
}

/** @typedef {{ start: number; end: number; phrase: string }} VerdictSpan */

const QA_VERDICT_RE =
  /\bQA\s*\d+\s+(?:ACCEPT|REJECT|INCOMPLETE|accept(?:ed)?|reject(?:ed|s|ion)?)\b/gi;
const QA_VERDICT_BY_RE = /\b(?:accept(?:ed)?|reject(?:ed|s|ion)?)\s+(?:by|in)\s+QA\s*\d+/gi;
const QA_ROUND_REJECT_RE = /\br\d+\s+was\s+reject(?:ed|s|ion)?\s+by\s+QA\s*\d+/gi;
const VERDICT_LABEL_RE = /\bVERDICT\s*:\s*(?:ACCEPT|REJECT|INCOMPLETE)\b/gi;
const UPPER_VERDICT_RE = /\b(?:ACCEPT|REJECT|INCOMPLETE)\b/g;
const PR_ROUND_RE =
  /\b(?:accepted|rejected|rejection)\b[^.\n]{0,120}\b(?:PR\s*#?\d+|PR\b|round\s+\d+|candidate)\b|\b(?:PR\s*#?\d+|PR\b|round\s+\d+|candidate)\b[^.\n]{0,120}\b(?:accepted|rejected|rejection)\b/gi;

const SCAN_RES = [VERDICT_LABEL_RE, QA_VERDICT_RE, QA_VERDICT_BY_RE, QA_ROUND_REJECT_RE, UPPER_VERDICT_RE, PR_ROUND_RE];

/** Known code/test false positives for the fixture negatives. */
export function isCodeVerdictFalsePositive(text, start, end) {
  const slice = text.slice(start, end);
  const window = text.slice(Math.max(0, start - 48), Math.min(text.length, end + 48));
  if (/export\s+function\s+accept\b/i.test(window) && /\baccept\b/i.test(slice)) return true;
  if (/\bfunction\s+accept\b/i.test(window) && /\baccept\b/i.test(slice)) return true;
  if (/\brejects\s+a\s+(?:stale\s+)?\w+/i.test(window) && /\brejects?\b/i.test(slice)) return true;
  if (/\brejection\s+path\b/i.test(window)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {string[]} distinct matched phrases (lower case for tokens, original slice for phrases)
 */
export function verdictLeakPhrasesInText(text) {
  if (!text || typeof text !== "string") return [];
  const spans = [];
  for (const re of SCAN_RES) {
    const flags = re.flags;
    const g = new RegExp(re.source, flags.includes("g") ? flags : `${flags}g`);
    for (const m of text.matchAll(g)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (isCodeVerdictFalsePositive(text, start, end)) continue;
      spans.push({ start, end, phrase: m[0].trim() });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const out = [];
  const seen = new Set();
  for (const s of spans) {
    const key = s.phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.phrase);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function textHasVerdictLeak(text) {
  return verdictLeakPhrasesInText(text).length > 0;
}

/** Split prose into sentences for plan redaction. */
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * Redact plan fields: drop sentences with verdict leaks; drop acceptance rows with no observable left.
 * @param {Record<string, unknown>} plan
 * @returns {{ plan: Record<string, unknown>; redacted_sentences: { field: string; sentence: string }[] }}
 */
export function redactPlanVerdictSentences(plan) {
  const redacted_sentences = [];
  const redactText = (field, text) => {
    if (!text || typeof text !== "string") return text;
    const kept = [];
    for (const sent of splitSentences(text)) {
      if (textHasVerdictLeak(sent)) redacted_sentences.push({ field, sentence: sent });
      else kept.push(sent);
    }
    return kept.join(" ").trim();
  };
  const redactList = (field, list) =>
    (list ?? [])
      .map((item, i) => {
        const t = redactText(`${field}[${i}]`, String(item));
        return t === "" ? null : t;
      })
      .filter(Boolean);

  const acceptance = (plan.acceptance ?? [])
    .map((row) => {
      const obs = redactText(`acceptance.${row.id}`, row.observable);
      if (!obs) {
        if (row.observable) redacted_sentences.push({ field: `acceptance.${row.id}`, sentence: row.observable });
        return null;
      }
      return { ...row, observable: obs };
    })
    .filter(Boolean);

  const next = {
    ...plan,
    objective: redactText("objective", plan.objective),
    new_capability: redactText("new_capability", plan.new_capability),
    tasks: redactList("tasks", plan.tasks),
    out_of_scope: redactList("out_of_scope", plan.out_of_scope),
    preserve: redactList("preserve", plan.preserve),
    repair_targets: redactList("repair_targets", plan.repair_targets),
    acceptance,
  };
  redacted_sentences.sort((a, b) => a.field.localeCompare(b.field) || a.sentence.localeCompare(b.sentence));
  return { plan: next, redacted_sentences };
}

/** @deprecated cal1 broad rule — not used for cal2 exclusion; kept for collect parity naming only. */
export const LEGACY_BROAD_LEAK_RE = /(?<![-\w])(reject(?:ed|s|ion)?|accept(?:ed|s)?|accept)(?![-\w])/i;

/** Plan still carries verdict wording (after redaction should be empty). */
export function leakHitsFromPlan(plan) {
  return strings(plan).flatMap((s) => verdictLeakPhrasesInText(s).map((p) => p.toLowerCase()));
}

export function leakSourceBucket(fieldPath) {
  const f = fieldPath.toLowerCase();
  if (f.includes("checks")) return "checks";
  if (f.includes("requirement_rows") || f.includes("hunks") || f.includes("diffstat") || f.includes("scored_diff")) {
    return "diff";
  }
  if (f.includes("plan") || f.includes("questions") || f.includes("observable")) return "plan";
  return "other";
}

/** Verdict leaks in work diff text only (post record-path filter). */
export function verdictLeaksFromDiffText(diff) {
  return verdictLeakPhrasesInText(diff).map((phrase) => ({
    field: "diff",
    source: "diff",
    phrase: phrase.toLowerCase(),
  }));
}

/** @param {unknown} request */
export function leakHitsFromRequest(request) {
  const hunks = request?.context?.requirement_rows;
  if (!Array.isArray(hunks)) return [];
  const text = hunks.flatMap((r) => r.hunks ?? []).join("\n");
  return verdictLeakPhrasesInText(text).map((p) => p.toLowerCase());
}

function leakHitsWalkVerdict(value, path, out, textExtractor) {
  if (typeof value === "string") {
    for (const phrase of textExtractor(value)) {
      out.push({ field: path, source: leakSourceBucket(path), phrase: phrase.toLowerCase() });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) leakHitsWalkVerdict(value[i], `${path}[${i}]`, out, textExtractor);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, x] of Object.entries(value)) {
      if (k.startsWith("reconstructed_")) continue;
      leakHitsWalkVerdict(x, path ? `${path}.${k}` : k, out, textExtractor);
    }
  }
}

/** Detailed verdict leaks from diff hunks inside a built request. */
export function leakHitsDetailedFromRequestDiff(request) {
  const raw = [];
  const rows = request?.context?.requirement_rows;
  if (Array.isArray(rows)) {
    for (let i = 0; i < rows.length; i++) {
      const hunks = rows[i]?.hunks;
      if (!Array.isArray(hunks)) continue;
      for (let j = 0; j < hunks.length; j++) {
        const field = `request.context.requirement_rows[${i}].hunks[${j}]`;
        for (const phrase of verdictLeakPhrasesInText(String(hunks[j]))) {
          raw.push({ field, source: "diff", phrase: phrase.toLowerCase() });
        }
      }
    }
  }
  return raw;
}

export function leakHitsDetailedFromPlan(plan) {
  const raw = [];
  leakHitsWalkVerdict(plan, "plan", raw, verdictLeakPhrasesInText);
  for (const h of raw) h.source = "plan";
  return raw;
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
