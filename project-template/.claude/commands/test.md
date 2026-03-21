# /test — Zero-Token E2E Testing

Follow the testing protocol defined in `.agents/workflows/test.md`.

## Quick Reference

1. Check Playwright is installed
2. Read `.agents/skills/playwright-tester/SKILL.md`
3. Assess project structure (routes, auth gates, components)
4. Author `.spec.ts` files in `tests/e2e/`
5. Execute via `npx playwright test tests/e2e/`
6. Fix loop (max 3 attempts per failure)
7. Report results — feeds into /end session summary
