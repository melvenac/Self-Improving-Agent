// T-194 r7 mutant specs: r6's 105 (re-based where r7 moved the code they edit) plus one or more per P0a/P0b/P0c/P0d clause and one for D-C.
// Each is ONE edit to the PRODUCT (open-brain/src/planner-hook). make-diffs.mjs writes <name>.diff against a clean tree; run-mutants.mjs applies
// each diff alone and runs the planner-hook tests, which must go red. Mutants are local (D-061, T-207): never committed into the candidate.
import { MUTANTS as R6 } from "../../t194-r6/mutants/specs.mjs";

// r6 mutants whose anchor text r7 changed (the clause is the same; the line that carries it moved or was replaced).
const REBASED = {
  // r6 refused inline code with a table of interpreter flags; r7 replaces the table with the allow-list and the node shape rule
  "p0-inline-code-allowed": { file: "bash-commands.ts", find: 'if (first.startsWith("-")) {', replace: "if (false) {" },
  "p0-unlisted-wrapper-allowed": { file: "parse-gate.ts", find: "if (REFUSED_COMMANDS.has(name)) return refuse(", replace: "if (false) return refuse(" },
  "p0-shell-stdin-allowed": { file: "parse-gate.ts", find: "if (!ok) return refuse(", replace: "if (false) return refuse(" },
  // the file tools' literal-path rule is now the validator's (one function for every source)
  "r5-p1-filetool-literal-off": { file: "paths.ts", find: "const nl = (expands ? ", replace: "const nl = !shell ? null : (expands ? " },
  // the PowerShell provider-path and drive-relative checks moved from the gate's token loop into the shared shape function
  "p0-ps-provider-path-allowed": { file: "paths.ts", find: 'if (text.includes("::")) return "provider path (::)";', replace: 'if (text.startsWith("::")) return "provider path (::)";' },
  "p0-ps-drive-relative-allowed": { file: "paths.ts", find: "if (/^[A-Za-z]:(?![\\\\/])./.test(text))", replace: "if (/^[a-z]:(?![\\\\/])./.test(text))" },
  "r6-limit-claims-caught-item": { file: "bash.ts", find: "rm, touch, mkdir and git checkout;", replace: "rm, touch, mkdir, git checkout, perl -pi and awk -i;" },
};
const r6 = R6.map((m) => ({ ...m, ...(REBASED[m.name] ?? {}) }));

export const MUTANTS = [
  ...r6,
  // ---- P0a: characters
  { name: "r7-ps-nonascii-allowed", clause: "P0a: PowerShell refuses any non-ASCII character", file: "parse-gate.ts",
    find: "  if (ascii) return ascii;\n", replace: "" },
  { name: "r7-bash-nonascii-allowed", clause: "P0a: Bash refuses non-ASCII outside quotes", file: "parse-gate.ts",
    find: "if (na && (c.charCodeAt(0) > 0x7e || c.charCodeAt(0) < 0x20)) return na;", replace: "" },
  { name: "r7-nonascii-controls-allowed", clause: "P0a: control characters are refused too", file: "parse-gate.ts",
    find: "if (cp > 0x7e || (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d)) {", replace: "if (cp > 0x7e) {" },
  { name: "r7-nonascii-del-allowed", clause: "P0a: DEL (0x7F) is outside printable ASCII", file: "parse-gate.ts",
    find: "if (cp > 0x7e || (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d)) {", replace: "if (cp > 0x7f || (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d)) {" },
  // ---- P0b: one validator, every write source
  { name: "r7-validator-skip-redirect", clause: "P0b: Bash and PowerShell redirect targets go through the validator", file: "bash.ts",
    find: "for (const t of ex.targets) {\n    const v = validateTarget(", replace: "for (const t of ex.targets) {\n    if (t.via.startsWith(\"redirect\")) continue;\n    const v = validateTarget(" },
  { name: "r7-validator-skip-tee", clause: "P0b: tee targets", file: "bash.ts",
    find: "for (const t of ex.targets) {\n    const v = validateTarget(", replace: "for (const t of ex.targets) {\n    if (t.via === \"tee\") continue;\n    const v = validateTarget(" },
  { name: "r7-validator-skip-cp-mv-install", clause: "P0b: cp, mv, install targets", file: "bash.ts",
    find: "for (const t of ex.targets) {\n    const v = validateTarget(", replace: "for (const t of ex.targets) {\n    if (t.via === \"cp\" || t.via === \"mv\" || t.via === \"install\" || t.via === \"ln\" || t.via === \"mv source\") continue;\n    const v = validateTarget(" },
  { name: "r7-validator-skip-sed", clause: "P0b: sed -i targets", file: "bash.ts",
    find: "for (const t of ex.targets) {\n    const v = validateTarget(", replace: "for (const t of ex.targets) {\n    if (t.via === \"sed -i\") continue;\n    const v = validateTarget(" },
  { name: "r7-validator-skip-scp", clause: "P0b: scp's local end", file: "bash.ts",
    find: "for (const t of ex.targets) {\n    const v = validateTarget(", replace: "for (const t of ex.targets) {\n    if (t.via === \"scp\") continue;\n    const v = validateTarget(" },
  { name: "r7-validator-skip-ps-cmdlets", clause: "P0b: PowerShell cmdlet -Path/-LiteralPath/-FilePath/-Destination and positionals", file: "bash.ts",
    find: "for (const t of ex.targets) {\n    const v = validateTarget(", replace: "for (const t of ex.targets) {\n    if (/^(?:set-content|add-content|clear-content|out-file|tee-object|copy-item|move-item|rename-item|remove-item|new-item)(?: source)?$/.test(t.via)) continue;\n    const v = validateTarget(" },
  { name: "r7-validator-skip-new-item-name", clause: "P0b/D-C: New-Item -Name checked on its own", file: "bash.ts",
    find: "      for (const nm of names) if (pathShapeProblem(nm.text)) add(nm, via);\n", replace: "" },
  { name: "r7-validator-skip-file-tools-shape", clause: "P0b: the file tools use the same shape check", file: "paths.ts",
    find: "  const shape = pathShapeProblem(text);\n  if (shape) return", replace: "  const shape = shell ? pathShapeProblem(text) : null;\n  if (shape) return" },
  { name: "r7-shape-provider-path", clause: "P0b: provider path (::) in the validator", file: "paths.ts",
    find: 'if (text.includes("::")) return "provider path (::)";', replace: "" },
  { name: "r7-shape-drive-relative", clause: "P0b: drive-relative path in the validator", file: "paths.ts",
    find: 'if (/^[A-Za-z]:(?![\\\\/])./.test(text)) return "drive-relative path (C:name)";', replace: "" },
  { name: "r7-shape-nonascii", clause: "P0b: non-ASCII in the validator", file: "paths.ts",
    find: "if (cp > 0x7e || cp < 0x20) return `non-ASCII character", replace: "if (cp > 0xffff) return `non-ASCII character" },
  { name: "r7-gate-ps-redirect-shape", clause: "P0b/D-A: PowerShell > target shape in the gate", file: "parse-gate.ts",
    find: "      const targetShape = psPathShapeProblem(t.text);\n      if (targetShape) return targetShape;\n", replace: "" },
  { name: "r7-gate-ps-2redirect-shape", clause: "P0b/D-A: PowerShell 2> target shape in the gate", file: "parse-gate.ts",
    find: "      const tgtShape = psPathShapeProblem(tgt.text);\n      if (tgtShape) return tgtShape;\n", replace: "" },
  { name: "r7-gate-ps-token-shape", clause: "P0b: PowerShell word shape in the gate", file: "parse-gate.ts",
    find: "    const shape = psPathShapeProblem(t.text);\n    if (shape) return shape;\n", replace: "" },
  // ---- P0c: command words
  { name: "r7-allowlist-off", clause: "P0c: a Bash command word must be on the allow-list", file: "parse-gate.ts",
    find: "if (!Object.prototype.hasOwnProperty.call(BASH_ALLOWED_COMMANDS, name)) return refuse(", replace: "if (false) return refuse(" },
  { name: "r7-path-command-allowed", clause: "P0c: a path is not a bare command name", file: "parse-gate.ts",
    find: "if (/[\\\\/]/.test(cmd.text)) return refuse(", replace: "if (false) return refuse(" },
  { name: "r7-restriction-skipped", clause: "P0c: per-command restrictions are applied", file: "parse-gate.ts",
    find: "    if (restricted) return refuse(restricted);\n", replace: "" },
  { name: "r7-node-no-script", clause: "P0c: node needs a script", file: "bash-commands.ts",
    find: 'if (first === undefined) return "node with no script', replace: 'if (first === undefined && false) return "node with no script' },
  { name: "r7-node-extension", clause: "P0c: node runs a .js, .mjs or .cjs file", file: "bash-commands.ts",
    find: "if (!NODE_SCRIPT_RE.test(first)) return", replace: "if (false) return" },
  { name: "r7-node-extension-case", clause: "P0c: the node extension test", file: "bash-commands.ts",
    find: "const NODE_SCRIPT_RE = /\\.(?:js|mjs|cjs)$/i;", replace: "const NODE_SCRIPT_RE = /\\.(?:js|mjs|cjs)/i;" },
  { name: "r7-curl-writes-allowed", clause: "P0c: curl is read-only", file: "bash-commands.ts",
    find: "const bad = args.find((a) => CURL_WRITES_RE.test(a));", replace: "const bad = undefined as string | undefined;" },
  { name: "r7-rg-pre-allowed", clause: "P0c: rg --pre runs a program", file: "bash-commands.ts",
    find: "const bad = args.find((a) => RG_RUNS_RE.test(a));", replace: "const bad = undefined as string | undefined;" },
  { name: "r7-ssh-proxy-allowed", clause: "P0c: ssh/scp options that run a local program", file: "bash-commands.ts",
    find: 'const bad = args.find((a, k) => a === "-F"', replace: 'const bad = args.find((a, k) => false && a === "-F"' },
  { name: "r7-shell-lc-allowed", clause: "P0c: a shell only as exactly -c", file: "parse-gate.ts",
    find: 'args.length === 2 && args[0].text === "-c"', replace: "args.length === 2 && /^-[a-z]*c$/.test(args[0].text)" },
  // ---- P0d: environment
  { name: "r7-env-gitgh-allowed", clause: "P0d: GIT_*, GH_REPO, GH_HOST in the environment", file: "parse-gate.ts",
    find: "if (ENV_GITGH_RE.test(raw)) return refuse(", replace: "if (false) return refuse(" },
  { name: "r7-env-runs-allowed", clause: "P0d: PATH, HOME, NODE_OPTIONS... in the environment", file: "parse-gate.ts",
    find: "if (ENV_RUNS_RE.test(raw)) return refuse(", replace: "if (false) return refuse(" },
  { name: "r7-env-leading-skipped", clause: "P0d: a leading assignment is checked", file: "parse-gate.ts",
    find: "      if (env) return env;\n      k++;\n    }\n    if (k >= s.words.length) continue; // only assignments", replace: "      k++;\n    }\n    if (k >= s.words.length) continue; // only assignments" },
  { name: "r7-env-after-wrapper-skipped", clause: "P0d: an assignment after env is checked", file: "parse-gate.ts",
    find: "          if (env) return env;\n          k++;\n        }\n        continue;", replace: "          k++;\n        }\n        continue;" },
  // ---- D-C, scp
  { name: "r7-new-item-name-alone", clause: "D-C: New-Item -Name with no -Path targets the current directory", file: "bash.ts",
    find: "    } else if (names.length > 0) {", replace: "    } else if (false) {" },
  { name: "r7-scp-target-ignored", clause: "P0b: scp's local end is a write target", file: "bash.ts",
    find: '    case "scp": {', replace: '    case "scp-ignored": {' },
];
