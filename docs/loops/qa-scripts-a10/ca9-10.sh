#!/bin/bash
# QA 108 (QA 104's ca9.sh idea): CA-9's pin against this PC's claude, by putting its directory first on PATH for the one
# test, in the A10 archive copy. First run inline at about 00:33Z; re-run from this file.
cd /c/qa-scratch/qa108/arch/A10/open-brain || exit 2
"/c/Users/Aaron Melven/.local/bin/claude.exe" --version 2>&1 | head -1
PATH="/c/Users/Aaron Melven/.local/bin:$PATH" node node_modules/vitest/vitest.mjs run tests/harness/process-role.test.ts -t "CA-9" --reporter=verbose > /c/qa-scratch/qa108/ca9.out 2>&1
echo "CA9_EXIT=$?"
sed 's/\x1b\[[0-9;]*m//g' /c/qa-scratch/qa108/ca9.out | grep -aE "✓|×|Tests " | cut -c1-200
