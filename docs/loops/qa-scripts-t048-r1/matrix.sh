#!/bin/sh
# QA 151: see.mjs + five.mjs for base and cand builds, with SeBackupPrivilege as inherited and disabled.
# Usage: sh s/matrix.sh <root, windows form with forward slashes> <label> <rel paths to probe...>
W=C:/qa-scratch/t048; ROOT=$1; LABEL=$2; shift 2
for pv in priv nopriv; do
  echo "######## $LABEL / $pv"
  powershell -NoProfile -ExecutionPolicy Bypass -File "$W/s/$pv.ps1" "$W/s/see.mjs" "$ROOT" "$@"
  for b in base cand; do
    powershell -NoProfile -ExecutionPolicy Bypass -File "$W/s/$pv.ps1" "$W/s/five.mjs" "$W/$b/open-brain/build" "$ROOT" "$b $pv" | grep -v '^PRIV\|^EXIT: 0'
  done
done
