---
description: Database/schema standards — loaded when reading schema or migration files
globs: convex/schema.*, schema/**, migrations/**, prisma/**, db/**, drizzle/**
---

# Database Rules

<!-- Customize for your stack. Examples below — delete what doesn't apply. -->

<!-- CONVEX -->
<!-- - All schema changes update both `convex/schema.ts` AND `.agents/SYSTEM/ENTITIES.md` -->
<!-- - Add indexes for any field used in `.withIndex()` queries -->
<!-- - Use `v.optional()` for nullable fields, not `v.union(v.string(), v.null())` -->

<!-- PRISMA -->
<!-- - Migrations are committed to Git. Never edit a migration after it's been applied -->
<!-- - Add `@index` on fields used in filter/order queries -->

<!-- DJANGO ORM -->
<!-- - All queries go through the ORM. No raw SQL unless performance-critical -->
<!-- - Add `db_index=True` on fields used in filter/order queries -->
<!-- - Use `select_related()` and `prefetch_related()` to avoid N+1 queries -->

<!-- DRIZZLE / SQLite -->
<!-- - Schema lives in a single source of truth file -->
<!-- - Always create migrations via `drizzle-kit generate` -->

## Universal
- When modifying the data model, update `.agents/SYSTEM/ENTITIES.md` immediately
- Log schema decisions in `.agents/SYSTEM/DECISIONS.md`
