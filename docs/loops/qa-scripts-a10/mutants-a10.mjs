// QA 108: mutant specs against A10 4b7a5ae (product tree ecf1f62). Each edit is { file, find, replace, count }, and
// `count` is asserted against A10's blob BEFORE archiving (build10.mjs). A block the developer's branch REMOVED is
// neutralised here with a trailing `&& process.pid < 0` on its condition, which is the same program; the developer's own branch diffs are
// in report section 4.
const CW = "src/harness/configwatch.ts";
const RT = "src/harness/runtime.ts";
const e = (file, find, replace, count = 1) => ({ file, find, replace, count });

export const MUTANTS = {
  // ---- the developer's kill set, rebuilt on A10 (handoff tables R77, R78, R79, R80, R82) ----
  "dev-a-identify": [e(CW, `return { kind: "other", mode: 0, nlink: 0, ino: null, dev: null, size: 0n, mtimeNs: 0n, target: null, code: code ?? "UNKNOWN" };`, `throw err;`)],
  "dev-b-listtree": [e(CW, `unlisted.push({ dir: d, code });\n      return;`, `throw err;`)],
  "dev-c-readstate": [e(CW, `    const readError = code === "EACCES" || code === "EPERM" ? "unreadable" : \`unreadable (\${code})\`;\n    return { ...fileState(id, null, true), readError };`, `    if (code !== "EACCES" && code !== "EPERM") throw err;\n    return { ...fileState(id, null, true), readError: "unreadable" };`)],
  "dev-d-stop": [e(RT, `if (configVerdict && (configVerdict.unrestored.length > 0 || configVerdict.unlisted.length > 0)) {`, `if (configVerdict && (configVerdict.unrestored.length > 0 || configVerdict.unlisted.length > 0) && process.pid < 0) {`)],
  "dev-e-unlisted": [e(CW, `const ok = (changes.length === 0 && ancestorLink === null && unlisted.length === 0);`, `const ok = (changes.length === 0 && ancestorLink === null);`)],
  "dev-f-begin": [e(RT, `if (unopened.length > 0) {`, `if (unopened.length > 0 && process.pid < 0) {`)],
  "dev-i-contents": [e(CW, `if (covered && before.has(path)) {`, `if (covered && before.has(path) && process.pid < 0) {`)],
  "dev-ii-machine": [e(RT, `if (unseen.length > 0) {`, `if (unseen.length > 0 && process.pid < 0) {`)],
  "dev-enoent": [e(CW, `  if (code === "ENOENT" || code === "ENOTDIR") return null;\n  return code;`, `  return code;`)],
  "dev-r61-hash": [e(CW, `        out.push(row(stable, stable, false, p.path, p.scope));`, `        const shown = end.lexicalKind === "symlink" && end.resolvedPath === null ? \`e3b0c44298fc1c14 \${stable}\` : stable;\n        out.push(row(shown, shown, false, p.path, p.scope));`)],
  "dev-r78-hash": [e(CW, "const readText = (s: MachineSnap): string => `${s.hash} ${factText(s)}`;", "const readText = (s: MachineSnap): string => s.hash;")],
  "dev-r79-a": [e(CW, `if (opened.reason === "unreadable" || opened.hash === "unreadable") return \`unreadable; stage start \${factText(opened)}\`;`, `if (opened.reason === "unreadable" || opened.hash === "unreadable") return "unreadable";`)],
  "dev-r79-b": [e(CW, `if (opened.resolvedPath === null) return opened.reason.startsWith("absent (") ? opened.reason : "absent";`, `if (opened.resolvedPath === null) return "absent";`)],
  "dev-r79-c": [e(CW, `s.resolvedPath === null && s.lexicalKind !== "symlink" ? "absent at loop base" :`, `s.resolvedPath === null && s.lexicalKind !== "symlink" ? factText(s) :`)],
  "dev-r79-d": [e(CW, `      if (lexical.kind === "symlink") {\n        failed.kind = "symlink";`, `      if (false && lexical.kind === "symlink") {\n        failed.kind = "symlink";`)],
  "dev-r80-equal": [e(RT, `  return f.changed;\n}`, `  return f.before !== f.after;\n}`)],
  "dev-r80-gained": [e(CW, `          ? "the object gained a name inside open"`, `          ? "handle is a different file; the object gained a name inside open"`)],
  "dev-r80-lost": [e(CW, `            ? "the object lost a name inside open"`, `            ? "handle is a different file"`)],
  "dev-r80-label": [e(CW, "not read: loop base ${baseText(base)}", "not read: base ${baseText(base)}", 2)],
  "dev-r80-link": [e(CW, "      if (s.lexicalKind !== \"symlink\") return factText(s);\n      const link =", "      if (s.lexicalKind !== \"symlink\" || true) return factText(s);\n      const link =")],
  "dev-r80-resolved": [e(CW, "      return `${link}; resolves to: ${factText(s)}`;", "      return link;")],

  // ---- this seat's ----
  // QA 104's M-R72-runtime, re-cut at A10's call site: the runtime decides by text equality again.
  "q108-r72-callsite": [e(RT, `          if (!machineChangeReported(f)) continue;`, `          if (f.before === f.after) continue;`)],
  // R61's narrowed detector: a dangling link claimed as read, in the code's own form (hash first) ...
  "q108-r61-headclaim": [e(CW, `        out.push(row(stable, stable, false, p.path, p.scope));`, `        const shown = end.lexicalKind === "symlink" ? \`\${hashOf(Buffer.from(String(end.lexicalTarget)))} \${stable}\` : stable;\n        out.push(row(shown, shown, false, p.path, p.scope));`)],
  // ... and with the hash after the facts, where the narrowed detector no longer looks.
  "q108-r61-tailclaim": [e(CW, `        out.push(row(stable, stable, false, p.path, p.scope));`, `        const shown = end.lexicalKind === "symlink" ? \`\${stable}; read \${hashOf(Buffer.from(String(end.lexicalTarget)))}\` : stable;\n        out.push(row(shown, shown, false, p.path, p.scope));`)],
  // The OLD path: d14a874's chmod before the restore (any kind), and 3771d53's (kind === "file" only), put back on A10.
  "q108-oldpath-chmod-any": [e(CW, `        } else if (b.kind === "file" && b.bytes !== null) {\n          restoreNewFile(`, `        } else if (b.kind === "file" && b.bytes !== null) {\n          try { chmodSync(path, b.mode || 0o644); } catch { /* the write records unrestored */ }\n          restoreNewFile(`)],
  "q108-oldpath-chmod-file": [e(CW, `        } else if (b.kind === "file" && b.bytes !== null) {\n          restoreNewFile(`, `        } else if (b.kind === "file" && b.bytes !== null) {\n          if (identify(path).kind === "file") {\n            try { chmodSync(path, b.mode || 0o644); } catch { /* the write records unrestored */ }\n          }\n          restoreNewFile(`)],
  // R82 as A10 reads it: only a READ stage start can become unobservable. This widens it to any observed stage start;
  // it is a FIX (a known negative for this seat's R82 probes), not a mutant.
  "FIX-q108-r82-observed": [e(CW, `if (opened.state === "read" && end.errno !== null) {`, `if (opened.errno === null && opened.reason !== "unreadable" && opened.hash !== "unreadable" && end.errno !== null) {`)],
  // R77.5 as A10 builds it: identify's contained code is dropped by readState (kind other -> null, read as absent).
  // A FIX that records it, a known negative for Q108-IDENTIFY-NOSEARCH-*.
  "FIX-q108-readstate-other": [e(CW, `  if (id.kind !== "file") return null;\n  const hadFile`, `  if (id.kind === "other" && id.code) return { ...fileState(id, null, true), readError: \`unreadable (\${id.code})\` };\n  if (id.kind !== "file") return null;\n  const hadFile`)],
};

// ---- added after CI run 36200429242: a combined FIX (a known negative), four independent edits, one per defect ----
MUTANTS["FIX-q108-all"] = [
  ...MUTANTS["FIX-q108-readstate-other"],
  ...MUTANTS["FIX-q108-r82-observed"],
  // A contained failure at the stage start is named, never the bare word absent.
  e(CW, `if (opened.resolvedPath === null) return opened.reason.startsWith("absent (") ? opened.reason : "absent";`, `if (opened.resolvedPath === null) return opened.reason.startsWith("absent (") ? opened.reason : opened.errno !== null ? \`unobservable at stage start: \${opened.reason}\` : "absent";`),
  // The unobservable side keeps the facts lstat gave.
  e(CW, "before: readText(opened), after: `unobservable (${end.errno})`, changed: true, unobservableCode: end.errno,", "before: readText(opened), after: `unobservable (${end.errno}); ${end.lexicalKind === \"symlink\" ? linkSide(end) : factText(end)}`, changed: true, unobservableCode: end.errno,"),
];

// ---- added after CI run 36201157136: FIX-q108-all left Q108-IDENTIFY-NOSEARCH-* red, because the null came from
// readForCompare's resolution-diff branch, the second site that turns identify's contained code into "absent". ----
MUTANTS["FIX-q108-all2"] = [
  ...MUTANTS["FIX-q108-all"],
  e(CW, `      if (id.kind !== "file") return null;\n      return fileState(id, null, true);`, `      if (id.kind === "other" && id.code) return { ...fileState(id, null, true), readError: \`unreadable (\${id.code})\` };\n      if (id.kind !== "file") return null;\n      return fileState(id, null, true);`),
];
