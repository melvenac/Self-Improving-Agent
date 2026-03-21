# /test — Zero-Token E2E Testing Protocol

> **Trigger:** Run after feature work or before deploy to execute E2E tests.

---

## Steps

### 1. Check Prerequisites
```
Verify: Playwright is installed (npx playwright --version)
If missing: npm install -D @playwright/test && npx playwright install chromium
```

### 2. Load Testing Skill
```
Read: .agents/skills/playwright-tester/SKILL.md
```
Follow the 5-phase playbook defined in the skill file.

### 3. Phase 1 — Assess
Read the project structure to understand:
- Framework and routing conventions
- Entry points and page components
- Authentication gates
- Key interactive flows
- API layer

### 4. Phase 2 — Author
Write focused, independent `.spec.ts` files in `tests/e2e/`, organized by test strategy:
- `happy_path.spec.ts` — Core user journeys
- `validation.spec.ts` — Form validation
- `navigation.spec.ts` — Routing & links
- `auth_gates.spec.ts` — Auth boundaries
- `responsive.spec.ts` — Viewport rendering
- `[feature].spec.ts` — Feature-specific flows

### 5. Phase 3 — Execute
```bash
npx playwright test tests/e2e/
```
Run tests natively via Playwright CLI. Zero AI tokens consumed at execution.

### 6. Phase 4 — Fix Loop
For each failure (max 3 attempts per test):
1. Read error output and failure screenshots
2. Determine: **test bug** (bad selector, timing) or **app bug** (broken UI, backend error)
3. Fix the issue and re-run
4. If still failing after 3 attempts, mark as unresolved

### 7. Phase 5 — Report
Generate a results table with:
- Pass/fail counts per test file
- App bugs found and fixed
- Unresolved failures
- Suggested additional coverage

---

## Output

After running /test, the agent should present:

```
🧪 E2E Test Run — [Date]
📊 Results: X passed, Y failed, Z unresolved
🐛 App Bugs Fixed: [list]
📋 Full report below...
```

This report feeds into the /end session summary.
