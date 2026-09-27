// QA 149: mutant specs against A12's product 7200e1c. Each edit is { file, find, replace, count }, and `count` is
// asserted against 7200e1c's blob BEFORE archiving (build12.mjs, QA 130's build11.mjs repointed).
// q130-*: QA 130's three R93 mutants, RE-APPLIED to 7200e1c (dispatch check 4). The first two are byte-identical to
// their branch diffs (e2cd6cc, 5761f3a). q130-r85b-via's line no longer exists at 7200e1c: R91 turned it into a
// block, and the re-application deletes that whole parent-link branch, which is what QA 130's mutant deleted.
// q149-*: this seat's, at least one per ruling R90-R92 (dispatch check 8). FIX-q149 is a known negative for check 1.
const CW = "src/harness/configwatch.ts";
const e = (file, find, replace, count = 1) => ({ file, find, replace, count });

export const MUTANTS = {
  // ---- QA 130's, re-applied ----
  "q130-r85-factsdrop": [e(CW, `      if (s.dev === null) return "no facts: realpath failed";\n      return factText(s);`, `      return "no facts: realpath failed";`)],
  "q130-r88-lstat": [e(CW, `      if (!state?.readError) continue;`, `      if (!state?.readError || state.dev === null) continue;`)],
  "q130-r85b-via": [e(CW,
    "      // R91. A parent link prints its lstat, and the file's stat when observe has one.\n      if (s.viaLink !== null) {\n        return s.dev === null ? ancestorLinkText(s) : `${ancestorLinkText(s)}; resolves to: ${factText(s)}`;\n      }\n",
    "")],

  // ---- this seat's ----
  // R90 bullet 1: the invented type comes back beside the no-facts wording.
  "q149-r90-typeword": [e(CW, "  if (s.readError && s.dev === null) return `${s.readError}; no facts: lstat failed`;", "  if (s.readError && s.dev === null) return `${s.readError}; type file; no facts: lstat failed`;")],
  // R90 bullet 2: the absent → unobservable record loses its code.
  "q149-r90-code": [e(CW, `          const code = a.readErrno ?? "UNKNOWN";`, `          const code = "UNKNOWN";`)],
  // R91: when observe has the file's stat, the parent link's lstat is dropped (the mirror of A11-2).
  "q149-r91-linkdrop": [e(CW, "        return s.dev === null ? ancestorLinkText(s) : `${ancestorLinkText(s)}; resolves to: ${factText(s)}`;", "        return s.dev === null ? ancestorLinkText(s) : `resolves to: ${factText(s)}`;")],
  // R92: the absent → ancestor-link branch prints the RESOLVED file's facts where the link's lstat belongs.
  "q149-r92-factlabel": [e(CW, "not read through; ${end.lexicalKind === \"symlink\" ? currentSide(end) : `${ancestorLinkText(end)}; ${currentSide(end)}`}`", "not read through; ${end.lexicalKind === \"symlink\" ? currentSide(end) : `${linkSide(end)}; ${currentSide(end)}`}`")],

  // ---- known negative for check 1: the R90 record also goes to unrestored (heals Q149-C1-*, must redden nothing) ----
  "FIX-q149": [e(CW,
    "            after: `unobservable (${code}); ${stateHash(a)}`,\n          });\n          continue;",
    "            after: `unobservable (${code}); ${stateHash(a)}`,\n          });\n          unrestored.push(`${path} (absent at the open; cannot be lstat'd at close (${code}); not removed)`);\n          continue;")],
};
