# Coding Standards & Conventions

> **Derived from:** PRD §3 (Tech Stack)
> **Last Updated:** Session 0 (Initial Setup)

---

## General Rules (Universal)

These apply to every project regardless of tech stack:

1. **No hardcoded secrets** — Use environment variables for all API keys, tokens, and credentials.
2. **Descriptive naming** — Variables, functions, and files should be self-documenting.
3. **Small, focused functions** — Each function does one thing well.
4. **Error handling** — Never swallow errors silently. Log or propagate.
5. **Comments for WHY, not WHAT** — Code should be readable; comments explain intent.
6. **No dead code** — Delete unused code rather than commenting it out. Git has history.

---

## Tech-Stack-Specific Rules

<!-- Customize this section based on your PRD §3 tech stack.
     Delete the example blocks and replace with your actual rules. -->

_Not yet defined. Populate after writing the PRD and choosing a tech stack._

### Frontend Rules
-

### Backend Rules
-

### Database Rules
-

### Testing Rules
-

<!--
====================================================================
EXAMPLES FOR COMMON STACKS
Pick what applies, delete the rest, and customize.
====================================================================

--- NEXT.JS + REACT ---

### Frontend Rules
- Default to Server Components. Only add `"use client"` when the component needs interactivity (hooks, event handlers, browser APIs).
- Use Tailwind CSS for all styling. No CSS modules or styled-components.
- Component naming: PascalCase files (`BookingCard.tsx`), one component per file.
- Use `shadcn/ui` components as the base — customize via Tailwind, don't override internal styles.
- Images use `next/image` with explicit width/height or `fill` + container sizing.
- Never use `any` type. Prefer explicit types or infer from library utilities.

### Backend Rules
- API routes in `src/app/api/` follow RESTful naming.
- Server Actions for form submissions. API routes for external integrations.
- Validate all inputs at the API boundary using Zod schemas.
- Never trust client-side data — re-validate on server.

--- DJANGO ---

### Frontend Rules
- Use Django templates with HTMX for interactivity. Minimize JavaScript.
- Alpine.js for client-side state that HTMX can't handle.
- Tailwind CSS via django-tailwind.
- Template naming: `app_name/template_name.html`.

### Backend Rules
- Class-based views for CRUD, function-based views for custom logic.
- Fat models, thin views — business logic lives on the model.
- Use Django REST Framework for any JSON API endpoints.
- All database queries go through the ORM. No raw SQL unless performance-critical.

### Database Rules
- Migrations are committed to Git. Never edit a migration after it's been applied.
- Add `db_index=True` on fields used in filter/order queries.
- Use `select_related()` and `prefetch_related()` to avoid N+1 queries.

--- CONVEX ---

### Backend Rules
- Queries are read-only. Mutations change data. Actions call external APIs.
- Always use `v.` validators in function arguments — no unvalidated inputs.
- Lazy-initialize external clients (Stripe, Resend) inside Actions, not at module scope.
- Use `ctx.runMutation()` inside Actions to write data (Actions can't write directly).

### Database Rules
- All schema changes update both `convex/schema.ts` AND `.agents/SYSTEM/ENTITIES.md`.
- Add indexes for any field used in `.withIndex()` queries.
- Use `v.optional()` for nullable fields, not `v.union(v.string(), v.null())`.

--- GO ---

### Backend Rules
- Always handle errors explicitly. Never use `_` to discard errors.
- Use `context.Context` as the first parameter for functions that do I/O.
- Wrap errors with `fmt.Errorf("doing X: %w", err)` for stack context.
- Interfaces belong in the package that uses them, not the package that implements them.

### Database Rules
- Use `sqlc` for type-safe SQL queries. No hand-written query building.
- Migrations use `golang-migrate`. One migration per schema change.
-->

---

## File & Folder Conventions

| Convention | Rule |
|---|---|
| Component files | |
| Utility files | |
| Test files | |
| Style files | |

<!-- EXAMPLE:
| Convention | Rule |
|---|---|
| Component files | `src/components/ComponentName.tsx` — PascalCase |
| Utility files | `src/lib/utilName.ts` — camelCase |
| Test files | `tests/e2e/feature.spec.ts` for E2E, `__tests__/unit.test.ts` for unit |
| Style files | Tailwind only — no separate style files |
| Page files | `src/app/(group)/route/page.tsx` — Next.js App Router conventions |
-->

---

## Git Conventions

- **Branch naming:** `feature/`, `fix/`, `chore/`
- **Commit messages:** Use conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- **PR size:** Keep PRs small and focused (< 400 lines when possible)

---

## Agent-Specific Rules

1. Always read `SUMMARY.md` at session start
2. Always update `SUMMARY.md` at session end
3. Log gotchas in the session log — don't let hard-won knowledge disappear
4. When modifying the data model, update `ENTITIES.md` immediately
5. When making architectural decisions, log them in `DECISIONS.md`
6. Tests are `.spec.ts` files, run natively via Playwright, zero AI tokens at execution
