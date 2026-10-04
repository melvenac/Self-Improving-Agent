# /test — Zero-Token E2E Testing (Cursor + SIA)

> **Cursor Composer:** execute inline. Claude Code's `/test` copy (`.claude/commands/test.md`) matches this
> protocol; neither host dispatches a dedicated test subagent for this command.

**For projects with a Playwright E2E suite.** This repo is not one of them: it has no `tests/e2e/`,
no Playwright dependency, and no `playwright-tester` skill outside `project-template/`. Run
`cd open-brain && npm test` here instead — that is the suite this repo actually has.

> This command previously opened with "Follow the testing protocol defined in
> `.agents/workflows/test.md`". That file exists in no mirror, so the command's first instruction
> could not be carried out anywhere.

## Prerequisites — check these before starting

1. Playwright installed (`npx playwright --version`)
2. `.agents/skills/playwright-tester/SKILL.md` present — it ships in `project-template/.agents/`
3. A `tests/e2e/` directory, or agreement on where specs should live

**If any is missing, say so and stop.** Do not author specs against a harness that is not there.

## Protocol

1. Assess project structure (routes, auth gates, components)
2. Author `.spec.ts` files in `tests/e2e/`
3. Execute via `npx playwright test tests/e2e/`
4. Fix loop — **max 3 attempts per failure**, then report the failure rather than continuing
5. Report results; `/end` picks them up for the session summary
