#!/bin/bash
# QA 104: CA-9's pin against this PC's installed claude (2.1.282 at ~/.local/bin/claude.exe), by putting that directory
# first on PATH for this one test in the A9 archive. `claude --help` is the only claude call the test makes.
# Also prints, for each flag the adapter declares, whether `claude --help` lists it. Exit codes unpiped.
B="/c/Users/Aaron Melven/.local/bin"
echo "claude: $("$B/claude.exe" --version 2>&1 | head -1)"
"$B/claude.exe" --help > /c/qa104/win/claude-help.txt 2>&1; echo "help_exit=$?"
for f in --print --output-format --session-id --permission-mode --permission-prompts --strict-mcp-config --setting-sources --allowed-tools --disallowed-tools; do
  grep -q -- "$f" /c/qa104/win/claude-help.txt && echo "  listed $f" || echo "  MISSING $f"
done
cd /c/qa104/arch/A9/open-brain || exit 2
PATH="$B:$PATH" node node_modules/vitest/vitest.mjs run tests/harness/process-role.test.ts -t "CA-9" --reporter=verbose > /c/qa104/win/ca9.out 2>&1
echo "ca9_exit=$?"
grep -aE "CA-9|Tests  " /c/qa104/win/ca9.out | sed -E 's/\x1b\[[0-9;]*m//g'
