#!/bin/bash
# QA 92: does the R19 test's own setup (machine-config clone, remote remove) leave a background writer that creates
# .git/info/refs later? Lists .git/info at 0s, 1s, 3s, 6s after setup. Scratch dirs only.
for n in 1 2 3; do
  T=$(mktemp -d)
  git init -q --initial-branch=main "$T/src"
  printf 'one\ntwo\n' > "$T/src/lf.txt"
  git -C "$T/src" add lf.txt
  git -C "$T/src" -c user.name=t -c user.email=t@t commit -q --no-verify --no-gpg-sign -m base
  git -C "$T" clone --quiet "$T/src" "$T/clone"
  git -C "$T/clone" remote remove origin
  for s in 0 1 2 3; do
    echo "run$n t+${s}s info: $(ls "$T/clone/.git/info" | tr '\n' ' ') | objects/info: $(ls "$T/clone/.git/objects/info" 2>/dev/null | tr '\n' ' ')"
    sleep 1
  done
  rm -rf "$T"
done
