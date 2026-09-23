// Mutant specs for candidate A3 5010199. QA seat, record session 87. Scratchpad only.
// Non-link specs are carried from session 85's mutants.mjs (A2) unchanged; the builder re-asserts every count at A3.
// Each edit: { file, find, replace, count }. The builder asserts `find` occurs exactly `count` times before, and that
// the written file equals old.split(find).join(replace), read back from disk.
const RT = "src/harness/runtime.ts";
const GIT = "src/harness/git.ts";
const CW = "src/harness/configwatch.ts";
const CK = "src/harness/checks.ts";
const RW = "src/harness/refwatch.ts";
const PR = "src/harness/process.ts";

const L0 = { file: GIT, find: `    env.GIT_CONFIG_GLOBAL = pin?.globalConfigPath ?? NULL_DEVICE;\n    env.GIT_CONFIG_NOSYSTEM = "1";\n`, replace: ``, count: 1 };
const L1a = { file: GIT, find: `  "-c",\n  \`core.hooksPath=\${NULL_DEVICE}\`,\n  "-c",\n  "core.fsmonitor=false",\n`, replace: ``, count: 1 };
const L1b = { file: GIT, find: `  Object.assign(env, LAYER1_ENV);\n`, replace: ``, count: 1 };
const L2 = { file: RT, find: `const configVerdict = configWatch ? configWatch.closeAndRestore() : null;`, replace: `const configVerdict = configWatch && Date.now() < 0 ? configWatch.closeAndRestore() : null;`, count: 1 };
const L2order = { file: RT, find: `      const configVerdict = configWatch ? configWatch.closeAndRestore() : null;`, replace: `      enforceAllowlist(repoRoot, allow, stageBase);\n      const configVerdict = configWatch ? configWatch.closeAndRestore() : null;`, count: 1 };
const R18 = { file: GIT, find: `  if (pin !== null) {\n    env.GIT_DIR = pin.gitDir;\n    env.GIT_WORK_TREE = pin.workTree;\n  }\n`, replace: ``, count: 1 };

// R46 (a7755ab), the tree-root record: only an ABSENT root is pushed (7df731a's shape), a base directory is not.
const R46root = { file: CW, find: `        changes.push({\n          path: tree,\n          kind: baseKind === "absent" ? "created" : "modified",`, replace: `        if (baseKind === "absent") changes.push({\n          path: tree,\n          kind: baseKind === "absent" ? "created" : "modified",`, count: 1 };
// R45 (7df731a), the record half: an absent root that became a link is not pushed.
const R45rec = { file: CW, find: `        changes.push({\n          path: tree,\n          kind: baseKind === "absent" ? "created" : "modified",`, replace: `        (baseKind === "absent" ? ([] as ConfigChange[]) : changes).push({\n          path: tree,\n          kind: baseKind === "absent" ? "created" : "modified",`, count: 1 };
// R45, the restore half: mkdir whatever the base was (A2's behaviour).
const R45mk = { file: CW, find: `        if (baseKind === "dir" && identify(tree).kind === "absent") mkdirSync(tree);`, replace: `        if (identify(tree).kind === "absent") mkdirSync(tree);`, count: 1 };

export const MUTANTS = {
  "M-typecheck-control": [{ file: RT, find: `/** Which stage the loop is in, for the R14 backstop's record. */`, replace: `const qaTypeProbe: number = "not a number";\n  void qaTypeProbe;\n  /** Which stage the loop is in, for the R14 backstop's record. */`, count: 1 }],
  "M-L0": [L0],
  "M-L1": [L1a, L1b],
  "M-L2": [L2],
  "M-L2-order": [L2order],
  "M-L2-order+M-L1": [L2order, L1a, L1b],
  "M-R18": [R18],
  "M-L2+M-R18": [L2, R18],
  "M-R16": [{ file: CK, find: `  const started = Date.now();\n  const r = spawnSync(spec.command`, replace: `  const started = Date.now();\n  spawnSync("git", ["--version"], { env });\n  const r = spawnSync(spec.command`, count: 1 }],
  "M-R15": [{ file: CK, find: `    cwd,\n    env,\n    encoding: "utf-8",\n    shell: false,\n    timeout: spec.timeoutMs`, replace: `    cwd,\n    env: { ...env, ...process.env },\n    encoding: "utf-8",\n    shell: false,\n    timeout: spec.timeoutMs`, count: 1 }],
  "M-backstop": [{ file: RT, find: `  } catch (err) {\n    const code: FailureCode =\n      err instanceof GitFailed`, replace: `  } catch (err) {\n    if (err) throw err;\n    const code: FailureCode =\n      err instanceof GitFailed`, count: 1 }],
  "M-CAS": [{ file: RW, find: `      setRefTo(this.repoRoot, d.ref, d.before, ZERO_OID);`, replace: `      setRefTo(this.repoRoot, d.ref, d.before, null);`, count: 1 }],
  "M-endstate": [{ file: RT, find: `            resetHardTo(repoRoot, stageBase);`, replace: `            resetHardTo(repoRoot, \`\${stageBase}~1\`);`, count: 1 }],

  // CA-15 (c): the restore removed, detection kept (A3 text of the tree-root block).
  "M-L2-norestore": [
    { file: CW, find: `        assertNoAncestor(this.repoRoot, this.dirs, tree);\n        removeLink(tree);\n        assertNoAncestor(this.repoRoot, this.dirs, tree);\n        if (baseKind === "dir" && identify(tree).kind === "absent") mkdirSync(tree);\n`, replace: `        void mkdirSync;\n`, count: 1 },
    { file: CW, find: `          const cur = identify(path);\n          if (cur.kind === "symlink") removeLink(path);\n          else if (cur.kind === "file") unlinkSync(path);\n          else if (cur.kind !== "absent") {\n            unrestored.push(\`\${path} (a \${cur.kind} was created; not removed recursively)\`);\n          }\n`, replace: ``, count: 1 },
    { file: CW, find: `          restoreNewFile(this.repoRoot, this.dirs, path, b.bytes, b.mode);\n`, replace: `          void restoreNewFile;\n`, count: 1 },
  ],
  // R32 (A2's three, re-derived for A3's text). (a): the path's own type — lstat guard reverted to link-following.
  "M-follow-a": [
    { file: CW, find: `  if (id.kind === "symlink") {\n    return { kind: "symlink", bytes: null, mode: id.mode, nlink: id.nlink, ino: id.ino, dev: id.dev, target: id.target, unreadIdentity: false };\n  }\n  if (id.kind !== "file") return null;`, replace: `  if (id.kind === "symlink") {\n    const t = statSync(p, { bigint: true });\n    if (!t.isFile()) return null;\n    return { kind: "file", bytes: readFileSync(p), mode: Number(t.mode & 0o777n), nlink: Number(t.nlink), ino: t.ino, dev: t.dev, target: null, unreadIdentity: false };\n  }\n  if (id.kind !== "file") return null;`, count: 1 },
    { file: CW, find: `  if (identify(dir).kind !== "dir") return [];`, replace: `  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];`, count: 1 },
    { file: CW, find: `      if (entry.isSymbolicLink()) {\n        out.push(p);\n        continue;\n      }\n`, replace: `      if (entry.isSymbolicLink()) {\n        if (statSync(p).isDirectory()) walk(p);\n        else out.push(p);\n        continue;\n      }\n`, count: 1 },
    { file: CW, find: `      if (identify(t).kind === "symlink") {\n        all.add(t);\n        continue;\n      }\n`, replace: ``, count: 1 },
    { file: CW, find: `        if (now.kind !== "symlink") continue;\n`, replace: `        if (now.kind !== "symlink" || tree !== "") continue;\n`, count: 1 },
    { file: CW, find: `    const cur = identify(path);\n    if (cur.kind === "symlink") {\n      assertNoAncestor(repoRoot, dirs, path);\n      removeLink(path);\n    }\n`, replace: `    const cur = identify(path);\n    if (cur.kind === "symlink") {\n      writeFileSync(path, bytes);\n      unlinkSync(tmp);\n      return;\n    }\n`, count: 1 },
    { file: CW, find: `import {\n  chmodSync,\n  existsSync,`, replace: `import {\n  statSync,\n  chmodSync,\n  existsSync,`, count: 1 },
  ],
  // (b): the ancestor walk.
  "M-follow-b": [
    { file: CW, find: `export function linkAboveWatched(repoRoot: string, dirs: GitDirs, target: string): string | null {\n`, replace: `export function linkAboveWatched(repoRoot: string, dirs: GitDirs, target: string): string | null {\n  if (target !== "") return null;\n`, count: 1 },
  ],
  // (c), R36: the restore writes in place instead of new-file-then-rename.
  "M-follow-c": [
    { file: CW, find: `  ensureRealDir(repoRoot, dirs, dirname(path));\n  const tmp = `, replace: `  ensureRealDir(repoRoot, dirs, dirname(path));\n  if (path !== "") {\n    writeFileSync(path, bytes);\n    chmodSync(path, mode);\n    return;\n  }\n  const tmp = `, count: 1 },
  ],

  // ---- A3's own protections, one mutant each (R32). ----
  // R44 (6293e56): the machine baseline is re-taken at every stage begin.
  "M-R44": [{ file: CW, find: `    if (this.loopBase !== null) return;\n`, replace: ``, count: 1 }],
  // R45 (7df731a): both halves, and each half alone.
  "M-R45": [R45rec, R45mk],
  "M-R45-record": [R45rec],
  "M-R45-mkdir": [R45mk],
  // R46 (a7755ab): the tree-root record, and baseNotes' component walk, each alone.
  "M-R46-root": [R46root],
  "M-R46-basenotes": [{ file: CW, find: `      for (const c of this.chainOf(p.path, true)) {\n`, replace: `      for (const c of this.chainOf(p.path, true).filter((x) => x.path === p.path)) {\n`, count: 1 }],
  // R43 (d333534): identity compared before reading — the repository half and the machine half, each alone.
  "M-R43-repo": [{ file: CW, find: `  if ((hadFile && !same) || (!hadFile && id.nlink !== 1)) return fileState(id, null, true);\n`, replace: `  void same;\n`, count: 1 }],
  "M-R43-machine": [{ file: CW, find: `      if (!prev || prev.kind !== "file" || c.kind !== "file") return false;\n`, replace: `      if (Date.now() > 0) return false;\n      if (!prev || prev.kind !== "file" || c.kind !== "file") return false;\n`, count: 1 }],

  // ---- CA-2.5 (e801849): the planted control and its refusal twin, each able to fail on win32. ----
  "M-2.5-refuse-node": [{ file: PR, find: `  if (SCRIPT_EXTS.has(ext)) {\n    return { ok: true,`, replace: `  if (SCRIPT_EXTS.has(ext)) {\n    if (real !== "") return { ok: false, reason: \`qa mutant: refusing \${real}\` };\n    return { ok: true,`, count: 1 }],
  "M-2.5-accept-cmd": [{ file: PR, find: `    if (target === null) {\n      return {`, replace: `    if (target === null) {\n      if (real !== "") return { ok: true, executable: real, preArgs: [], form: "native", resolvedFrom: real, how: "qa mutant" };\n      return {`, count: 1 }],
};
