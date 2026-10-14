/**
 * The trigger's query path — precision only, floor below, nothing under it.
 *
 * This module is the one thing the trigger and the store have in common, and
 * it is deliberately NOT `ob_recall`. Brief §2 deliverable 2 and ruling 4:
 * `ob_recall`'s handler broadens a conjunctive query to `OR` whenever the
 * precise attempt underfills, which is right for an agent that asked a
 * question and wrong for a channel nobody asked. An agent reading a weak hit
 * it requested discounts it; an agent handed a weak hit it did not request
 * learns to ignore the channel. So: no broadening here, ever, and below the
 * relevance floor the answer is nothing rather than the best of a bad set.
 *
 * Boundaries this module holds (brief §3):
 *   - it imports nothing from `src/harness/`, and nothing there imports it;
 *   - it never writes to the record (`.agents/state.json` is `ob_state`'s);
 *   - it never writes to the store at all — this path reads.
 *
 * ## How a command becomes a query, and why not the obvious way
 *
 * The obvious derivation is "take the command's words and AND them", and it
 * is dead on arrival. FTS5 joins bare terms conjunctively, so the G-039
 * command `npx vitest run 2>&1 | tail -8; echo $?` would ask for an entry
 * containing *npx* AND *vitest* AND *run* AND *tail* AND *echo* — which
 * matches nothing in a real store, including the entry that describes that
 * exact mistake. The repair for that in `ob_recall` is to fall back to `OR`,
 * and that fallback is the one thing this path may not do.
 *
 * So the derivation is **narrow by construction rather than broad and then
 * filtered**: it recognises the risky ELEMENTS of a command and maps each to
 * the terms that name it, then ANDs those. Nothing else in the command
 * contributes. Two consequences worth stating plainly:
 *
 *   - **An unrecognised command derives no query at all**, and a trigger with
 *     no query injects nothing and says nothing. That is the fail-closed
 *     direction: the channel speaks only about acts it can name.
 *   - **The mapping is a fixed table in code, not a model call** (ruling 7).
 *     It is deterministic and local, so any fire is reproducible from the
 *     transcript alone.
 *
 * The table is small on purpose. This loop's observable is one act; a second
 * element is a later loop's evidence, not this one's speculation.
 */

import type Database from "better-sqlite3";

/** One entry the trigger's query found, in the order the trigger ranked it. */
export interface TriggerHit {
  id: number;
  key: string | null;
  content: string;
  /**
   * Relevance, HIGHER IS BETTER — the negation of FTS5's bm25, which is
   * negative and better the more negative it gets. Flipped here so that "the
   * floor is a minimum" reads the way a floor should, and so a policy file
   * never has to explain why a smaller number means a better match.
   */
  relevance: number;
}

export interface TriggerQueryInput {
  /** Opened by the caller; this path only reads. */
  db: Database.Database;
  /** The Bash command text, exactly as it appeared in the tool input. */
  command: string;
  /**
   * The relevance floor, as a minimum. A policy value, never a literal in the
   * query code (ruling 5) — the caller reads it from data and passes it here.
   */
  floor: number;
  /** Hits to consider before the floor is applied. */
  limit?: number;
}

/**
 * The recognised elements, and the terms each contributes.
 *
 * Read as: *when a command does THIS, the store is asked about THAT.* Each
 * entry is a shape this repo has an error about, not a shape that merely
 * exists.
 */
interface CommandElement {
  /** Why this element is risky — quoted into no output, kept for the reader. */
  readonly what: string;
  readonly test: (command: string) => boolean;
  readonly terms: readonly string[];
}

/**
 * A pipeline whose LAST stage trims output. `tail`, `head` and `grep` all
 * succeed on input they did not produce, so the pipeline's status stops being
 * the command's status.
 */
const TRIMMERS = ["tail", "head", "grep"] as const;

const lastPipelineStage = (command: string): string => {
  // Split on `|` but not `||`: a logical OR is not a pipeline stage.
  const stages = command.split(/\|\|/).pop()?.split("|") ?? [];
  return (stages.length > 1 ? stages[stages.length - 1] : "").trim();
};

/** Drop heredoc bodies: their text is data for the receiving program, not shell. */
const stripHeredocs = (command: string): string => {
  const lines = command.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const tags = [...lines[i].matchAll(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)].map((m) => m[2]);
    for (const tag of tags) {
      while (i + 1 < lines.length && lines[i + 1].trim() !== tag) i++;
      if (i + 1 < lines.length) i++;
    }
  }
  return out.join("\n");
};

interface Statement {
  readonly stages: readonly string[];
  /** The statement's text with single-quoted contents blanked: literal to this shell. */
  readonly masked: string;
}

const stageProgram = (stage: string): string => {
  const toks = stage.trim().split(/\s+/).filter(Boolean);
  while (toks.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[0])) toks.shift();
  if (toks.length && (toks[0] === "command" || toks[0] === "env" || toks[0] === "xargs")) toks.shift();
  const t = (toks[0] ?? "").replace(/\\/g, "/");
  return t.slice(t.lastIndexOf("/") + 1).toLowerCase().replace(/\.exe$/, "");
};

/**
 * T-288: the text before a single quote ends in an inner shell's `-c` (bash -c, bash -lc, wsl bash -c, docker exec app sh -c);
 * separate flags before `-c` (`bash -e -c`, `bash --norc -c`), a shell after `(` (`$(bash -c …)`), and ksh (T-290).
 */
const INNER_SHELL_C = /(^|[\s/\\(])(bash|sh|zsh|dash|ksh)(\.exe)?(\s+--?[A-Za-z][\w-]*)*?\s+-[A-Za-z]*c[A-Za-z]*\s*$/i;

/**
 * Split a script into top-level statements (on unquoted `;`, newline, `&&`,
 * `||`, `&`) and each statement into pipeline stages (on unquoted `|`). A bare
 * `( ... )` subshell is transparent; a `$( ... )` substitution is kept whole.
 * The single-quoted argument of `ssh`, or of an inner shell's `-c` (T-288), is
 * returned in `remote`: it is another shell's script, so it is a script in its
 * own right. Any other single-quoted string is inert.
 */
const splitStatements = (script: string): { stmts: Statement[]; remote: string[] } => {
  const stmts: Statement[] = [];
  const remote: string[] = [];
  let stages = [""];
  let masked = "";
  let sq = false, dq = false, esc = false, sqBuf = "";
  let sqStart = 0;
  const parens: Array<"sub" | "grp"> = [];
  const flush = () => {
    if (stages.some((s) => s.trim()) || masked.trim()) stmts.push({ stages: stages.map((s) => s.trim()), masked });
    stages = [""];
    masked = "";
  };
  const add = (raw: string, m = raw) => {
    stages[stages.length - 1] += raw;
    masked += m;
  };
  for (let i = 0; i < script.length; i++) {
    const c = script[i];
    const n = script[i + 1];
    if (esc) {
      esc = false;
      // T-290: a backslash-newline is removed before tokenising (sh), so `cmd | \⏎ tail` is one pipeline.
      if (c === "\n") { stages[stages.length - 1] = stages[stages.length - 1].slice(0, -1); masked = masked.slice(0, -1); continue; }
      add(c);
      continue;
    }
    if (sq) {
      if (c === "'") {
        sq = false;
        const stage = stages[stages.length - 1];
        if (stageProgram(stage) === "ssh" || INNER_SHELL_C.test(stage.slice(0, sqStart))) remote.push(sqBuf);
        add(c);
      } else { sqBuf += c; add(c, " "); }
      continue;
    }
    if (c === "\\") { add(c); esc = true; continue; }
    if (dq) { if (c === '"') dq = false; add(c); continue; }
    if (c === "'") { sq = true; sqBuf = ""; sqStart = stages[stages.length - 1].length; add(c); continue; }
    if (c === '"') { dq = true; add(c); continue; }
    const inSub = parens.includes("sub");
    if (c === "(") {
      parens.push(script[i - 1] === "$" || inSub ? "sub" : "grp");
      if (parens[parens.length - 1] === "sub") add(c);
      continue;
    }
    if (c === ")" && parens.length) {
      if (parens.pop() === "sub") add(c);
      continue;
    }
    if (inSub) { add(c); continue; }
    // T-288: a newline right after an unquoted `|` continues the pipeline (sh reads `cmd |\n tail` as one pipeline).
    if (c === "\n" && stages.length > 1 && stages[stages.length - 1].trim() === "") { add(" "); continue; }
    if (c === ";" || c === "\n") { flush(); continue; }
    if ((c === "&" && n === "&") || (c === "|" && n === "|")) { flush(); i++; continue; }
    if (c === "&" && n !== ">" && script[i - 1] !== ">" && script[i - 1] !== "<") { flush(); continue; }
    if (c === "|") { if (n === "&") i++; stages.push(""); masked += " "; continue; }
    add(c);
  }
  flush();
  return { stmts, remote };
};

const isTrimmerPipeline = (s: Statement): boolean =>
  s.stages.length > 1 && (TRIMMERS as readonly string[]).includes(stageProgram(s.stages[s.stages.length - 1]));

/** T-290: a group's close, alone or followed only by redirections (`} 2>&1`, `} > log`, `} &>/dev/null`). */
const GROUP_CLOSE = /^\s*\}(\s*[0-9]*(?:[<>]{1,2}|&>)&?\s*[^\s;|&<>]+)*\s*$/;

// T-288: a statement that is only `}`, or `}` with redirections (T-290), closes a `{ ...; }` group, whose status is its
// last command's: skip it, as a `( ... )` subshell is already transparent.
const scriptHasUnsafeRead = (all: readonly Statement[]): boolean => {
  const stmts = all.filter((s) => !GROUP_CLOSE.test(s.masked));
  return stmts.some(
    (s, i) =>
      i > 0 &&
      /\$\?|\$\{\?\}/.test(s.masked) &&
      isTrimmerPipeline(stmts[i - 1]) &&
      !stmts.slice(0, i).some((p) => /\bpipefail\b/.test(p.masked)),
  );
};

/**
 * True exactly when the command reads `$?` as the status of a pipeline whose
 * last stage is a trimmer: the statement the `$?` follows is such a pipeline,
 * and `set -o pipefail` is not in effect earlier in the same script. Heredoc
 * bodies and single-quoted strings are not shell to this test, except the
 * single-quoted argument of `ssh` or of `bash/sh -c` (T-288), which is tested
 * as that shell's script.
 *
 * The semantics are T-264's VIOLATING class (`docs/loops/t264/measure.mjs`),
 * ported rather than imported, narrowed to the ruling's trimmers and to `ssh`.
 */
export function isUnsafeStatusRead(command: string): boolean {
  const { stmts, remote } = splitStatements(stripHeredocs(command));
  return scriptHasUnsafeRead(stmts) || remote.some((r) => scriptHasUnsafeRead(splitStatements(r).stmts));
}

const ELEMENTS: readonly CommandElement[] = [
  {
    // Since T-286 this element adds no term of its own: deriveQuery asks only when the status element is present, and that element's terms already include "tail".
    what: "a pipeline whose last stage is a trimmer",
    test: (command) => {
      const last = lastPipelineStage(command);
      return TRIMMERS.some((t) => new RegExp(`(^|\\s)${t}(\\s|$)`).test(last));
    },
    terms: ["tail"],
  },
  {
    what: "a $? read of a pipeline whose last stage is a trimmer",
    // This element used to fire on `$?` or `PIPESTATUS` anywhere in the
    // command, on the reasoning that the entry explaining the difference was
    // worth surfacing for either. T-264 (docs/loops/t264/result.md) measured
    // that on 1,025 injected fires: only 6.4% landed on a real mistake, and 85%
    // on commands that already read PIPESTATUS (171) or captured the status
    // from a different statement (693). Where the mistake was real the next
    // similar command used PIPESTATUS 84% of the time (26/31, against 2/7
    // uninjected), so the injection works when warranted. T-265's ruling
    // (D-148): fire only on the mistake itself.
    test: isUnsafeStatusRead,
    // T-286: the read follows a trimmer pipeline by construction, so the query names the whole mistake, "tail" included.
    terms: ["tail", "exit", "code"],
  },
];

/**
 * Turn a command into an FTS MATCH expression, by code and by code alone.
 *
 * Returns the empty string when nothing in the command is recognised — which
 * the caller must treat as "ask nothing", not as "ask for everything".
 */
export function deriveQuery(command: string): string {
  // T-286: ask only about the mistake itself. A trimmer pipeline with no $? read of it is not the act (T-274
  // measured 14,023 such fires with no VIOLATING one), so a command without the status element derives no query
  // and takes T-159's not-asked path, never opening the store.
  if (!isUnsafeStatusRead(command)) return "";
  const terms: string[] = [];
  for (const element of ELEMENTS) {
    if (!element.test(command)) continue;
    for (const term of element.terms) if (!terms.includes(term)) terms.push(term);
  }
  // Conjunctive, always. The joiner is the whole difference between this path
  // and `ob_recall`'s fallback, so it is written once, here, and never
  // parameterised — a broadening mutant has to edit this line to exist.
  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}

/**
 * Query the store for a command, precision only, floor applied.
 *
 * Returns the empty array when nothing clears the floor — and the caller
 * injects nothing at all in that case rather than reporting that it found
 * nothing (ruling 3: silent means silent).
 */
export function queryStore(input: TriggerQueryInput): TriggerHit[] {
  const match = deriveQuery(input.command);
  if (!match) return [];

  const rows = input.db
    .prepare(
      `SELECT k.id, k.key, k.content, bm25(knowledge_fts) AS bm
         FROM knowledge_fts
         JOIN knowledge_index k ON k.id = knowledge_fts.rowid
        WHERE knowledge_fts MATCH ?
          AND k.archived_into IS NULL
        ORDER BY bm
        LIMIT ?`,
    )
    .all(match, input.limit ?? 5) as Array<{
    id: number;
    key: string | null;
    content: string;
    bm: number;
  }>;

  return rows
    .map((r) => ({ id: r.id, key: r.key, content: r.content, relevance: -r.bm }))
    .filter((h) => h.relevance >= input.floor);
}
