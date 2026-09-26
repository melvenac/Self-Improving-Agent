# QA 135 transcript helper: r <cmd...> runs in the cwd, appends "$ cmd", full output, and exit code to $T.
export OB_JS="C:/qa-scratch/cand/open-brain/build/cli.js"
OB() { node "$OB_JS" "$@"; }
r() {
  printf '\n$ %s\n' "$*" >> "$T"
  "$@" > /c/qa-tmp/r.out 2>&1; local rc=$?
  cat /c/qa-tmp/r.out >> "$T"; printf '[exit %s]\n' "$rc" >> "$T"
  cat /c/qa-tmp/r.out; echo "[exit $rc]"
  return 0
}
note() { printf '\n> %s\n' "$*" >> "$T"; }
