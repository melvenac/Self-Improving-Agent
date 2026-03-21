# Testing Strategy

> **Derived from:** PRD §3 (Tech Stack) + Core Features
> **Last Updated:** Session 0 (Initial Setup)
> **Status:** Placeholder — flesh out after first feature ships

---

## Testing Philosophy

This framework uses a **layered testing strategy** with a zero-token E2E layer powered by Playwright.

The key principle: **AI writes the tests, machines run them.** Test authoring uses AI tokens; test execution uses zero tokens.

---

## Test Layers

| Layer | What | Tool | AI Tokens |
|---|---|---|---|
| Layer 1: Schema validation | ENTITIES.md matches actual schema | Custom script | Zero |
| Layer 2: Unit tests | Pure logic, utilities, helpers | Your test runner | Zero |
| Layer 3: Integration tests | API endpoints, DB queries | Your test runner | Zero |
| Layer 4: E2E tests | Full user flows in a browser | Playwright | Zero (at execution) |
| Layer 5: Manual/exploratory | Edge cases, UX review | Human | N/A |

---

## Test Stack

<!-- Fill in after choosing your tech stack -->

| Tool | Purpose |
|---|---|
| | Unit tests |
| | Integration tests |
| Playwright | E2E tests |
| | Mocking |

<!--
EXAMPLES:
| Tool | Purpose |
|---|---|
| Vitest | Unit + integration tests (Next.js/React) |
| Playwright | E2E tests |
| MSW | API mocking |

| Tool | Purpose |
|---|---|
| pytest | Unit + integration tests (Django/Python) |
| Playwright | E2E tests |
| Factory Boy | Test data fixtures |

| Tool | Purpose |
|---|---|
| Go testing | Unit + integration tests |
| Playwright | E2E tests (if there's a frontend) |
| testcontainers | Database integration tests |
-->

---

## Test Structure

```
tests/
├── unit/           ← Pure logic tests
├── integration/    ← API / DB tests
└── e2e/            ← Playwright specs (zero-token execution)
    ├── happy_path.spec.ts
    ├── validation.spec.ts
    ├── navigation.spec.ts
    ├── auth_gates.spec.ts
    ├── responsive.spec.ts
    └── [feature].spec.ts
```

---

## Zero-Token E2E Testing

The E2E layer uses the `playwright-tester` skill (see `.agents/skills/playwright-tester/SKILL.md`).

### How It Works
1. **Write phase** (AI tokens) — Agent reads project structure, generates `.spec.ts` files
2. **Run phase** (zero tokens) — `npx playwright test tests/e2e/` executes natively
3. **Fix loop** (AI tokens) — Agent reads failures, fixes test bugs or app bugs, re-runs (max 3 attempts)

### Invoking Tests
- Run `/test` slash command
- Or ask the agent to "run E2E tests"
- Or run manually: `npx playwright test tests/e2e/`

---

## Coverage Goals

| Type | Target | Current |
|---|---|---|
| Unit | 80% | 0% |
| Integration | 60% | 0% |
| E2E | Critical paths | 0% |

---

## Testing Conventions

1. E2E test files: `[strategy].spec.ts` in `tests/e2e/`
2. Unit test files: `[filename].test.[ext]` or `[filename].spec.[ext]`
3. Each test should be independent — no shared mutable state
4. Use descriptive test names: `should [expected behavior] when [condition]`
5. Mock external services, not internal logic
6. Run tests before every commit

---

## CI/CD Integration

<!-- Define how tests run in your pipeline -->

_Not yet configured._

<!--
EXAMPLE:
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx vitest run          # Unit + integration
      - run: npx playwright install chromium
      - run: npx playwright test      # E2E
```
-->
