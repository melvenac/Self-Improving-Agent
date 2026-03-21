# Playwright Zero-Token Tester

> **Trigger**: User asks to test the app, run E2E tests, or invokes `/test`.
> **Definition of Done**: Write Playwright test files, run them natively (zero AI tokens at execution), and fix failures in an automated loop.

## Why Zero-Token?

Traditional AI-driven testing (screenshot analysis, Playwright MCP server) consumes massive tokens per run. This skill uses AI only in the **write phase** — generating deterministic `.spec.ts` files that Playwright executes natively. Execution cost: **zero tokens**.

## Prerequisites

Before running, ensure Playwright is installed:

```bash
# Check if installed
npx playwright --version

# If not installed
npm install -D @playwright/test
npx playwright install chromium
```

If Playwright is not detected, install it automatically before proceeding.

## Playbook

### Phase 1: Assess

Read the project structure to understand:
- Framework and routing conventions (e.g., `src/app/` for Next.js, `src/routes/` for SvelteKit, `src/pages/` for Astro)
- Entry points and page components
- Authentication gates (middleware, route guards, protected layouts)
- Key interactive flows (forms, checkout, dashboards)
- API layer (REST endpoints, GraphQL, server actions, etc.)

Reference these files:
- Your app's route/page directory
- Shared/interactive components directory
- Auth middleware or route guard configuration
- `.agents/SYSTEM/ENTITIES.md` — Data model
- `.agents/SYSTEM/TESTING.md` — Existing test strategy

<!-- CUSTOMIZE: Replace the generic references above with your project's actual paths -->

### Phase 2: Author

Write focused, independent `.spec.ts` files in `tests/e2e/`, organized by test strategy. Each file must be self-contained — no shared state between files.

| File | Strategy | What it covers |
|---|---|---|
| `happy_path.spec.ts` | Core user journeys | The flows that must always work |
| `validation.spec.ts` | Form validation | Required fields, error states, success states |
| `navigation.spec.ts` | Routing & links | All routes resolve, nav links work, 404 handling |
| `auth_gates.spec.ts` | Authentication boundaries | Protected routes redirect, public routes stay open |
| `responsive.spec.ts` | Mobile/tablet/desktop rendering | Viewport breakpoints, mobile nav, responsive grids |
| `[feature].spec.ts` | Feature-specific flows | Customize per project (e.g., checkout, booking, onboarding) |

<!-- CUSTOMIZE: Add or remove test files based on your project's features -->

#### Writing Guidelines

- Use Playwright best practices: `page.getByRole()`, `page.getByText()` over CSS selectors
- Each test should be independent and idempotent
- Use `test.describe()` blocks for logical grouping
- Include meaningful test names that describe the expected behavior
- Add `await expect()` assertions — don't just navigate, verify outcomes
- For auth-gated tests, use Playwright's `storageState` for session management
- Target your dev server URL (see Configuration section below)

### Phase 3: Execute

Run tests natively via Playwright CLI:

```bash
# Run all tests (headless, parallel)
npx playwright test tests/e2e/

# Run specific test file
npx playwright test tests/e2e/happy_path.spec.ts

# Run headed (visible browser) for debugging
npx playwright test tests/e2e/ --headed

# Run with trace for failure diagnosis
npx playwright test tests/e2e/ --trace on
```

Default configuration:
- **Workers**: 4 (parallel execution)
- **Retries**: 0 (fix loop handles retries, not Playwright)
- **Reporter**: list (console output)
- **Browser**: Chromium only (matches most production targets)

### Phase 4: Fix Loop

When tests fail, enter the automated fix loop:

1. Read the Playwright error output and trace
2. Determine if the failure is a **test bug** (bad selector, timing) or an **app bug** (broken UI, missing element, backend error)
3. Fix the issue:
   - **Test bug**: Update the `.spec.ts` file
   - **App bug**: Fix the application code, then note it in the report
4. Re-run the failing test(s)
5. **Maximum 3 attempts** per failing test — if still failing after 3 tries, mark as unresolved and move on

Rules:
- Never skip a failing test — either fix it or report it
- Never disable assertions to make tests pass
- If an app bug is found and fixed, always re-run the full suite (not just the fixed test)
- Track each attempt: what failed, what was changed, result

### Phase 5: Report

After all tests pass (or fix loop exhausts 3 attempts), generate a report:

```markdown
## Test Execution Report

### Results
| Test File | Tests | Passed | Failed | Status |
|---|---|---|---|---|
| happy_path.spec.ts | 5 | 5 | 0 | PASS |
| validation.spec.ts | 8 | 7 | 1 | FAIL (unresolved) |
| ... | ... | ... | ... | ... |

### App Bugs Found & Fixed
- **[BUG-001]** Description — fixed in `path/to/file.tsx:42`

### Unresolved Failures
- `test_file.spec.ts > test name` — Reason, needs investigation

### Suggested Additional Coverage
- [ ] Additional flow or edge case to test
```

## Swarm Mode

When running with multiple agents:
- **Orchestrator**: Manages the 5-phase workflow, delegates file-specific work
- **Author agents**: Each writes one `.spec.ts` file independently (parallelizable)
- **Fix agent**: Handles the fix loop — reads errors, patches code, re-runs
- **Reporter**: Collects results from all agents, generates final report

## Configuration

Create `playwright.config.ts` in project root if it doesn't exist:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',  // CUSTOMIZE: your dev server URL
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev',            // CUSTOMIZE: your dev server command
    url: 'http://localhost:3000',      // CUSTOMIZE: your dev server URL
    reuseExistingServer: true,
  },
});
```

## Customizing This Skill for Your Project

After cloning the framework, update these sections:

1. **Phase 1 (Assess)**: Replace generic path references with your actual project paths
2. **Phase 2 (Author)**: Add/remove test file categories to match your features
3. **Configuration**: Set your dev server URL and start command
4. **Writing Guidelines**: Add framework-specific selector patterns if needed

Lines marked with `<!-- CUSTOMIZE -->` are the places that need project-specific updates.
