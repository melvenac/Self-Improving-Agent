import { isNullSink, pathShapeProblem, validateTarget } from "./paths.js";
import { PS_CMDLETS, psCanonical, resolvePsParam } from "./parse-gate.js";
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
 * What the hook can and cannot see, said once (T-194 r5, rewritten for r6 / QA 237 D17). Under the parse gate most of
 * r5's "out of reach" list is REFUSED, so this states only what is still true, and nothing it states is caught.
 */
export const BASH_WRITE_LIMIT =
  "The hook checks only a command it can fully parse (Bash and PowerShell); anything else is refused as 'not statically " +
  "parseable'. PowerShell must be printable ASCII; Bash may carry other characters only inside quotes; a Bash command word " +
  "must be on the allow-list (BASH_ALLOWED_COMMANDS). Inside that grammar it reads redirects and the targets of tee, cp, mv, " +
  "install, sed -i and scp's local end (Bash), and of Set-Content, Add-Content, Clear-Content, Out-File, Tee-Object, New-Item, " +
  "Copy-Item, Move-Item, Rename-Item and Remove-Item (PowerShell). A target that is not a literal path is refused, and so is " +
  "cd plus a write on one line (split them into two commands). OUT OF REACH, not caught: a program named on the allow-list does " +
  "what its own arguments say (node x.js or npm test writing a path it builds at runtime); the remote side of ssh and scp " +
  "(D-019); in Bash, rm, touch, mkdir and git checkout; symlinks and junctions; and a merge through the GitHub API (curl, gh " +
  "api). It stops mistakes by the planner's tools; it is not a sandbox.";

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
        if (!ended && w.text.startsWith("--")) {
          // GNU long options accept any unambiguous prefix: `--t`, `--target`, `--target-dir` are all --target-directory
          // (r6, QA 237 D3). `--no-target-directory` starts with `--no`, so it is not matched here.
          const eq = w.text.indexOf("=");
          const long = eq < 0 ? w.text : w.text.slice(0, eq);
          if (long.length >= 3 && "--target-directory".startsWith(long)) {
            if (eq >= 0) targetDir = { text: w.text.slice(eq + 1), raw: w.raw, expands: w.expands };
            else if (args[k + 1]) {
              targetDir = args[k + 1];
              k++;
            }
          }
          continue;
        }
        if (!ended && w.text.startsWith("-") && w.text.length > 1) {
          // a short cluster: `-t DIR`, `-tDIR`, `-vt DIR`, `-vtDIR`. Everything after a `t` in the cluster is its value.
          const cluster = w.text.slice(1);
          const t = cluster.indexOf("t");
          if (t >= 0) {
            const attached = cluster.slice(t + 1);
            if (attached) targetDir = { text: attached, raw: w.raw, expands: w.expands };
            else if (args[k + 1]) {
              targetDir = args[k + 1];
              k++;
            }
          }
          continue;
        }
        pos.push(w);
      }
      if (targetDir) out.push({ word: targetDir, via: name });
      else if (pos.length >= 2) out.push({ word: pos[pos.length - 1], via: name });
      // A move deletes its sources, so a protected source is a protected write.
      if (name === "mv") for (const w of pos.slice(0, targetDir ? pos.length : pos.length - 1)) out.push({ word: w, via: "mv source" });
      return;
    }
    case "scp": {
      // the LOCAL end of a copy is a write target: the last operand, unless it names a remote host (`host:path`, `user@host:path`)
      const pos = positionals(args);
      const last = pos[pos.length - 1];
      if (last && pos.length >= 2 && !/^(?:[^\s@/\\:]+@)?[^\s@/\\:]{2,}:/.test(last.text)) out.push({ word: last, via: "scp" });
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

/**
 * A comma list (`Remove-Item a,b`, `-Path 'x','y'`) is several targets. The comma is read OUTSIDE quotes in the word as
 * written, so a quoted list is split too (r6, QA 237 D14), and each piece loses its own quotes.
 */
function splitCommaWord(w: Word): Word[] {
  const pieces: string[] = [];
  let cur = "";
  let q: string | null = null;
  for (let k = 0; k < w.raw.length; k++) {
    const c = w.raw[k];
    if (q) {
      if (c === q) q = null;
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      q = c;
      continue;
    }
    if (c === ",") {
      pieces.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  pieces.push(cur);
  if (pieces.length === 1) return [w];
  return pieces.filter((t) => t !== "").map((t) => ({ text: t, raw: t, expands: w.expands }));
}

function psCommandTargets(canon: string, args: readonly Word[], via: string, out: WriteTarget[]): void {
  const def = PS_CMDLETS[canon];
  const kind = def.kind;
  const pathVals: Word[] = [];
  const destVals: Word[] = [];
  const names: Word[] = [];
  const pos: Word[] = [];
  for (let k = 0; k < args.length; k++) {
    const w = args[k];
    const unquotedParam = w.raw.startsWith("-") && w.text.length > 1 && !/^-\d/.test(w.text);
    if (unquotedParam) {
      const colon = w.text.indexOf(":");
      const p = resolvePsParam(canon, w.text);
      const pd = def.params[p];
      if (!pd) continue; // the parse gate has already refused an unknown parameter; nothing to read here
      let value: Word | null = null;
      if (colon > 0) value = { text: w.text.slice(colon + 1), raw: w.text.slice(colon + 1), expands: w.expands };
      else if (pd.value && args[k + 1]) {
        value = args[k + 1];
        k++;
      }
      if (!value) continue;
      if (pd.role === "dest") destVals.push(...splitCommaWord(value));
      else if (pd.role === "path") pathVals.push(...splitCommaWord(value));
      else if (pd.role === "name") names.push(value);
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
      // the name is a path FRAGMENT: joined it can hide a shape problem (`docs/C:name`), so it is checked on its own as well
      for (const nm of names) if (pathShapeProblem(nm.text)) add(nm, via);
      for (const b of base) {
        for (const nm of names) {
          add({ text: `${b.text}/${nm.text}`, raw: `${b.raw}/${nm.raw}`, expands: b.expands || nm.expands }, via);
        }
      }
    } else if (names.length > 0) {
      // r7 D-C (QA 241): -Name with no -Path creates the item in the current directory; the name IS the target
      for (const nm of names) add(nm, via);
    } else for (const b of base) add(b, via);
    return;
  }
  if (kind !== "copy" && kind !== "move") return; // read-only cmdlets write nothing
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
    const canon = psCanonical(name);
    if (canon) psCommandTargets(canon, args, canon, targets);
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
        "so where the write lands cannot be determined; split them into two commands)",
    );
  }

  for (const t of ex.targets) {
    const v = validateTarget(t.word.text, t.word.raw, t.word.expands, repoRoot, cwd, true);
    if (v.kind === "refused") push(v.cause);
    else if (v.kind === "protected") push(t.word.text);
  }
  return hits;
}
