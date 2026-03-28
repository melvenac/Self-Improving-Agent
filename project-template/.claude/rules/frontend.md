---
description: Frontend coding standards — loaded when reading UI/component files
globs: src/components/**, src/app/**/page.*, src/app/**/layout.*, app/components/**, app/**/page.*, app/**/layout.*
---

# Frontend Rules

<!-- Customize for your stack. Examples below — delete what doesn't apply. -->

<!-- NEXT.JS + REACT -->
<!-- - Default to Server Components. Only add `"use client"` when the component needs interactivity -->
<!-- - Use Tailwind CSS for all styling. No CSS modules or styled-components -->
<!-- - Component naming: PascalCase files (`BookingCard.tsx`), one component per file -->
<!-- - Use `shadcn/ui` components as the base — customize via Tailwind, don't override internal styles -->
<!-- - Images use `next/image` with explicit width/height or `fill` + container sizing -->
<!-- - Never use `any` type. Prefer explicit types or infer from library utilities -->

<!-- SVELTE -->
<!-- - Use server-side load functions for data fetching -->
<!-- - Stores for shared state, props for parent-child -->
<!-- - Tailwind utility classes, no component CSS -->

<!-- DJANGO TEMPLATES -->
<!-- - Use Django templates with HTMX for interactivity. Minimize JavaScript -->
<!-- - Alpine.js for client-side state that HTMX can't handle -->
<!-- - Template naming: `app_name/template_name.html` -->
