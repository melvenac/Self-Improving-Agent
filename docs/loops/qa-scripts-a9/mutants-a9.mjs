// Mutant specs for candidate A9 6bd97f2 (QA record session 104). Carried: every spec in mutants-a8.mjs (which carries
// mutants-a7, -a6 and -a5). build9.mjs asserts each edit's count against A9's blobs; a spec whose text A9 changed fails
// loudly as NOT APPLICABLE and is listed, never silently skipped. Below: A9 equivalents of the carried specs A9's edits
// broke, local rebuilds of the developer's seven A9 mutants (from their diffs against 0423d97, read with git diff), and
// this seat's own: one per R72-R74 protection, plus a FIX build that is a known negative, not a mutant.
import { MUTANTS as A8 } from "./mutants-a8.mjs";

const CW = "src/harness/configwatch.ts";
const RT = "src/harness/runtime.ts";

const READREAD9 = "        out.push(row(opened.hash, end.hash, opened.hash !== end.hash, p.path, p.scope));\n";
const CHANGED_UNREAD9 =
  "    return a.kind !== b.kind || a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink || a.size !== b.size || a.mtimeNs !== b.mtimeNs || a.readError !== b.readError;\n";
const CHANGED_IF9 = "  if (a.unreadIdentity || b.unreadIdentity || a.readError !== b.readError) {\n";
const UNREADABLE_BEFORE9 = '      if (opened.reason === "unreadable" || opened.hash === "unreadable") return "unreadable";\n';
const GAINED = '            ? "handle is a different file; the object gained a name inside open"\n';
const TYPECHANGE_LINK9 =
  '            : `type change: ${end.viaLink} is a symlink${end.viaTarget ? ` target ${end.viaTarget}` : ""}; not read: base ${base.resolvedPath ?? "unresolved"} ${factText(base)}; current ${end.resolvedPath ?? "unresolved"} ${factText(end)}`;\n';
const FINAL9 =
  '              : `not read: base ${base.resolvedPath ?? "unresolved"} ${factText(base)}; current ${end.resolvedPath ?? "unresolved"} ${factText(end)}`;\n';
const SYMLINK_OBJ =
  '    return { kind: "symlink", bytes: null, mode: id.mode, nlink: id.nlink, ino: id.ino, dev: id.dev, size: id.size, mtimeNs: id.mtimeNs, target: id.target, unreadIdentity: false, readError: null };\n  }\n  if (id.kind !== "file") return null;\n  const hadFile';
const READ_TRY =
  '  try {\n    return fileState(id, readFileSync(p), false);\n  } catch (err) {\n    const code = (err as NodeJS.ErrnoException).code;\n    if (code !== "EACCES" && code !== "EPERM") throw err;\n    return { ...fileState(id, null, true), readError: "unreadable" };\n  }\n';

const followA7 = A8["M-follow-a7"];

const OWN = {
  // ---- A9 equivalents of carried specs whose text A9 changed ----
  "M-R54-9": [{ file: CW, find: READREAD9, replace: "        out.push(row(base.hash, end.hash, base.hash !== end.hash, p.path, p.scope));\n", count: 1 }],
  "M-dev-identity9": [{ file: CW, find: CHANGED_IF9 + CHANGED_UNREAD9 + "  }\n", replace: "  if (a.unreadIdentity || b.unreadIdentity || a.readError !== b.readError) return true;\n", count: 1 }],
  "M-dev9-facts7": [{ file: CW, find: CHANGED_UNREAD9, replace: "    return a.kind !== b.kind || a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink || a.readError !== b.readError;\n", count: 1 }],
  "M-dev9-record7": [{ file: CW, find: READREAD9, replace: "        if (opened.hash !== end.hash) out.push(row(opened.hash, end.hash, true, p.path, p.scope));\n", count: 1 }],
  "M-dev9-trade7": [{ file: CW, find: TYPECHANGE_LINK9, replace: '            : `type change: ${end.viaLink} is a symlink${end.viaTarget ? ` target ${end.viaTarget}` : ""}; not read through`;\n', count: 1 }],
  "M-follow-a9": [
    {
      file: CW,
      find: SYMLINK_OBJ,
      replace:
        '    const t = statSync(p, { bigint: true });\n    if (!t.isFile()) return null;\n    return { kind: "file", bytes: readFileSync(p), mode: Number(t.mode & 0o777n), nlink: Number(t.nlink), ino: t.ino, dev: t.dev, size: t.size, mtimeNs: t.mtimeNs, target: null, unreadIdentity: false, readError: null };\n  }\n  if (id.kind !== "file") return null;\n  const hadFile',
      count: 1,
    },
    ...followA7.slice(1),
  ],
  // R71 A6-4/A6-5: "before" from the LOOP base again, at all three sites.
  "M-R71-before9": [
    { file: CW, find: "        const before = stageBefore(opened);\n        if (before !== end.hash", replace: "        const before = stageBefore(base);\n        if (before !== end.hash", count: 1 },
    { file: CW, find: "        out.push(row(stageBefore(opened), after, true, p.path, p.scope));\n", replace: "        out.push(row(stageBefore(base), after, true, p.path, p.scope));\n", count: 1 },
    { file: CW, find: "`unreadable; stage start ${factText(opened)}` : stageBefore(opened);\n", replace: "`unreadable; stage start ${factText(base)}` : stageBefore(base);\n", count: 1 },
  ],
  // ---- the developer's seven, rebuilt from their diffs against 0423d97 ----
  "M-dev9-r72": [{ file: CW, find: "      out.push(row(before, after, true, p.path, p.scope));\n", replace: "      out.push(row(before, after, unreadBoth ? false : true, p.path, p.scope));\n", count: 1 }],
  "M-dev9-r73": [{ file: CW, find: "        const stable = end.resolvedPath === null ? label : `${label}; ${factText(end)}`;\n", replace: "        const stable = label;\n", count: 1 }],
  "M-dev9-r74": [{ file: CW, find: FINAL9, replace: '              : `not read: base ${base.resolvedPath ?? "unresolved"} ${factText(opened)}; current ${end.resolvedPath ?? "unresolved"} ${factText(end)}`;\n', count: 1 }],
  "M-dev9-size": [{ file: CW, find: "      a.size === b.size &&\n", replace: "", count: 1 }],
  "M-dev9-mtime": [{ file: CW, find: "      a.size === b.size &&\n      a.mtimeNs === b.mtimeNs;\n", replace: "      a.size === b.size;\n", count: 1 }],
  "M-dev9-r71": [{ file: CW, find: UNREADABLE_BEFORE9, replace: '      if (opened.reason === "unreadable" || opened.hash === "unreadable") return `stage start ${factText(opened)}`;\n', count: 1 }],
  "M-dev9-handle": [{ file: CW, find: GAINED, replace: '            ? "handle is a different file"\n', count: 1 }],
  // ---- this seat's: one per R72-R74 protection ----
  // R72: the runtime decides from the text again (A8's line).
  "M-R72-runtime": [{ file: RT, find: "          if (!f.changed) continue;\n", replace: "          if (f.before === f.after) continue;\n", count: 1 }],
  // R72 repository side: a refused read throws again (A8's readState).
  "M-R72-repo-catch": [{ file: CW, find: READ_TRY, replace: "  return fileState(id, readFileSync(p), false);\n", count: 1 }],
  // R72 machine side: "after" of an unreadable change back to the bare placeholder.
  "M-R72-after-bare": [{ file: CW, find: "            ? `unreadable; current ${factText(end)}`\n", replace: '            ? "unreadable"\n', count: 1 }],
  // R72 machine side: "before" of an unreadable/unreadable change back to the bare placeholder.
  "M-R72-before-bare": [{ file: CW, find: "      const before = unreadBoth ? `unreadable; stage start ${factText(opened)}` : stageBefore(opened);\n", replace: "      const before = stageBefore(opened);\n", count: 1 }],
  // R73: each named text loses its facts.
  "M-R73-handle": [{ file: CW, find: "          ? `${end.reason}; not read; ${factText(end)}`\n", replace: "          ? `${end.reason}; not read`\n", count: 1 }],
  "M-R73-typechange": [{ file: CW, find: "; not read through; ${factText(end)}`\n        : end.reason.startsWith", replace: "; not read through`\n        : end.reason.startsWith", count: 1 }],
  "M-R73-absentlink": [{ file: CW, find: "; not read through; ${factText(end)}`\n            : `type change: ${end.viaLink}", replace: "; not read through`\n            : `type change: ${end.viaLink}", count: 1 }],
  "M-R73-code": [{ file: CW, find: "      return { ...unresolved(), reason: `did not resolve: ${code}` };\n", replace: "      return unresolved();\n", count: 1 }],
  // R74: the labels and type.
  "M-R74-stagestart": [{ file: CW, find: "      return `stage start ${factText(opened)}`;\n", replace: "      return factText(opened);\n", count: 1 }],
  "M-R74-type": [{ file: CW, find: "      `type ${s.kind} dev ${s.dev}", replace: "      `dev ${s.dev}", count: 1 }],
  "M-R74-gained-nlink": [{ file: CW, find: "          nlink: Number(st.nlink),\n", replace: "", count: 1 }],
  // ---- FIX build: a known negative for A9-1 (not a mutant; a "kill" here is the fix's effect) ----
  "FIX-before-facts": [{ file: CW, find: UNREADABLE_BEFORE9, replace: '      if (opened.reason === "unreadable" || opened.hash === "unreadable") return `unreadable; stage start ${factText(opened)}`;\n', count: 1 }],
};

export const MUTANTS = { ...A8, ...OWN };
export const OWN_NAMES = Object.keys(OWN);
