# Security Audit Checklist

> **Derived from:** Auth + Payment + Data handling
> **Last Updated:** Session 0 (Initial Setup)
> **Status:** Placeholder — flesh out before production deploy

---

## Authentication & Authorization

- [ ] All routes require authentication (unless explicitly public)
- [ ] Role-based access control (RBAC) is enforced server-side
- [ ] Session tokens have appropriate expiration
- [ ] Password requirements meet minimum standards
- [ ] OAuth flows use state parameter to prevent CSRF
- [ ] Failed login attempts are rate-limited

<!--
STACK-SPECIFIC CHECKLIST ITEMS — add what applies to your auth provider:

--- CLERK ---
- [ ] Clerk middleware protects all non-public routes
- [ ] `auth()` is called server-side before any data access (not just client-side checks)
- [ ] Clerk webhook signature is verified (`svix` library)
- [ ] Organization/role-based permissions use Clerk's RBAC, not custom logic
- [ ] Session token lifetime matches your security needs (default: 60s refresh)

--- NEXT-AUTH / AUTH.JS ---
- [ ] `getServerSession()` is used for server-side auth checks (not `useSession()` alone)
- [ ] CSRF token is validated on all auth endpoints
- [ ] JWT secret is strong and stored in env vars
- [ ] Callback URLs are restricted to your domain (no open redirect)
- [ ] Database sessions preferred over JWT for sensitive apps

--- DJANGO ALLAUTH ---
- [ ] `@login_required` or `LoginRequiredMixin` on all protected views
- [ ] `ACCOUNT_EMAIL_VERIFICATION = "mandatory"` in production
- [ ] `ACCOUNT_RATE_LIMITS` configured to prevent brute force
- [ ] Social account providers use server-side flow (not implicit)
- [ ] Django's CSRF middleware is enabled (never disabled)

--- SUPABASE AUTH ---
- [ ] Row Level Security (RLS) policies on all tables
- [ ] `auth.uid()` used in RLS policies, not client-passed user IDs
- [ ] Service role key is NEVER exposed to the client
- [ ] Email confirmation required before account activation
- [ ] JWT expiration and refresh token rotation configured
-->

---

## Data Protection

- [ ] Sensitive data is encrypted at rest
- [ ] Sensitive data is encrypted in transit (HTTPS everywhere)
- [ ] PII is identified and handled per privacy policy
- [ ] Database access is restricted to application service accounts
- [ ] Backups are encrypted
- [ ] Data retention policy is defined and enforced

<!--
STACK-SPECIFIC ITEMS:

--- CONVEX ---
- [ ] Convex functions use `ctx.auth.getUserIdentity()` before accessing user data
- [ ] No raw database access — all queries go through validated Convex functions
- [ ] Sensitive fields are not returned to unauthorized clients (filter in query, not client)

--- PRISMA / SQL ---
- [ ] Database user has minimal privileges (no SUPERUSER for app connections)
- [ ] Connection string uses SSL (`?sslmode=require`)
- [ ] Migrations don't drop columns containing PII without a data migration plan
- [ ] `SELECT *` is avoided — only query fields needed

--- DJANGO ---
- [ ] `SECRET_KEY` is unique per environment and stored in env vars
- [ ] `DEBUG = False` in production
- [ ] `ALLOWED_HOSTS` is set restrictively (no `*`)
- [ ] Sensitive model fields use `editable=False` where appropriate
-->

---

## API Security

- [ ] All API endpoints validate input
- [ ] SQL injection / NoSQL injection prevention
- [ ] XSS prevention (output encoding)
- [ ] CSRF protection on state-changing requests
- [ ] Rate limiting on public endpoints
- [ ] API keys are not exposed in client-side code
- [ ] CORS is configured restrictively

<!--
STACK-SPECIFIC ITEMS:

--- NEXT.JS ---
- [ ] API routes use Zod or similar for request body validation
- [ ] Server Actions validate all inputs (they're public HTTP endpoints)
- [ ] `next.config.js` security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- [ ] `NEXT_PUBLIC_` env vars contain ONLY public data (never secrets)
- [ ] Image domains are whitelisted in `next.config.js` (`remotePatterns`)

--- DJANGO REST FRAMEWORK ---
- [ ] `DEFAULT_PERMISSION_CLASSES` is set (not `AllowAny` globally)
- [ ] `DEFAULT_THROTTLE_RATES` configured for anonymous and authenticated users
- [ ] Serializers validate all input fields (no `Meta.fields = '__all__'` on sensitive models)
- [ ] `SECURE_BROWSER_XSS_FILTER = True`
- [ ] `SECURE_CONTENT_TYPE_NOSNIFF = True`

--- EXPRESS / NODE ---
- [ ] Helmet middleware enabled for security headers
- [ ] Body parser has size limits (`express.json({ limit: '10kb' })`)
- [ ] Rate limiter middleware on auth and public API routes
- [ ] CORS origin is set to specific domains, not `*`
-->

---

## Infrastructure

- [ ] Environment variables for all secrets (no hardcoded credentials)
- [ ] Secrets are stored in a secrets manager (not .env in production)
- [ ] Dependencies are regularly audited for vulnerabilities
- [ ] Docker images use minimal base images
- [ ] Production logs don't contain sensitive data
- [ ] Error messages don't leak internal details to users

<!--
EXAMPLE: Dependency auditing commands by ecosystem:

```bash
# Node.js
npm audit
npx audit-ci --critical

# Python
pip-audit
safety check

# Go
govulncheck ./...

# Ruby
bundle audit check --update
```

Add one of these to your CI pipeline to catch vulnerabilities automatically.
-->

---

## Payment Security (if applicable)

- [ ] PCI compliance requirements identified
- [ ] Payment processing uses a certified provider (Stripe, etc.)
- [ ] No credit card data stored on our servers
- [ ] Webhook signatures are verified
- [ ] Refund/dispute handling is documented

<!--
--- STRIPE-SPECIFIC ---
- [ ] Using Stripe Checkout or Elements (never raw card number handling)
- [ ] Webhook endpoint verifies `stripe-signature` header using `stripe.webhooks.constructEvent()`
- [ ] Stripe secret key is server-only (never in `NEXT_PUBLIC_` or client bundle)
- [ ] Test mode keys used in development, live keys only in production env vars
- [ ] Idempotency keys used for critical mutations (prevent double charges)
- [ ] Price IDs are validated server-side (client can't pass arbitrary amounts)
- [ ] Stripe CLI used for local webhook testing (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`)
-->

---

## Monitoring & Incident Response

- [ ] Security events are logged and monitored
- [ ] Alerting is configured for suspicious activity
- [ ] Incident response plan is documented
- [ ] Security contact is defined
- [ ] Breach notification process is documented

<!--
EXAMPLE: What to monitor for security:
- Failed login spikes (> 10 failures from same IP in 5 minutes)
- Unusual API traffic patterns (scraping, enumeration)
- New admin accounts created outside normal flow
- Webhook signature verification failures
- Dependency vulnerability alerts (GitHub Dependabot / Snyk)
-->

---

## Compliance

| Requirement | Status | Notes |
|---|---|---|
| GDPR | | |
| SOC 2 | | |
| HIPAA | | |
| PCI DSS | | |

<!--
EXAMPLE:
| Requirement | Status | Notes |
|---|---|---|
| GDPR | In Progress | Cookie consent banner added; data export/deletion endpoints needed |
| SOC 2 | Not Started | Required before enterprise sales |
| HIPAA | N/A | No health data processed |
| PCI DSS | Compliant | Stripe handles all card data; SAQ-A applies |

Delete rows that don't apply to your project. Add any industry-specific
requirements (FERPA, CCPA, etc.).
-->

---

## Audit Log

| Date | Auditor | Findings | Remediation |
|---|---|---|---|
| | | | |

<!--
EXAMPLE:
| Date | Auditor | Findings | Remediation |
|---|---|---|---|
| 2026-03-01 | @yourname | Stripe webhook secret not rotated since project start | Rotated key, updated env var, verified webhook delivery |
| 2026-03-10 | AI agent (Session 12) | npm audit found 2 moderate vulnerabilities in `semver` | Updated to semver@7.6.0, verified no breaking changes |

Log every security review, even informal ones. This creates a paper trail
that's valuable for compliance and incident investigation.
-->
