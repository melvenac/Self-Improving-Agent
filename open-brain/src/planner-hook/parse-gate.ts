/**
 * T-194 r6, P0: the parse gate. It runs BEFORE every other planner-hook rule.
 *
 * r2-r5 each tried to understand more of the shell and allowed whatever they failed to understand. QA 237 found
 * a class in every property, because a shell has more constructs than any list. r6 inverts the default: a Bash or
 * PowerShell command is looked at by P1, P2, P2b and P3 only if EVERY word of it is in the small grammar below.
 * Anything else is refused with one named cause: `not statically parseable: <construct>`.
 *
 * This file is deliberately a second, strict scanner and not an extension of shell-words.ts. The gate must be
 * able to say "I do not understand this" without depending on the tokeniser's idea of a word.
 *
 * BASH accepts: plain words; single-quoted strings; double-quoted strings with no `$`, backtick or backslash; the
 * operators `;` `&&` `||` `|`; the redirects `>` `>>` `2>` `2>&1` `&>` `<`; leading `NAME=value` with a literal value;
 * the wrappers `env` (no flags), `command` (no flags) and `nohup` (no flags); a shell only as `sh -c '<string>'`, where
 * the string is gated in turn. Nothing else.
 * POWERSHELL accepts: a cmdlet or alias from the table below, with parameters from its table (full name or an
 * unambiguous prefix) and literal values; native commands with plain words; `;` `|` `>` `>>` `2>&1`; `& gh`.
 */
import { BASH_ALLOWED_COMMANDS, commandRestriction } from "./bash-commands.js";
import { pathShapeProblem } from "./paths.js";
import { commandBase, type Flavor } from "./shell-words.js";

export const NOT_PARSEABLE = "not statically parseable";

// ------------------------------------------------------------------------------------------------ word model

interface GWord {
  text: string;
  /** The word as written, quotes included: an assignment is decided on it, because the value may be quoted. */
  raw: string;
  /** Written with no quote character at all: only such a word can be a reserved word or an assignment. */
  bare: boolean;
}
interface GSimple {
  words: GWord[];
  /** Redirect operators seen, in order. */
  redirs: string[];
}

const refuse = (what: string): string => what;

// ------------------------------------------------------------------------------------------------ Bash scan

const RESERVED = new Set([
  "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac", "in", "select", "function",
  "time", "coproc", "!", "{", "}", "[[", "]]",
]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash", "ksh", "ash", "csh", "tcsh", "fish"]);
const REFUSED_COMMANDS = new Set([
  "sudo", "doas", "su", "runuser", "nice", "ionice", "timeout", "xargs", "exec", "builtin", "stdbuf", "setsid", "watch",
  "strace", "ltrace", "nsenter", "chroot", "script", "parallel", "flock", "taskset", "chrt", "unbuffer", "winpty", "start",
  "cmd", "eval", "source", ".", "powershell", "pwsh", "at", "batch", "crontab", "screen", "tmux",
]);
/**
 * P0d (r7): an environment assignment that changes which git or gh config is read, or what runs. `git -c alias.x=...` needs a grant (Open 5);
 * the same act through the environment is refused outright (QA 241 D-F).
 */
const ENV_GITGH_RE = /^(?:GIT_[A-Za-z0-9_]*|GH_REPO|GH_HOST|GH_CONFIG_DIR|GH_TOKEN|GH_ENTERPRISE_TOKEN|GITHUB_TOKEN)=/i;
const ENV_RUNS_RE = /^(?:PATH|HOME|USERPROFILE|XDG_CONFIG_HOME|APPDATA|NODE_OPTIONS|NODE_PATH|BASH_ENV|ENV|LD_PRELOAD|LD_LIBRARY_PATH|PROMPT_COMMAND|PS4|IFS|SHELLOPTS|BASHOPTS)=/i;

function envAssignmentProblem(raw: string): string | null {
  if (ENV_GITGH_RE.test(raw)) return refuse(`git/gh config through the environment (${raw.split("=")[0]})`);
  if (ENV_RUNS_RE.test(raw)) return refuse(`an environment variable that changes what runs or which config is read (${raw.split("=")[0]})`);
  return null;
}

/** P0a: the first character outside printable ASCII (plus tab, newline and carriage return, which have their own rules). */
function nonAscii(text: string, from = 0): string | null {
  for (let k = from; k < text.length; ) {
    const cp = text.codePointAt(k) as number;
    if (cp > 0x7e || (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d)) {
      return refuse(`non-ASCII character U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
    }
    k += cp > 0xffff ? 2 : 1;
  }
  return null;
}

function gateBash(command: string, depth: number): string | null {
  const simples: GSimple[] = [];
  let cur: GSimple = { words: [], redirs: [] };
  const n = command.length;
  let i = 0;

  const endSimple = (): void => {
    simples.push(cur);
    cur = { words: [], redirs: [] };
  };

  /** Read one word starting at i. Returns the refusal, or the word. */
  const readWord = (): GWord | string => {
    let text = "";
    let bare = true;
    const start = i;
    while (i < n) {
      const c = command[i];
      if (c === " " || c === "\t" || c === ";" || c === "&" || c === "|" || c === ">" || c === "<" || c === "\n" || c === "\r") break;
      {
        const na = nonAscii(command.slice(i, i + 2));
        if (na && (c.charCodeAt(0) > 0x7e || c.charCodeAt(0) < 0x20)) return na;
      }
      if (c === "'") {
        bare = false;
        const e = command.indexOf("'", i + 1);
        if (e < 0) return refuse("unclosed single quote");
        text += command.slice(i + 1, e);
        i = e + 1;
        continue;
      }
      if (c === '"') {
        bare = false;
        i++;
        while (i < n && command[i] !== '"') {
          const d = command[i];
          if (d === "$") return refuse("$ inside double quotes (expansion)");
          if (d === "`") return refuse("backtick inside double quotes (command substitution)");
          if (d === "\\") return refuse("backslash");
          text += d;
          i++;
        }
        if (i >= n) return refuse("unclosed double quote");
        i++;
        continue;
      }
      if (c === "\\") return refuse("backslash");
      if (c === "$") return refuse("$ (variable, substitution or $'...' string)");
      if (c === "`") return refuse("backtick (command substitution)");
      if (c === "(" || c === ")") return refuse("parenthesis (subshell, grouping or process substitution)");
      if (c === "{" || c === "}") return refuse("brace ({ } group or brace expansion)");
      if (c === "*" || c === "?" || c === "[" || c === "]") return refuse("glob character (* ? [ ])");
      if (c === "~" && i === start) return refuse("tilde (home-directory expansion)");
      if (c === "#" && i === start) return refuse("comment (# at the start of a word)");
      text += c;
      i++;
    }
    return { text, bare, raw: command.slice(start, i) };
  };

  while (i < n) {
    const c = command[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") return refuse("newline outside quotes (use ; between commands)");
    if (c === ";") {
      if (command[i + 1] === ";") return refuse(";; (case terminator)");
      i++;
      endSimple();
      continue;
    }
    if (c === "&") {
      if (command[i + 1] === "&") {
        i += 2;
        endSimple();
        continue;
      }
      if (command[i + 1] === ">") {
        if (command[i + 2] === ">") return refuse("&>> redirect");
        cur.redirs.push("&>");
        i += 2;
        const t = readTarget();
        if (typeof t === "string") return t;
        continue;
      }
      return refuse("background & (use && or ;)");
    }
    if (c === "|") {
      if (command[i + 1] === "|") {
        i += 2;
        endSimple();
        continue;
      }
      if (command[i + 1] === "&") return refuse("|& pipe");
      i++;
      endSimple();
      continue;
    }
    if (c === "<") {
      if (command[i + 1] === "<") return refuse("heredoc or here-string");
      if (command[i + 1] === "(" || command[i + 1] === "&" || command[i + 1] === ">") return refuse("process substitution or fd redirect");
      cur.redirs.push("<");
      i++;
      const t = readTarget();
      if (typeof t === "string") return t;
      continue;
    }
    if (c === ">") {
      if (command[i + 1] === "|") return refuse(">| redirect");
      if (command[i + 1] === "(") return refuse("process substitution");
      if (command[i + 1] === "&") return refuse(">& redirect");
      if (command[i + 1] === ">") {
        cur.redirs.push(">>");
        i += 2;
      } else {
        cur.redirs.push(">");
        i++;
      }
      const t = readTarget();
      if (typeof t === "string") return t;
      continue;
    }
    // a word; a lone `2` directly before `>` is the stderr redirect
    const w = readWord();
    if (typeof w === "string") return w;
    if (/^\d+$/.test(w.text) && w.bare && command[i] === ">") {
      if (w.text !== "2") return refuse("file-descriptor redirect other than 2>");
      if (command[i + 1] === "&") {
        if (command[i + 2] !== "1" || /[^\s;&|]/.test(command[i + 3] ?? " ")) return refuse("fd redirect other than 2>&1");
        cur.redirs.push("2>&1");
        i += 3;
        continue;
      }
      if (command[i + 1] === ">" || command[i + 1] === "|" || command[i + 1] === "(") return refuse("2>> or 2>| redirect");
      cur.redirs.push("2>");
      i++;
      const t = readTarget();
      if (typeof t === "string") return t;
      continue;
    }
    cur.words.push(w);
  }
  simples.push(cur);

  /** After a redirect operator: skip spaces, then one word. */
  function readTarget(): string | null {
    while (i < n && (command[i] === " " || command[i] === "\t")) i++;
    if (i >= n || /[;&|<>\n]/.test(command[i])) return refuse("redirect without a target");
    const w = readWord();
    if (typeof w === "string") return w;
    if (w.text === "") return refuse("redirect to an empty name");
    return null;
  }

  return checkBashSimples(simples, depth);
}

function baseName(text: string): string {
  return commandBase(text);
}

function checkBashSimples(simples: GSimple[], depth: number): string | null {
  for (const s of simples) {
    if (s.words.length === 0) {
      if (s.redirs.length > 0) continue; // `> file` alone
      continue;
    }
    // leading NAME=value
    let k = 0;
    while (k < s.words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(s.words[k].raw)) {
      const env = envAssignmentProblem(s.words[k].raw);
      if (env) return env;
      k++;
    }
    if (k >= s.words.length) continue; // only assignments
    // wrappers: env / command / nohup, with no options
    let guard = 0;
    while (k < s.words.length && guard++ < 8) {
      const w = s.words[k];
      const b = baseName(w.text);
      if (b === "env" || b === "command" || b === "nohup") {
        const next = s.words[k + 1];
        if (next && next.text.startsWith("-")) return refuse(`wrapper with options (${b} ${next.text})`);
        k++;
        while (k < s.words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(s.words[k].raw)) {
          const env = envAssignmentProblem(s.words[k].raw);
          if (env) return env;
          k++;
        }
        continue;
      }
      break;
    }
    if (k >= s.words.length) continue;
    const cmd = s.words[k];
    const name = baseName(cmd.text);
    if (cmd.bare && RESERVED.has(cmd.text)) return refuse(`reserved word (${cmd.text})`);
    if (REFUSED_COMMANDS.has(name)) return refuse(`wrapper, shell or code-running command (${name})`);
    const args = s.words.slice(k + 1);
    if (SHELLS.has(name)) {
      const ok = args.length === 2 && args[0].text === "-c";
      if (!ok) return refuse(`${name} is only parseable as: ${name} -c '<string>'`);
      if (depth >= 3) return refuse("shell strings nested deeper than 3");
      const inner = gateBash(args[1].text, depth + 1);
      if (inner) return refuse(`inside ${name} -c: ${inner}`);
      continue;
    }
    // P0c (r7): the command word must be on the allow-list, and the few commands with restrictions are held to them.
    if (/[\\/]/.test(cmd.text)) return refuse(`command not allowed: ${cmd.text} (a path, not a bare command name)`);
    if (!Object.prototype.hasOwnProperty.call(BASH_ALLOWED_COMMANDS, name)) return refuse(`command not allowed: ${name}`);
    const restricted = commandRestriction(name, args.map((a) => a.text));
    if (restricted) return refuse(restricted);
    if (name === "sed") {
      const r = gateSed(args);
      if (r) return r;
    }
    if (name === "git") {
      const r = gateGit(args.map((a) => a.text));
      if (r) return r;
    }
    if (name === "gh") {
      const r = gateGh(args.map((a) => a.text));
      if (r) return r;
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ sed

function gateSed(args: GWord[]): string | null {
  const scripts: string[] = [];
  const pos: string[] = [];
  let hasExpr = false;
  for (let k = 0; k < args.length; k++) {
    const t = args[k].text;
    if (t === "--file" || t.startsWith("--file=")) return refuse("sed -f (a script read from a file)");
    if (t === "-e" || t === "--expression") {
      hasExpr = true;
      if (args[k + 1]) scripts.push(args[k + 1].text);
      k++;
      continue;
    }
    if (t.startsWith("--expression=")) {
      hasExpr = true;
      scripts.push(t.slice("--expression=".length));
      continue;
    }
    if (/^-[A-Za-z]*e./.test(t) && !t.startsWith("--")) {
      hasExpr = true;
      scripts.push(t.replace(/^-[A-Za-z]*e/, ""));
      continue;
    }
    if (/^-[A-Za-z]*f/.test(t) && !t.startsWith("--")) return refuse("sed -f (a script read from a file)");
    if (t.startsWith("-") && t.length > 1) continue;
    pos.push(t);
  }
  if (!hasExpr && pos.length > 0) scripts.push(pos[0]);
  for (const s of scripts) {
    const r = sedScriptRefusal(s);
    if (r) return r;
  }
  return null;
}

/** Looks for sed's `w`, `W` and `e` commands and the `w`/`e` flags of `s`. Anything it cannot follow is refused. */
export function sedScriptRefusal(s: string): string | null {
  let i = 0;
  const n = s.length;
  const skipSp = (): void => {
    while (i < n && (s[i] === " " || s[i] === "\t")) i++;
  };
  const readDelimited = (d: string): boolean => {
    while (i < n && s[i] !== d) {
      if (s[i] === "\\") i++;
      i++;
    }
    if (i >= n) return false;
    i++;
    return true;
  };
  while (i < n) {
    while (i < n && /[\s;]/.test(s[i])) i++;
    if (i >= n) break;
    // addresses
    for (;;) {
      skipSp();
      if (/\d/.test(s[i] ?? "")) {
        while (i < n && /\d/.test(s[i])) i++;
      } else if (s[i] === "$") {
        i++;
      } else if (s[i] === "/" || s[i] === "\\") {
        let d = "/";
        if (s[i] === "\\") {
          i++;
          d = s[i] ?? "/";
        }
        i++;
        if (!readDelimited(d)) return refuse("sed script not parseable (unterminated address)");
        while (i < n && /[IM]/.test(s[i])) i++;
      } else break;
      skipSp();
      if (s[i] === "~") {
        i++;
        while (i < n && /\d/.test(s[i])) i++;
      }
      skipSp();
      if (s[i] === ",") {
        i++;
        continue;
      }
      break;
    }
    skipSp();
    while (s[i] === "!") {
      i++;
      skipSp();
    }
    if (i >= n) return refuse("sed script not parseable (address without a command)");
    const c = s[i++];
    switch (c) {
      case "{":
      case "}":
      case "p": case "P": case "d": case "D": case "n": case "N": case "g": case "G": case "h": case "H": case "x":
      case "=": case "z": case "F":
        break;
      case "s": {
        const d = s[i++];
        if (!d || d === "\\" || d === "\n") return refuse("sed script not parseable (s delimiter)");
        if (!readDelimited(d) || !readDelimited(d)) return refuse("sed script not parseable (unterminated s command)");
        while (i < n && !/[;\n}]/.test(s[i])) {
          if (s[i] === "w" || s[i] === "W") return refuse("sed w (writes a file)");
          if (s[i] === "e") return refuse("sed e (runs a command)");
          i++;
        }
        break;
      }
      case "y": {
        const d = s[i++];
        if (!d || d === "\\" || d === "\n") return refuse("sed script not parseable (y delimiter)");
        if (!readDelimited(d) || !readDelimited(d)) return refuse("sed script not parseable (unterminated y command)");
        break;
      }
      case "w": case "W":
        return refuse("sed w (writes a file)");
      case "e":
        return refuse("sed e (runs a command)");
      case "r": case "R": case "a": case "i": case "c":
        while (i < n && !(s[i] === "\n" && s[i - 1] !== "\\")) i++;
        break;
      case ":": case "b": case "t": case "T":
        while (i < n && !/[;\n]/.test(s[i])) i++;
        break;
      case "l": case "L": case "q": case "Q":
        while (i < n && /\d/.test(s[i])) i++;
        break;
      default:
        return refuse(`sed script not parseable (command ${c})`);
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ git and gh

const GIT_COMMANDS = new Set(`add am annotate apply archive bisect blame branch bugreport bundle cat-file check-attr check-ignore
check-mailmap check-ref-format checkout checkout-index cherry cherry-pick citool clean clone column commit commit-graph
commit-tree config count-objects credential describe diagnose diff diff-files diff-index diff-tree difftool fast-export
fast-import fetch fetch-pack filter-branch fmt-merge-msg for-each-ref for-each-repo format-patch fsck gc get-tar-commit-id
grep gui hash-object help hook index-pack init interpret-trailers log ls-files ls-remote ls-tree mailinfo mailsplit
maintenance merge merge-base merge-file merge-index merge-tree mergetool mktag mktree multi-pack-index mv name-rev notes
pack-objects pack-redundant pack-refs patch-id prune prune-packed pull push range-diff read-tree rebase reflog remote
repack replace request-pull rerere reset restore rev-list rev-parse revert rm scalar send-email shortlog show show-branch
show-index show-ref sparse-checkout stash status stripspace submodule switch symbolic-ref tag unpack-file unpack-objects
update-index update-ref update-server-info var verify-commit verify-pack verify-tag version whatchanged worktree write-tree`.split(/\s+/));
const GIT_GLOBAL_WITH_VALUE_G = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env", "--exec-path"]);

/** The git subcommand of an argument list (global options skipped), or null when there is none. */
export function gitSubcommand(args: readonly string[]): { index: number; name: string } | null {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) i += GIT_GLOBAL_WITH_VALUE_G.has(args[i]) ? 2 : 1;
  return i < args.length ? { index: i, name: args[i] } : null;
}

function gateGit(args: readonly string[]): string | null {
  const sub = gitSubcommand(args);
  if (!sub) return null;
  if (!GIT_COMMANDS.has(sub.name)) return refuse(`git alias or external subcommand (${sub.name})`);
  return null;
}

const GH_COMMANDS = new Set(`pr issue repo api auth browse cache codespace completion config gist gpg-key label org project release
ruleset run search secret ssh-key status variable workflow version help attestation copilot`.split(/\s+/));
const GH_GLOBAL_WITH_VALUE = new Set(["-R", "--repo", "--hostname"]);

/** gh's positional words, after its global flags. */
export function ghPositionals(args: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (t.startsWith("-") && t.length > 1) {
      if (GH_GLOBAL_WITH_VALUE.has(t)) i++;
      continue;
    }
    out.push(t);
  }
  return out;
}

function gateGh(args: readonly string[]): string | null {
  const pos = ghPositionals(args);
  if (pos.length === 0) return null;
  if (pos[0] === "alias" || pos[0] === "extension" || pos[0] === "ext") return refuse(`gh ${pos[0]} (defines or runs commands the hook cannot see)`);
  if (!GH_COMMANDS.has(pos[0])) return refuse(`gh alias or extension command (${pos[0]})`);
  return null;
}

// ------------------------------------------------------------------------------------------------ PowerShell

export interface PsParam {
  /** True when the parameter takes a value. */
  value: boolean;
  /** What the hook does with that value. */
  role: "path" | "dest" | "name" | "other";
}
export interface PsCmdlet {
  kind: "write" | "copy" | "move" | "remove" | "new" | "read" | "other";
  params: Record<string, PsParam>;
}

const P = (value: boolean, role: PsParam["role"] = "other"): PsParam => ({ value, role });
export const PS_CMDLETS: Record<string, PsCmdlet> = {
  "set-content": { kind: "write", params: { path: P(true, "path"), literalpath: P(true, "path"), value: P(true), encoding: P(true), nonewline: P(false), force: P(false), stream: P(true) } },
  "add-content": { kind: "write", params: { path: P(true, "path"), literalpath: P(true, "path"), value: P(true), encoding: P(true), nonewline: P(false), force: P(false), stream: P(true) } },
  "clear-content": { kind: "write", params: { path: P(true, "path"), literalpath: P(true, "path"), force: P(false) } },
  "out-file": { kind: "write", params: { filepath: P(true, "path"), path: P(true, "path"), literalpath: P(true, "path"), encoding: P(true), append: P(false), force: P(false), noclobber: P(false), width: P(true), inputobject: P(true) } },
  "tee-object": { kind: "write", params: { filepath: P(true, "path"), literalpath: P(true, "path"), append: P(false), inputobject: P(true) } },
  "new-item": { kind: "new", params: { path: P(true, "path"), name: P(true, "name"), itemtype: P(true), type: P(true), value: P(true), force: P(false) } },
  "copy-item": { kind: "copy", params: { path: P(true, "path"), literalpath: P(true, "path"), destination: P(true, "dest"), recurse: P(false), force: P(false) } },
  "move-item": { kind: "move", params: { path: P(true, "path"), literalpath: P(true, "path"), destination: P(true, "dest"), force: P(false) } },
  "rename-item": { kind: "move", params: { path: P(true, "path"), literalpath: P(true, "path"), newname: P(true), force: P(false) } },
  "remove-item": { kind: "remove", params: { path: P(true, "path"), literalpath: P(true, "path"), recurse: P(false), force: P(false) } },
  "get-content": { kind: "read", params: { path: P(true, "other"), literalpath: P(true, "other"), totalcount: P(true), tail: P(true), raw: P(false), encoding: P(true) } },
  "get-childitem": { kind: "read", params: { path: P(true, "other"), literalpath: P(true, "other"), filter: P(true), recurse: P(false), name: P(false), file: P(false), directory: P(false), force: P(false), depth: P(true) } },
  "get-item": { kind: "read", params: { path: P(true, "other"), literalpath: P(true, "other"), force: P(false) } },
  "test-path": { kind: "read", params: { path: P(true, "other"), literalpath: P(true, "other"), pathtype: P(true) } },
  "select-string": { kind: "read", params: { pattern: P(true), path: P(true, "other"), simplematch: P(false), casesensitive: P(false), context: P(true) } },
  "write-output": { kind: "other", params: { inputobject: P(true) } },
  "write-host": { kind: "other", params: { object: P(true), nonewline: P(false) } },
  "out-null": { kind: "other", params: {} },
  "get-date": { kind: "other", params: { format: P(true), uformat: P(true) } },
  "select-object": { kind: "other", params: { first: P(true), last: P(true), skip: P(true), property: P(true), expandproperty: P(true), unique: P(false) } },
  "measure-object": { kind: "other", params: { line: P(false), word: P(false), character: P(false) } },
  "sort-object": { kind: "other", params: { property: P(true), descending: P(false), unique: P(false) } },
  "get-location": { kind: "other", params: {} },
  "set-location": { kind: "other", params: { path: P(true, "other"), literalpath: P(true, "other") } },
};
export const PS_ALIASES: Record<string, string> = {
  sc: "set-content", ac: "add-content", clc: "clear-content", tee: "tee-object", ni: "new-item",
  cpi: "copy-item", copy: "copy-item", cp: "copy-item", mi: "move-item", move: "move-item", mv: "move-item",
  rni: "rename-item", ren: "rename-item", ri: "remove-item", rm: "remove-item", del: "remove-item", erase: "remove-item",
  rd: "remove-item", rmdir: "remove-item", gc: "get-content", cat: "get-content", type: "get-content",
  gci: "get-childitem", ls: "get-childitem", dir: "get-childitem", gi: "get-item", sls: "select-string",
  echo: "write-output", write: "write-output", select: "select-object", measure: "measure-object",
  sort: "sort-object", gl: "get-location", pwd: "get-location", sl: "set-location", cd: "set-location", chdir: "set-location",
};
const PS_REFUSED_COMMANDS = new Set([
  "invoke-expression", "iex", "invoke-command", "icm", "start-process", "saps", "start", "start-job", "invoke-item", "ii",
  "invoke-webrequest", "iwr", "invoke-restmethod", "irm", "curl", "wget", "powershell", "pwsh", "cmd", "bash", "sh", "wsl",
  "set-alias", "sal", "new-alias", "nal", "import-module", "ipmo", "add-type", "new-object", "invoke-wmimethod", "iwmi",
  "foreach-object", "where-object", "invoke-method",
]);

/** The canonical cmdlet for a command word, or null. */
export function psCanonical(word: string): string | null {
  const w = word.toLowerCase();
  if (PS_CMDLETS[w]) return w;
  return PS_ALIASES[w] ?? null;
}

/**
 * Resolves a parameter written `-Name` against a cmdlet's table: exact or an unambiguous prefix.
 * Returns the canonical parameter name, "unknown" or "ambiguous".
 */
export function resolvePsParam(cmdlet: string, text: string): string {
  const table = PS_CMDLETS[cmdlet]?.params ?? {};
  const name = text.replace(/^-/, "").replace(/:.*$/, "").toLowerCase();
  if (name === "") return "unknown";
  if (table[name]) return name;
  const hits = Object.keys(table).filter((p) => p.startsWith(name));
  if (hits.length === 1) return hits[0];
  return hits.length === 0 ? "unknown" : "ambiguous";
}

interface PsTok {
  text: string;
  quoted: boolean;
  /** The token does not START with a quote: `-Path:"x"` is a parameter although part of it is quoted. */
  bare: boolean;
}

/** The one shape check for a PowerShell word that names a path: used for every token AND every redirect target (r7, D-A). */
export function psPathShapeProblem(text: string): string | null {
  const p = pathShapeProblem(text);
  return p ? refuse(p) : null;
}

function gatePowerShell(command: string, depth: number): string | null {
  void depth;
  // P0a (r7): PowerShell 5.1 treats NBSP, U+2000..U+200A and U+3000 as whitespace, en/em/horizontal dashes as `-`, and curly
  // quotes as quotes. The gate cannot list them all, so it refuses every character outside printable ASCII.
  const ascii = nonAscii(command);
  if (ascii) return ascii;
  const n = command.length;
  let i = 0;
  const stages: PsTok[][] = [];
  let cur: PsTok[] = [];
  let call = false; // a `&` call operator is pending for the next word

  const readTok = (): PsTok | string => {
    let text = "";
    let quoted = false;
    const start = i;
    while (i < n) {
      const c = command[i];
      if (c === " " || c === "\t" || c === ";" || c === "|" || c === ">" || c === "\n" || c === "\r") break;
      if (c === "'") {
        quoted = true;
        i++;
        for (;;) {
          if (i >= n) return refuse("unclosed single quote");
          if (command[i] === "'") {
            if (command[i + 1] === "'") {
              text += "'";
              i += 2;
              continue;
            }
            i++;
            break;
          }
          text += command[i++];
        }
        continue;
      }
      if (c === '"') {
        quoted = true;
        i++;
        for (;;) {
          if (i >= n) return refuse("unclosed double quote");
          const d = command[i];
          if (d === '"') {
            if (command[i + 1] === '"') {
              text += '"';
              i += 2;
              continue;
            }
            i++;
            break;
          }
          if (d === "$") return refuse("$ inside a PowerShell double-quoted string (expansion)");
          if (d === "`") return refuse("backtick inside a PowerShell double-quoted string (escape character)");
          text += d;
          i++;
        }
        continue;
      }
      if (c === "$") {
        // `$null` alone is the null device (`> $null`); every other $ is a variable or expression
        const rest = command.slice(i, i + 6);
        if (/^\$null(?![A-Za-z0-9_:.])/i.test(rest)) {
          text += command.slice(i, i + 5);
          i += 5;
          continue;
        }
        return refuse("$ (variable or expression)");
      }
      if (c === "`") return refuse("backtick (PowerShell escape character)");
      if (c === "(" || c === ")") return refuse("parenthesis (expression or sub-expression)");
      if (c === "{" || c === "}") return refuse("script block or brace");
      if (c === "@") return refuse("@ (splat, array or hash literal)");
      if (c === "[" || c === "]") return refuse("[ ] (type literal, index or wildcard)");
      if (c === "*" || c === "?") return refuse("wildcard character (* ?)");
      if (c === "&") return refuse("& inside a word");
      if (c === "<") return refuse("< (redirect, block comment or here-string)");
      if (c === "#" && i === start) return refuse("comment (# at the start of a PowerShell word)");
      if (c === "~" && i === start) return refuse("tilde (PowerShell home-directory expansion)");
      text += c;
      i++;
    }
    return { text, quoted, bare: command[start] !== "'" && command[start] !== '"' };
  };

  const flushStage = (): void => {
    stages.push(cur);
    cur = [];
    call = false;
  };

  while (i < n) {
    const c = command[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") return refuse("newline outside quotes (use ; between commands)");
    if (c === ";") {
      i++;
      flushStage();
      continue;
    }
    if (c === "|") {
      if (command[i + 1] === "|") return refuse("|| (PowerShell 7 pipeline chain)");
      i++;
      flushStage();
      continue;
    }
    if (c === "&") {
      if (command[i + 1] === "&") return refuse("&& (PowerShell 7 pipeline chain)");
      if (cur.length > 0) return refuse("& (call operator not at the start of a command)");
      call = true;
      i++;
      continue;
    }
    if (c === ">") {
      i++;
      if (command[i] === ">") i++;
      while (i < n && (command[i] === " " || command[i] === "\t")) i++;
      if (i >= n || /[;|>\n]/.test(command[i])) return refuse("redirect without a target");
      const t = readTok();
      if (typeof t === "string") return t;
      // D-A (QA 241): a redirect target gets the SAME shape check as any other word that names a path
      const targetShape = psPathShapeProblem(t.text);
      if (targetShape) return targetShape;
      cur.push({ text: "\u0000>", quoted: false, bare: true }, t);
      continue;
    }
    const t = readTok();
    if (typeof t === "string") return t;
    if (t.text === "" && !t.quoted) {
      i++;
      continue;
    }
    // `2>` and `2>&1`: a lone 2 directly before >
    if (!t.quoted && t.text === "2" && command[i] === ">") {
      if (command[i + 1] === "&" && command[i + 2] === "1") {
        i += 3;
        continue;
      }
      i++;
      if (command[i] === ">") i++;
      while (i < n && (command[i] === " " || command[i] === "\t")) i++;
      const tgt = readTok();
      if (typeof tgt === "string") return tgt;
      const tgtShape = psPathShapeProblem(tgt.text);
      if (tgtShape) return tgtShape;
      cur.push({ text: "\u0000>", quoted: false, bare: true }, tgt);
      continue;
    }
    if (t.text === "." && !t.quoted && cur.length === 0) return refuse("dot-sourcing (. file)");
    const shape = psPathShapeProblem(t.text);
    if (shape) return shape;
    if (call && cur.length === 0) {
      if (commandBase(t.text) !== "gh") return refuse("& call of anything but gh");
    }
    cur.push(t);
  }
  flushStage();

  for (const stage of stages) {
    const words = stage.filter((w, k) => w.text !== "\u0000>" && !(k > 0 && stage[k - 1].text === "\u0000>"));
    if (words.length === 0) continue;
    const head = words[0];
    const headLower = head.text.toLowerCase();
    const baseLower = commandBase(head.text);
    if (PS_REFUSED_COMMANDS.has(headLower) || PS_REFUSED_COMMANDS.has(baseLower)) return refuse(`code-running or unknown command (${head.text})`);
    if (/^[\w.]+\\[A-Za-z]+-[A-Za-z]+$/.test(head.text)) return refuse(`module-qualified cmdlet (${head.text})`);
    const canon = psCanonical(headLower);
    if (canon) {
      const args = words.slice(1);
      for (let k = 0; k < args.length; k++) {
        const a = args[k];
        if (!a.bare || !a.text.startsWith("-") || a.text.length < 2 || /^-\d/.test(a.text)) continue;
        const colon = a.text.indexOf(":");
        const p = resolvePsParam(canon, a.text);
        if (p === "unknown") return refuse(`unknown parameter ${colon > 0 ? a.text.slice(0, colon) : a.text} for ${canon}`);
        if (p === "ambiguous") return refuse(`ambiguous parameter ${a.text} for ${canon}`);
        const def = PS_CMDLETS[canon].params[p];
        if (def.value && colon < 0) {
          if (!args[k + 1]) return refuse(`parameter ${a.text} has no value`);
          const v = args[k + 1];
          if (!v.quoted && v.text.startsWith("-") && !/^-\d/.test(v.text)) return refuse(`parameter ${a.text} has no literal value`);
          k++;
        }
      }
      continue;
    }
    if (/^[A-Za-z]+-[A-Za-z]+$/.test(head.text)) return refuse(`unknown cmdlet (${head.text})`);
    // PowerShell hands a native command (git, gh, node...) an unquoted `a,b` as TWO arguments; the hook would read one.
    const comma = words.slice(1).find((w) => !w.quoted && w.text.includes(","));
    if (comma) return refuse(`comma list as an argument to a native command (${head.text}); PowerShell passes it as an array`);
    if (baseLower === "git") {
      const r = gateGit(words.slice(1).map((w) => w.text));
      if (r) return r;
    }
    if (baseLower === "gh") {
      const r = gateGh(words.slice(1).map((w) => w.text));
      if (r) return r;
    }
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ entry

/** null when the command is inside the accepted grammar; otherwise the construct that is not. */
export function parseGate(command: string, flavor: Flavor): string | null {
  return flavor === "powershell" ? gatePowerShell(command, 0) : gateBash(command, 0);
}
