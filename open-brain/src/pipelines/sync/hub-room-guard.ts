/**
 * HUBROOM-GUARD (QA-281 G1): sentence-level check that Cursor hub copies do not instruct a waker seat to
 * run foreground hub-talk --wait or to wait/listen/block for the next turn inside the run.
 */

export const EXIT2_WAIT_PHRASE =
  "Exit 2 comes only from --wait, which a seat with a waker does not run; if you see it, end the turn.";

const NEVER_BLOCK_PHRASE = "never block on hub-talk waiting";
const EXIT3_WAIT_PHRASE = "wait `retry-after` seconds";

const SEAT_FILE_WAIT_RE = /`wait`\s+(suffix|key|line)/i;
const WAIT_TIMEOUT_RE = /wait[-_]?timeout/i;

const HUB_INVOKE_RE = /hub-talk|talk line|`talk`/i;
const FORBIDDEN_VERB_RE = /\b(wait(?:ing|s)?|listen(?:ing)?|block(?:ing)?|poll(?:ing)?)\b/i;

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

function sentenceIsAllowlisted(sentence: string): boolean {
  if (sentence.includes(EXIT2_WAIT_PHRASE)) return true;
  if (sentence.toLowerCase().includes(NEVER_BLOCK_PHRASE)) return true;
  if (sentence.includes(EXIT3_WAIT_PHRASE)) return true;
  return false;
}

function sentenceIsNegated(sentence: string): boolean {
  return /\bnever\b/i.test(sentence) || /\bdoes not\b/i.test(sentence) || /\bdo not\b/i.test(sentence);
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

export function hubRoomGuardViolations(text: string): string[] {
  const violations: string[] = [];
  const normalized = text.replace(/\r\n/g, "\n");

  const waitMatches = normalized.match(/--wait\b/g);
  const waitCount = waitMatches?.length ?? 0;
  let exit2Count = 0;
  let from = 0;
  while (true) {
    const idx = normalized.indexOf(EXIT2_WAIT_PHRASE, from);
    if (idx < 0) break;
    exit2Count++;
    from = idx + EXIT2_WAIT_PHRASE.length;
  }
  if (waitCount !== exit2Count) {
    violations.push(
      `--wait count (${waitCount}) must equal exit-2 explain sentence count (${exit2Count}); only that sentence may name --wait`
    );
  }

  for (const sentence of splitSentencesOutsideBackticks(normalized)) {
    if (SEAT_FILE_WAIT_RE.test(sentence)) {
      violations.push(`seat-file wait key/suffix/line forbidden: ${sentence.slice(0, 80)}…`);
    }
    if (WAIT_TIMEOUT_RE.test(sentence)) {
      violations.push(`wait-timeout forbidden: ${sentence.slice(0, 80)}…`);
    }

    if (!HUB_INVOKE_RE.test(sentence) || !FORBIDDEN_VERB_RE.test(sentence)) continue;
    if (sentenceIsAllowlisted(sentence) || sentenceIsNegated(sentence)) continue;
    violations.push(`hub invocation with wait/listen/block/poll: ${sentence.slice(0, 100)}…`);
  }

  return violations;
}
