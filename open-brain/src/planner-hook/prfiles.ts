import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * The changed-file list of a PR for the D-032/D-055 docs-only merge check (T-194 r2).
 *
 * No child process: GitHub's REST API over `fetch`, keyed with the user's gh token.
 * The spawn-sites check (CA-4b/R16) is why — a `gh pr view` spawn is what r1 dropped.
 * FAILS CLOSED: every way of not knowing the list returns `{ ok: false, cause }`, and
 * the caller treats that as grant-required and names the cause in the refusal.
 */

export type PrFilesResult = { ok: true; paths: string[] } | { ok: false; cause: string };

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface PrFilesDeps {
  fetchImpl?: FetchLike;
  env?: NodeJS.ProcessEnv;
  /** Home directory holding `.config/gh/hosts.yml` (tests). */
  home?: string;
  timeoutMs?: number;
}

const PER_PAGE = 100;
const MAX_PAGES = 30; // GitHub caps the files endpoint at 3000 files.

const fail = (cause: string): PrFilesResult => ({ ok: false, cause });

/** `owner/repo` from a GitHub remote URL, or null. */
export function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  const u = url.trim();
  const m =
    u.match(/^https?:\/\/(?:[^@/]+@)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i) ??
    u.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** The PR ref of `gh pr merge <ref>`: a number, `#number`, or a github.com pull URL. */
export function parsePrRef(
  ref: string,
): { number: number; owner?: string; repo?: string } | null {
  const bare = ref.replace(/^['"]|['"]$/g, "");
  const n = bare.match(/^#?(\d+)$/);
  if (n) return { number: Number(n[1]) };
  const u = bare.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/i);
  if (u) return { number: Number(u[3]), owner: u[1], repo: u[2] };
  return null;
}

/** The git dir that holds `config`: a worktree's `.git` file points at a gitdir with a `commondir`. */
function commonGitDir(repoRoot: string): string | null {
  const dotGit = join(repoRoot, ".git");
  if (!existsSync(dotGit)) return null;
  if (statSync(dotGit).isDirectory()) return dotGit;
  const pointer = readFileSync(dotGit, "utf-8").match(/^gitdir:\s*(.+)$/m);
  if (!pointer) return null;
  const gitdir = isAbsolute(pointer[1].trim()) ? pointer[1].trim() : resolve(repoRoot, pointer[1].trim());
  const commondirFile = join(gitdir, "commondir");
  if (!existsSync(commondirFile)) return gitdir;
  const common = readFileSync(commondirFile, "utf-8").trim();
  return isAbsolute(common) ? common : resolve(gitdir, common);
}

function originRepo(repoRoot: string): { owner: string; repo: string } | string {
  let dir: string | null;
  try {
    dir = commonGitDir(repoRoot);
  } catch (e) {
    return `cannot read the git directory (${e instanceof Error ? e.message : String(e)})`;
  }
  if (!dir) return "no .git found at the repository root";
  const cfg = join(dir, "config");
  if (!existsSync(cfg)) return "no git config found";
  let text: string;
  try {
    text = readFileSync(cfg, "utf-8");
  } catch (e) {
    return `cannot read git config (${e instanceof Error ? e.message : String(e)})`;
  }
  const section = text.match(/^\[remote "origin"\][^\[]*/m);
  const url = section?.[0].match(/^\s*url\s*=\s*(.+)$/m)?.[1];
  if (!url) return "the git config has no origin url";
  return parseGithubRemote(url) ?? `origin is not a github.com remote (${url.trim()})`;
}

/** gh's config directories, in the order gh itself looks (GH_CONFIG_DIR, XDG, %AppData%GitHub CLI, ~/.config/gh). */
function ghConfigDirs(env: NodeJS.ProcessEnv, home: string): string[] {
  const dirs: string[] = [];
  if (env.GH_CONFIG_DIR) dirs.push(env.GH_CONFIG_DIR);
  if (env.XDG_CONFIG_HOME) dirs.push(join(env.XDG_CONFIG_HOME, "gh"));
  if (env.APPDATA) dirs.push(join(env.APPDATA, "GitHub CLI"));
  dirs.push(join(home, ".config", "gh"));
  return dirs;
}

/**
 * GH_TOKEN, GITHUB_TOKEN, then a token gh wrote into hosts.yml. A token gh keeps in the OS
 * keyring (`gh auth status` says "(keyring)") is NOT readable without a spawn: hosts.yml then has
 * no oauth_token, this returns null, and the merge is grant-required until GH_TOKEN is set.
 */
export function readGhToken(env: NodeJS.ProcessEnv, home: string): string | null {
  for (const k of ["GH_TOKEN", "GITHUB_TOKEN"]) {
    const v = env[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const dir of ghConfigDirs(env, home)) {
    const hosts = join(dir, "hosts.yml");
    if (!existsSync(hosts)) continue;
    try {
      const doc = parseYaml(readFileSync(hosts, "utf-8")) as Record<string, unknown> | null;
      const gh = doc?.["github.com"] as Record<string, unknown> | undefined;
      const tok = gh?.oauth_token;
      if (typeof tok === "string" && tok.trim()) return tok.trim();
    } catch {
      /* unreadable hosts.yml: try the next directory */
    }
  }
  return null;
}

export async function fetchPrChangedPaths(
  ref: string,
  repoRoot: string,
  deps: PrFilesDeps = {},
): Promise<PrFilesResult> {
  const parsed = parsePrRef(ref);
  if (!parsed) return fail(`could not read a PR number from "${ref}" (only a number, #number or a github.com pull URL)`);

  let owner = parsed.owner;
  let repo = parsed.repo;
  if (!owner || !repo) {
    const o = originRepo(repoRoot);
    if (typeof o === "string") return fail(o);
    owner = o.owner;
    repo = o.repo;
  }

  const token = readGhToken(deps.env ?? process.env, deps.home ?? homedir());
  if (!token) {
    return fail("no GitHub token readable without a spawn (GH_TOKEN/GITHUB_TOKEN unset and hosts.yml has no oauth_token — a keyring-stored gh token cannot be read here)");
  }

  const doFetch: FetchLike = deps.fetchImpl ?? ((url, init) => fetch(url, init));
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "sia-planner-hook",
  };
  const base = `https://api.github.com/repos/${owner}/${repo}/pulls/${parsed.number}`;

  const getJson = async (url: string): Promise<{ body: unknown } | { cause: string }> => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), deps.timeoutMs ?? 5000);
    try {
      const res = await doFetch(url, { headers, signal: ctl.signal });
      if (!res.ok) return { cause: `GitHub API returned HTTP ${res.status} for ${url}` };
      return { body: await res.json() };
    } catch (e) {
      return { cause: `GitHub API unreachable (${e instanceof Error ? e.message : String(e)})` };
    } finally {
      clearTimeout(timer);
    }
  };

  const meta = await getJson(base);
  if ("cause" in meta) return fail(meta.cause);
  const expected = (meta.body as { changed_files?: unknown } | null)?.changed_files;
  if (typeof expected !== "number" || !Number.isInteger(expected) || expected < 1) {
    return fail("the PR's changed_files count is unreadable, so the file list cannot be checked for completeness");
  }

  const paths: string[] = [];
  let files = 0;
  for (let page = 1; page <= MAX_PAGES && files < expected; page++) {
    const r = await getJson(`${base}/files?per_page=${PER_PAGE}&page=${page}`);
    if ("cause" in r) return fail(r.cause);
    if (!Array.isArray(r.body)) return fail("the files endpoint returned something other than a list");
    if (r.body.length === 0) break;
    for (const f of r.body as Array<Record<string, unknown>>) {
      if (typeof f?.filename !== "string" || !f.filename) return fail("a file entry has no filename");
      files++;
      paths.push(f.filename);
      // A rename touches the OLD path as well: moving a file out of src/ is a src/ change.
      if (typeof f.previous_filename === "string" && f.previous_filename) paths.push(f.previous_filename);
      else if (f.status === "renamed") return fail("a renamed file has no previous_filename");
    }
  }
  // Count FILES, not paths: a rename adds two paths for one file.
  if (files < expected) {
    return fail(`the file list is incomplete (${files} of ${expected} changed files)`);
  }
  return { ok: true, paths };
}
