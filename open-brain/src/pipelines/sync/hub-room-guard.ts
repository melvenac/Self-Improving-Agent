/**
 * HUBROOM-GUARD (QA-281, QA-283, HUBROOM-GUARD r3): Cursor hub copies must not instruct a waker seat to wait for the
 * next atlas turn inside the run.
 */

export const EXIT2_WAIT_PHRASE =
  "Exit 2 comes only from --wait, which a seat with a waker does not run; if you see it, end the turn.";

const NEVER_BLOCK_PHRASE = "never block on hub-talk waiting";
const EXIT3_WAIT_PHRASE = "wait `retry-after` seconds";

const SEAT_FILE_WAIT_RE = /`wait`\s+(suffix|key|line)/i;
const WAIT_TIMEOUT_RE = /wait[-_]?timeout/i;

const HUB_INVOKE_RE = /hub-talk(?:\.mjs)?|talk line|`talk`/i;
const FORBIDDEN_VERB_RE = /\b(a?wait\w*|listen\w*|block\w*|poll\w*|await\w*)\b/i;

const ATLAS_NEXT_TURN_RE = /\b(atlas(?:'s)?|next turn|replied|reply)\b/i;

export type HubRoomGuardOptions = {
  skipWaitCount?: boolean;
  skipSeatFileWait?: boolean;
  skipHubVerbInTurn?: boolean;
  skipAtlasNextTurn?: boolean;
  /** When true, negation clauses never exempt (mutant: S6 must go red). */
  skipNegationScope?: boolean;
};

function negationScopeEnabled(opts: HubRoomGuardOptions): boolean {
  return !opts.skipNegationScope;
}

/** Period is a filename extension (e.g. hub-talk.mjs), not a sentence end. */
function isFilenameExtensionDot(text: string, dotIndex: number): boolean {
  const before = text[dotIndex - 1];
  const after = text[dotIndex + 1];
  return before !== undefined && after !== undefined && /[\w-]/.test(before) && /[\w]/.test(after);
}

/** Split on `.`, `;`, or newline outside backticks (`.` not inside `word.ext`). */
export function splitSentencesOutsideBackticks(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inTick = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "`") {
      inTick = !inTick;
      buf += ch;
      continue;
    }
    if (!inTick && ch === "." && isFilenameExtensionDot(text, i)) {
      buf += ch;
      continue;
    }
    if (!inTick && (ch === "\n" || ch === ";" || ch === ".")) {
      const piece = buf.trim();
      if (piece) out.push(piece);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

/** Split a sentence into clauses on `,`, `;`, em-dash, or colon outside backticks. */
export function splitClausesOutsideBackticks(sentence: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inTick = false;
  for (let i = 0; i < sentence.length; i++) {
    const ch = sentence[i];
    if (ch === "`") {
      inTick = !inTick;
      buf += ch;
      continue;
    }
    if (!inTick && (ch === "," || ch === ";" || ch === "—" || ch === ":")) {
      const piece = buf.trim();
      if (piece) out.push(piece);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out.length > 0 ? out : [sentence.trim()];
}

function clauseIsThrottledRetryBackoff(clause: string): boolean {
  if (/\bwait\s+\d+\s+seconds\b/i.test(clause) && /\b(retry|throttl)/i.test(clause)) return true;
  if (/\bthrottl/i.test(clause) && /\bwait\b/i.test(clause)) return true;
  return false;
}

/** True when this clause's negation governs the forbidden hub-wait act in the same clause. */
export function clauseNegatesHubWaitAct(clause: string): boolean {
  const c = clause.toLowerCase();
  if (c.includes(NEVER_BLOCK_PHRASE)) return true;
  if (clause.includes(EXIT3_WAIT_PHRASE)) return true;
  if (/\bdoes not\s+run\b/i.test(clause) && /--wait\b/.test(clause)) return true;
  if (/\b(?:don't|doesn't|do not|never)\s+(?:wait|block|listen|poll)\b/i.test(clause) && HUB_INVOKE_RE.test(clause)) {
    return true;
  }
  if (/\b(?:don't|do not)\s+wait\s+on\s+hub-talk\b/i.test(clause)) return true;
  return false;
}

function clauseWaitsForAtlasNextTurn(clause: string): boolean {
  if (/\blisten\w*\b/i.test(clause) && ATLAS_NEXT_TURN_RE.test(clause)) return true;
  if (/\b(?:wait|wait for)\b/i.test(clause) && ATLAS_NEXT_TURN_RE.test(clause)) return true;
  if (/\bfor\b.*\b(atlas|next turn|reply)\b/i.test(clause) && /\bbefore you end the turn\b/i.test(clause)) return true;
  if (/\buntil\b/i.test(clause) && ATLAS_NEXT_TURN_RE.test(clause)) return true;
  if (/\bkeep\s+listening\b/i.test(clause) && ATLAS_NEXT_TURN_RE.test(clause)) return true;
  return false;
}

function clauseHubVerbInTurnWait(clause: string): boolean {
  if (clauseIsThrottledRetryBackoff(clause)) return false;
  if (HUB_INVOKE_RE.test(clause) && FORBIDDEN_VERB_RE.test(clause)) return true;
  if (/\bwait for hub-talk\b/i.test(clause)) return true;
  if (/\bhub-talk\b/i.test(clause) && /\b(repeat|rerun)\b/i.test(clause) && /\buntil\b/i.test(clause)) return true;
  if (/\bhub-talk\b/i.test(clause) && /\buntil\b/i.test(clause) && ATLAS_NEXT_TURN_RE.test(clause)) return true;
  if (/\btalk line\b/i.test(clause) && /\b(rerun|repeat|every minute)\b/i.test(clause)) return true;
  if (/\btalk line\b/i.test(clause) && /\buntil\b/i.test(clause) && ATLAS_NEXT_TURN_RE.test(clause)) return true;
  if (/\b(listen|poll|block)\w*\b/i.test(clause) && /\buntil\b/i.test(clause) && ATLAS_NEXT_TURN_RE.test(clause)) {
    return true;
  }
  if (/\bpoll\w*\b/i.test(clause) && HUB_INVOKE_RE.test(clause) && ATLAS_NEXT_TURN_RE.test(clause)) return true;
  if (/\bawait\w*\b/i.test(clause) && /\b(atlas|hub-talk|next turn)\b/i.test(clause)) return true;
  if (/\bstay in this run\b/i.test(clause) && /\b(posting|after posting)\b/i.test(clause)) return true;
  if (/\bpoll\w*\b/i.test(clause) && /\b(before ending|next turn|atlas)\b/i.test(clause)) return true;
  return false;
}

function guardedClauseViolation(
  clause: string,
  opts: HubRoomGuardOptions,
  kind: "hub-verb" | "atlas-next-turn",
  message: string
): string | null {
  if (negationScopeEnabled(opts) && clauseNegatesHubWaitAct(clause)) return null;
  const hit =
    kind === "hub-verb" ? clauseHubVerbInTurnWait(clause) : clauseWaitsForAtlasNextTurn(clause) && !HUB_INVOKE_RE.test(clause);
  if (!hit) return null;
  if (kind === "atlas-next-turn" && HUB_INVOKE_RE.test(clause) && clauseHubVerbInTurnWait(clause)) return null;
  return message;
}

/** Check 1: only the exit-2 explain sentence may name `--wait`. */
export function violationsWaitFlagCount(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const waitCount = normalized.match(/--wait\b/g)?.length ?? 0;
  let exit2Count = 0;
  let from = 0;
  while (true) {
    const idx = normalized.indexOf(EXIT2_WAIT_PHRASE, from);
    if (idx < 0) break;
    exit2Count++;
    from = idx + EXIT2_WAIT_PHRASE.length;
  }
  if (waitCount !== exit2Count) {
    return [
      `--wait count (${waitCount}) must equal exit-2 explain sentence count (${exit2Count}); only that sentence may name --wait`,
    ];
  }
  return [];
}

/** Check 2: no seat-file `wait` suffix/key/line or wait-timeout wording. */
export function violationsSeatFileWait(text: string): string[] {
  const violations: string[] = [];
  for (const sentence of splitSentencesOutsideBackticks(text.replace(/\r\n/g, "\n"))) {
    for (const clause of splitClausesOutsideBackticks(sentence)) {
      if (SEAT_FILE_WAIT_RE.test(clause)) {
        violations.push(`seat-file wait key/suffix/line forbidden: ${clause.slice(0, 80)}…`);
      }
      if (WAIT_TIMEOUT_RE.test(clause)) {
        violations.push(`wait-timeout forbidden: ${clause.slice(0, 80)}…`);
      }
    }
  }
  return violations;
}

/** Check 3: hub invocation paired with wait/listen/block/poll inflections. */
export function violationsHubVerbInTurn(text: string, opts: HubRoomGuardOptions = {}): string[] {
  const violations: string[] = [];
  for (const sentence of splitSentencesOutsideBackticks(text.replace(/\r\n/g, "\n"))) {
    for (const clause of splitClausesOutsideBackticks(sentence)) {
      const v = guardedClauseViolation(clause, opts, "hub-verb", `hub-verb in-turn wait: ${clause.slice(0, 100)}…`);
      if (v) violations.push(v);
    }
  }
  return violations;
}

/** Check 4: wait/listen for atlas or next turn without hub token, and cross-sentence talk-line + wait pairs (K1c). */
export function violationsAtlasNextTurn(text: string, opts: HubRoomGuardOptions = {}): string[] {
  const violations: string[] = [];
  const normalized = text.replace(/\r\n/g, "\n");
  const sentences = splitSentencesOutsideBackticks(normalized);

  for (const sentence of sentences) {
    for (const clause of splitClausesOutsideBackticks(sentence)) {
      const v = guardedClauseViolation(
        clause,
        opts,
        "atlas-next-turn",
        `atlas/next-turn in-run wait: ${clause.slice(0, 100)}…`
      );
      if (v) violations.push(v);
    }
  }

  for (let i = 1; i < sentences.length; i++) {
    const prev = sentences[i - 1];
    const cur = sentences[i];
    if (!HUB_INVOKE_RE.test(prev)) continue;
    if (negationScopeEnabled(opts) && clauseNegatesHubWaitAct(cur)) continue;
    if (/\b(wait|wait for)\b/i.test(cur) && ATLAS_NEXT_TURN_RE.test(cur)) {
      violations.push(`cross-sentence hub invoke then wait for atlas: ${cur.slice(0, 100)}…`);
    }
    if (/\bbefore you end the turn\b/i.test(cur) && ATLAS_NEXT_TURN_RE.test(cur) && /\bwait\b/i.test(cur)) {
      violations.push(`cross-sentence hub invoke then wait before end: ${cur.slice(0, 100)}…`);
    }
  }

  return violations;
}

/** Check 3+4 combined (legacy name). */
export function violationsInTurnWait(text: string, opts: HubRoomGuardOptions = {}): string[] {
  return [...violationsHubVerbInTurn(text, opts), ...violationsAtlasNextTurn(text, opts)];
}

/** Hub-room section of start.md: from `### Hub room` through the line before the next `###` heading. */
export function hubRoomSectionFromStart(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const at = lines.findIndex((l) => l.trim() === "### Hub room");
  if (at < 0) return "";
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((l) => /^### /.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

export function hubRoomGuardViolations(text: string, opts: HubRoomGuardOptions = {}): string[] {
  const out: string[] = [];
  if (!opts.skipWaitCount) out.push(...violationsWaitFlagCount(text));
  if (!opts.skipSeatFileWait) out.push(...violationsSeatFileWait(text));
  if (!opts.skipHubVerbInTurn) out.push(...violationsHubVerbInTurn(text, opts));
  if (!opts.skipAtlasNextTurn) out.push(...violationsAtlasNextTurn(text, opts));
  return out;
}
