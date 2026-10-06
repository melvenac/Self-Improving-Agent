/**
 * HUBROOM-GUARD (QA-281 G1, QA-283 K1/K2): sentence-level check that Cursor hub copies do not instruct a waker
 * seat to run foreground hub-talk --wait or to wait/listen/block for the next turn inside the run.
 */

export const EXIT2_WAIT_PHRASE =
  "Exit 2 comes only from --wait, which a seat with a waker does not run; if you see it, end the turn.";

const NEVER_BLOCK_PHRASE = "never block on hub-talk waiting";
const EXIT3_WAIT_PHRASE = "wait `retry-after` seconds";

const SEAT_FILE_WAIT_RE = /`wait`\s+(suffix|key|line)/i;
const WAIT_TIMEOUT_RE = /wait[-_]?timeout/i;

const HUB_INVOKE_RE = /hub-talk|talk line|`talk`/i;
const FORBIDDEN_VERB_RE = /\b(a?wait(?:ing|s)?|listen(?:ing|s)?|block(?:ing|s)?|poll(?:ing|s)?|await(?:ing|s)?)\b/i;

export type HubRoomGuardOptions = {
  /** QA-283 K2: mutant tests disable one check at a time. */
  skipWaitCount?: boolean;
  skipSeatFileWait?: boolean;
  skipInTurnWait?: boolean;
};

/** Split on `.`, `;`, or newline outside backticks. */
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

/** Split a sentence into clauses on `,`, `;`, or em-dash outside backticks (K1: negation applies per clause). */
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

/** True when this clause's negation governs the forbidden hub-wait act in the same clause. */
export function clauseNegatesHubWaitAct(clause: string): boolean {
  const c = clause.toLowerCase();
  if (c.includes(NEVER_BLOCK_PHRASE)) return true;
  if (EXIT3_WAIT_PHRASE.toLowerCase() === clause.trim().toLowerCase() || clause.includes(EXIT3_WAIT_PHRASE)) {
    return true;
  }
  if (/\bdoes not\s+run\b/i.test(clause) && /--wait\b/.test(clause)) return true;
  if (/\bnever\s+(block|wait|listen|poll|await)\b/i.test(clause) && HUB_INVOKE_RE.test(clause)) return true;
  return false;
}

function clauseInstructsInTurnWait(clause: string): boolean {
  if (clauseNegatesHubWaitAct(clause)) return false;

  if (HUB_INVOKE_RE.test(clause) && FORBIDDEN_VERB_RE.test(clause)) return true;

  if (/\bwait for hub-talk\b/i.test(clause)) return true;
  if (/\bhub-talk\b/i.test(clause) && /\b(repeat|rerun)\b/i.test(clause) && /\buntil\b/i.test(clause)) return true;
  if (/\btalk line\b/i.test(clause) && /\b(rerun|repeat|every minute)\b/i.test(clause)) return true;
  if (/\btalk line\b/i.test(clause) && /\buntil\b/i.test(clause) && /\b(next turn|atlas)\b/i.test(clause)) return true;
  if (/\b(listen|poll|block)\b/i.test(clause) && /\buntil\b/i.test(clause) && /\b(atlas|next turn|replied)\b/i.test(clause)) {
    return true;
  }
  if (/\bawait\b/i.test(clause) && /\b(atlas|hub-talk|next turn)\b/i.test(clause)) return true;
  if (/\bstay in this run\b/i.test(clause) && /\b(posting|after posting)\b/i.test(clause)) return true;
  if (/\bpoll(ing)?\b/i.test(clause) && /\b(before ending|next turn|atlas)\b/i.test(clause)) return true;

  return false;
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

/** Check 3: no in-run wait/listen/block/poll for the next hub turn (clause-scoped negation). */
export function violationsInTurnWait(text: string): string[] {
  const violations: string[] = [];
  const normalized = text.replace(/\r\n/g, "\n");

  for (const sentence of splitSentencesOutsideBackticks(normalized)) {
    for (const clause of splitClausesOutsideBackticks(sentence)) {
      if (clauseInstructsInTurnWait(clause)) {
        violations.push(`in-turn wait/listen/block/poll: ${clause.slice(0, 100)}…`);
      }
    }
  }
  return violations;
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
  if (!opts.skipInTurnWait) out.push(...violationsInTurnWait(text));
  return out;
}
