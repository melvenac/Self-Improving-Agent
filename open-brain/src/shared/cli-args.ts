import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * T-185 (T-150's rule, every subcommand): a command declares the flags it
 * accepts, and any token starting with "-" (or with a typographic dash, R185-5)
 * that it did not declare REFUSES.
 *
 * Before this, each subcommand took `args.find((a) => !a.startsWith("--"))` as
 * its directory and `args.includes("--x")` for its flags. So a misspelled flag
 * was ignored and a single-dash one became the directory, and in both cases the
 * command ran its default: `sync -check` ran the FIXING sync, `detach -dry-run`
 * ran a real detach, and `state migrate -dry-run` migrated the files.
 *
 * Pure: it parses and reports, and never exits or prints. The caller refuses.
 * Unlisted tokens default to the strict side, so a command cannot widen what
 * it accepts by forgetting to declare something.
 */

/** How a value flag takes its value. Declared per flag so no accepted form changes. */
export type ValueForm = "space" | "equals" | "both";

export type PositionalKind =
  /** No positional tokens at all. */
  | "none"
  /** At most one, and it must name an existing directory (no walk-up from a path that is not there). */
  | "directory"
  /** Any number of free-form tokens (for example files); the command checks them itself. */
  | "any";

export interface CommandSpec {
  /** As the user types it: "sync", "state migrate". */
  readonly name: string;
  readonly booleans: readonly string[];
  readonly values: Readonly<Record<string, ValueForm>>;
  readonly positionals: PositionalKind;
}

export interface ParsedArgs {
  /** True when a declared boolean flag was given. Asking for an undeclared flag throws. */
  has(flag: string): boolean;
  /** The value of a declared value flag, or undefined. Asking for an undeclared flag throws. */
  value(flag: string): string | undefined;
  readonly positionals: readonly string[];
  /** The one directory positional, resolved, for a "directory" command. */
  readonly directory: string | undefined;
}

export type ParseResult = { ok: true; args: ParsedArgs } | { ok: false; error: string };

/** Every flag a command accepts, in declaration order. */
export function declaredFlags(spec: CommandSpec): string[] {
  return [...spec.booleans, ...Object.keys(spec.values)];
}

/**
 * R185-5: autocorrect turns "--" into an em or en dash, and a token that starts
 * with one does not start with "-". It used to become a positional: a second
 * FILE for `state migrate`, a directory for the rest. It is a mistyped flag.
 */
const TYPOGRAPHIC_DASH = /^[‐-―−﹘﹣－]/;

const looksLikeFlag = (tok: string): boolean => tok.startsWith("-") || TYPOGRAPHIC_DASH.test(tok);

export function parseArgs(spec: CommandSpec, tokens: readonly string[], cwd: string = process.cwd()): ParseResult {
  const booleans = new Set<string>();
  const values = new Map<string, string>();
  const positionals: string[] = [];
  const unknown: string[] = [];
  const problems: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i]!;
    if (TYPOGRAPHIC_DASH.test(tok)) {
      unknown.push(tok);
      continue;
    }
    if (!tok.startsWith("-")) {
      positionals.push(tok);
      continue;
    }
    if (spec.booleans.includes(tok)) {
      booleans.add(tok);
      continue;
    }
    const eq = tok.indexOf("=");
    const name = eq > 0 ? tok.slice(0, eq) : tok;
    const form = Object.prototype.hasOwnProperty.call(spec.values, name) ? spec.values[name] : undefined;
    if (form === undefined) {
      unknown.push(tok);
      continue;
    }
    if (values.has(name)) {
      problems.push(`${name} given more than once`);
      continue;
    }
    if (eq > 0) {
      if (form === "space") {
        problems.push(`${name} takes its value as "${name} <value>", not "${tok}"`);
        continue;
      }
      values.set(name, tok.slice(eq + 1));
      continue;
    }
    if (form === "equals") {
      problems.push(`${name} takes its value as "${name}=<value>"`);
      continue;
    }
    const next = tokens[i + 1];
    if (next === undefined || looksLikeFlag(next)) {
      problems.push(`${name} needs a value`);
      continue;
    }
    values.set(name, next);
    i += 1;
  }

  if (unknown.length > 0) {
    const flags = declaredFlags(spec);
    const named = (u: string): string => (TYPOGRAPHIC_DASH.test(u) ? `"${u}" (a typographic dash, not "-")` : `"${u}"`);
    return {
      ok: false,
      error:
        `unrecognised flag${unknown.length > 1 ? "s" : ""} ${unknown.map(named).join(", ")}.\n` +
        `Accepted flags: ${flags.length > 0 ? flags.join(", ") : "(none)"}`,
    };
  }
  if (problems.length > 0) return { ok: false, error: problems.join("; ") };

  let directory: string | undefined;
  if (spec.positionals === "none" && positionals.length > 0) {
    return { ok: false, error: `takes no positional arguments, got ${positionals.map((p) => `"${p}"`).join(", ")}` };
  }
  if (spec.positionals === "directory") {
    if (positionals.length > 1) {
      return { ok: false, error: `takes at most one directory, got ${positionals.map((p) => `"${p}"`).join(", ")}` };
    }
    if (positionals.length === 1) {
      const abs = resolve(cwd, positionals[0]!);
      if (!existsSync(abs) || !statSync(abs).isDirectory()) {
        return { ok: false, error: `"${positionals[0]}" is not an existing directory (resolved to ${abs})` };
      }
      directory = abs;
    }
  }

  const declared = (flag: string, kind: "boolean" | "value"): void => {
    const ok = kind === "boolean" ? spec.booleans.includes(flag) : Object.prototype.hasOwnProperty.call(spec.values, flag);
    // A read of an undeclared flag is a defect in the command, and it would
    // otherwise read as "not given" forever: the lock-out a declaration typo makes.
    if (!ok) throw new Error(`${spec.name}: ${flag} is not a declared ${kind} flag`);
  };

  return {
    ok: true,
    args: {
      has: (flag) => { declared(flag, "boolean"); return booleans.has(flag); },
      value: (flag) => { declared(flag, "value"); return values.get(flag); },
      positionals,
      directory,
    },
  };
}
