---
description: Testing standards — loaded when reading test files
globs: tests/**, **/*.spec.*, **/*.test.*, e2e/**, __tests__/**
---

# Testing Rules

- Tests are `.spec.ts` files, run natively via Playwright, zero AI tokens at execution
- Use the playwright-tester skill for the 5-phase workflow (assess, author, execute, fix, report)
- Max 3 fix attempts per failing test — prevents infinite loops
- Determine if failure is a **test bug** (bad selector, timing) or an **app bug** (broken UI, backend error)

<!-- Add project-specific testing conventions below -->
