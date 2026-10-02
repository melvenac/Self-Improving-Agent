// QA 246's own mutants: at least one per P0a / P0b / P0c / P0d clause, each a DIFFERENT edit from Forge's 34 r7 mutants.
// Same shape as Forge's specs (file, find, replace); run by run-mutants.mjs after Forge's 139 in the same pass.
export const QA_MUTANTS = [
  // P0a: the character check only looks below U+2000, so U+2000..U+200A, en/em dash, curly quotes, U+3000 pass
  { name: "qa-p0a-below-u2000-only", clause: "P0a: every non-ASCII character, including U+2000 and above", file: "parse-gate.ts",
    find: "if (cp > 0x7e || (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d)) {",
    replace: "if ((cp > 0x7e && cp < 0x2000) || (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d)) {" },
  // P0a: the Bash check skips the LAST character of a word (an off-by-one an implementation could make)
  { name: "qa-p0a-bash-only-first-of-pair", clause: "P0a: Bash non-ASCII outside quotes, anywhere in a word", file: "parse-gate.ts",
    find: "if (na && (c.charCodeAt(0) > 0x7e || c.charCodeAt(0) < 0x20)) return na;",
    replace: "if (na && i === start && (c.charCodeAt(0) > 0x7e || c.charCodeAt(0) < 0x20)) return na;" },
  // P0b: the validator is bypassed for ONE source: an append redirect (>>), Bash and PowerShell
  { name: "qa-p0b-skip-append-redirect", clause: "P0b: one validator for every source (>> only)", file: "bash.ts",
    find: "for (const t of ex.targets) {\n    const v = validateTarget(",
    replace: "for (const t of ex.targets) {\n    if (t.via === \"redirect >>\") continue;\n    const v = validateTarget(" },
  // P0b: the validator is bypassed for ONE source: a move's SOURCE (mv deletes it)
  { name: "qa-p0b-skip-mv-source", clause: "P0b: one validator for every source (mv source only)", file: "bash.ts",
    find: "for (const t of ex.targets) {\n    const v = validateTarget(",
    replace: "for (const t of ex.targets) {\n    if (t.via === \"mv source\") continue;\n    const v = validateTarget(" },
  // P0c: the allow-list is applied at the top level only, not inside sh -c / bash -c
  { name: "qa-p0c-allowlist-top-level-only", clause: "P0c: the allow-list inside sh -c strings too", file: "parse-gate.ts",
    find: "if (!Object.prototype.hasOwnProperty.call(BASH_ALLOWED_COMMANDS, name)) return refuse(",
    replace: "if (depth === 0 && !Object.prototype.hasOwnProperty.call(BASH_ALLOWED_COMMANDS, name)) return refuse(" },
  // P0c: node refuses only long options before the script, so -e / -p / -r get through
  { name: "qa-p0c-node-long-options-only", clause: "P0c: node -e / -p / -r in every spelling", file: "bash-commands.ts",
    find: 'if (first.startsWith("-")) {', replace: 'if (first.startsWith("--")) {' },
  // P0d: GH_HOST is dropped from the environment refusal
  { name: "qa-p0d-gh-host-dropped", clause: "P0d: GH_HOST in the environment", file: "parse-gate.ts",
    find: "GH_REPO|GH_HOST|GH_CONFIG_DIR", replace: "GH_REPO|GH_CONFIG_DIR" },
  // P0d: GIT_CONFIG_* only when written in upper case (Windows environment names are case-insensitive)
  { name: "qa-p0d-case-sensitive", clause: "P0d: GIT_* in any case", file: "parse-gate.ts",
    find: "GITHUB_TOKEN)=/i;", replace: "GITHUB_TOKEN)=/;" },
];
