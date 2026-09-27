/**
 * The fifth channel: **git config and hooks** — layer 2 of three.
 *
 * A role can plant a hook or a program-valued config key and have it run
 * inside the RUNTIME's next git call (design §2.3, reproduced by QA). Layers 0
 * and 1 (`git.ts`) stop the runtime's calls from reading machine config and
 * override the repo-local keys on the command line. This layer is the one that
 * catches the whole CLASS: it does not enumerate dangerous keys — there is no
 * complete list of program-valued config, and git adds to it — it refuses ANY
 * change to the files git reads config and hooks from.
 *
 * ## It reads FILES, never git, and it restores before anything reads HEAD
 *
 * `git status` is itself an execution point: `core.fsmonitor` runs on it. So
 * the comparison and the restore here are plain file reads and writes, and the
 * runtime runs them BEFORE the ref window closes and before `enforceAllowlist`
 * — G-045's "restore before any read", moved one channel earlier. A git call
 * placed ahead of this restore is the ordering defect layer 1 exists to catch.
 *
 * ## Where the files are is decided ONCE, at preflight (R12)
 *
 * In a linked worktree `.git` is a file, config and hooks live in the COMMON
 * dir, and `config.worktree` lives in the worktree's own git dir. Both are
 * resolved before any role runs and never re-resolved: a role that rewrites the
 * worktree's `.git` file to point elsewhere must not move the snapshot. That
 * `.git` file is itself in the snapshot, so the rewrite is caught and undone.
 *
 * ## What this does NOT see, and says so in its verdict
 *
 * Config outside the repository — global, XDG, system — is not this layer's:
 * the runtime's calls do not read it (layer 0), and a role's writes to it are
 * HASHED AND REPORTED, never restored, by {@link MachineConfigWatch} (R8). The
 * index, submodules and the reflog are unprobed.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  closeSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  statSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { git, gitTry } from "./git.js";

/** Where git keeps the files this layer watches, resolved once. */
export interface GitDirs {
  /** `git rev-parse --git-dir`: this worktree's own git dir. */
  gitDir: string;
  /** `git rev-parse --git-common-dir`: config, hooks and info live here. */
  commonDir: string;
  /** `<worktree>/.git` when it is a FILE (a linked worktree), else null. */
  gitFile: string | null;
}

const toAbs = (repoRoot: string, p: string): string => resolve(isAbsolute(p) ? p : join(repoRoot, p));

/**
 * Resolve the git dirs. Called at preflight, before any role has run — the
 * only moment the answer is the repository's rather than a role's.
 */
export function resolveGitDirs(repoRoot: string): GitDirs {
  const gitDir = toAbs(repoRoot, git(repoRoot, ["rev-parse", "--git-dir"]));
  const commonDir = toAbs(repoRoot, git(repoRoot, ["rev-parse", "--git-common-dir"]));
  const dotGit = join(repoRoot, ".git");
  const gitFile = existsSync(dotGit) && lstatSync(dotGit).isFile() ? dotGit : null;
  return { gitDir, commonDir, gitFile };
}

/** The exact files and directories this layer snapshots. Stated so a verdict can say what it looked at. */
export function watchedLocations(dirs: GitDirs): { files: string[]; trees: string[] } {
  const files = new Set<string>([
    join(dirs.commonDir, "config"),
    join(dirs.gitDir, "config.worktree"),
    join(dirs.commonDir, "config.worktree"),
  ]);
  if (dirs.gitFile !== null) files.add(dirs.gitFile);
  const trees = [join(dirs.commonDir, "hooks"), join(dirs.commonDir, "info")];
  if (dirs.gitDir !== dirs.commonDir) trees.push(join(dirs.gitDir, "info"));
  return { files: [...files].sort(), trees: [...new Set(trees)].sort() };
}

/**
 * What `lstat` says about one path. `lstat` does not follow the final component.
 * An intermediate component that is a link is NOT visible here — walk those
 * with {@link linkAboveWatched}. Inodes are bigint: a win32 `ino` does not fit
 * in a Number (measured above 2^53).
 */
export interface PathIdentity {
  kind: "absent" | "file" | "dir" | "symlink" | "other";
  mode: number;
  nlink: number;
  ino: bigint | null;
  dev: bigint | null;
  /** Byte length and mtime. Attribution of an unread file uses these (R64). */
  size: bigint;
  mtimeNs: bigint;
  target: string | null;
  /** Set when lstat or readlink failed with a code other than ENOENT or ENOTDIR. Not absence. */
  code?: string | null;
}

/**
 * R82. ENOENT and ENOTDIR mean nothing is there. Every other code means the
 * runtime could not see the path, and that code fails the stage.
 */
export function resolutionUnobservable(code: string): string | null {
  if (code === "ENOENT" || code === "ENOTDIR") return null;
  return code;
}

export function identify(p: string): PathIdentity {
  try {
    const st = lstatSync(p, { bigint: true });
    const base = { mode: Number(st.mode & 0o777n), nlink: Number(st.nlink), ino: st.ino, dev: st.dev, size: st.size, mtimeNs: st.mtimeNs, target: null as string | null };
    if (st.isSymbolicLink()) return { ...base, kind: "symlink", target: readlinkSync(p) };
    if (st.isFile()) return { ...base, kind: "file" };
    if (st.isDirectory()) return { ...base, kind: "dir" };
    return { ...base, kind: "other" };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { kind: "absent", mode: 0, nlink: 0, ino: null, dev: null, size: 0n, mtimeNs: 0n, target: null, code: null };
    }
    return { kind: "other", mode: 0, nlink: 0, ino: null, dev: null, size: 0n, mtimeNs: 0n, target: null, code: code ?? "UNKNOWN" };
  }
}

/**
 * The first symlink strictly between `floor` and `target`, not including either
 * endpoint. `lstat(target)` alone cannot see this: it only checks the final component.
 */
export function linkAncestor(floor: string, target: string): string | null {
  const rel = relative(floor, target);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return null;
  const parts = rel.split(/[\\/]/).filter((p) => p !== "");
  let cur = floor;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cur = join(cur, parts[i]!);
    if (identify(cur).kind === "symlink") return cur;
  }
  return null;
}

/** A link at an ancestor of `target`, from the repo root or from either git dir. */
export function linkAboveWatched(repoRoot: string, dirs: GitDirs, target: string): string | null {
  const floors = [repoRoot, dirname(dirs.gitDir), dirname(dirs.commonDir)];
  for (const floor of floors) {
    const hit = linkAncestor(floor, target);
    if (hit) return hit;
  }
  return null;
}

/** `.git` itself replaced by a link. Checked before any git call at preflight. */
export function dotGitLink(repoRoot: string): string | null {
  const p = join(repoRoot, ".git");
  return identify(p).kind === "symlink" ? p : null;
}

/**
 * Directory entries under `dir`. A symlink is listed and not entered.
 * A missing dir, or a dir that is itself a link, contributes nothing: the
 * caller decides what a link at the root means, and this function does not follow it.
 */
interface UnlistedDir {
  dir: string;
  code: string;
}

function listTree(dir: string): { paths: string[]; unlisted: UnlistedDir[] } {
  const id = identify(dir);
  if (id.kind === "other" && id.code) return { paths: [], unlisted: [{ dir, code: id.code }] };
  if (id.kind !== "dir") return { paths: [], unlisted: [] };
  const out: string[] = [];
  const unlisted: UnlistedDir[] = [];
  const walk = (d: string): void => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
      unlisted.push({ dir: d, code });
      return;
    }
    for (const entry of entries) {
      const p = join(d, entry.name);
      if (entry.isSymbolicLink()) {
        out.push(p);
        continue;
      }
      if (entry.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return { paths: out, unlisted };
}

/**
 * Links already present at repository watched paths. Machine-config paths are
 * not this function's: a dotfiles link at base is recorded, not refused (R35).
 */
export function repositoryLinksAtBase(repoRoot: string, dirs: GitDirs): string[] {
  const found: string[] = [];
  const note = (p: string): void => {
    const anc = linkAboveWatched(repoRoot, dirs, p);
    if (anc) found.push(anc);
    if (identify(p).kind === "symlink") found.push(p);
  };
  const { files, trees } = watchedLocations(dirs);
  for (const f of files) note(f);
  for (const t of trees) {
    note(t);
    if (identify(t).kind === "dir") {
      // Unlisted is not reported here; begin's currentFiles refuses the same trees, R77.
      const listed = listTree(t);
      for (const entry of listed.paths) if (identify(entry).kind === "symlink") found.push(entry);
    }
  }
  return [...new Set(found)];
}

const hashOf = (bytes: Buffer | null): string =>
  bytes === null ? "absent" : createHash("sha256").update(bytes).digest("hex").slice(0, 16);

/** One component of a path's resolution. `nlink` is compared on the final file only (R49). */
interface ResolutionComp {
  path: string;
  kind: PathIdentity["kind"];
  target: string | null;
  dev: bigint | null;
  ino: bigint | null;
  nlink: number;
}

function opensSame(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
}

function resolutionComp(p: string): ResolutionComp {
  const id = identify(p);
  return { path: p, kind: id.kind, target: id.target, dev: id.dev, ino: id.ino, nlink: id.nlink };
}

const ROUTE_LIMIT = 40;

/** A link target's own anchor: the path root when absolute, the link's directory when relative. */
function linkTargetAnchor(linkPath: string, target: string): { anchor: string; dest: string } {
  if (isAbsolute(target)) {
    const dest = resolve(target);
    return { anchor: parse(dest).root, dest };
  }
  const anchor = dirname(linkPath);
  return { anchor, dest: resolve(anchor, target) };
}

function lexicalPaths(anchor: string, file: string, includeAnchor: boolean): string[] {
  const rel = relative(anchor, file);
  const segs = rel === "" || rel.startsWith("..") || isAbsolute(rel) ? [] : rel.split(/[\\/]/).filter((s) => s !== "");
  const paths: string[] = [];
  if (includeAnchor && anchor !== "") paths.push(anchor);
  let cur = anchor;
  for (const seg of segs) {
    cur = join(cur, seg);
    paths.push(cur);
  }
  return paths;
}

/**
 * R55. The route is every component as written, and when a component is a link,
 * that link plus every component of its target from the target's own anchor,
 * recursively — including a link in the last position and the object it leads
 * to. `lstat` and `readlink` only; this does not open the file.
 */
function routeChain(
  anchor: string,
  file: string,
  includeAnchor: boolean,
  depth = 0,
  seen?: Set<string>,
): ResolutionComp[] {
  if (depth > ROUTE_LIMIT) return [];
  const chain: ResolutionComp[] = [];
  const visited = seen ?? new Set<string>();
  const paths = lexicalPaths(anchor, file, includeAnchor);
  for (let i = 0; i < paths.length; i++) {
    const c = resolutionComp(paths[i]!);
    chain.push(c);
    if (c.kind === "absent") break;
    if (c.kind === "symlink" && c.target) {
      const key = `${c.dev}:${c.ino}`;
      if (c.dev !== null && visited.has(key)) break;
      if (c.dev !== null) visited.add(key);
      const restSegs: string[] = [];
      for (let j = i + 1; j < paths.length; j++) restSegs.push(relative(paths[j - 1]!, paths[j]!));
      const { anchor: nextAnchor, dest } = linkTargetAnchor(paths[i]!, c.target);
      const followed = restSegs.length === 0 ? dest : join(dest, ...restSegs);
      chain.push(...routeChain(nextAnchor, followed, true, depth + 1, visited));
      break;
    }
  }
  return chain;
}

function compsDiffer(prev: ResolutionComp, now: ResolutionComp, final: boolean): boolean {
  const nlinkOk = !final || prev.kind !== "file" || now.kind !== "file" || prev.nlink === now.nlink;
  return prev.kind !== now.kind || prev.target !== now.target || prev.dev !== now.dev || prev.ino !== now.ino || !nlinkOk;
}

/** First route entry that differs. `null` when the object and the route still match. */
function firstDiff(base: ResolutionComp[] | undefined, now: ResolutionComp[]): ResolutionComp | null {
  const n = Math.max(base?.length ?? 0, now.length);
  for (let i = 0; i < n; i++) {
    const prev = base?.[i];
    const cur = now[i];
    if (!prev) return cur ?? null;
    if (!cur) return prev;
    if (compsDiffer(prev, cur, i === n - 1)) return cur;
    if (cur.kind === "absent") return null;
  }
  return null;
}

/** The deepest floor that contains `file`, so a linked worktree's git dir still has a chain. */
function repoFloor(repoRoot: string, dirs: GitDirs, file: string): string {
  const floors = [repoRoot, dirname(dirs.gitDir), dirname(dirs.commonDir)];
  const inside = floors.filter((f) => {
    const rel = relative(f, file);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  });
  inside.sort((a, b) => b.length - a.length);
  return inside[0] ?? dirname(file);
}

/** From the floor exclusive, down to `file`, through links, stopping at the first absence (R30, R49, R55). */
function recordRepoChain(floor: string, file: string): ResolutionComp[] {
  return routeChain(floor, file, false);
}

/** Last path the repository route records. A doubled `rest` ends at the wrong file. */
export function routeEnd(anchor: string, file: string): string | null {
  const chain = routeChain(anchor, file, false);
  return chain.length === 0 ? null : chain[chain.length - 1]!.path;
}

/**
 * R49, repository side, separate from the machine-side check so each can be
 * reverted on its own. Returns the first component whose type, dev, ino,
 * readlink target, or (on the final file) nlink differs from the chain recorded
 * when the window opened. No recorded chain means the path was absent then.
 *
 * LIMIT: the compare and the open are not atomic, the same class of race as
 * R37. This does not close it.
 */
function repositoryResolutionDiff(floor: string, file: string, base: ResolutionComp[] | undefined): ResolutionComp | null {
  return firstDiff(base, recordRepoChain(floor, file));
}

export interface ConfigChange {
  path: string;
  kind: "created" | "deleted" | "modified";
  before: string;
  after: string;
}

export interface ConfigVerdict {
  ok: boolean;
  stage: string;
  /** How many files were compared. A check must prove it looked. */
  examined: number;
  changes: ConfigChange[];
  /** Files the restore could not put back, with why. */
  unrestored: string[];
  /** Directories that could not be listed, as `unlisted: <dir> (<code>)`. An empty list is not "no files". */
  unlisted: string[];
  /**
   * Set when a link replaced an ancestor of a watched path. Nothing beneath it
   * was restored, and the runtime must not spawn git — including rollback.
   */
  ancestorLink: string | null;
  message: string;
}

export const CONFIG_WATCH_LIMIT =
  "LIMIT: repository config and hooks (the common dir's config, hooks/ and info/, config.worktree, and a " +
  "linked worktree's .git file) — not global, XDG or system config (hashed and reported separately, never " +
  "restored), not the index, submodules or the reflog.";

/**
 * A byte snapshot of the repository's config and hooks around one stage.
 *
 * Compare and restore are one call, {@link closeAndRestore}, because the only
 * safe moment to have looked is also the moment to put things back: between
 * the two, nothing may run git.
 */
/**
 * A watched file's content AND mode — a hook is enabled by its executable bit
 * as much as by its bytes. `nlink` and `ino` are for the record and for seeing
 * a hard link. They never select an in-place write (R36): a restore always
 * creates a new file and renames it over the entry.
 */
interface FileState {
  kind: "file" | "symlink";
  bytes: Buffer | null;
  mode: number;
  nlink: number;
  ino: bigint | null;
  dev: bigint | null;
  size: bigint;
  mtimeNs: bigint;
  target: string | null;
  /** Set when dev, ino or nlink disagreed with the baseline, so the bytes were not read (R43). */
  unreadIdentity: boolean;
  /** Set when the bytes were refused (EACCES/EPERM). The record says unreadable, with the facts (R72, R73). */
  readError: string | null;
  /** R88. The errno from that read, kept even when the record's word is plain `unreadable`. */
  readErrno: string | null;
}

const fileState = (id: PathIdentity, bytes: Buffer | null, unreadIdentity: boolean): FileState => ({
  kind: "file",
  bytes,
  mode: id.mode,
  nlink: id.nlink,
  ino: id.ino,
  dev: id.dev,
  size: id.size,
  mtimeNs: id.mtimeNs,
  target: null,
  unreadIdentity,
  readError: null,
  readErrno: null,
});

/**
 * R83. `identify` contained an `lstat` failure as kind `other` plus a code.
 * That state is unreadable, with the code and the identity's facts. It is
 * never absent: a null here is what let a planted hook complete and what
 * made the restore delete a hook it had never read.
 */
const unreadableIdentity = (id: PathIdentity): FileState => ({
  ...fileState(id, null, true),
  readError: `unreadable (${id.code})`,
  readErrno: id.code ?? "UNKNOWN",
});

/**
 * Read a path only when `lstat` says it is a regular file whose dev, ino and
 * nlink match the baseline. A mismatch is an identity change and is not read
 * (R43). A symlink is recorded, not followed. A hard link that appears with no
 * baseline was not there at the window's open, and is not read (R49).
 * `preflight` is that open: a hard link already there is the base, so its
 * bytes are recorded and an unchanged link is not a change (R50).
 */
const readState = (p: string, baseline?: FileState | null, preflight = false): FileState | null => {
  const id = identify(p);
  if (id.kind === "symlink") {
    return { kind: "symlink", bytes: null, mode: id.mode, nlink: id.nlink, ino: id.ino, dev: id.dev, size: id.size, mtimeNs: id.mtimeNs, target: id.target, unreadIdentity: false, readError: null, readErrno: null };
  }
  if (id.kind === "other" && id.code) return unreadableIdentity(id);
  if (id.kind !== "file") return null;
  const hadFile = baseline?.kind === "file";
  const same = hadFile && baseline.dev === id.dev && baseline.ino === id.ino && baseline.nlink === id.nlink;
  if (hadFile && !same) return fileState(id, null, true);
  if (!hadFile && id.nlink !== 1 && !preflight) return fileState(id, null, true);
  try {
    return fileState(id, readFileSync(p), false);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
    const readError = code === "EACCES" || code === "EPERM" ? "unreadable" : `unreadable (${code})`;
    return { ...fileState(id, null, true), readError, readErrno: code };
  }
};

/** A change, including a hard link whose bytes still match (nlink or inode moved). */
const changed = (a: FileState | null, b: FileState | null): boolean => {
  if (a === null || b === null) return a !== b;
  if (a.kind !== b.kind) return true;
  if (a.kind === "symlink" || b.kind === "symlink") return a.target !== b.target;
  if (a.unreadIdentity || b.unreadIdentity || a.readError !== b.readError) {
    return a.kind !== b.kind || a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink || a.size !== b.size || a.mtimeNs !== b.mtimeNs || a.readError !== b.readError;
  }
  if (a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink) return true;
  return a.mode !== b.mode || !a.bytes!.equals(b.bytes!);
};

/**
 * What "put back" is allowed to claim. The new file's inode will not match the
 * snapshot — that is the point of writing a new file — so inode is not required.
 * Type, bytes, mode and nlink are.
 */
const agrees = (snapshot: FileState, now: FileState | null): boolean => {
  if (now === null || snapshot.kind !== now.kind) return false;
  if (snapshot.kind === "symlink") return snapshot.target === now.target;
  if (snapshot.bytes === null || now.bytes === null) return false;
  return now.mode === snapshot.mode && now.nlink === snapshot.nlink && now.bytes.equals(snapshot.bytes);
};

const stateHash = (s: FileState | null): string => {
  if (s === null) return "absent";
  if (s.kind === "symlink") return `type:symlink readlink:${s.target}`;
  // R90. A contained lstat failure has no identity. type file and zeroes would invent one.
  if (s.readError && s.dev === null) return `${s.readError}; type file; no facts: lstat failed`;
  if (s.readError) return `${s.readError}; type file dev ${s.dev} ino ${s.ino} nlink ${s.nlink} size ${s.size} mtimeNs ${s.mtimeNs}`;
  if (s.unreadIdentity) return `identity:dev ${s.dev} ino ${s.ino} nlink ${s.nlink} size ${s.size} mtimeNs ${s.mtimeNs}; not read`;
  return `${hashOf(s.bytes)}/${s.mode.toString(8)}/nlink:${s.nlink}`;
};

class AncestorLinkError extends Error {
  constructor(readonly ancestor: string) {
    super(ancestor);
    this.name = "AncestorLinkError";
  }
}

/**
 * Remove a symlink or directory junction without following it and without a
 * recursive remove. A non-recursive `rmdir` on a win32 junction removes the
 * junction and leaves the target (measured in scratch before this was used).
 * A file symlink is not a directory; `rmdir` fails and `unlink` removes the link.
 */
function removeLink(path: string): void {
  try {
    rmdirSync(path);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTDIR" || code === "ENOENT" || code === "EINVAL" || code === "EPERM") {
      unlinkSync(path);
      return;
    }
    throw err;
  }
}

function assertNoAncestor(repoRoot: string, dirs: GitDirs, target: string): void {
  const hit = linkAboveWatched(repoRoot, dirs, target);
  if (hit) throw new AncestorLinkError(hit);
}

/** Create `dir` one level at a time. `mkdir` recursive is not used: each new level is checked first. */
function ensureRealDir(repoRoot: string, dirs: GitDirs, dir: string): void {
  assertNoAncestor(repoRoot, dirs, dir);
  const id = identify(dir);
  if (id.kind === "dir") return;
  if (id.kind === "symlink") {
    assertNoAncestor(repoRoot, dirs, dir);
    removeLink(dir);
  } else if (id.kind === "file" || id.kind === "other") {
    throw new Error(`${dir} is a ${id.kind}; refusing to replace it with a directory`);
  }
  const parent = dirname(dir);
  if (parent !== dir) ensureRealDir(repoRoot, dirs, parent);
  assertNoAncestor(repoRoot, dirs, dir);
  if (identify(dir).kind === "absent") mkdirSync(dir);
}

/**
 * Write `bytes` as a NEW file in the same directory, then rename it over `path`.
 * No restore path opens an existing watched file for writing (R36). A hard link
 * therefore cannot carry the write: rename replaces the directory entry.
 */
function restoreNewFile(repoRoot: string, dirs: GitDirs, path: string, bytes: Buffer, mode: number): void {
  assertNoAncestor(repoRoot, dirs, path);
  ensureRealDir(repoRoot, dirs, dirname(path));
  const tmp = join(dirname(path), `.a2-restore-${process.pid}-${randomBytes(4).toString("hex")}`);
  assertNoAncestor(repoRoot, dirs, tmp);
  writeFileSync(tmp, bytes, { flag: "wx" });
  try {
    assertNoAncestor(repoRoot, dirs, path);
    const cur = identify(path);
    if (cur.kind === "symlink") {
      assertNoAncestor(repoRoot, dirs, path);
      removeLink(path);
    }
    assertNoAncestor(repoRoot, dirs, path);
    assertNoAncestor(repoRoot, dirs, tmp);
    try {
      renameSync(tmp, path);
    } catch {
      assertNoAncestor(repoRoot, dirs, path);
      const again = identify(path);
      if (again.kind === "symlink") removeLink(path);
      else if (again.kind === "file") unlinkSync(path);
      assertNoAncestor(repoRoot, dirs, tmp);
      renameSync(tmp, path);
    }
    assertNoAncestor(repoRoot, dirs, path);
    const placed = identify(path);
    if (placed.kind !== "file") throw new Error(`restore of ${path} left a ${placed.kind}`);
    chmodSync(path, mode);
    if (identify(path).kind !== "file") throw new Error(`chmod saw ${path} change type`);
  } catch (err) {
    try {
      if (identify(tmp).kind === "file") unlinkSync(tmp);
    } catch {
      // the temp file was already renamed
    }
    throw err;
  }
}

export class ConfigWatch {
  private snapshot: Map<string, FileState | null> | null = null;
  /** R49/R57: resolution from the repo root, exclusive, recorded once at the loop's base. */
  private loopChains: Map<string, ResolutionComp[]> | null = null;
  /** Kind of each watched tree root when the window opened. An absence stays an absence (R45). */
  private treeAtBase = new Map<string, PathIdentity["kind"]>();
  private stage = "";
  readonly dirs: GitDirs;
  /** The work tree. Ancestor walks start here, not at `gitDir`'s parent: a linked worktree's git dir lives elsewhere. */
  readonly repoRoot: string;

  constructor(dirs: GitDirs, repoRoot?: string) {
    this.dirs = dirs;
    this.repoRoot = repoRoot ?? resolve(dirs.gitDir, "..");
  }

  /** Directories listTree could not list on the latest currentFiles call. */
  private unlistedNotes: UnlistedDir[] = [];

  private currentFiles(): string[] {
    const { files, trees } = watchedLocations(this.dirs);
    const all = new Set<string>(files);
    const unlisted: UnlistedDir[] = [];
    for (const t of trees) {
      // A link at the tree root is the change. Do not list what it points at.
      if (identify(t).kind === "symlink") {
        all.add(t);
        continue;
      }
      const listed = listTree(t);
      for (const f of listed.paths) all.add(f);
      unlisted.push(...listed.unlisted);
    }
    this.unlistedNotes = unlisted;
    return [...all].sort();
  }

  /** Directories the latest listing could not read, as `unlisted: <dir> (<code>)`. */
  unlistedAtOpen(): readonly string[] {
    return this.unlistedNotes.map((u) => `unlisted: ${u.dir} (${u.code})`);
  }

  /**
   * R88. Paths whose bytes could not be read when the window opened.
   * A path the window cannot snapshot cannot be restored, so the watch is not established.
   */
  readFailuresAtOpen(): readonly string[] {
    if (this.snapshot === null) return [];
    const out: string[] = [];
    for (const [path, state] of this.snapshot) {
      if (!state?.readError) continue;
      out.push(`unreadable: ${path} (${state.readErrno ?? "UNKNOWN"})`);
    }
    return out;
  }

  /**
   * The loop's base, once (R57). A later call does not re-read. `begin` gates
   * its reads against this and must not be the thing that defines it.
   */
  captureBase(): void {
    if (this.loopChains !== null) return;
    const chains = new Map<string, ResolutionComp[]>();
    for (const f of this.currentFiles()) {
      chains.set(f, recordRepoChain(repoFloor(this.repoRoot, this.dirs, f), f));
    }
    this.loopChains = chains;
  }

  /** Open a window. Bytes are read only when the route still matches the loop's base (R57). */
  begin(stage: string): void {
    this.stage = stage;
    this.treeAtBase = new Map(watchedLocations(this.dirs).trees.map((t) => [t, identify(t).kind]));
    this.captureBase();
    const snap = new Map<string, FileState | null>();
    for (const f of this.currentFiles()) {
      const floor = repoFloor(this.repoRoot, this.dirs, f);
      const diff = repositoryResolutionDiff(floor, f, this.loopChains!.get(f));
      if (diff) {
        const id = identify(f);
        if (id.kind === "symlink") {
          snap.set(f, {
            kind: "symlink",
            bytes: null,
            mode: id.mode,
            nlink: id.nlink,
            ino: id.ino,
            dev: id.dev,
            size: id.size,
            mtimeNs: id.mtimeNs,
            target: id.target,
            unreadIdentity: false,
            readError: null,
            readErrno: null,
          });
        } else if (id.kind === "file") snap.set(f, fileState(id, null, true));
        else if (id.kind === "other" && id.code) snap.set(f, unreadableIdentity(id));
        else snap.set(f, null);
      } else {
        snap.set(f, readState(f, undefined, true));
      }
    }
    this.snapshot = snap;
  }

  /**
   * The after-preflight read (R49). A path whose resolution differs from the
   * chain recorded in {@link begin}, including a path that was absent then, is
   * reported from lstat and not opened.
   */
  private readForCompare(path: string, baseline: FileState | null, chains: Map<string, ResolutionComp[]> | null): FileState | null {
    const diff = repositoryResolutionDiff(repoFloor(this.repoRoot, this.dirs, path), path, chains?.get(path));
    if (diff) {
      const id = identify(path);
      if (id.kind === "symlink") {
        return { kind: "symlink", bytes: null, mode: id.mode, nlink: id.nlink, ino: id.ino, dev: id.dev, size: id.size, mtimeNs: id.mtimeNs, target: id.target, unreadIdentity: false, readError: null, readErrno: null };
      }
      if (id.kind === "other" && id.code) return unreadableIdentity(id);
      if (id.kind !== "file") return null;
      return fileState(id, null, true);
    }
    return readState(path, baseline);
  }

  get open(): boolean {
    return this.snapshot !== null;
  }

  /**
   * Close the window: compare by bytes and put every changed file back. File
   * I/O only — no git call happens anywhere in here, which is what makes it
   * safe to run while a planted `core.fsmonitor` is still in `.git/config`.
   */
  closeAndRestore(): ConfigVerdict {
    const before = this.snapshot;
    if (before === null) {
      throw new Error(
        "ConfigWatch.closeAndRestore() was called with no open window — a verdict with no baseline would " +
          "report 'nothing changed' for a stage nobody watched.",
      );
    }
    this.snapshot = null;
    const chains = this.loopChains;

    const changes: ConfigChange[] = [];
    const unrestored: string[] = [];
    let ancestorLink: string | null = null;

    const blocked = (ancestor: string): void => {
      ancestorLink = ancestor;
    };

    // A junction at a watched tree root is route (a): remove the link, then
    // recreate the directory, and only then restore the files that were inside.
    // Doing the file writes first would see the junction as an ancestor of those
    // files and refuse the recreate. An ancestor ABOVE the tree root (`.git`
    // itself) is route (b): do not touch anything beneath it.
    for (const tree of watchedLocations(this.dirs).trees) {
      if (ancestorLink) break;
      try {
        assertNoAncestor(this.repoRoot, this.dirs, tree);
        const now = identify(tree);
        if (now.kind !== "symlink") continue;
        const baseKind = this.treeAtBase.get(tree) ?? "absent";
        // The root itself is the change, with its type and readlink target (R46).
        // Listing only the files under it as deleted is not that record.
        // A directory that existed is recreated below; an absence is not (R45).
        changes.push({
          path: tree,
          kind: baseKind === "absent" ? "created" : "modified",
          before: baseKind === "absent" ? "absent" : baseKind,
          after: `type:symlink readlink:${now.target}`,
        });
        assertNoAncestor(this.repoRoot, this.dirs, tree);
        removeLink(tree);
        assertNoAncestor(this.repoRoot, this.dirs, tree);
        if (baseKind === "dir" && identify(tree).kind === "absent") mkdirSync(tree);
      } catch (err) {
        if (err instanceof AncestorLinkError) blocked(err.ancestor);
        else unrestored.push(`${tree} (${(err as Error).message})`);
      }
    }

    // After a tree-root junction is gone. Not called when an ancestor link was
    // found: listing would lstat through that link.
    const names = new Set<string>(ancestorLink ? [...before.keys()] : [...before.keys(), ...this.currentFiles()]);

    for (const path of [...names].sort()) {
      if (ancestorLink) break;
      const covered = this.unlistedNotes.find(
        (u) => path === u.dir || path.startsWith(u.dir + sep) || path.startsWith(u.dir + "/"),
      );
      if (covered && before.has(path)) {
        const b = before.get(path)!;
        unrestored.push(
          `${path} (unrestorable: under unlisted ${covered.dir} (${covered.code}); begin ${stateHash(b)})`,
        );
        continue;
      }
      let b: FileState | null = null;
      let a: FileState | null = null;
      try {
        assertNoAncestor(this.repoRoot, this.dirs, path);
        b = before.has(path) ? before.get(path)! : null;
        a = this.readForCompare(path, b, chains);
        if (!changed(b, a)) continue;
        // R90. Absent at the open, and lstat failed at the close: that is not a created file.
        // The record is absent → unobservable (<code>). Nothing is removed, and the note does not say one was.
        if (b === null && a !== null && a.readError && a.dev === null) {
          const code = a.readErrno ?? "UNKNOWN";
          changes.push({
            path,
            kind: "modified",
            before: "absent",
            after: `unobservable (${code}); ${stateHash(a)}`,
          });
          continue;
        }
        changes.push({
          path,
          kind: b === null ? "created" : a === null ? "deleted" : "modified",
          before: stateHash(b),
          after: stateHash(a),
        });
        if (b === null) {
          assertNoAncestor(this.repoRoot, this.dirs, path);
          const cur = identify(path);
          if (cur.kind === "symlink") removeLink(path);
          else if (cur.kind === "file") unlinkSync(path);
          else if (cur.kind !== "absent") {
            unrestored.push(`${path} (a ${cur.kind} was created; not removed recursively)`);
          }
        } else if (b.kind === "file" && b.bytes !== null) {
          restoreNewFile(this.repoRoot, this.dirs, path, b.bytes, b.mode);
        } else if (b.kind === "file") {
          // R80. Was :755 at 6bd97f2. An unread file was described as "not followed", which is the symlink wording.
          unrestored.push(`${path} (snapshot was file; unread, not restored)`);
        } else {
          unrestored.push(`${path} (snapshot was ${b.kind}; not followed)`);
        }
        const now = readState(path);
        if (b !== null && !agrees(b, now)) {
          unrestored.push(`${path} (read back ${stateHash(now)}, expected ${stateHash(b)})`);
        }
        if (b === null && readState(path) !== null && identify(path).kind === "symlink") {
          unrestored.push(`${path} (the link is still there)`);
        }
      } catch (err) {
        if (err instanceof AncestorLinkError) blocked(err.ancestor);
        else unrestored.push(`${path} (${(err as Error).message})`);
      }
    }

    const rel = (p: string): string => {
      const r = relative(this.dirs.commonDir, p);
      return r.startsWith("..") ? p : `<common>/${r.replace(/\\/g, "/")}`;
    };
    const unlisted = this.unlistedNotes.map((u) => `unlisted: ${u.dir} (${u.code})`);
    const scale = `examined ${names.size + unlisted.length} file(s) around the ${this.stage} stage`;
    const ok = (changes.length === 0 && ancestorLink === null && unlisted.length === 0);
    const restored =
      ancestorLink !== null
        ? `No restore was claimed beneath the ancestor link ${ancestorLink}. `
        : unrestored.length === 0 && changes.length > 0
          ? `Every file was put back by bytes before any git call read the repository. `
          : unrestored.length > 0
            ? `${unrestored.length} FILE(S) COULD NOT BE PUT BACK: ${unrestored.join("; ")}. Recover by hand before rerunning. `
            : "";
    const message =
      ancestorLink !== null
        ? `ancestor link at ${ancestorLink} during the ${this.stage} stage. ${restored}${scale}. ${CONFIG_WATCH_LIMIT}`
        : ok
          ? `no repository config or hook changed (${scale}). ${CONFIG_WATCH_LIMIT}`
          : `${changes.length} repository config/hook file(s) changed during the ${this.stage} stage: ` +
            `${changes.map((c) => c.after.startsWith("unobservable (")
              ? `${rel(c.path)} (${c.before} → ${c.after})`
              : `${rel(c.path)} ${c.kind} (${c.before} → ${c.after})`).join("; ")}. ` +
            `A role may not change what git executes: a hook or a program-valued config key runs inside the ` +
            `runtime's own git calls. ` +
            restored +
            `${scale}. ${CONFIG_WATCH_LIMIT}`;
    const named = unlisted.length === 0 ? message : `${message} Unlisted: ${unlisted.join("; ")}.`;
    const readNotes = [...before.values()].flatMap((s) =>
      s?.readError && s.readError !== "unreadable" ? [s.readError] : [],
    );
    const withReads = readNotes.length === 0 ? named : `${named} Read failures: ${readNotes.join("; ")}.`;

    return { ok, stage: this.stage, examined: names.size + unlisted.length, changes, unrestored, unlisted, ancestorLink, message: withReads };
  }
}

/* ------------------------------------------------------------------------- *
 * R8 — the machine-wide half: HASHED AND REPORTED, never refused or restored
 * ------------------------------------------------------------------------- */

export interface MachineConfigPath {
  /** `global`, `xdg` or `system`. */
  scope: "global" | "xdg" | "system";
  path: string;
  /** How the path was arrived at, so a reader can check it. */
  source: string;
}

export interface MachineConfigFinding {
  stage: string;
  scope: string;
  path: string;
  before: string;
  after: string;
  /** From the facts and hashes compared. Never from whether the two texts are equal (R72). */
  changed: boolean;
  /** Set when the path was readable at stage start and could not be observed at close. */
  unobservableCode?: string;
}

/**
 * The files git would read as global and system config for THIS environment.
 *
 * Derived from the environment the runtime was given, not from `os.homedir()`,
 * so a test that points HOME and XDG_CONFIG_HOME at scratch dirs is watching
 * the files it wrote rather than the real ones.
 *
 * The system path is DERIVED, not asked of git: asking would mean a git call
 * that reads the system config, which layer 0 forbids. `GIT_CONFIG_SYSTEM`
 * wins when set; otherwise Git for Windows keeps it at `<install>/etc/gitconfig`
 * three levels above `git --exec-path`, and other platforms at
 * `/etc/gitconfig`. That derivation is a reading of the install layout, and
 * the test that checks it on this machine compares it with git's own
 * `--show-origin`.
 */
export function machineConfigPaths(env: NodeJS.ProcessEnv, execPath: string | null): MachineConfigPath[] {
  const home = env.HOME ?? env.USERPROFILE ?? "";
  const out: MachineConfigPath[] = [];
  if (home !== "") out.push({ scope: "global", path: join(home, ".gitconfig"), source: "HOME (or USERPROFILE)/.gitconfig" });
  const xdgBase = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME !== "" ? env.XDG_CONFIG_HOME : home !== "" ? join(home, ".config") : "";
  if (xdgBase !== "") {
    out.push({
      scope: "xdg",
      path: join(xdgBase, "git", "config"),
      source: env.XDG_CONFIG_HOME ? "XDG_CONFIG_HOME/git/config" : "HOME/.config/git/config (XDG default)",
    });
  }
  if (env.GIT_CONFIG_SYSTEM && env.GIT_CONFIG_SYSTEM !== "") {
    out.push({ scope: "system", path: env.GIT_CONFIG_SYSTEM, source: "GIT_CONFIG_SYSTEM" });
  } else if (process.platform === "win32" && execPath !== null) {
    out.push({ scope: "system", path: resolve(execPath, "..", "..", "..", "etc", "gitconfig"), source: "git --exec-path/../../../etc/gitconfig (Git for Windows layout)" });
  } else {
    out.push({ scope: "system", path: "/etc/gitconfig", source: "/etc/gitconfig (default prefix)" });
  }
  return out;
}

/** `git --exec-path` — reads no config, so it is safe to ask. Null when it cannot be answered. */
export function gitExecPath(repoRoot: string): string | null {
  const r = gitTry(repoRoot, ["--exec-path"]);
  return r.ok && r.stdout !== "" ? r.stdout : null;
}

/**
 * Hash the machine-wide config files before and after each stage. A change is
 * a FINDING, with the path and both hashes. It fails nothing and restores
 * nothing: a role that wrote `~/.gitconfig` has changed git for every session
 * on the machine, and the runtime must not "restore" a person's own file (R8).
 *
 * A link is part of the finding (R39). The baseline is captured once at
 * preflight (R44): a later stage does not re-snapshot, and a link that was not
 * there at base is never read through. A link that was already there at base
 * is read the same way it was read then.
 */
interface MachineSnap {
  /** `lstat` of the path as written. A link planted at this path is a type change. */
  lexicalKind: PathIdentity["kind"];
  lexicalTarget: string | null;
  /** First symlink on the path as written, if any. Not a followed route. */
  viaLink: string | null;
  viaTarget: string | null;
  /** R86. lstat of viaLink, including a link that is only an ancestor. Null when there is no link. */
  viaDev: bigint | null;
  viaIno: bigint | null;
  viaNlink: number;
  viaSize: bigint;
  viaMtimeNs: bigint;
  /** What the OS reaches. Null when the path does not resolve. */
  resolvedPath: string | null;
  kind: PathIdentity["kind"];
  dev: bigint | null;
  ino: bigint | null;
  nlink: number;
  /** R68. An unread machine path is attributed by these, the same facts as R64. */
  size: bigint;
  mtimeNs: bigint;
  /** R80. lstat of the path when the path itself is a symlink. Null otherwise. */
  linkDev: bigint | null;
  linkIno: bigint | null;
  linkNlink: number;
  linkSize: bigint;
  linkMtimeNs: bigint;
  /** R69. The parent directory's realpath at this observation. Compared when a path was absent at base. */
  parentReal: string | null;
  hash: string;
  state: "read" | "not-read" | "unwatched";
  reason: string;
  /** Set only by the catch that saw lstat, open, fstat, or read throw. Absent means the path was observed. */
  errno: string | null;
}

/**
 * R84. Observed at the stage start means the runtime got an answer other than
 * "could not see": a read, an absence with a code, a non-file, a two-name, or
 * a deliberate not-read. An errno, or an unreadable hash, is the environment.
 */
function stageStartObserved(opened: MachineSnap): boolean {
  if (opened.errno !== null) return false;
  if (opened.reason === "unreadable" || opened.hash === "unreadable") return false;
  return true;
}

export class MachineConfigWatch {
  /** Link types and targets at preflight. Never replaced (R44). */
  private loopBase: Map<string, MachineSnap> | null = null;
  /** Content window for the current stage. Closed by compare. */
  private stageStart: Map<string, MachineSnap> | null = null;
  private stage = "";
  readonly paths: readonly MachineConfigPath[];

  constructor(paths: readonly MachineConfigPath[]) {
    this.paths = paths;
  }

  /**
   * HOME (or USERPROFILE) for `.gitconfig`, the XDG base for `git/config`,
   * and the system config's own directory. The anchor itself is part of the
   * chain (R49), so replacing `~/.config` with a junction is visible.
   */
  private anchorOf(file: string): string {
    const spec = this.paths.find((p) => p.path === file);
    if (spec?.scope === "xdg") return dirname(dirname(file));
    return dirname(file);
  }

  /**
   * R60. The OS resolves `p`. A link planted at `p` itself is a type change and
   * is not opened. The same file is opened, `fstat`'d on that handle, and only
   * then read. A different file is not opened.
   *
   * LIMIT: a racing role can still make this open a different file (R37). The
   * handle check stops the read.
   */
  private observe(p: string, gate: MachineSnap | null): MachineSnap {
    const lexical = identify(p);
    let parentReal: string | null = null;
    try {
      parentReal = realpathSync.native(dirname(p));
    } catch {
      parentReal = null;
    }
    let viaLink: string | null = null;
    let viaTarget: string | null = null;
    let viaDev: bigint | null = null;
    let viaIno: bigint | null = null;
    let viaNlink = 0;
    let viaSize = 0n;
    let viaMtimeNs = 0n;
    for (const c of lexicalPaths(this.anchorOf(p), p, true)) {
      const id = identify(c);
      if (id.kind === "symlink" && id.target) {
        viaLink = c;
        viaTarget = id.target;
        viaDev = id.dev;
        viaIno = id.ino;
        viaNlink = id.nlink;
        viaSize = id.size;
        viaMtimeNs = id.mtimeNs;
        break;
      }
      if (id.kind === "absent") break;
    }
    const unresolved = (): MachineSnap => ({
      lexicalKind: lexical.kind,
      lexicalTarget: lexical.target,
      viaLink,
      viaTarget,
      viaDev,
      viaIno,
      viaNlink,
      viaSize,
      viaMtimeNs,
      resolvedPath: null,
      kind: "absent",
      dev: null,
      ino: null,
      nlink: 0,
      size: 0n,
      mtimeNs: 0n,
      linkDev: lexical.kind === "symlink" ? lexical.dev : null,
      linkIno: lexical.kind === "symlink" ? lexical.ino : null,
      linkNlink: lexical.kind === "symlink" ? lexical.nlink : 0,
      linkSize: lexical.kind === "symlink" ? lexical.size : 0n,
      linkMtimeNs: lexical.kind === "symlink" ? lexical.mtimeNs : 0n,
      parentReal,
      hash: "unread",
      state: "unwatched",
      reason: "did not resolve",
      errno: null,
    });
    let resolvedPath: string | null = null;
    let kind: PathIdentity["kind"] = "absent";
    let dev: bigint | null = null;
    let ino: bigint | null = null;
    let nlink = 0;
    let size = 0n;
    let mtimeNs = 0n;
    try {
      resolvedPath = realpathSync.native(p);
      const st = statSync(resolvedPath, { bigint: true });
      kind = st.isFile() ? "file" : st.isDirectory() ? "dir" : "other";
      dev = st.dev;
      ino = st.ino;
      nlink = Number(st.nlink);
      size = st.size;
      mtimeNs = st.mtimeNs;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
      const errno = resolutionUnobservable(code);
      const failed = unresolved();
      failed.reason = errno === null ? `absent (${code})` : `did not resolve: ${code}`;
      failed.errno = errno;
      // R79. A dangling link is not absence. lstat saw the link, so the record keeps those facts.
      if (lexical.kind === "symlink") {
        failed.kind = "symlink";
        failed.dev = lexical.dev;
        failed.ino = lexical.ino;
        failed.nlink = lexical.nlink;
        failed.size = lexical.size;
        failed.mtimeNs = lexical.mtimeNs;
      }
      return failed;
    }
    const note: MachineSnap = {
      lexicalKind: lexical.kind,
      lexicalTarget: lexical.target,
      viaLink,
      viaTarget,
      viaDev,
      viaIno,
      viaNlink,
      viaSize,
      viaMtimeNs,
      resolvedPath,
      kind,
      dev,
      ino,
      nlink,
      size,
      mtimeNs,
      linkDev: lexical.kind === "symlink" ? lexical.dev : null,
      linkIno: lexical.kind === "symlink" ? lexical.ino : null,
      linkNlink: lexical.kind === "symlink" ? lexical.nlink : 0,
      linkSize: lexical.kind === "symlink" ? lexical.size : 0n,
      linkMtimeNs: lexical.kind === "symlink" ? lexical.mtimeNs : 0n,
      parentReal,
      hash: "unread",
      state: "not-read",
      reason: "not read",
      errno: null,
    };
    if (gate && lexical.kind === "symlink" && gate.lexicalKind !== "symlink") {
      return { ...note, reason: "type change" };
    }
    const sameObject = gate !== null && gate.kind === kind && gate.dev === dev && gate.ino === ino;
    const singleName = kind === "file" && nlink === 1 && gate !== null && gate.resolvedPath === resolvedPath;
    // R69. Absent at base may be read once it appears at the same parent and name, as one regular file.
    const appeared =
      gate !== null &&
      gate.resolvedPath === null &&
      kind === "file" &&
      nlink === 1 &&
      lexical.kind === "file" &&
      basename(resolvedPath) === basename(p) &&
      parentReal !== null &&
      parentReal === gate.parentReal;
    const same = gate === null || appeared || (gate.resolvedPath === resolvedPath && (sameObject || singleName));
    if (!same) return { ...note, reason: "different file" };
    if (kind !== "file") return { ...note, reason: "not a file" };
    let fd: number | null = null;
    try {
      fd = openSync(p, "r");
      const st = fstatSync(fd, { bigint: true });
      // R70. The single-name condition is re-checked on the handle, with dev, ino and type, before any byte.
      if (!st.isFile() || st.dev !== dev || st.ino !== ino || Number(st.nlink) !== nlink) {
        const n = Number(st.nlink);
        const sameObject = st.isFile() && st.dev === dev && st.ino === ino;
        const reason = sameObject && n > nlink
          ? "the object gained a name inside open"
          : sameObject && n < nlink
            ? "the object lost a name inside open"
            : "handle is a different file";
        return { ...note, nlink: n, reason };
      }
      return { ...note, hash: hashOf(readFileSync(fd)), state: "read", reason: "read" };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "UNKNOWN";
      const errno = resolutionUnobservable(code);
      if (errno === null) {
        return { ...note, resolvedPath: null, kind: "absent", hash: "unread", state: "unwatched", reason: `absent (${code})`, errno: null };
      }
      return { ...note, hash: "unreadable", reason: "unreadable", errno };
    } finally {
      if (fd !== null) closeSync(fd);
    }
  }

  /**
   * R54, stage attribution, separate from {@link resolutionMismatch}. A change
   * is reported once, against the snapshot taken at the start of this stage.
   * `"bytes"` is a content change the read gate allowed. A component means the
   * lstat identity changed during the stage. A change that is already in the
   * stage-start snapshot is not reported again.
   *
   * LIMIT: a byte change to a path the read gate forbids is invisible here,
   * because those bytes are never read.
   */
  /** Links present at base, named from the path as written, not a route walk (R35, R46). */
  baseNotes(): string[] {
    this.captureBase();
    const notes: string[] = [];
    for (const p of this.paths) {
      const snap = this.loopBase!.get(p.path);
      const willRead = snap?.state === "read";
      for (const c of lexicalPaths(this.anchorOf(p.path), p.path, true)) {
        const id = identify(c);
        if (id.kind !== "symlink" || !id.target) continue;
        notes.push(
          willRead
            ? `machine config ${p.scope} ${c} is a link at base, type ${id.kind}, readlink ${id.target}; read through that target, not refused.`
            : `machine config ${p.scope} ${c} is a link at base, type ${id.kind}, readlink ${id.target}; unwatched: ${snap?.reason ?? "did not resolve"}.`,
        );
      }
      if (snap && snap.state === "unwatched" && snap.lexicalKind !== "symlink") {
        notes.push(`machine config ${p.scope} ${p.path} unwatched: ${snap.reason}.`);
      }
    }
    return notes;
  }

  /**
   * The loop's base, once. A later call does not re-read. `begin` opens a stage
   * window against this base and must not be the thing that defines it (R44).
   */
  captureBase(): void {
    if (this.loopBase !== null) return;
    this.loopBase = new Map(this.paths.map((p) => [p.path, this.observe(p.path, null)]));
  }

  begin(stage: string): void {
    this.stage = stage;
    this.captureBase();
    const start = new Map<string, MachineSnap>();
    for (const p of this.paths) {
      const base = this.loopBase!.get(p.path)!;
      start.set(p.path, this.observe(p.path, base));
    }
    this.stageStart = start;
  }

  compare(): MachineConfigFinding[] {
    const start = this.stageStart;
    if (start === null || this.loopBase === null) {
      throw new Error("MachineConfigWatch.compare() was called with no open window.");
    }
    this.stageStart = null;
    const out: MachineConfigFinding[] = [];
    const sameId = (a: MachineSnap, b: MachineSnap): boolean =>
      a.lexicalKind === b.lexicalKind &&
      a.resolvedPath === b.resolvedPath &&
      a.kind === b.kind &&
      a.dev === b.dev &&
      a.ino === b.ino &&
      a.nlink === b.nlink &&
      a.size === b.size &&
      a.mtimeNs === b.mtimeNs;
    const factText = (s: MachineSnap): string =>
      `type ${s.kind} dev ${s.dev} ino ${s.ino} nlink ${s.nlink} size ${s.size} mtimeNs ${s.mtimeNs}`;
    // R78. A side that was read prints the hash and the facts. "Read or not" includes a read.
    const readText = (s: MachineSnap): string => `${s.hash} ${factText(s)}`;
    const linkSide = (s: MachineSnap): string => {
      if (s.lexicalKind !== "symlink") return factText(s);
      const link =
        `link: type symlink dev ${s.linkDev} ino ${s.linkIno} nlink ${s.linkNlink} size ${s.linkSize} mtimeNs ${s.linkMtimeNs} readlink ${s.lexicalTarget}`;
      if (s.resolvedPath === null) {
        const code = s.reason.startsWith("absent (") ? s.reason.slice("absent (".length, -1) : (s.errno ?? "UNKNOWN");
        return `${link}; does not resolve (${code})`;
      }
      return `${link}; resolves to: ${factText(s)}`;
    };
    // R86. A link above the watched path is labelled the same way as a link at the path.
    const ancestorLinkText = (s: MachineSnap): string =>
      `link: type symlink dev ${s.viaDev} ino ${s.viaIno} nlink ${s.viaNlink} size ${s.viaSize} mtimeNs ${s.viaMtimeNs} readlink ${s.viaTarget}`;
    // R85b. A realpath failure with no lstat prints no zeros. The link itself, or a parent link, prints that lstat.
    const unobservableSide = (s: MachineSnap): string => {
      if (s.lexicalKind === "symlink") return linkSide(s);
      // R91. A parent link prints its lstat, and the file's stat when observe has one.
      if (s.viaLink !== null) {
        return s.dev === null ? ancestorLinkText(s) : `${ancestorLinkText(s)}; resolves to: ${factText(s)}`;
      }
      if (s.dev === null) return "no facts: realpath failed";
      return factText(s);
    };
    // R85. A current side that did not resolve names that failure. Zeroed facts are not a stand-in for the code.
    const currentSide = (s: MachineSnap): string => {
      if (s.lexicalKind === "symlink") return linkSide(s);
      if (s.resolvedPath === null) return s.reason;
      return `${s.resolvedPath} ${factText(s)}`;
    };
    // R79. A loop base that was not there is that phrase, never zeroed facts.
    const baseText = (s: MachineSnap): string =>
      s.resolvedPath === null && s.lexicalKind !== "symlink" ? "absent at loop base" : `${s.resolvedPath ?? "unresolved"} ${factText(s)}`;
    const stageBefore = (opened: MachineSnap): string => {
      if (opened.state === "read") return readText(opened);
      if (opened.reason === "unreadable" || opened.hash === "unreadable") return `unreadable; stage start ${factText(opened)}`;
      if (opened.lexicalKind === "symlink" && opened.resolvedPath === null) return `${opened.reason}; ${factText(opened)}`;
      // R85. A failed lstat's reason is "did not resolve: <code>". Print it. The word absent is not that failure.
      if (opened.resolvedPath === null) return opened.reason;
      return `stage start ${factText(opened)}`;
    };
    const row = (before: string, after: string, changed: boolean, path: string, scope: string): MachineConfigFinding => ({
      stage: this.stage, scope, path, before, after, changed,
    });
    for (const p of this.paths) {
      const base = this.loopBase.get(p.path)!;
      const opened = start.get(p.path)!;
      const end = this.observe(p.path, base);
      if (stageStartObserved(opened) && end.errno !== null) {
        out.push({
          stage: this.stage, scope: p.scope, path: p.path,
          before: stageBefore(opened),
          after: `unobservable (${end.errno}); ${unobservableSide(end)}`,
          changed: true, unobservableCode: end.errno,
        });
        continue;
      }
      if (end.state === "read" && opened.state === "read") {
        out.push(row(readText(opened), readText(end), opened.hash !== end.hash, p.path, p.scope));
        continue;
      }
      if (end.state === "read") {
        // R80. Was :1134 at 6bd97f2. Both-read already continued, so `opened.state !== "read"` was always true.
        out.push(row(stageBefore(opened), readText(end), true, p.path, p.scope));
        continue;
      }
      const linkPlanted = end.viaLink !== null && end.viaLink !== opened.viaLink;
      if (sameId(opened, end) && opened.state !== "read" && !linkPlanted) {
        const unreadable = end.reason === "unreadable" || end.hash === "unreadable";
        const label = unreadable
          ? `unreadable; stage start ${factText(end)}`
          : end.state === "unwatched"
            ? `unwatched: ${end.reason}; not read`
            : `not read: ${end.reason}`;
        const stable = unreadable
          ? label
          : end.lexicalKind === "symlink" || end.resolvedPath !== null
            ? `${label}; ${factText(end)}`
            : label;
        out.push(row(stable, stable, false, p.path, p.scope));
        continue;
      }
      if (linkPlanted) {
        const after =
          base.resolvedPath === null
            ? `absent → symlink${end.viaTarget ? ` target ${end.viaTarget}` : ""}; not read through; ${end.lexicalKind === "symlink" ? currentSide(end) : `${ancestorLinkText(end)}; ${currentSide(end)}`}`
            : `type change: ${end.viaLink} is a symlink${end.viaTarget ? ` target ${end.viaTarget}` : ""}; not read: loop base ${baseText(base)}; current ${end.lexicalKind === "symlink" ? currentSide(end) : `${ancestorLinkText(end)}; ${currentSide(end)}`}`;
        out.push(row(stageBefore(opened), after, true, p.path, p.scope));
        continue;
      }
      const typeChange = end.lexicalKind === "symlink" && base.lexicalKind !== "symlink";
      const after = typeChange
        ? `type change: ${p.path} is a ${end.lexicalKind}; ${linkSide(end)}`
        : end.reason === "the object gained a name inside open" || end.reason === "the object lost a name inside open" || end.reason.startsWith("handle is a different file")
          ? `${end.reason}; not read; ${factText(end)}`
          : end.reason === "unreadable" || end.hash === "unreadable"
            ? `unreadable; current ${factText(end)}`
            : end.resolvedPath === null
              ? end.reason.startsWith("absent (")
                ? end.reason
                : `unwatched: ${end.reason}; not read`
              : `not read: loop base ${baseText(base)}; current ${end.resolvedPath ?? "unresolved"} ${factText(end)}`;
      const before = stageBefore(opened);
      out.push(row(before, after, true, p.path, p.scope));
    }
    return out;
  }
}

/* ------------------------------------------------------------------------- *
 * R21 — the target's own config is DEFAULT-DENY at base
 * ------------------------------------------------------------------------- */

/**
 * The keys a target repository's local config may carry at base. Anything else
 * is refused, by name, before any role runs.
 *
 * Not a list of dangerous keys — there is no complete one, and git adds to it —
 * but a list of SAFE ones, which is the strict side (shared.md). Measured, not
 * recalled: `git init`, `git clone` and `git worktree add` on git
 * 2.54.0.windows.1 write exactly the six `core.*` keys below, plus
 * `remote.origin.url`/`fetch` and `branch.<b>.remote`/`merge` for a clone; the
 * test that runs them re-measures on whatever git runs the suite, so CI's git
 * checks it too.
 *
 * Beyond what init and clone write: the planner's NAMED list of reviewed
 * non-program keys (ruling on Probe's question 1), each with its reason below.
 * Any key that names or selects a program stays refused — `gpg.program`,
 * `tag.gpgSign`, `filter.*`, `core.sshCommand`, `core.fsmonitor`, … — and so
 * does every key nobody has reviewed. `remote.<x>.url` and `.fetch` are the
 * clone's own keys; `receivepack`/`uploadpack` name programs and are not in
 * the list. A loop with a process role refuses any remote separately.
 */
export const SAFE_LOCAL_KEYS: ReadonlyArray<{ key: RegExp; value?: RegExp; why: string }> = [
  { key: /^core\.(repositoryformatversion|filemode|bare|logallrefupdates|symlinks|ignorecase)$/, why: "written by git init (measured)" },
  { key: /^branch\.[^.]+(\..+)?\.(remote|merge)$/, why: "written by git clone (measured)" },
  { key: /^remote\.[^.]+(\..+)?\.(url|fetch)$/, why: "written by git clone (measured)" },
  { key: /^user\.(name|email)$/, why: "identity: a name and an address, never a program" },
  { key: /^commit\.gpgsign$/, why: "every runtime commit passes --no-gpg-sign, so no signing program runs" },
  { key: /^core\.(autocrlf|eol)$/, why: "line-ending handling only" },
  { key: /^extensions\.worktreeconfig$/, why: "a flag enabling config.worktree, which is itself watched and held to this list" },
];

/** Every key in the repository's own config files that {@link SAFE_LOCAL_KEYS} does not allow. */
export function unsafeLocalKeys(repoRoot: string, dirs: GitDirs): { keys: string[]; error: string | null } {
  const files = [join(dirs.commonDir, "config"), join(dirs.gitDir, "config.worktree"), join(dirs.commonDir, "config.worktree")];
  const keys: string[] = [];
  for (const f of [...new Set(files)]) {
    if (!existsSync(f)) continue;
    // `-z`: key and value separated by a newline, entries by NUL, so a value
    // containing "=" or a newline cannot be mis-split.
    const r = gitTry(repoRoot, ["config", "--file", f, "--list", "-z"]);
    if (!r.ok) return { keys, error: `could not read ${f}: ${r.stderr || `exit ${r.status}`}` };
    for (const entry of r.stdout.split("\0")) {
      if (entry === "") continue;
      const nl = entry.indexOf("\n");
      const key = (nl < 0 ? entry : entry.slice(0, nl)).toLowerCase();
      const value = nl < 0 ? "" : entry.slice(nl + 1);
      const rule = SAFE_LOCAL_KEYS.find((s) => s.key.test(key));
      if (rule === undefined || (rule.value !== undefined && !rule.value.test(value.trim()))) {
        keys.push(`${key} (in ${f})`);
      }
    }
  }
  return { keys, error: null };
}

/* ------------------------------------------------------------------------- *
 * R13 — an include present at base is refused
 * ------------------------------------------------------------------------- */

/**
 * Every `include.*` / `includeIf.*` key in the repository's own config files.
 *
 * Read with `git config --file <path>`, one file at a time, so only the
 * repository's files are consulted (layer 0 already keeps the machine's out).
 * `--get-regexp` exits 1 when nothing matches — an ANSWER, not a fault — and
 * any other non-zero exit is returned as an error so the caller refuses rather
 * than reading a failure as "no includes".
 */
export function includesAtBase(repoRoot: string, dirs: GitDirs): { keys: string[]; error: string | null } {
  const files = [join(dirs.commonDir, "config"), join(dirs.gitDir, "config.worktree"), join(dirs.commonDir, "config.worktree")];
  const keys: string[] = [];
  for (const f of [...new Set(files)]) {
    if (!existsSync(f)) continue;
    const r = gitTry(repoRoot, ["config", "--file", f, "--name-only", "--get-regexp", "^include(if)?\\."]);
    if (r.status === 1) continue;
    if (!r.ok) return { keys, error: `could not read ${f}: ${r.stderr || `exit ${r.status}`}` };
    for (const k of r.stdout.split("\n")) if (k.trim() !== "") keys.push(`${k.trim()} (in ${f})`);
  }
  return { keys, error: null };
}
