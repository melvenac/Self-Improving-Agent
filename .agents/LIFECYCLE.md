---
title: Component Lifecycle Policy
created: 2026-04-16
source: ~/Research-Wiki/wiki/concepts/Component Pruning.md
---

# Component Lifecycle

Every harness component (skill, hook, slash command) encodes an assumption about what the model can't do alone. Those assumptions expire. This policy defines how components are added, tracked, and pruned.

## Principle

Discipline narrowing beats expensive broadening. Add components only when evidence shows the model needs them. Remove components when evidence shows it doesn't. The default is fewer components, not more.

## Invocation Tracking

All skills and slash commands are logged automatically by the SessionEnd pipeline to `~/.claude/open-brain/skill-invocations.jsonl`. Each entry records: timestamp, type, name, session ID, project.

Hook invocations are not separately logged; the SessionEnd pipeline's Stage 3 writes the skill/command entries above (`invocation-logger.ts:49`).

## Three-Tier Pruning

### Tier 1: Data-Driven Flags

Run the audit query periodically (monthly or when the component count grows). Flag:

| Signal | Threshold | Action |
|--------|-----------|--------|
| Zero invocations in 30 days | Hard | Flag for review — candidate for removal |
| Invoked only by one parent chain | Soft | Flag as redundant — may be absorbable into parent |
| Invoked < 3 times in 60 days | Soft | Flag as low-value — justify keeping or remove |

Cross-project check required: a component unused in one project may be critical in another. Query the JSONL with `project` field before deciding.

### Tier 2: Experimental Removal

For any flagged component:

1. **Disable** — rename `skill.md` → `skill.md.disabled` (or comment out hook in settings.json)
2. **Run 5-10 sessions** in the relevant domain
3. **Observe** — did anything break? Did Aaron ask for it? Did a task fail?
4. **No regression → delete permanently**
5. **Regression → re-enable**, update "last validated" date in this file's log below

### Tier 3: Model Upgrade Sweep

When a new model ships, review all components:
- Which exist because the model needed hand-holding?
- Which hooks enforce behavior the model now does natively?
- Which context patterns compensate for limitations the new model handles?

## Component Log

Track lifecycle events here. Format: `YYYY-MM-DD | component | event | reason`

```
2026-04-16 | skill-invocations.jsonl | CREATED | P1 from design audit — track usage for pruning
2026-04-16 | task contract schema | CREATED | P1 from design audit — bound tasks with outputs/completion/scope
2026-04-16 | /recall | PRUNED | Absorbed into /start — command file already removed, 3 historical invocations. Mid-session recalls use the `ob_recall` tool directly with `trigger: "explicit"`.
```

## Audit Query

To run the first audit, use context-mode on the JSONL:

```
ctx_execute(language: "shell", code: `
cat ~/.claude/open-brain/skill-invocations.jsonl | \
  python3 -c "
import sys, json, collections
from datetime import datetime, timedelta

entries = [json.loads(l) for l in sys.stdin if l.strip()]
cutoff_30 = (datetime.now() - timedelta(days=30)).isoformat()
cutoff_60 = (datetime.now() - timedelta(days=60)).isoformat()

# Count by name
counts = collections.Counter(e['name'] for e in entries)
recent = collections.Counter(e['name'] for e in entries if e['ts'] > cutoff_30)
all_names = set(counts.keys())
recent_names = set(recent.keys())

print('=== USAGE SUMMARY ===')
for name, count in counts.most_common():
    r = recent.get(name, 0)
    print(f'  {name}: {count} total, {r} in last 30d')

print(f'\n=== TIER 1 FLAGS ===')
stale = all_names - recent_names
for name in sorted(stale):
    print(f'  STALE (0 in 30d): {name} ({counts[name]} total)')

low = {n for n, c in counts.items() if c < 3 and n not in stale}
for name in sorted(low):
    print(f'  LOW-VALUE (<3 in 60d): {name} ({counts[name]} total)')
"
`, intent: "component audit flags")
```
