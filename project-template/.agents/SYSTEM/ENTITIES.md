# Data Model — Entities

> **Derived from:** PRD §6 (Data Model Sketch)
> **Last Updated:** Session 0 (Initial Setup)

---

## Overview

<!-- High-level description of the data model and how entities relate to each other -->

_Not yet defined. Populate this after writing the PRD._

---

## Entities

<!--
Define each entity with its fields, types, and relationships.
Format this section to match your tech stack's schema format.

IMPORTANT: When the data model changes during development, update this file
immediately. This is the source of truth that agents read every session.
-->

### Entity: [ExampleEntity]

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Primary key |
| | | | |

**Relationships:**
-

<!--
====================================================================
EXAMPLES FOR DIFFERENT TECH STACKS
Pick the format that matches your stack, delete the others.
====================================================================

--- CONVEX (Document DB with validators) ---

### users
```typescript
// convex/schema.ts
users: defineTable({
  name: v.string(),
  email: v.string(),
  role: v.union(v.literal("member"), v.literal("admin")),
  membershipId: v.optional(v.id("memberships")),
  clerkId: v.string(),
  createdAt: v.number(),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_email", ["email"])
```

**Relationships:**
- `membershipId` → `memberships._id` (optional, one-to-one)
- Referenced by: `bookings.userId`, `payments.userId`

--- PRISMA (SQL with schema DSL) ---

### User
```prisma
// prisma/schema.prisma
model User {
  id           String      @id @default(cuid())
  name         String
  email        String      @unique
  role         Role        @default(MEMBER)
  membership   Membership? @relation(fields: [membershipId], references: [id])
  membershipId String?
  bookings     Booking[]
  payments     Payment[]
  createdAt    DateTime    @default(now())
}

enum Role {
  MEMBER
  ADMIN
}
```

--- DJANGO (Python ORM) ---

### User
```python
# models.py
class User(AbstractUser):
    role = models.CharField(max_length=20, choices=[("member", "Member"), ("admin", "Admin")])
    membership = models.ForeignKey("Membership", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["email"])]
```

--- SQL DDL ---

### users
```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  membership_id UUID REFERENCES memberships(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```
-->

---

## Entity Relationship Diagram

<!-- ASCII diagram showing how entities connect. Update as entities are added. -->

```
[Entity A] --< [Entity B] --- [Entity C]
```

<!--
EXAMPLE:
```
[User] ---o [Membership]
  |
  |--< [Booking] >--- [ClassInstance] >--- [Class]
  |
  |--< [Payment]
```
Legend: --- one-to-one, --< one-to-many, >--- many-to-one, >--< many-to-many
-->

---

## Changelog

| Date | Change | Session |
|---|---|---|
| | Initial creation | 0 |
