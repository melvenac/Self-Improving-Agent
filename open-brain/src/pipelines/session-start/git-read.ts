import { execFileSync } from "node:child_process";

/**
 * `git show <ref>:<path>`, read WHOLE or refused with a named cause (T-200).
 *
 * The helper `tree-currency.ts` and `role-files.ts` share (`git()` there) uses
 * execFileSync's DEFAULT maxBuffer and swallows every error into `null`. On a large
 * blob that is ENOBUFS, and `null` is what "no record" looks like too: a record that
 * outgrew a buffer read as an absent one, and nothing said so. The master record was
 * 432 KB when this was written and grows with every session.
 *
 * So: a buffer far past any real record, no `.trim()` (a cut record must not be
 * made to look whole by trimming), no shell (`ref:path` reaches git verbatim — MSYS
 * mangles it in a shell), and a cause on every refusal. Callers that need to know the
 * content is a record parse it: this helper proves only that git returned all of it.
 */
export const GIT_SHOW_MAX_BYTES = 256 * 1024 * 1024;

export type GitShowResult = { ok: true; text: string } | { ok: false; cause: string };

export function gitShow(cwd: string, ref: string, rel: string, maxBytes = GIT_SHOW_MAX_BYTES): GitShowResult {
  try {
    const text = execFileSync("git", ["show", `${ref}:${rel}`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: maxBytes,
    });
    return { ok: true, text };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: Buffer | string };
    if (e.code === "ENOBUFS") {
      return { ok: false, cause: `${rel} at ${ref} is larger than ${maxBytes} bytes, so it was not read whole` };
    }
    const stderr = (typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString("utf8") ?? "")).trim().split(/\r?\n/)[0];
    return { ok: false, cause: stderr || `git show ${ref}:${rel} failed (${e.code ?? e.message})` };
  }
}

/** One line of stdout from a git command, or null. For refs and hashes only, never for content. */
export function gitLine(cwd: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}
