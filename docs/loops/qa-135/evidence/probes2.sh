source /c/qa-scratch/t.sh; export T=/c/qa-scratch/logs/probes2.txt; : > $T
G="git -c user.name=QA135 -c user.email=qa135@example.invalid"
B=/c/qa-scratch/probes
note "P6: bootstrap interrupted after step 3 (scaffold) and resumed in a new session: step 1's check, then step 1's table (PRE-STATE -> skip to step 6)"
cd $B/p5
r OB bootstrap check
r OB state import --draft
r node -e 'const d=require("./.agents/state.draft.json");console.log(d.tasks.map(t=>t.priority+" "+t.title).join("\n"));console.log("objective:",JSON.stringify(d.objective))'

note "P7: a project with no package.json inside a PARENT folder that has package.json + .agents/SYSTEM + .agents/TASKS (a pre-state project, not a git repo), the child being its own git repository"
rm -rf $B/p7; mkdir -p $B/p7/.agents/SYSTEM $B/p7/.agents/TASKS $B/p7/child; cd $B/p7
printf '{"name":"parent","version":"9.9.9"}\n' > package.json; printf '# Inbox\n\n## P1\n\n- [ ] PARENT TASK\n' > .agents/TASKS/INBOX.md
cd child; git init -q; echo "print(1)" > main.py; $G add -A; $G commit -qm pre
r OB bootstrap check
r OB bootstrap scaffold
$G add -A >/dev/null 2>&1
r OB state import --draft
r ls ../.agents
