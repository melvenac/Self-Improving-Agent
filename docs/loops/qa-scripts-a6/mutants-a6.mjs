// Mutant specs for candidate A6 dc35b24 (QA record session 94). Carried: every spec in mutants-a5.mjs, rebased onto
// A6 (build6.mjs asserts each edit's count; a spec whose text A6 removed fails loudly and is reported as not
// applicable, never silently skipped). A6's own: the narrow handle mutant, and local rebuilds of the developer's six.
import { MUTANTS as A5 } from "./mutants-a5.mjs";

const CW = "src/harness/configwatch.ts";
const RT = "src/harness/runtime.ts";

const OWN = {
  // Dispatch 3(a). Keep the open and the read; drop ONLY the identity comparison on the opened handle.
  "M-handle-narrow": [
    {
      file: CW,
      find: "if (!st.isFile() || st.dev !== dev || st.ino !== ino || Number(st.nlink) !== nlink) {",
      replace: "if (!st.isFile()) {",
      count: 1,
    },
  ],
  // The developer's six, rebuilt from their diffs against dc35b24 (read with git diff, not from the handoff).
  "M-dev-object": [
    { file: CW, find: '    if (!same) return { ...note, reason: "different file" };\n', replace: "", count: 1 },
  ],
  "M-dev-handle": [
    {
      file: CW,
      find: "if (!st.isFile() || st.dev !== dev || st.ino !== ino || Number(st.nlink) !== nlink) {",
      replace: "let rejectHandle = false;\n      rejectHandle = true;\n      if (rejectHandle || !st.isFile() || st.dev !== dev || st.ino !== ino || Number(st.nlink) !== nlink) {",
      count: 1,
    },
  ],
  "M-dev-rest": [
    {
      file: CW,
      find: "      const restSegs: string[] = [];\n      for (let j = i + 1; j < paths.length; j++) restSegs.push(relative(paths[j - 1]!, paths[j]!));\n",
      replace: "      const restSegs = paths.slice(i + 1).map((p) => relative(paths[i]!, p));\n",
      count: 1,
    },
  ],
  "M-dev-unwatched": [
    {
      file: CW,
      find: "          willRead\n            ? `machine config ${p.scope} ${c} is a link at base, type ${id.kind}, readlink ${id.target}; read through that target, not refused.`\n            : `machine config ${p.scope} ${c} is a link at base, type ${id.kind}, readlink ${id.target}; unwatched: ${snap?.reason ?? \"did not resolve\"}.`,\n",
      replace: "          `machine config ${p.scope} ${c} is a link at base, type ${id.kind}, readlink ${id.target}; read through that target, not refused.`,\n",
      count: 1,
    },
  ],
  "M-dev-identity": [
    {
      file: CW,
      find: "  if (a.unreadIdentity || b.unreadIdentity) {\n    return a.kind !== b.kind || a.dev !== b.dev || a.ino !== b.ino || a.nlink !== b.nlink;\n  }\n",
      replace: "  if (a.unreadIdentity || b.unreadIdentity) return true;\n",
      count: 1,
    },
  ],
  "M-dev-revert": [
    { file: RT, find: "        return `${refNote} The offending paths were reverted.`;", replace: "        return refNote;", count: 1 },
  ],
  // A6 equivalents of carried machine-side specs whose text A6 removed.
  // R46: no base notes at all (A5's M-R46-basenotes).
  "M-R46-basenotes6": [
    {
      file: CW,
      find: "    for (const p of this.paths) {\n      const snap = this.loopBase!.get(p.path);\n",
      replace: "    for (const p of this.paths.slice(0, 0)) {\n      const snap = this.loopBase!.get(p.path);\n",
      count: 1,
    },
  ],
  // R54: attribution compares against the LOOP base instead of the stage's start (A5's M-R54).
  "M-R54-6": [
    {
      file: CW,
      find: "        if (opened.hash !== end.hash) {\n          out.push({ stage: this.stage, scope: p.scope, path: p.path, before: opened.hash, after: end.hash });",
      replace: "        if (base.hash !== end.hash) {\n          out.push({ stage: this.stage, scope: p.scope, path: p.path, before: base.hash, after: end.hash });",
      count: 1,
    },
  ],
  // R59 read half: a path read at the stage's end, not read at its start, is written up as "not read" (A5's M-R59-read).
  "M-R59-read6": [
    {
      file: CW,
      find: '      if (end.state === "read") {\n        const before = base.state === "read" ? base.hash : "absent";',
      replace: '      if ((end.state as string) === "never") {\n        const before = base.state === "read" ? base.hash : "absent";',
      count: 1,
    },
  ],
  // R62 probe: A6's `drifted` clause removed, so only changed(b, a) decides (R62's letter). Names EXISTBETWEEN's cause.
  "M-drifted-off": [
    { file: CW, find: "        if (!changed(b, a) && !drifted) continue;", replace: "        if (!changed(b, a) && !drifted && false) continue;\n        if (!changed(b, a)) continue;", count: 1 },
  ],
  // CA-15 clause 4 (kept by R60): a link planted AT the watched path is a type change, checked by lstat.
  "M-typechange6": [
    {
      file: CW,
      find: '    if (gate && lexical.kind === "symlink" && gate.lexicalKind !== "symlink") {\n      return { ...note, reason: "type change" };\n    }\n',
      replace: "",
      count: 1,
    },
  ],
};

// M-follow-a at A6: A6 already imports statSync, so QA 92's import edit (the last one) would duplicate it (TS2300).
// Every behavioural edit is kept, unchanged.
OWN["M-follow-a6"] = A5["M-follow-a"].filter((e) => !e.find.startsWith("import {"));
if (OWN["M-follow-a6"].length !== A5["M-follow-a"].length - 1) throw new Error("M-follow-a6: expected to drop exactly one edit");

export const MUTANTS = { ...A5, ...OWN };
export const OWN_NAMES = Object.keys(OWN);
