import { classifyTarget, isNullSink } from "./paths.js";
import {
  allParses,
  commandBase,
  commandIndex,
  type Flavor,
  type Parsed,
  type Simple,
  type Word,
} from "./shell-words.js";

/**
 * What the hook can and cannot see, said once (T-194 r5). The refusal text carries it, so nothing out
 * of reach is described only in a handoff.
 */
export const BASH_WRITE_LIMIT =
  "Static write detection only (Bash and PowerShell): redirects, sed -i, tee, cp, mv and install targets, and the " +
  "PowerShell cmdlets Set-Content, Add-Content, Out-File, New-Item, Copy-Item, Move-Item, Remove-Item. A target " +
  "that is not a literal path, or a cd in the same command line, is refused. OUT OF REACH: a path a script builds " +
  "at runtime (node x.js writing src/), other write commands (rm, touch, dd, curl -o, git checkout), symlinks and " +
  "junctions, and a merge through the GitHub API (curl, gh api). It stops mistakes by the planner's tools; it is " +
  "not a sandbox.";

export interface WriteTarget {
  word: Word;
  via: string;
}

export interface Extracted {
  targets: WriteTarget[];
  /** A `cd`, `pushd` or `Set-Location` was found anywhere in the command line. */
  cd: boolean;
  /** PowerShell code the hook cannot read statically (Invoke-Expression, a script block that writes). */
  dynamic: string | null;
}

const CD_NAMES = new Set(["cd", "chdir", "pushd", "popd", "set-location", "sl", "push-location", "pop-location"]);

const isOption = (w: Word): boolean => w.text.startsWith("-") && w.text.length > 1;

/** Positional (non-option) words after the command name; `--` makes everything after it positional. */
function positionals(args: readonly Word[]): Word[] {
  const out: Word[] = [];
  let ended = false;
  for (const w of args) {
    if (!ended && w.text === "--") {
      ended = true;
      continue;
    }
    if (!ended && isOption(w)) continue;
    out.push(w);
  }
  return out;
}

function bashCommandTargets(name: string, args: readonly Word[], out: WriteTarget[]): void {
  switch (name) {
    case "tee": {
      for (const w of positionals(args)) out.push({ word: w, via: "tee" });
      return;
    }
    case "cp":
    case "mv":
    case "install":
    case "ln": {
      let targetDir: Word | null = null;
      const pos: Word[] = [];
      let ended = false;
      for (let k = 0; k < args.length; k++) {
        const w = args[k];
        if (!ended && w.text === "--") {
          ended = true;
          continue;
        }
        if (!ended && (w.text === "-t" || w.text === "--target-directory")) {
          const v = args[k + 1];
          if (v) targetDir = v;
          k++;
          continue;
        }
        if (!ended && w.text.startsWith("--target-directory=")) {
          targetDir = { text: w.text.slice("--target-directory=".length), raw: w.raw, expands: w.expands };
          continue;
        }
        if (!ended && isOption(w)) continue;
        pos.push(w);
      }
      if (targetDir) out.push({ word: targetDir, via: name });
      else if (pos.length >= 2) out.push({ word: pos[pos.length - 1], via: name });
      // A move deletes its sources, so a protected source is a protected write.
      if (name === "mv") for (const w of pos.slice(0, targetDir ? pos.length : pos.length - 1)) out.push({ word: w, via: "mv source" });
      return;
    }
    case "sed": {
      const inPlace = args.some((w) => /^--in-place/.test(w.text) || /^-[A-Za-z]*i/.test(w.text) && !w.text.startsWith("--"));
      if (!inPlace) return;
      const files: Word[] = [];
      let scripted = false;
      let ended = false;
      for (let k = 0; k < args.length; k++) {
        const w = args[k];
        if (!ended && w.text === "--") {
          ended = true;
          continue;
        }
        if (!ended && (w.text === "-e" || w.text === "-f" || w.text === "--expression" || w.text === "--file")) {
          scripted = true;
          k++;
          continue;
        }
        if (!ended && (/^-[ef]./.test(w.text) || /^--(?:expression|file)=/.test(w.text))) {
          scripted = true;
          continue;
        }
        if (!ended && isOption(w)) continue;
        files.push(w);
      }
      for (const w of scripted ? files : files.slice(1)) out.push({ word: w, via: "sed -i" });
      return;
    }
    default:
  }
}

// PowerShell: parameter names that carry a path. PowerShell accepts any unambiguous prefix of a parameter name.
const PS_PATH_PARAMS = ["path", "literalpath", "filepath", "pspath"];
const PS_DEST_PARAMS = ["destination"];
const PS_VALUE_PARAMS = new Set([
  "path", "literalpath", "filepath", "pspath", "destination", "value", "name", "itemtype", "encoding",
  "erroraction", "stream", "width", "include", "exclude", "filter", "newname", "inputobject",
]);

function psParam(text: string): { name: string; inline: string | null } | null {
  const m = text.match(/^-([A-Za-z]+)(?::(.*))?$/);
  return m ? { name: m[1].toLowerCase(), inline: m[2] ?? null } : null;
}

const psMatches = (name: string, full: readonly string[]): boolean =>
  name.length >= 2 && full.some((f) => f.startsWith(name));

/** A comma list written without quotes (`Remove-Item a,b`) is several targets. */
function splitCommaWord(w: Word): Word[] {
  if (w.raw !== w.text || !w.text.includes(",")) return [w];
  return w.text.split(",").filter((t) => t !== "").map((t) => ({ text: t, raw: t, expands: w.expands }));
}

type PsKind = "write" | "copy" | "move" | "remove" | "new";
const PS_CMDLETS: Record<string, PsKind> = {
  "set-content": "write", sc: "write", "add-content": "write", ac: "write", "out-file": "write",
  "clear-content": "write", clc: "write", "tee-object": "write", tee: "write",
  "new-item": "new", ni: "new",
  "copy-item": "copy", cpi: "copy", copy: "copy", cp: "copy",
  "move-item": "move", mi: "move", move: "move", mv: "move",
  "rename-item": "move", rni: "move", ren: "move",
  "remove-item": "remove", ri: "remove", rm: "remove", del: "remove", erase: "remove", rd: "remove", rmdir: "remove",
};

function psCommandTargets(kind: PsKind, args: readonly Word[], via: string, out: WriteTarget[]): void {
  const pathVals: Word[] = [];
  const destVals: Word[] = [];
  const names: Word[] = [];
  const pos: Word[] = [];
  for (let k = 0; k < args.length; k++) {
    const w = args[k];
    const p = psParam(w.text);
    if (p && w.text.startsWith("-")) {
      const takesValue = PS_VALUE_PARAMS.has(p.name) || [...PS_VALUE_PARAMS].some((f) => p.name.length >= 2 && f.startsWith(p.name));
      let value: Word | null = null;
      if (p.inline !== null) value = { text: p.inline, raw: p.inline, expands: w.expands };
      else if (takesValue && args[k + 1]) {
        value = args[k + 1];
        k++;
      }
      if (!value) continue;
      if (psMatches(p.name, PS_DEST_PARAMS)) destVals.push(...splitCommaWord(value));
      else if (psMatches(p.name, PS_PATH_PARAMS)) pathVals.push(...splitCommaWord(value));
      else if (p.name === "name" || (p.name.length >= 2 && "name".startsWith(p.name))) names.push(value);
      continue;
    }
    pos.push(...splitCommaWord(w));
  }
  const add = (w: Word, v: string): void => {
    out.push({ word: w, via: v });
  };
  if (kind === "write" || kind === "remove") {
    for (const w of pathVals.length > 0 ? pathVals : pos.slice(0, kind === "remove" ? pos.length : 1)) add(w, via);
    return;
  }
  if (kind === "new") {
    const base = pathVals.length > 0 ? pathVals : pos.slice(0, 1);
    if (names.length > 0 && base.length > 0) {
      for (const b of base) {
        for (const nm of names) {
          add({ text: `${b.text}/${nm.text}`, raw: `${b.raw}/${nm.raw}`, expands: b.expands || nm.expands }, via);
        }
      }
    } else for (const b of base) add(b, via);
    return;
  }
  // copy and move: the destination is written; a move also deletes its source.
  const src = pathVals.length > 0 ? pathVals : pos.slice(0, 1);
  const dest = destVals.length > 0 ? destVals : pathVals.length > 0 ? pos.slice(0, 1) : pos.slice(1, 2);
  for (const w of dest) add(w, via);
  if (kind === "move") for (const w of src) add(w, `${via} source`);
}

function extractSimple(s: Simple, flavor: Flavor, targets: WriteTarget[], flags: { cd: boolean; dynamic: string | null }): void {
  for (const r of s.redirs) {
    if (r.dup) continue;
    if (r.target) targets.push({ word: r.target, via: `redirect ${r.op}` });
  }
  const idx = commandIndex(s.words);
  if (idx < 0) return;
  const nameWord = s.words[idx];
  const name = commandBase(nameWord.text);
  const args = s.words.slice(idx + 1);
  if (CD_NAMES.has(name)) flags.cd = true;
  if (flavor === "powershell") {
    if (/^(?:invoke-expression|iex|invoke-command|icm)$/.test(name)) {
      flags.dynamic = `${nameWord.text} runs code the hook cannot read statically`;
    }
    const kind = PS_CMDLETS[name];
    if (kind) psCommandTargets(kind, args, name, targets);
    return;
  }
  bashCommandTargets(name, args, targets);
}

/** Every write target and flag found in one parse. */
export function extractFromParsed(parsed: Parsed, flavor: Flavor): Extracted {
  const targets: WriteTarget[] = [];
  const flags = { cd: false, dynamic: null as string | null };
  for (const s of parsed.simples) extractSimple(s, flavor, targets, flags);
  return { targets, cd: flags.cd, dynamic: flags.dynamic };
}

const PS_WRITE_WORD_RE =
  /\b(?:set-content|add-content|out-file|new-item|copy-item|move-item|remove-item|rename-item|clear-content|tee-object)\b/i;

/**
 * The command and every piece of code it carries (substitutions, `bash -c`, `pwsh -Command`, `eval`) are
 * parsed on their own and their findings joined, so a write one level down is found as surely as one at
 * the top. Quoted prose and heredoc bodies are data and are never read as commands.
 */
export function extractWrites(command: string, flavor: Flavor): Extracted {
  const all = allParses(command, flavor).map((p) => extractFromParsed(p.parsed, p.flavor));
  let dynamic: string | null = all.map((a) => a.dynamic).find((d) => d !== null) ?? null;
  if (flavor === "powershell" && !dynamic) {
    // A brace inside a quoted string is text (`-Value '{"a":1}'`); one outside quotes opens a script block.
    const unquoted = command.replace(/"(?:[^"`]|`.)*"|'(?:[^']|'')*'/g, "");
    if (unquoted.includes("{") && (PS_WRITE_WORD_RE.test(unquoted) || />/.test(unquoted))) {
      dynamic = "a script block that writes, whose target the hook cannot read statically";
    }
  }
  return { targets: all.flatMap((a) => a.targets), cd: all.some((a) => a.cd), dynamic };
}

/**
 * P1: the write targets that must be refused, as text. One entry per refused or protected target:
 * - a target that is not a literal path (`~`, `$`, backtick, glob, brace) is refused with its cause;
 * - a `cd`/`pushd`/`Set-Location` in the same command line as any file-writing target is refused as
 *   undeterminable, because the shell's cwd is no longer the payload's;
 * - otherwise the target is resolved by THE canonicaliser and refused when it falls under a protected path.
 * A write whose location is known and outside the repo is allowed: the hook protects the repo's
 * artifacts and is not a sandbox.
 */
export function detectBashWriteTargets(
  command: string,
  repoRoot: string,
  cwd: string = repoRoot,
  flavor: Flavor = "bash",
): string[] {
  const ex = extractWrites(command, flavor);
  const hits: string[] = [];
  const seen = new Set<string>();
  const push = (h: string): void => {
    if (!seen.has(h)) {
      seen.add(h);
      hits.push(h);
    }
  };

  if (ex.dynamic) push(`${ex.dynamic} (so its write location cannot be determined)`);

  const fileTargets = ex.targets.filter((t) => !isNullSink(t.word.text));
  if (ex.cd && fileTargets.length > 0) {
    push(
      `${fileTargets[0].word.text} (the command line changes directory with cd, pushd or Set-Location and also writes, ` +
        "so where the write lands cannot be determined)",
    );
  }

  for (const t of ex.targets) {
    const v = classifyTarget(t.word.text, t.word.raw, t.word.expands, repoRoot, cwd, true);
    if (v.kind === "refused") push(v.cause);
    else if (v.kind === "protected") push(t.word.text);
  }
  return hits;
}
