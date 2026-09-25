// Mutant specs for candidate A7 d223d1d (QA record session 96). Carried: every spec in mutants-a6.mjs (which carries
// mutants-a5.mjs). build7.mjs asserts each edit's count against A7's blobs; a spec whose text A7 changed fails loudly
// as NOT APPLICABLE and is listed, never silently skipped. Below: A7 equivalents of the six A6 specs A7's edits broke,
// local rebuilds of the developer's eight A7 mutants (from their diffs against d223d1d, read with git diff), and this
// seat's own.
import { MUTANTS as A6 } from "./mutants-a6.mjs";

const CW = "src/harness/configwatch.ts";

const HANDLE = "if (!st.isFile() || st.dev !== dev || st.ino !== ino) {";
const TYPE = '    if (gate && lexical.kind === "symlink" && gate.lexicalKind !== "symlink") {\n      return { ...note, reason: "type change" };\n    }\n';
const DIFF = '    if (!same) return { ...note, reason: "different file" };\n';
const SINGLE = '    const singleName = kind === "file" && nlink === 1 && gate !== null && gate.resolvedPath === resolvedPath;\n';
const SAME = "    const same = gate === null || (gate.resolvedPath === resolvedPath && (sameObject || singleName));\n";
const CHANGED_UNREAD = "    return a.kind !== b.kind || a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink || a.size !== b.size || a.mtimeNs !== b.mtimeNs;\n";
const READREAD = "        out.push({ stage: this.stage, scope: p.scope, path: p.path, before: opened.hash, after: end.hash });\n        continue;\n";

const OWN = {
  // ---- A7 equivalents of A6 specs whose text A7 changed ----
  // = the developer's mut-handle: keep the open and the read, drop only the identity comparison on the handle.
  "M-handle-narrow7": [{ file: CW, find: HANDLE, replace: "if (!st.isFile()) {", count: 1 }],
  "M-dev-handle7": [{ file: CW, find: HANDLE, replace: "let rejectHandle = false;\n      rejectHandle = true;\n      if (rejectHandle || !st.isFile() || st.dev !== dev || st.ino !== ino) {", count: 1 }],
  // R62/R64: an unread side is always a change.
  "M-dev-identity7": [{ file: CW, find: "  if (a.unreadIdentity || b.unreadIdentity) {\n" + CHANGED_UNREAD + "  }\n", replace: "  if (a.unreadIdentity || b.unreadIdentity) return true;\n", count: 1 }],
  // R54: read/read attribution against the LOOP base, not the stage's start.
  "M-R54-7": [{ file: CW, find: READREAD, replace: "        out.push({ stage: this.stage, scope: p.scope, path: p.path, before: base.hash, after: end.hash });\n        continue;\n", count: 1 }],
  // M-follow-a6 with its first edit rebased: A7's symlink FileState carries size and mtimeNs.
  "M-follow-a7": [
    {
      file: CW,
      find: '  if (id.kind === "symlink") {\n    return { kind: "symlink", bytes: null, mode: id.mode, nlink: id.nlink, ino: id.ino, dev: id.dev, size: id.size, mtimeNs: id.mtimeNs, target: id.target, unreadIdentity: false };\n  }\n  if (id.kind !== "file") return null;',
      replace: '  if (id.kind === "symlink") {\n    const t = statSync(p, { bigint: true });\n    if (!t.isFile()) return null;\n    return { kind: "file", bytes: readFileSync(p), mode: Number(t.mode & 0o777n), nlink: Number(t.nlink), ino: t.ino, dev: t.dev, size: t.size, mtimeNs: t.mtimeNs, target: null, unreadIdentity: false };\n  }\n  if (id.kind !== "file") return null;',
      count: 1,
    },
    ...A6["M-follow-a6"].slice(1),
  ],
  // ---- the developer's eight, rebuilt locally from their diffs against d223d1d ----
  "M-dev7-drifted": [
    {
      file: CW,
      find: "        if (!changed(b, a)) continue;\n",
      replace: "        const baseChain = chains?.get(path);\n        const baseLast = baseChain?.[baseChain.length - 1];\n        const drifted =\n          a?.unreadIdentity === true &&\n          baseLast?.kind === \"file\" &&\n          (baseLast.dev !== a.dev || baseLast.ino !== a.ino || baseLast.nlink !== a.nlink);\n        if (!changed(b, a) && !drifted) continue;\n",
      count: 1,
    },
  ],
  "M-dev7-facts": [{ file: CW, find: CHANGED_UNREAD, replace: "    return a.kind !== b.kind || a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink;\n", count: 1 }],
  "M-dev7-record": [{ file: CW, find: READREAD, replace: "        if (opened.hash !== end.hash) {\n          out.push({ stage: this.stage, scope: p.scope, path: p.path, before: opened.hash, after: end.hash });\n        }\n        continue;\n", count: 1 }],
  "M-dev7-r50": [
    {
      file: CW,
      find: "  if (a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink) return true;\n",
      replace: "  if (a.kind === \"file\" && a.nlink > 1 && b.nlink > 1 && a.ino === b.ino) return false;\n  if (a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink) return true;\n",
      count: 1,
    },
  ],
  "M-dev7-r67": [
    {
      file: CW,
      find: "    const sameObject = gate !== null && gate.kind === kind && gate.dev === dev && gate.ino === ino;\n" + SINGLE + SAME,
      replace: "    const same =\n      gate === null ||\n      (gate.resolvedPath !== null && gate.kind === kind && gate.dev === dev && gate.ino === ino && gate.nlink === nlink);\n",
      count: 1,
    },
  ],
  "M-dev7-trade": [
    {
      file: CW,
      find: ': `type change: ${end.viaLink} is a symlink${end.viaTarget ? ` target ${end.viaTarget}` : ""}; not read: base ${base.resolvedPath ?? "unresolved"} dev ${base.dev} ino ${base.ino} nlink ${base.nlink}; current ${end.resolvedPath ?? "unresolved"} dev ${end.dev} ino ${end.ino} nlink ${end.nlink}`;',
      replace: ': `type change: ${end.viaLink} is a symlink${end.viaTarget ? ` target ${end.viaTarget}` : ""}; not read through`;',
      count: 1,
    },
  ],
  "M-dev7-type": [
    { file: CW, find: TYPE, replace: "", count: 1 },
    { file: CW, find: SAME, replace: "    const same = gate === null || sameObject || (gate.resolvedPath === resolvedPath && singleName);\n", count: 1 },
    {
      file: CW,
      find: '      const typeChange = end.lexicalKind === "symlink" && base.lexicalKind !== "symlink";\n',
      replace: '      const typeChange = false && end.lexicalKind === "symlink" && base.lexicalKind !== "symlink";\n',
      count: 1,
    },
  ],
  // ---- this seat's (dispatch 2(a), 2(b), and R67 condition 1) ----
  "M-R29-both": [{ file: CW, find: TYPE, replace: "", count: 1 }, { file: CW, find: DIFF, replace: "", count: 1 }],
  "M-R67-realpath": [
    { file: CW, find: SINGLE, replace: '    const singleName = kind === "file" && nlink === 1 && gate !== null;\n', count: 1 },
    { file: CW, find: SAME, replace: "    const same = gate === null || sameObject || singleName;\n", count: 1 },
  ],
  "M-R67-nlink": [{ file: CW, find: SINGLE, replace: '    const singleName = kind === "file" && gate !== null && gate.resolvedPath === resolvedPath;\n', count: 1 }],
};

export const MUTANTS = { ...A6, ...OWN };
export const OWN_NAMES = Object.keys(OWN);
