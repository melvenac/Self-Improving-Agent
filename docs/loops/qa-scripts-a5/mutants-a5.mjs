// Mutant specs for candidate A5 4c1287f (QA record session 92), carried from mutants-a4.mjs (session 89) where A5's
// text is unchanged; the builder re-asserts every count at A5. A5's own mutants are at the end of MUTANTS.
// --- original header (session 89) ---
// Mutant specs for candidate A4 f9a1aa8. QA seat, record session 89. Scratchpad only.
// Carried from mutants-a3.mjs (session 87) where A4's text is unchanged; the builder re-asserts every count at A4.
// Re-derived where A4 changed the text (M-R46-basenotes, M-R43-repo). A3's M-R43-machine targeted identityChange,
// which A4 removed; its protection is now R49's machine side (M-R49-machine).
// Each edit: { file, find, replace, count }. The builder asserts `find` occurs exactly `count` times before, and that
// the written file equals old.split(find).join(replace), read back from disk. `sha` overrides the archived SHA.
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

const R46root = { file: CW, find: `        changes.push({\n          path: tree,\n          kind: baseKind === "absent" ? "created" : "modified",`, replace: `        if (baseKind === "absent") changes.push({\n          path: tree,\n          kind: baseKind === "absent" ? "created" : "modified",`, count: 1 };
const R45rec = { file: CW, find: `        changes.push({\n          path: tree,\n          kind: baseKind === "absent" ? "created" : "modified",`, replace: `        (baseKind === "absent" ? ([] as ConfigChange[]) : changes).push({\n          path: tree,\n          kind: baseKind === "absent" ? "created" : "modified",`, count: 1 };
const R45mk = { file: CW, find: `        if (baseKind === "dir" && identify(tree).kind === "absent") mkdirSync(tree);`, replace: `        if (identify(tree).kind === "absent") mkdirSync(tree);`, count: 1 };

// ---- A4's own protections (rulings-10 R49-R52, rulings-11 R54), one mutant each. ----
// R49, repository side (9788d32): the resolution compare never reports a difference.
const R49repo = { file: CW, find: `function repositoryResolutionDiff(floor: string, file: string, base: ResolutionComp[] | undefined): ResolutionComp | null {\n`, replace: `function repositoryResolutionDiff(floor: string, file: string, base: ResolutionComp[] | undefined): ResolutionComp | null {\n  if (floor !== "") return null;\n`, count: 1 };
// R49, machine side (9788d32): resolutionMismatch never reports a difference.
const R49machine = { file: CW, find: `  private resolutionMismatch(base: MachineSnap, file: string): ResolutionComp | undefined {\n`, replace: `  private resolutionMismatch(base: MachineSnap, file: string): ResolutionComp | undefined {\n    if (file !== "") return undefined;\n`, count: 1 };
// R54 (2db806a): stage attribution measured against the LOOP base instead of the stage start.
const R54attr = { file: CW, find: `      const why = this.attributionChange(opened, end);\n`, replace: `      const why = this.attributionChange(Date.now() > 0 ? base : opened, end);\n`, count: 1 };
// R50 (27c0e63): a base hard link is not read when the window opens (A3's behaviour at begin).
const R50begin = { file: CW, find: `      snap.set(f, readState(f, undefined, true));\n`, replace: `      snap.set(f, readState(f, undefined, Date.now() < 0));\n`, count: 1 };
// R50's record half: agrees() dereferences null bytes again.
const R50agrees = { file: CW, find: `  if (snapshot.bytes === null || now.bytes === null) return false;\n`, replace: ``, count: 1 };
// R51 (403296d): every .cmd is refused, so a control that goes through the .cmd shim path must turn red.
const R51cmd = { file: PR, find: `    const target = cmdShimTarget(real);\n    if (target === null) {\n`, replace: `    const target = cmdShimTarget(real);\n    if (target === null || real !== "") {\n`, count: 1 };

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

  "M-L2-norestore": [
    { file: CW, find: `        assertNoAncestor(this.repoRoot, this.dirs, tree);\n        removeLink(tree);\n        assertNoAncestor(this.repoRoot, this.dirs, tree);\n        if (baseKind === "dir" && identify(tree).kind === "absent") mkdirSync(tree);\n`, replace: `        void mkdirSync;\n`, count: 1 },
    { file: CW, find: `          const cur = identify(path);\n          if (cur.kind === "symlink") removeLink(path);\n          else if (cur.kind === "file") unlinkSync(path);\n          else if (cur.kind !== "absent") {\n            unrestored.push(\`\${path} (a \${cur.kind} was created; not removed recursively)\`);\n          }\n`, replace: ``, count: 1 },
    { file: CW, find: `          restoreNewFile(this.repoRoot, this.dirs, path, b.bytes, b.mode);\n`, replace: `          void restoreNewFile;\n`, count: 1 },
  ],
  "M-follow-a": [
    { file: CW, find: `  if (id.kind === "symlink") {\n    return { kind: "symlink", bytes: null, mode: id.mode, nlink: id.nlink, ino: id.ino, dev: id.dev, target: id.target, unreadIdentity: false };\n  }\n  if (id.kind !== "file") return null;`, replace: `  if (id.kind === "symlink") {\n    const t = statSync(p, { bigint: true });\n    if (!t.isFile()) return null;\n    return { kind: "file", bytes: readFileSync(p), mode: Number(t.mode & 0o777n), nlink: Number(t.nlink), ino: t.ino, dev: t.dev, target: null, unreadIdentity: false };\n  }\n  if (id.kind !== "file") return null;`, count: 1 },
    { file: CW, find: `  if (identify(dir).kind !== "dir") return [];`, replace: `  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];`, count: 1 },
    { file: CW, find: `      if (entry.isSymbolicLink()) {\n        out.push(p);\n        continue;\n      }\n`, replace: `      if (entry.isSymbolicLink()) {\n        if (statSync(p).isDirectory()) walk(p);\n        else out.push(p);\n        continue;\n      }\n`, count: 1 },
    { file: CW, find: `      if (identify(t).kind === "symlink") {\n        all.add(t);\n        continue;\n      }\n`, replace: ``, count: 1 },
    { file: CW, find: `        if (now.kind !== "symlink") continue;\n`, replace: `        if (now.kind !== "symlink" || tree !== "") continue;\n`, count: 1 },
    { file: CW, find: `    const cur = identify(path);\n    if (cur.kind === "symlink") {\n      assertNoAncestor(repoRoot, dirs, path);\n      removeLink(path);\n    }\n`, replace: `    const cur = identify(path);\n    if (cur.kind === "symlink") {\n      writeFileSync(path, bytes);\n      unlinkSync(tmp);\n      return;\n    }\n`, count: 1 },
    { file: CW, find: `import {\n  chmodSync,\n  existsSync,`, replace: `import {\n  statSync,\n  chmodSync,\n  existsSync,`, count: 1 },
  ],
  "M-follow-b": [
    { file: CW, find: `export function linkAboveWatched(repoRoot: string, dirs: GitDirs, target: string): string | null {\n`, replace: `export function linkAboveWatched(repoRoot: string, dirs: GitDirs, target: string): string | null {\n  if (target !== "") return null;\n`, count: 1 },
  ],
  "M-follow-c": [
    { file: CW, find: `  ensureRealDir(repoRoot, dirs, dirname(path));\n  const tmp = `, replace: `  ensureRealDir(repoRoot, dirs, dirname(path));\n  if (path !== "") {\n    writeFileSync(path, bytes);\n    chmodSync(path, mode);\n    return;\n  }\n  const tmp = `, count: 1 },
  ],

  // A3's protections, re-scored at A4.
  "M-R44": [{ file: CW, find: `    if (this.loopBase !== null) return;\n`, replace: ``, count: 1 }],
  "M-R45": [R45rec, R45mk],
  "M-R45-record": [R45rec],
  "M-R45-mkdir": [R45mk],
  "M-R46-root": [R46root],
  "M-R46-basenotes": [{ file: CW, find: `      for (const c of this.recordChain(p.path)) {\n`, replace: `      for (const c of this.recordChain(p.path).filter((x) => x.path === p.path)) {\n`, count: 1 }],
  // R43's repository half at A4's text: both identity refusals in readState removed.
  "M-R43-repo": [{ file: CW, find: `  if (hadFile && !same) return fileState(id, null, true);\n  if (!hadFile && id.nlink !== 1 && !preflight) return fileState(id, null, true);\n`, replace: `  void same;\n  void preflight;\n`, count: 1 }],

  // A4's own.
  "M-R49-repo": [R49repo],
  "M-R49-machine": [R49machine],
  "M-R49-both": [R49repo, R49machine],
  "M-R49-repo+M-R43-repo": [R49repo, { file: CW, find: `  if (hadFile && !same) return fileState(id, null, true);\n  if (!hadFile && id.nlink !== 1 && !preflight) return fileState(id, null, true);\n`, replace: `  void same;\n  void preflight;\n`, count: 1 }],
  "M-R54": [R54attr],
  "M-R50": [R50begin],
  "M-R50+agrees": [R50begin, R50agrees],
  // v2: the first draft was TS18047 (type-invalid, not counted). A3's own form: non-null assertions.
  "M-R50+agrees-v2": [R50begin, R50agrees, { file: CW, find: `now.bytes.equals(snapshot.bytes);\n`, replace: `now.bytes!.equals(snapshot.bytes!);\n`, count: 1 }],
  "M-R51-refuse-cmd": [R51cmd],
  "M-R51-refuse-cmd@a3": { sha: "50101992e0bd6c79c8f18f0b62f78a459aebee2b", edits: [R51cmd] },

  "M-2.5-refuse-node": [{ file: PR, find: `  if (SCRIPT_EXTS.has(ext)) {\n    return { ok: true,`, replace: `  if (SCRIPT_EXTS.has(ext)) {\n    if (real !== "") return { ok: false, reason: \`qa mutant: refusing \${real}\` };\n    return { ok: true,`, count: 1 }],
  "M-2.5-accept-cmd": [{ file: PR, find: `    if (target === null) {\n      return {`, replace: `    if (target === null) {\n      if (real !== "") return { ok: true, executable: real, preArgs: [], form: "native", resolvedFrom: real, how: "qa mutant" };\n      return {`, count: 1 }],

  // ---- A5's own protections (rulings-12 R55, R57, R59), one mutant each. QA record session 92. ----
  // R55 route (70ec18c): a link in the LAST position is not followed, so the route ends at the link (A4's lexical walk).
  "M-R55-route": [{ file: CW, find: `    if (c.kind === "symlink" && c.target) {\n`, replace: `    if (c.kind === "symlink" && c.target && i < paths.length - 1) {\n`, count: 1 }],
  // R55's allowed read (63a7932): "reached" compared lexically again, as at 70ec18c.
  "M-R55-realpath": [{ file: CW, find: `    const reached = last !== undefined && opensSame(last.path, p);\n`, replace: `    const reached = last !== undefined && resolve(last.path) === resolve(p);\n    void opensSame;\n`, count: 1 }],
  // R57 (70ec18c): begin reads a repository file even when its route differs from the loop base.
  "M-R57": [{ file: CW, find: `      const diff = repositoryResolutionDiff(floor, f, this.loopChains!.get(f));\n      if (diff) {\n`, replace: `      const diff = repositoryResolutionDiff(floor, f, this.loopChains!.get(f));\n      if (diff && f === "") {\n`, count: 1 }],
  // R59 read half (70ec18c): attribution's "not read" text is kept when compare did read.
  "M-R59-read": [{ file: CW, find: `        if (end.hash !== "unread") {\n          finding.after = end.hash;\n        }\n`, replace: ``, count: 1 }],
  // R59 rollBack (70ec18c): "reverted" printed whatever the list holds (A4's text).
  "M-R59-revert": [{ file: RT, find: `        if (bad.length === 0) return refNote;\n        revertPaths(repoRoot, bad);\n`, replace: `        if (bad.length > 0) revertPaths(repoRoot, bad);\n`, count: 1 }],
  // The over-correction: "reverted" never printed, even when the revert ran. Does any test see the positive?
  "M-R59-never": [{ file: RT, find: `        return \`\${refNote} The offending paths were reverted.\`;\n`, replace: `        return refNote;\n`, count: 1 }],
};
