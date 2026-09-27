// QA 130: mutant specs against A11 bbf9d07 (product tree ef2a8a7). Each edit is { file, find, replace, count }, and
// `count` is asserted against A11's blob BEFORE archiving (build11.mjs). The developer's mutants are REBUILT here on
// A11 from their branch diffs (each branch sits on the commit of its own ruling); this seat's are `q130-*`.
// FIX-* builds are known negatives (a correct fix for a suspected defect), not mutants.
const CW = "src/harness/configwatch.ts";
const RT = "src/harness/runtime.ts";
const e = (file, find, replace, count = 1) => ({ file, find, replace, count });

const OBSERVED_BODY = `  if (opened.errno !== null) return false;\n  if (opened.reason === "unreadable" || opened.hash === "unreadable") return false;\n  return true;`;

export const MUTANTS = {
  // ---- the developer's, rebuilt on A11 (handoff "Per ruling") ----
  "dev-readstate": [e(CW, `  if (id.kind === "other" && id.code) return unreadableIdentity(id);\n  if (id.kind !== "file") return null;\n  const hadFile`, `  if (id.kind !== "file") return null;\n  const hadFile`)],
  "dev-begin": [e(CW, `        else if (id.kind === "other" && id.code) snap.set(f, unreadableIdentity(id));\n`, ``)],
  "dev-readforcompare": [e(CW, `      if (id.kind === "other" && id.code) return unreadableIdentity(id);\n      if (id.kind !== "file") return null;\n      return fileState(id, null, true);`, `      if (id.kind !== "file") return null;\n      return fileState(id, null, true);`)],
  "dev-r84-read": [e(CW, OBSERVED_BODY, `  return opened.state === "read";`)],
  "dev-r84-env": [e(CW, OBSERVED_BODY, `  return typeof opened.state === "string";`)],
  "dev-r85-absent": [e(CW, `      if (opened.resolvedPath === null) return opened.reason;\n      return \`stage start`, `      if (opened.resolvedPath === null) return opened.reason.startsWith("absent (") ? opened.reason : "absent";\n      return \`stage start`)],
  "dev-r85-ancestor": [e(CW, `      if (s.resolvedPath === null) return s.reason;`, `      if (s.resolvedPath === null) return factText(s);`)],
  "dev-r85-facts": [e(CW, "after: `unobservable (${end.errno}); ${unobservableSide(end)}`,", "after: `unobservable (${end.errno})`,")],
  "dev-r85b-zeros": [e(CW, `      if (s.dev === null) return "no facts: realpath failed";`, `      if (s.dev === null) return factText(s);`)],
  "dev-r86-link": [e(CW, "current ${end.lexicalKind === \"symlink\" ? currentSide(end) : `${ancestorLinkText(end)}; ${currentSide(end)}`}`;", "current ${currentSide(end)}`;")],
  // QA 108's q108-r72-callsite, which the developer's mut-r87-callsite is (byte for byte the same line).
  "q108-r72-callsite": [e(RT, `          if (!machineChangeReported(f)) continue;`, `          if (f.before === f.after) continue;`)],
  "dev-r88-open": [e(RT, `      const unopened = [\n        ...(configWatch?.unlistedAtOpen() ?? []),\n        ...(configWatch?.readFailuresAtOpen() ?? []),\n      ];`, `      const unopened = configWatch?.unlistedAtOpen() ?? [];`)],

  // ---- this seat's, at least one per ruling ----
  // R83: begin's consumer only (the read at the window's open converts an lstat failure to null; close still contains it).
  "q130-r83-beginonly": [e(CW, `  if (id.kind === "other" && id.code) return unreadableIdentity(id);\n  if (id.kind !== "file") return null;\n  const hadFile`, `  if (id.kind === "other" && id.code && !preflight) return unreadableIdentity(id);\n  if (id.kind !== "file") return null;\n  const hadFile`)],
  // R84: an absence observed at the stage start (turn 107) is treated as not observed; not-a-file and two-name still are.
  "q130-r84-absence": [e(CW, OBSERVED_BODY, `  if (opened.state === "unwatched") return false;\n${OBSERVED_BODY}`)],
  // R85: an unobservable side whose stat succeeded prints no facts (A10-4's shape: a read file made 000).
  "q130-r85-factsdrop": [e(CW, `      if (s.dev === null) return "no facts: realpath failed";\n      return factText(s);`, `      return "no facts: realpath failed";`)],
  // R85: a link at the path loses its label and link wording in the unobservable side (ELOOP, a target dir 000).
  "q130-r85-linkside": [e(CW, `      if (s.lexicalKind === "symlink") return linkSide(s);\n      if (s.viaLink !== null) return ancestorLinkText(s);`, `      if (s.viaLink !== null) return ancestorLinkText(s);`)],
  // R85b: a parent link that was lstat'd is not printed when realpath fails (the handoff: no separate row).
  "q130-r85b-via": [e(CW, `      if (s.viaLink !== null) return ancestorLinkText(s);\n      if (s.dev === null) return "no facts: realpath failed";`, `      if (s.dev === null) return "no facts: realpath failed";`)],
  // R86: the ancestor link label carries the RESOLVED file's dev/ino, not the link's.
  "q130-r86-label": [e(CW, "`link: type symlink dev ${s.viaDev} ino ${s.viaIno} nlink ${s.viaNlink}", "`link: type symlink dev ${s.dev} ino ${s.ino} nlink ${s.viaNlink}")],
  // R87: the call site reports a finding when EITHER the comparison says changed or the texts differ.
  "q130-r87-either": [e(RT, `          if (!machineChangeReported(f)) continue;`, `          if (!machineChangeReported(f) && f.before === f.after) continue;`)],
  // R88: an lstat failure at the open (no facts) is not refused; only a failed read of a file whose lstat succeeded is.
  "q130-r88-lstat": [e(CW, `      if (!state?.readError) continue;`, `      if (!state?.readError || state.dev === null) continue;`)],

  // ---- known negatives: this seat's fixes for the suspected defects (heal, and must redden nothing) ----
  "FIX-q130": [
    // R85: the resolved file's facts beside the parent link when stat succeeded.
    e(CW, `      if (s.viaLink !== null) return ancestorLinkText(s);\n      if (s.dev === null) return "no facts: realpath failed";`, `      if (s.viaLink !== null) return s.dev === null ? ancestorLinkText(s) : \`\${ancestorLinkText(s)}; resolves to: \${factText(s)}\`;\n      if (s.dev === null) return "no facts: realpath failed";`),
    // R86/R79: the absent -> ancestor link text carries the link's lstat.
    e(CW, "? `absent → symlink${end.viaTarget ? ` target ${end.viaTarget}` : \"\"}; not read through; ${currentSide(end)}`", "? `absent → symlink${end.viaTarget ? ` target ${end.viaTarget}` : \"\"}; not read through; ${end.lexicalKind === \"symlink\" ? currentSide(end) : `${ancestorLinkText(end)}; ${currentSide(end)}`}`"),
    // R85 (repository side): a failed lstat prints its code and no invented facts.
    e(CW, "  if (s.readError) return `${s.readError}; type file dev ${s.dev} ino ${s.ino} nlink ${s.nlink} size ${s.size} mtimeNs ${s.mtimeNs}`;", "  if (s.readError && s.dev === null) return `${s.readError}; no facts: lstat failed`;\n  if (s.readError) return `${s.readError}; type file dev ${s.dev} ino ${s.ino} nlink ${s.nlink} size ${s.size} mtimeNs ${s.mtimeNs}`;"),
  ],
};
