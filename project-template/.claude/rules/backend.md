---
description: Backend coding standards — loaded when reading API/server files
globs: src/api/**, src/server/**, convex/**, api/**, server/**, lib/server/**
---

# Backend Rules

<!-- Customize for your stack. Examples below — delete what doesn't apply. -->

<!-- NEXT.JS API ROUTES -->
<!-- - API routes in `src/app/api/` follow RESTful naming -->
<!-- - Server Actions for form submissions. API routes for external integrations -->
<!-- - Validate all inputs at the API boundary using Zod schemas -->
<!-- - Never trust client-side data — re-validate on server -->

<!-- CONVEX -->
<!-- - Queries are read-only. Mutations change data. Actions call external APIs -->
<!-- - Always use `v.` validators in function arguments — no unvalidated inputs -->
<!-- - Lazy-initialize external clients (Stripe, Resend) inside Actions, not at module scope -->
<!-- - Use `ctx.runMutation()` inside Actions to write data (Actions can't write directly) -->

<!-- DJANGO -->
<!-- - Class-based views for CRUD, function-based views for custom logic -->
<!-- - Fat models, thin views — business logic lives on the model -->
<!-- - Use Django REST Framework for any JSON API endpoints -->

<!-- GO -->
<!-- - Always handle errors explicitly. Never use `_` to discard errors -->
<!-- - Use `context.Context` as the first parameter for functions that do I/O -->
<!-- - Wrap errors with `fmt.Errorf("doing X: %w", err)` for stack context -->
