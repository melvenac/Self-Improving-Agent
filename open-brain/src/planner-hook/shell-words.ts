/**
 * T-194 r5: ONE tokeniser for the planner hook's Bash and PowerShell tools.
 *
 * r2-r4 each matched command text with a regex written for the spellings the last QA round found.
 * r5 states properties instead (P1 the real write location, P2 the exact merge grammar), and a
 * property needs words, not substrings: quotes resolved, separators found, redirections pulled out,
 * heredoc bodies skipped as data, and every word that a shell would EXPAND before use flagged,
 * because the hook cannot know what those become.
 */

export type Flavor = "bash" | "powershell";

export interface Word {
  /** The word with quotes removed and escapes resolved. */
  text: string;
  /** The word as written. */
  raw: string;
  /** A `$` or (bash) backtick was written outside single quotes: the shell will substitute something. */
  expands: boolean;
}

export interface Redir {
  op: string;
  /** null when the operator has no readable target; the shell itself rejects that, so nothing is written. */
  target: Word | null;
  /** `2>&1`-style descriptor duplication: writes to no file. */
  dup: boolean;
}

export interface Simple {
  words: Word[];
  redirs: Redir[];
}

export interface Parsed {
  simples: Simple[];
  /** How many command boundaries (`;` `&&` `||` `|` `&` newline `(` `)`) were crossed. */
  separators: number;
}

const FD_PREFIX_RE = /^(?:\d+|\*)$/;

interface PendingHeredoc {
  delim: string;
  strip: boolean;
}

export function parseCommand(source: string, flavor: Flavor): Parsed {
  const src = source.replace(/\r\n/g, "\n");
  const ps = flavor === "powershell";
  const simples: Simple[] = [];
  let cur: Simple = { words: [], redirs: [] };
  let separators = 0;
  let i = 0;
  let lastWordEnd = -1;
  const n = src.length;
  const pending: PendingHeredoc[] = [];

  const endSimple = (): void => {
    if (cur.words.length > 0 || cur.redirs.length > 0) simples.push(cur);
    cur = { words: [], redirs: [] };
    separators++;
  };

  /** Skip the heredoc bodies whose operators were on the line that just ended. They are data, not commands. */
  const skipHeredocBodies = (): void => {
    while (pending.length > 0) {
      const h = pending.shift() as PendingHeredoc;
      while (i < n) {
        let eol = src.indexOf("\n", i);
        if (eol < 0) eol = n;
        const line = src.slice(i, eol);
        i = Math.min(n, eol + 1);
        if ((h.strip ? line.replace(/^\t+/, "") : line) === h.delim) break;
      }
    }
  };

  /** Copy a `$( ... )` substitution into the word, matching parentheses and skipping quoted spans inside it. */
  const copySubstitution = (acc: { text: string; raw: string }): void => {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      acc.text += c;
      acc.raw += c;
      i++;
      if (c === "'" || c === '"') {
        const q = c;
        while (i < n && src[i] !== q) {
          if (q === '"' && src[i] === "\\" && i + 1 < n) {
            acc.text += src[i];
            acc.raw += src[i];
            i++;
          }
          acc.text += src[i];
          acc.raw += src[i];
          i++;
        }
        if (i < n) {
          acc.text += src[i];
          acc.raw += src[i];
          i++;
        }
        continue;
      }
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) return;
      }
    }
  };

  const readWord = (allowParen: boolean): Word | null => {
    const acc = { text: "", raw: "" };
    let expands = false;
    const start = i;
    while (i < n) {
      const c = src[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === ";" || c === "|" || c === "&" || c === ">") break;
      if (!allowParen && (c === "(" || c === ")")) break;
      if (c === "'") {
        // PowerShell here-string  @'  ...  '@
        if (ps && acc.raw === "@" && src[i + 1] === "\n") {
          const end = src.indexOf("\n'@", i + 2);
          const body = end < 0 ? src.slice(i + 2) : src.slice(i + 2, end);
          acc.text = body;
          acc.raw += src.slice(i, end < 0 ? n : end + 3);
          i = end < 0 ? n : end + 3;
          continue;
        }
        acc.raw += c;
        i++;
        while (i < n) {
          if (src[i] === "'") {
            if (ps && src[i + 1] === "'") {
              acc.text += "'";
              acc.raw += "''";
              i += 2;
              continue;
            }
            break;
          }
          acc.text += src[i];
          acc.raw += src[i];
          i++;
        }
        if (i < n) {
          acc.raw += "'";
          i++;
        }
        continue;
      }
      if (c === '"') {
        if (ps && acc.raw === "@" && src[i + 1] === "\n") {
          const end = src.indexOf('\n"@', i + 2);
          const body = end < 0 ? src.slice(i + 2) : src.slice(i + 2, end);
          acc.text = body;
          if (body.includes("$")) expands = true;
          acc.raw += src.slice(i, end < 0 ? n : end + 3);
          i = end < 0 ? n : end + 3;
          continue;
        }
        acc.raw += c;
        i++;
        while (i < n && src[i] !== '"') {
          const d = src[i];
          if (d === "$" && src[i + 1] === "(") {
            expands = true;
            copySubstitution(acc);
            continue;
          }
          if (d === "$" || (!ps && d === "`")) expands = true;
          if (ps && d === "`" && i + 1 < n) {
            acc.text += src[i + 1];
            acc.raw += d + src[i + 1];
            i += 2;
            continue;
          }
          if (!ps && d === "\\" && i + 1 < n && /["$`\\]/.test(src[i + 1])) {
            acc.text += src[i + 1];
            acc.raw += d + src[i + 1];
            i += 2;
            continue;
          }
          acc.text += d;
          acc.raw += d;
          i++;
        }
        if (i < n) {
          acc.raw += '"';
          i++;
        }
        continue;
      }
      if (!ps && c === "\\" && i + 1 < n && /[ "'$`\\]/.test(src[i + 1])) {
        acc.text += src[i + 1];
        acc.raw += c + src[i + 1];
        i += 2;
        continue;
      }
      if (ps && c === "`" && i + 1 < n) {
        acc.text += src[i + 1];
        acc.raw += c + src[i + 1];
        i += 2;
        continue;
      }
      if (c === "$" || (!ps && c === "`")) expands = true;
      acc.text += c;
      acc.raw += c;
      i++;
    }
    if (i === start) return null;
    return { text: acc.text, raw: acc.raw, expands };
  };

  const readRedirect = (op: string, fdPrefixed: boolean): void => {
    if (fdPrefixed) cur.words.pop();
    let dup = false;
    let target: Word | null = null;
    // `>&2`, `>&-`, `2>&1`: a descriptor, not a file. `>&file` writes the file.
    if (src[i] === "&") {
      i++;
      const w = readWord(true);
      if (w && /^(?:\d+|-)$/.test(w.text)) dup = true;
      else target = w;
    } else {
      while (i < n && (src[i] === " " || src[i] === "\t")) i++;
      target = readWord(true);
    }
    cur.redirs.push({ op, target, dup });
  };

  while (i < n) {
    const c = src[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === "\n" || c === "\r" || c === ";") {
      endSimple();
      i++;
      if (c === "\n" && pending.length > 0) skipHeredocBodies();
      continue;
    }
    if (c === "<" && src[i + 1] === "<" && src[i + 2] !== "<" && !ps) {
      i += 2;
      let strip = false;
      if (src[i] === "-") {
        strip = true;
        i++;
      }
      while (i < n && (src[i] === " " || src[i] === "\t")) i++;
      const d = readWord(false);
      if (d) pending.push({ delim: d.text, strip });
      continue;
    }
    if (c === "&") {
      if (src[i + 1] === ">") {
        i += 2;
        let op = "&>";
        if (src[i] === ">") {
          op = "&>>";
          i++;
        }
        readRedirect(op, false);
        continue;
      }
      if (src[i + 1] === "&") {
        endSimple();
        i += 2;
        continue;
      }
      // PowerShell: a lone `&` is the call operator (`& gh ...`), not a boundary.
      if (ps) {
        i++;
        continue;
      }
      endSimple();
      i++;
      continue;
    }
    if (c === "|") {
      endSimple();
      i += src[i + 1] === "|" ? 2 : 1;
      continue;
    }
    if (c === "(" || c === ")") {
      endSimple();
      i++;
      continue;
    }
    if (c === ">") {
      const prev = cur.words[cur.words.length - 1];
      const fdPrefixed = prev !== undefined && lastWordEnd === i && prev.raw === prev.text && FD_PREFIX_RE.test(prev.text);
      i++;
      let op = ">";
      if (src[i] === ">") {
        op = ">>";
        i++;
      } else if (src[i] === "|") {
        op = ">|";
        i++;
      }
      readRedirect(op, fdPrefixed);
      continue;
    }
    const w = readWord(false);
    if (w) {
      cur.words.push(w);
      lastWordEnd = i;
    } else {
      i++;
    }
  }
  if (cur.words.length > 0 || cur.redirs.length > 0) simples.push(cur);
  return { simples, separators };
}

/** File name of a word's text, lower-cased, directory and ONE trailing extension removed: `"C:\x\GH.EXE"` -> `gh`. */
export function commandBase(text: string): string {
  const unq = text.replace(/^["']+|["']+$/g, "").replace(/\\/g, "/");
  const last = unq.split("/").pop() ?? "";
  return last.replace(/\.[A-Za-z0-9]{1,4}$/, "").toLowerCase();
}

const WRAPPERS = new Set([
  "env", "command", "builtin", "sudo", "nice", "nohup", "time", "exec", "xargs", "stdbuf", "ionice", "setsid",
]);

/** Index of the word that names the program: after `NAME=value` prefixes and wrappers such as `env` or `command`. */
export function commandIndex(words: readonly Word[]): number {
  let k = 0;
  while (k < words.length) {
    const t = words[k].text;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) {
      k++;
      continue;
    }
    if (WRAPPERS.has(commandBase(t))) {
      k++;
      while (k < words.length && words[k].text.startsWith("-")) k++;
      continue;
    }
    break;
  }
  return k < words.length ? k : -1;
}

const SH_SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh", "ash", "cmd"]);
const PS_SHELLS = new Set(["powershell", "pwsh"]);
const MAX_DEPTH = 4;

/** Code strings that a word carries inside itself: `$( ... )` and backtick substitutions. */
function substitutionBodies(w: Word): string[] {
  const out: string[] = [];
  if (!w.expands) return out;
  const t = w.text;
  for (let k = 0; k < t.length; k++) {
    if (t[k] === "$" && t[k + 1] === "(") {
      let depth = 0;
      let j = k + 1;
      for (; j < t.length; j++) {
        if (t[j] === "(") depth++;
        else if (t[j] === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      out.push(t.slice(k + 2, j));
      k = j;
    } else if (t[k] === "`") {
      const e = t.indexOf("`", k + 1);
      out.push(t.slice(k + 1, e < 0 ? t.length : e));
      if (e < 0) break;
      k = e;
    }
  }
  return out;
}

/** The strings a command hands to another interpreter: `bash -c "..."`, `pwsh -Command "..."`, `eval "..."`. */
function nestedStrings(s: Simple): Array<{ code: string; flavor: Flavor }> {
  const idx = commandIndex(s.words);
  if (idx < 0) return [];
  const name = commandBase(s.words[idx].text);
  const args = s.words.slice(idx + 1);
  const out: Array<{ code: string; flavor: Flavor }> = [];
  if (SH_SHELLS.has(name)) {
    for (let k = 0; k < args.length; k++) {
      const t = args[k].text;
      if ((/^-[A-Za-z]*c$/.test(t) || t.toLowerCase() === "/c" || t.toLowerCase() === "/k") && args[k + 1]) {
        out.push({ code: args.slice(k + 1).map((a) => a.text).join(" "), flavor: "bash" });
        break;
      }
    }
  } else if (PS_SHELLS.has(name)) {
    for (let k = 0; k < args.length; k++) {
      const t = args[k].text.toLowerCase();
      if ((t === "-c" || t === "-command" || t === "-com" || t === "-comm") && args[k + 1]) {
        out.push({ code: args.slice(k + 1).map((a) => a.text).join(" "), flavor: "powershell" });
        break;
      }
    }
  } else if (name === "eval") {
    out.push({ code: args.map((a) => a.text).join(" "), flavor: "bash" });
  }
  return out;
}

/**
 * The command, and every piece of code it carries inside itself, each parsed on its own: substitutions
 * (`$( ... )`, backticks) and the strings given to `bash -c`, `pwsh -Command` and `eval`. The first entry
 * is the command line itself. A write or a merge hidden one level down is found at the same strength as
 * one written at the top.
 */
export function allParses(command: string, flavor: Flavor, depth = 0): Array<{ parsed: Parsed; flavor: Flavor }> {
  const top = parseCommand(command, flavor);
  const out = [{ parsed: top, flavor }];
  if (depth >= MAX_DEPTH) return out;
  for (const s of top.simples) {
    for (const w of [...s.words, ...s.redirs.flatMap((r) => (r.target ? [r.target] : []))]) {
      for (const body of substitutionBodies(w)) out.push(...allParses(body, flavor, depth + 1));
    }
    for (const nested of nestedStrings(s)) out.push(...allParses(nested.code, nested.flavor, depth + 1));
  }
  return out;
}
