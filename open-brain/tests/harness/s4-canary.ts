/**
 * Shared helpers for slice four's key-handling tests (S4-3a, S4-3b).
 *
 * D-071's property is that the key reaches the Jev endpoint and nothing else. The tests that prove
 * it share four tools: a canary the test builds itself, a constructed environment that is never
 * `process.env`, a hostile fake `fetch` that echoes the `Authorization` header back (the worst
 * case: the key would otherwise flow through `answer`, `note` and an error's detail), and a scan
 * that walks every output and can be shown to find a planted canary.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** `S4CANARY-` plus 24 random hex characters: at least 32, unique per call. */
export const makeCanary = (): string => `S4CANARY-${randomBytes(12).toString("hex")}`;

/**
 * The whole environment a spawned CLI or an in-process run gets: what a process needs to start
 * (`PATH`, a home, the Windows system root and temp dirs) and the extras the test names. It is
 * NEVER spread from `process.env` as a whole — a real key in the machine's environment must not
 * reach a child because a test forgot to delete it (G-044).
 */
export function harnessEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const keep = ["PATH", "Path", "PATHEXT", "HOME", "USERPROFILE", "SystemRoot", "windir", "TEMP", "TMP", "TMPDIR", "ComSpec"];
  const env: NodeJS.ProcessEnv = {};
  for (const k of keep) {
    const v = process.env[k];
    if (typeof v === "string") env[k] = v;
  }
  return { ...env, ...extra };
}

export interface SeenRequest {
  url: string;
  method: string | undefined;
  authorization: string | undefined;
}

/**
 * A fake `fetch` that echoes the request's `Authorization` header into the response: as a 200
 * whose answers and envelope carry it, or as a 422 whose body and `detail[].loc` carry it. It
 * records every request it sees.
 */
export function hostileFetch(status: 200 | 422, seen: SeenRequest[]): typeof fetch {
  return (async (url: unknown, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const auth = headers.Authorization;
    seen.push({ url: String(url), method: init?.method, authorization: auth });
    if (status === 422) {
      return new Response(
        JSON.stringify({ detail: [{ loc: ["body", String(auth)], msg: `echo ${String(auth)}`, type: "value_error" }], echo: auth }),
        { status: 422 },
      );
    }
    const echoed = { echo: auth };
    return new Response(
      JSON.stringify({
        model: "jev-1.13.0",
        echo: auth,
        answers: {
          plan_mode: { choice: "mixed", confidence: 0.9, ...echoed },
          scope_size: { score: 1, confidence: 0.9, ...echoed },
          preserves_validated: { noul: 0.95, ...echoed },
          addresses_top_failures: { noul: 0.95, ...echoed },
          has_observable_acceptance: { noul: 0.95, ...echoed },
          diff_matches_plan: { noul: 0.95, ...echoed },
          touches_out_of_scope: { noul: 0.01, ...echoed },
          local_tests_support_claim: { noul: 0.95, ...echoed },
          stuck_repeating_prior_failure: { noul: 0.01, ...echoed },
          risk_of_regression: { score: 0, confidence: 0.9, ...echoed },
          regression_of_validated: { noul: 0.1, ...echoed },
          artifact_complete_enough_to_stop: { noul: 0.9, ...echoed },
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
}

/** Every file under `dir`, found by walking it rather than by listing expected paths. */
export function walkFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

export interface CanaryScan {
  /** Total occurrences of the canary across every file and string. */
  hits: number;
  filesRead: number;
  stringsRead: number;
  /** Where each hit was (a path or the string's label). Never the canary itself. */
  where: string[];
}

const occurrences = (haystack: string, needle: string): number => (needle === "" ? 0 : haystack.split(needle).length - 1);

/** Scan every file under each dir, plus labelled strings (an error message, stdout, stderr). */
export function scanForCanary(canary: string, sources: { dirs?: string[]; strings?: Record<string, string> }): CanaryScan {
  const scan: CanaryScan = { hits: 0, filesRead: 0, stringsRead: 0, where: [] };
  for (const dir of sources.dirs ?? []) {
    for (const file of walkFiles(dir)) {
      const n = occurrences(readFileSync(file, "latin1"), canary) + occurrences(readFileSync(file, "utf-8"), canary);
      scan.filesRead += 1;
      if (n > 0) {
        scan.hits += 1;
        scan.where.push(file);
      }
    }
  }
  for (const [label, text] of Object.entries(sources.strings ?? {})) {
    scan.stringsRead += 1;
    if (occurrences(text, canary) > 0) {
      scan.hits += 1;
      scan.where.push(label);
    }
  }
  return scan;
}

/** The scan's own known positive: a temp file holding the canary must report exactly one hit. */
export function scanKnownPositive(canary: string): number {
  const dir = mkdtempSync(join(tmpdir(), "s4-positive-"));
  try {
    writeFileSync(join(dir, "planted.txt"), `before ${canary} after\n`);
    return scanForCanary(canary, { dirs: [dir] }).hits;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
