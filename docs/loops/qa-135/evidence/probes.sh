source /c/qa-scratch/t.sh; export T=/c/qa-scratch/logs/probes.txt; : > $T
G="git -c user.name=QA135 -c user.email=qa135@example.invalid"
B=/c/qa-scratch/probes; rm -rf $B; mkdir -p $B
mk() { rm -rf "$B/$1"; mkdir -p "$B/$1"; cd "$B/$1"; printf '{"name":"%s","version":"1.0.0"}\n' "$1" > package.json; git init -q; $G add -A; $G commit -qm pre; }

note "P1a: .agents/ holding ONLY a valid-looking state.json (no TASKS/, no views)"
mk p1a; mkdir .agents; git -C /c/qa-scratch/cand show f618b73:project-template/.agents/state.json | sed 's/{{PROJECT}}/p1a/' > .agents/state.json
r OB bootstrap check
r OB bootstrap scaffold
note "P1b: .agents/ holding ONLY the OLD template placeholder state.json ({{PROJECT}}, f618b73), as a wholesale copy of an old template would leave it"
mk p1b; mkdir .agents; git -C /c/qa-scratch/cand show f618b73:project-template/.agents/state.json > .agents/state.json
r OB bootstrap check
r node /c/qa-scratch/ob-start.mjs "$(cygpath -w .)"
note "P1c: .agents/ holding ONLY a zero-byte state.json"
mk p1c; mkdir .agents; : > .agents/state.json
r OB bootstrap check

note "P2a: .agents/ holding ONLY an empty TASKS/ directory"
mk p2a; mkdir -p .agents/TASKS
r OB bootstrap check
r OB bootstrap scaffold
r OB state import --draft
note "P2b: .agents/ holding ONLY TASKS/INBOX.md with frogger's old headings (## Priority / ## Backlog)"
mk p2b; mkdir -p .agents/TASKS; printf '# Inbox\n\n## Priority\n\n- [ ] Fix the lives counter\n\n## Backlog\n\n- [ ] High scores\n- [ ] Sound\n' > .agents/TASKS/INBOX.md
r OB bootstrap check
r OB state import --draft
r grep -n "WARNING" .agents/state.import-report.md
note "P2c: .agents/ holding ONLY a file named TASKS (not a directory)"
mk p2c; mkdir -p .agents; echo x > .agents/TASKS
r OB bootstrap check

note "P3a: nested residue (a directory and a file), one file tracked by git"
mk p3a; mkdir -p .agents/META; echo old > .agents/META/notes.md; echo q > .agents/reflection-queue.json; $G add .agents/META/notes.md; $G commit -qm "tracked residue"
sha_before=$(find .agents -type f -exec sha1sum {} \; | sed 's#\.agents/##' | sort)
r OB bootstrap check
r OB bootstrap move-residue
r find .agents -type f
sha_after=$(find .agents/archive/pre-bootstrap-residue-* -type f -exec sha1sum {} \; | sed 's#\.agents/archive/pre-bootstrap-residue-[0-9-]*/##' | sort)
[ "$sha_before" = "$sha_after" ] && note "P3a: content hashes identical before and after the move" || note "P3a: HASHES DIFFER: $sha_before / $sha_after"
r git status --short
r OB bootstrap check
note "P3b: a second residue appears on the same day, after a first move-residue"
mk p3b; mkdir .agents; echo one > .agents/a.json; OB bootstrap move-residue >/dev/null; echo two > .agents/b.json
r OB bootstrap check
r OB bootstrap move-residue
r find .agents -type f
r OB bootstrap check
note "P3c: move-residue when .agents/ is not residue (empty, absent, pre-state)"
mk p3c; r OB bootstrap move-residue; mkdir .agents; r OB bootstrap move-residue; mkdir .agents/TASKS; r OB bootstrap move-residue

note "P4a: scaffold over an owner's existing .claude/commands/start.md and INBOX-free tree: never overwritten"
mk p4a; mkdir -p .claude/commands; echo "my own start" > .claude/commands/start.md; $G add -A; $G commit -qm own
r OB bootstrap scaffold
r cat .claude/commands/start.md
note "P4b: an owner's .gitignore that ignores .agents/ wholesale"
mk p4b; printf 'node_modules/\n.agents/\n' > .gitignore; $G add -A; $G commit -qm gi
r OB bootstrap scaffold
note "P4c: scaffold on a dirty tree, and with no commit"
mk p4c; echo dirt > dirt.txt; r OB bootstrap scaffold
rm -rf "$B/p4d"; mkdir -p "$B/p4d"; cd "$B/p4d"; git init -q; r OB bootstrap scaffold
note "P4e: scaffold inside another repository"
mk p4e; mkdir sub; cd sub; r OB bootstrap check; r OB bootstrap scaffold

note "P5: an existing CLAUDE.md is byte-identical after check, move-residue and scaffold"
mk p5; printf '# Mine\r\nkeep me\r\n' > CLAUDE.md; mkdir .agents; echo r > .agents/old.json; $G add CLAUDE.md; $G commit -qm c
h0=$(sha1sum CLAUDE.md); OB bootstrap check >/dev/null; OB bootstrap move-residue >/dev/null; OB bootstrap scaffold >/dev/null; h1=$(sha1sum CLAUDE.md)
note "P5: before $h0 / after $h1"
r OB bootstrap check
