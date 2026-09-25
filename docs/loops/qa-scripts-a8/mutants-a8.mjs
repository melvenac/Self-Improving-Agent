// Mutant specs for candidate A8 9e2dd5d (QA record session 99). Carried: every spec in mutants-a7.mjs (which carries
// mutants-a6.mjs and mutants-a5.mjs). build8.mjs asserts each edit's count against A8's blobs; a spec whose text A8
// changed fails loudly as NOT APPLICABLE and is listed, never silently skipped. Below: A8 equivalents of A7 specs
// A8's edits broke, local rebuilds of the developer's four A8 mutants (from their diffs against 270e601, read with
// git diff), and this seat's own: one per R68-R71 protection.
import { MUTANTS as A7 } from "./mutants-a7.mjs";

const CW = "src/harness/configwatch.ts";

const HANDLE8 = "if (!st.isFile() || st.dev !== dev || st.ino !== ino || Number(st.nlink) !== nlink) {";
const TYPE = '    if (gate && lexical.kind === "symlink" && gate.lexicalKind !== "symlink") {\n      return { ...note, reason: "type change" };\n    }\n';
const SINGLE = '    const singleName = kind === "file" && nlink === 1 && gate !== null && gate.resolvedPath === resolvedPath;\n';
const SAME8 = "    const same = gate === null || appeared || (gate.resolvedPath === resolvedPath && (sameObject || singleName));\n";
const AP_NLINK = '      kind === "file" &&\n      nlink === 1 &&\n      lexical.kind === "file" &&\n';
const AP_LEX = '      nlink === 1 &&\n      lexical.kind === "file" &&\n      basename(resolvedPath) === basename(p) &&\n';
const AP_BASE = "      basename(resolvedPath) === basename(p) &&\n      parentReal !== null &&\n";
const AP_PARENT = "      parentReal !== null &&\n      parentReal === gate.parentReal;\n";
const SAMEID_FACTS = "      a.nlink === b.nlink &&\n      a.size === b.size &&\n      a.mtimeNs === b.mtimeNs;\n";
const STATEHASH8 = "  if (s.unreadIdentity) return `identity:dev ${s.dev} ino ${s.ino} nlink ${s.nlink} size ${s.size} mtimeNs ${s.mtimeNs}; not read`;";
const BEFORE_READ = "        const before = stageBefore(opened);\n        if (before !== end.hash || opened.state !== \"read\") {\n";
const BEFORE_LINK = "        const before = stageBefore(opened);\n        out.push({ stage: this.stage, scope: p.scope, path: p.path, before, after });\n        continue;\n";
const BEFORE_REST = "      const before = stageBefore(opened);\n      out.push({ stage: this.stage, scope: p.scope, path: p.path, before, after });\n    }\n";
const UNREADABLE_BEFORE = '      if (opened.reason === "unreadable" || opened.hash === "unreadable") return "unreadable";\n';

const OWN = {
  // ---- A8 equivalents of A7 specs whose text A8 changed ----
  // M-handle-narrow, M-dev-handle (A5's, written when the handle still compared nlink) and M-R29-both (A7's) match
  // A8's text exactly, so they are run under their carried names and not duplicated here.
  // M-R59-read6 with A8's "before" line: the read branch of compare() never taken.
  "M-R59-read8": [{ file: CW, find: '      if (end.state === "read") {\n        const before = stageBefore(opened);', replace: '      if ((end.state as string) === "never") {\n        const before = stageBefore(opened);', count: 1 }],
  "M-R67-realpath8": [
    { file: CW, find: SINGLE, replace: '    const singleName = kind === "file" && nlink === 1 && gate !== null;\n', count: 1 },
    { file: CW, find: SAME8, replace: "    const same = gate === null || appeared || sameObject || singleName;\n", count: 1 },
  ],
  "M-dev8-r67": [
    {
      file: CW,
      find: SAME8,
      replace: "    const same =\n      gate === null ||\n      (gate.resolvedPath !== null && gate.kind === kind && gate.dev === dev && gate.ino === ino && gate.nlink === nlink);\n",
      count: 1,
    },
  ],
  // ---- the developer's four, rebuilt from their diffs against 270e601 ----
  "M-dev8-facts": [{ file: CW, find: SAMEID_FACTS, replace: "      a.nlink === b.nlink;\n", count: 1 }],
  "M-dev8-appear": [{ file: CW, find: SAME8, replace: "    const same = gate === null || (gate.resolvedPath === resolvedPath && (sameObject || singleName));\n", count: 1 }],
  "M-dev8-nlink": [{ file: CW, find: HANDLE8, replace: "if (!st.isFile() || st.dev !== dev || st.ino !== ino) {", count: 1 }],
  "M-dev8-record": [{ file: CW, find: STATEHASH8, replace: "  if (s.unreadIdentity) return `identity:dev ${s.dev} ino ${s.ino} nlink ${s.nlink}; not read`;", count: 1 }],
  // ---- this seat's: one per R69 edge, R70 (independent of the developer's), R71's A6-4/A6-5 ----
  // R69 nlink 1: a hard-linked appearance would be read.
  "M-R69-nlink": [{ file: CW, find: AP_NLINK, replace: '      kind === "file" &&\n      lexical.kind === "file" &&\n', count: 1 }],
  // R69's lexical file condition alone (the symlink at the name). The early type-change return still stands.
  "M-R69-lexical": [{ file: CW, find: AP_LEX, replace: "      nlink === 1 &&\n      basename(resolvedPath) === basename(p) &&\n", count: 1 }],
  // The early type-change return alone. R69's lexical condition still stands.
  "M-R69-typechange": [{ file: CW, find: TYPE, replace: "", count: 1 }],
  // Both symlink guards.
  "M-R69-symlink-both": [
    { file: CW, find: TYPE, replace: "", count: 1 },
    { file: CW, find: AP_LEX, replace: "      nlink === 1 &&\n      basename(resolvedPath) === basename(p) &&\n", count: 1 },
  ],
  // R69 "its name is unchanged".
  "M-R69-basename": [{ file: CW, find: AP_BASE, replace: "      parentReal !== null &&\n", count: 1 }],
  // R69 "its parent directory's realpath equals the parent's realpath at base".
  "M-R69-parent": [{ file: CW, find: AP_PARENT, replace: "      parentReal !== null;\n", count: 1 }],
  // R70, this seat's own: only the nlink comparison on the handle dropped (textually equal to the developer's).
  "M-R70-nlink": [{ file: CW, find: " || Number(st.nlink) !== nlink) {", replace: ") {", count: 1 }],
  // R68 facts, this seat's own: size and mtimeNs out of sameId, one at a time.
  "M-R68-size": [{ file: CW, find: "      a.size === b.size &&\n", replace: "", count: 1 }],
  "M-R68-mtime": [{ file: CW, find: "      a.size === b.size &&\n      a.mtimeNs === b.mtimeNs;\n", replace: "      a.size === b.size;\n", count: 1 }],
  // R71 A6-4/A6-5: "before" from the LOOP base again (A7's three lines), all three sites.
  "M-R71-before": [
    { file: CW, find: BEFORE_READ, replace: "        const before = base.state === \"read\" ? base.hash : \"absent\";\n        if (before !== end.hash || opened.state !== \"read\") {\n", count: 1 },
    { file: CW, find: BEFORE_LINK, replace: "        const before = base.state === \"read\" ? base.hash : base.resolvedPath === null ? \"absent\" : `type:${base.lexicalKind}`;\n        out.push({ stage: this.stage, scope: p.scope, path: p.path, before, after });\n        continue;\n", count: 1 },
    { file: CW, find: BEFORE_REST, replace: "      const before = base.state === \"read\" ? base.hash : base.resolvedPath === null ? \"absent\" : `type:${base.lexicalKind}`;\n      out.push({ stage: this.stage, scope: p.scope, path: p.path, before, after });\n    }\n", count: 1 },
  ],
  // R71 A6-5 alone: the "unreadable" line of stageBefore removed.
  "M-R71-unreadable": [{ file: CW, find: UNREADABLE_BEFORE, replace: "", count: 1 }],
};

export const MUTANTS = { ...A7, ...OWN };
export const OWN_NAMES = Object.keys(OWN);
