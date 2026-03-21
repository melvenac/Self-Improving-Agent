# Product Requirements Document (PRD)

> **Status:** Draft — Fill in each section before starting development.

---

## 1. Project Overview

<!-- What are we building? For whom? What problem does it solve? -->

**Project Name:**
**Description:**
**Target Users:**
**Problem Statement:**

<!-- EXAMPLE:
**Project Name:** FitTrack
**Description:** A fitness class booking platform for boutique studios
**Target Users:** Studio owners and their members
**Problem Statement:** Small fitness studios rely on spreadsheets and Instagram DMs to manage bookings, leading to double-bookings and no-shows.
-->

---

## 2. Core Features

<!-- Numbered list of must-have features. Be specific about what each feature does. -->

1.
2.
3.

<!-- EXAMPLE:
1. **Class scheduling** — Studio owners create recurring or one-off classes with capacity limits
2. **Online booking** — Members browse, book, and cancel classes from a web app
3. **Membership tiers** — Monthly plans (Basic, Premium, Unlimited) with different class allowances
4. **Waitlists** — Auto-promote when a spot opens, notify via email
5. **Payment processing** — Stripe integration for memberships and drop-in purchases
6. **Admin dashboard** — Owner sees bookings, revenue, attendance trends
-->

---

## 3. Tech Stack

<!-- What technologies are we using? This drives RULES.md and skill creation. -->

| Layer | Technology |
|---|---|
| Frontend | |
| Backend | |
| Database | |
| Auth | |
| Hosting | |
| Other | |

<!-- EXAMPLE (Next.js + Convex):
| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS, shadcn/ui |
| Backend | Convex (serverless functions + real-time DB) |
| Database | Convex (built-in, document-based) |
| Auth | Clerk (OAuth + email/password) |
| Hosting | Vercel (frontend), Convex Cloud (backend) |
| Other | Stripe (payments), Resend (email), FullCalendar (scheduling UI) |

EXAMPLE (Django + PostgreSQL):
| Layer | Technology |
|---|---|
| Frontend | Django templates, HTMX, Alpine.js, Tailwind CSS |
| Backend | Django 5.0, Django REST Framework |
| Database | PostgreSQL 16 |
| Auth | Django Allauth (OAuth + email/password) |
| Hosting | Railway (app), Neon (database) |
| Other | Stripe (payments), Celery + Redis (background jobs) |
-->

---

## 4. User Roles

<!-- Who uses the system and what can they do? -->

| Role | Permissions |
|---|---|
| | |

<!-- EXAMPLE:
| Role | Permissions |
|---|---|
| **Public visitor** | View classes, pricing, studio info |
| **Member** | Book/cancel classes, manage membership, view history |
| **Studio owner (Admin)** | All member permissions + create classes, manage members, view analytics, process refunds |
| **Super admin** | All admin permissions + manage studio owner accounts |
-->

---

## 5. Pages / Routes

<!-- What pages/screens exist? This drives navigation tests and auth gate tests. -->

| Route | Description | Auth Required? |
|---|---|---|
| | | |

<!-- EXAMPLE:
| Route | Description | Auth Required? |
|---|---|---|
| `/` | Landing page — hero, features, pricing | No |
| `/classes` | Browse all upcoming classes | No |
| `/classes/:id` | Class detail — description, schedule, book button | No |
| `/pricing` | Membership tiers and pricing | No |
| `/contact` | Contact form | No |
| `/dashboard` | Member dashboard — upcoming bookings, history | Yes (Member) |
| `/dashboard/membership` | Manage membership plan | Yes (Member) |
| `/admin` | Admin dashboard — analytics, revenue | Yes (Admin) |
| `/admin/classes` | Manage class schedule | Yes (Admin) |
| `/admin/members` | Member management CRM | Yes (Admin) |
| `/sign-in` | Authentication page | No |
| `/sign-up` | Registration page | No |
-->

---

## 6. Data Model Sketch

<!-- What are the main entities? This becomes ENTITIES.md.
     Focus on the key fields and relationships — exact types come later. -->

### Entity: [Name]
- field: type
- field: type

<!-- EXAMPLE:
### Entity: User
- id, name, email, role (member | admin), membershipId?, createdAt

### Entity: Membership
- id, name, tier (basic | premium | unlimited), priceMonthly, classesPerMonth, stripeProductId

### Entity: Class
- id, title, description, instructor, capacity, duration, recurringSchedule?, studioId

### Entity: ClassInstance
- id, classId, date, time, spotsRemaining, status (scheduled | cancelled)

### Entity: Booking
- id, userId, classInstanceId, status (confirmed | cancelled | waitlisted), bookedAt

### Entity: Payment
- id, userId, amount, type (membership | drop-in), stripePaymentId, status, createdAt

Relationships:
- User → has one → Membership (optional)
- User → has many → Bookings
- Class → has many → ClassInstances
- ClassInstance → has many → Bookings
- User → has many → Payments
-->

---

## 7. Third-Party Integrations

<!-- What external services are involved? Include API docs links if known. -->

| Service | Purpose | Notes |
|---|---|---|
| | | |

<!-- EXAMPLE:
| Service | Purpose | Notes |
|---|---|---|
| Stripe | Payment processing | Subscriptions for memberships, one-time for drop-ins |
| Clerk | Authentication | OAuth (Google, Apple) + email/password |
| Resend | Transactional email | Booking confirmations, waitlist notifications |
| Vercel | Frontend hosting | Auto-deploy from GitHub |
| Sentry | Error tracking | Client + server error monitoring |
-->

---

## 8. Non-Functional Requirements

<!-- Performance, security, accessibility, etc. -->

- **Performance:**
- **Security:**
- **Accessibility:**
- **Scalability:**

<!-- EXAMPLE:
- **Performance:** Pages load in < 2s on 3G. Real-time updates for booking availability.
- **Security:** No stored credit card data (Stripe handles PCI). Row-level access control on all data.
- **Accessibility:** WCAG 2.1 AA compliance. Keyboard-navigable booking flow.
- **Scalability:** Support 50 concurrent users per studio. Multi-studio architecture from day 1.
-->
