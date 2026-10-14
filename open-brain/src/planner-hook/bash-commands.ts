/**
 * T-194 r7, P0c: the Bash command-word allow-list.
 *
 * r6 refused the CONSTRUCTS it could name and allowed every command word it had not heard of, so `awk`, `trap`, `mapfile`,
 * `sort -o`, `find -fprint` and every spelling of `node -e` got through (QA 241 D-D, D-E). r7 inverts that too: the first word
 * of every Bash simple command must be in this table, or the command is refused as
 * `not statically parseable: command not allowed: <word>`.
 *
 * THE PLANNER'S WORKING SET IS THE LIST. Each entry has a reason. A program on the list "does what its own arguments say": the
 * hook reads the write targets of the ones it knows (tee, cp, mv, install, sed -i, scp's local end) and nothing else.
 * Not on the list, on purpose: perl, python, ruby, php, awk, find, sort, xargs, trap, mapfile, eval, source, `.`, export,
 * set, read, alias, wget, dd, tar, zip, rsync, kill, and every shell except `sh|bash -c '<string>'`.
 */

export const BASH_ALLOWED_COMMANDS: Record<string, string> = {
  // the repo and the host
  git: "the planner's own tool; subcommands are checked against git's own commands (P0), pushes and merges by P2b",
  gh: "pull requests and checks; subcommands are checked against gh's own commands (P0), merges by P2",
  npm: "runs the project's scripts",
  npx: "runs a package's binary (tsc, vitest, gitnexus)",
  node: "only as `node <file.js|.mjs|.cjs> [args]`: no option before the script, so --eval, -e, -p, --print, -r and --import are refused in every spelling",
  ssh: "reaches the other seats' machines; the remote side is outside this hook (D-019)",
  scp: "copies to or from another machine; the remote side is outside this hook (D-019); the local end is read as a write target",
  curl: "read-only fetches; any option that writes a file is refused",
  // reading
  ls: "list a directory",
  cat: "read files",
  head: "read the start of a file",
  tail: "read the end of a file",
  wc: "count lines",
  diff: "compare files",
  cmp: "compare files byte by byte",
  comm: "compare two sorted files",
  grep: "search text",
  rg: "search text (--pre and --hostname-bin run programs and are refused)",
  jq: "read JSON",
  stat: "file metadata",
  file: "file type",
  du: "disk use",
  basename: "path arithmetic",
  dirname: "path arithmetic",
  realpath: "path arithmetic",
  readlink: "path arithmetic",
  md5sum: "checksum",
  sha256sum: "checksum",
  shasum: "checksum",
  tr: "translate characters in a pipe",
  cut: "select columns in a pipe",
  uniq: "collapse duplicate lines in a pipe",
  // output and tests
  echo: "print text",
  printf: "print text",
  pwd: "print the working directory",
  which: "locate a program",
  date: "print the date",
  uname: "platform name",
  whoami: "user name",
  hostname: "host name",
  sleep: "wait",
  test: "conditions",
  true: "exit status",
  false: "exit status",
  // writing (targets read by P1 where named in the limit text)
  tee: "write a stream to files",
  cp: "copy files",
  mv: "move files",
  install: "copy files with a mode",
  sed: "edit text; the script is read by the parse gate (no w, no e, no -f), -i targets by P1",
  mkdir: "create a directory (the target is not read; limit text)",
  rm: "delete files (the target is not read; limit text)",
  rmdir: "delete a directory (the target is not read; limit text)",
  touch: "create or touch a file (the target is not read; limit text)",
  // movement
  cd: "change directory (a cd on the same line as a write is refused by P1)",
  pushd: "change directory (same rule as cd)",
  popd: "change directory (same rule as cd)",
  // the wrappers the gate itself unwraps, and the one shell form it can read
  env: "only with no options; the command after it is checked as well",
  command: "only with no options; the command after it is checked as well",
  nohup: "only with no options; the command after it is checked as well",
  sh: "only as `sh -c '<string>'`; the string is gated in turn",
  bash: "only as `bash -c '<string>'`; the string is gated in turn",
};

const NODE_SCRIPT_RE = /\.(?:js|mjs|cjs)$/i;
const CURL_WRITES_RE = /^(?:-[A-Za-z]*[oOTK]|--output|--output-dir|--remote-name|--remote-name-all|--remote-header-name|--upload-file|--config|--create-dirs|--trace|--trace-ascii|--stderr|--dump-header|--cookie-jar|--hsts|--libcurl|-D|-c)(?:=.*)?$/;
const RG_RUNS_RE = /^--(?:pre|pre-glob|hostname-bin)(?:=.*)?$/;
const SSH_RUNS_RE = /(?:proxycommand|localcommand|permitlocalcommand|knownhostscommand|match\s+exec)/i;

/**
 * A command-specific restriction on the words after the command word. Returns the refusal, or null. `args` are the unquoted
 * texts. The command word itself has already been checked against BASH_ALLOWED_COMMANDS.
 */
export function commandRestriction(name: string, args: readonly string[]): string | null {
  switch (name) {
    case "node": {
      const first = args[0];
      if (first === undefined) return "node with no script (an interactive or stdin session); node is allowed only as node <file.js|.mjs|.cjs> [args]";
      if (first.startsWith("-")) {
        return `inline code or an option before the script (node ${first}); node is allowed only as node <file.js|.mjs|.cjs> [args]`;
      }
      if (!NODE_SCRIPT_RE.test(first)) return `node ${first} is not a .js, .mjs or .cjs file; node is allowed only as node <file.js|.mjs|.cjs> [args]`;
      return null;
    }
    case "curl": {
      const bad = args.find((a) => CURL_WRITES_RE.test(a));
      return bad === undefined ? null : `curl option that writes a file or reads a config (${bad}); curl is allowed read-only`;
    }
    case "rg": {
      const bad = args.find((a) => RG_RUNS_RE.test(a));
      return bad === undefined ? null : `rg option that runs a program (${bad})`;
    }
    case "ssh":
    case "scp": {
      const bad = args.find((a, k) => a === "-F" || /^-F./.test(a) || (SSH_RUNS_RE.test(a)) || (a === "-o" && SSH_RUNS_RE.test(args[k + 1] ?? "")));
      return bad === undefined ? null : `${name} option that runs a local program or reads a config (${bad})`;
    }
    default:
      return null;
  }
}
