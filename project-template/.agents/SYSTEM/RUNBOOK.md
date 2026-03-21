# Production Runbook

> **Derived from:** Infrastructure choices
> **Last Updated:** Session 0 (Initial Setup)
> **Status:** Placeholder — flesh out before production deploy

---

## Deployment

### Prerequisites
-

### Deploy Steps
1.
2.
3.

### Rollback Steps
1.
2.

<!--
====================================================================
EXAMPLES FOR DIFFERENT HOSTING STACKS
Pick what applies, delete the rest, and customize.
====================================================================

--- VERCEL + CONVEX (Serverless) ---

### Prerequisites
- Vercel CLI installed (`npm i -g vercel`)
- Convex CLI installed (`npm i -g convex`)
- Environment variables configured in Vercel dashboard and Convex dashboard
- GitHub repo connected to Vercel for auto-deploy

### Deploy Steps
1. Push to `main` branch — Vercel auto-deploys frontend
2. Run `npx convex deploy` — deploys backend functions and schema
3. Verify deployment at production URL
4. Check Convex dashboard for function health

### Rollback Steps
1. **Frontend:** Vercel dashboard → Deployments → click previous deployment → "Promote to Production"
2. **Backend:** `git revert <commit>` then `npx convex deploy` (Convex has no built-in rollback)

--- RAILWAY + DOCKER ---

### Prerequisites
- Railway CLI installed (`npm i -g @railway/cli`)
- Dockerfile tested locally (`docker build -t myapp .`)
- Environment variables configured in Railway dashboard
- PostgreSQL database provisioned on Railway

### Deploy Steps
1. Push to `main` branch — Railway auto-builds and deploys from Dockerfile
2. Monitor build logs in Railway dashboard
3. Run pending migrations: `railway run python manage.py migrate`
4. Verify at production URL

### Rollback Steps
1. Railway dashboard → Deployments → click previous deployment → "Redeploy"
2. If migration needs reversal: `railway run python manage.py migrate <app> <previous_migration>`

--- AWS (ECS + RDS) ---

### Prerequisites
- AWS CLI configured with appropriate IAM role
- ECR repository for Docker images
- ECS service and task definition configured
- RDS instance running with security groups

### Deploy Steps
1. Build and tag image: `docker build -t myapp:$(git rev-parse --short HEAD) .`
2. Push to ECR: `docker push <account>.dkr.ecr.<region>.amazonaws.com/myapp:<tag>`
3. Update ECS task definition with new image tag
4. Update ECS service: `aws ecs update-service --cluster prod --service myapp --force-new-deployment`
5. Monitor rollout: `aws ecs wait services-stable --cluster prod --services myapp`

### Rollback Steps
1. Update ECS task definition to previous image tag
2. `aws ecs update-service --cluster prod --service myapp --force-new-deployment`
3. If DB migration needs reversal, run migration rollback before image rollback
-->

---

## Environment Variables

| Variable | Description | Where Set |
|---|---|---|
| | | |

<!--
EXAMPLE:
| Variable | Description | Where Set |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Railway / AWS Secrets Manager |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key (safe for client) | Vercel env vars |
| `CLERK_SECRET_KEY` | Clerk secret key (server only) | Vercel env vars |
| `STRIPE_SECRET_KEY` | Stripe API key (server only) | Vercel env vars |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Vercel env vars |
| `CONVEX_DEPLOY_KEY` | Convex deployment key | CI/CD secrets |
| `RESEND_API_KEY` | Transactional email API key | Convex dashboard env vars |
| `SENTRY_DSN` | Error tracking endpoint | Vercel env vars |

**Rules:**
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser — only use for public keys
- All other variables are server-only — never import them in client components
- Use `.env.local` for local development (gitignored), dashboards for production
-->

---

## Infrastructure

| Service | Provider | URL / Dashboard |
|---|---|---|
| Hosting | | |
| Database | | |
| Auth | | |
| CDN | | |
| Monitoring | | |

<!--
EXAMPLE (Vercel + Convex):
| Service | Provider | URL / Dashboard |
|---|---|---|
| Frontend hosting | Vercel | vercel.com/team/project |
| Backend + DB | Convex | dashboard.convex.dev/project |
| Auth | Clerk | dashboard.clerk.com |
| Payments | Stripe | dashboard.stripe.com |
| Email | Resend | resend.com/emails |
| Error tracking | Sentry | sentry.io/organizations/team/projects/project |
| DNS | Cloudflare | dash.cloudflare.com |

EXAMPLE (Railway + PostgreSQL):
| Service | Provider | URL / Dashboard |
|---|---|---|
| App hosting | Railway | railway.app/project/xxx |
| Database | Railway (PostgreSQL) | railway.app/project/xxx/service/postgres |
| Auth | Django Allauth | Self-hosted (part of app) |
| Payments | Stripe | dashboard.stripe.com |
| Email | AWS SES | console.aws.amazon.com/ses |
| Monitoring | UptimeRobot | uptimerobot.com/dashboard |
-->

---

## Monitoring & Alerts

### Health Checks
-

### Key Metrics to Watch
-

### Alert Thresholds
| Metric | Warning | Critical |
|---|---|---|
| | | |

<!--
EXAMPLE:
### Health Checks
- `GET /api/health` — returns 200 if app + DB are up (checked every 60s by UptimeRobot)
- Convex dashboard → Functions tab → check for elevated error rates
- Stripe dashboard → Developers → Webhooks → check for failed deliveries

### Key Metrics to Watch
- **Response time** — p95 should be < 500ms for API routes
- **Error rate** — Sentry alert if > 5 errors/minute
- **Database connections** — should stay below 80% of pool limit
- **Webhook delivery rate** — Stripe webhooks should have > 99% success
- **Auth failures** — spike in failed logins may indicate brute force attack

### Alert Thresholds
| Metric | Warning | Critical |
|---|---|---|
| API p95 latency | > 500ms | > 2000ms |
| Error rate | > 5/min | > 20/min |
| DB connections | > 80% pool | > 95% pool |
| Disk usage | > 80% | > 95% |
| Failed webhooks | > 3 in 1hr | > 10 in 1hr |
-->

---

## Incident Response

### Severity Levels
| Level | Description | Response Time |
|---|---|---|
| P0 | Service down | Immediate |
| P1 | Major feature broken | < 1 hour |
| P2 | Minor issue | < 24 hours |
| P3 | Cosmetic / low impact | Next sprint |

### Common Issues & Fixes

#### Issue: [Description]
- **Symptoms:**
- **Cause:**
- **Fix:**

<!--
EXAMPLE:
#### Issue: Stripe webhooks failing
- **Symptoms:** Payments succeed but memberships don't activate. Stripe dashboard shows webhook failures.
- **Cause:** Webhook secret rotated but env var not updated, or endpoint URL changed after deploy.
- **Fix:** 1) Check Stripe dashboard → Developers → Webhooks for error details. 2) Verify `STRIPE_WEBHOOK_SECRET` env var matches the webhook endpoint's signing secret. 3) Redeploy if env var was updated.

#### Issue: Database connection pool exhausted
- **Symptoms:** 500 errors on all pages, logs show "too many connections" or "connection pool timeout."
- **Cause:** Long-running queries holding connections, or connection leak from unclosed transactions.
- **Fix:** 1) Identify long queries: `SELECT * FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;` 2) Kill stuck queries if needed. 3) Increase pool size as a temporary fix, then find and fix the leak.

#### Issue: Auth redirect loop
- **Symptoms:** User gets stuck in a login → redirect → login loop. Browser shows "too many redirects."
- **Cause:** Middleware protecting a route that the auth callback redirects to, or cookie domain mismatch.
- **Fix:** 1) Check middleware matcher — ensure `/sign-in`, `/sign-up`, and auth callback routes are excluded. 2) Verify cookie domain matches the production domain. 3) Clear cookies and test.
-->

---

## Backup & Recovery

- **Database backups:**
- **Recovery procedure:**
- **RTO (Recovery Time Objective):**
- **RPO (Recovery Point Objective):**

<!--
EXAMPLE:
- **Database backups:** Automatic daily snapshots via Railway/RDS. Retained for 7 days. Point-in-time recovery available for last 24 hours.
- **Recovery procedure:**
  1. Railway: Dashboard → Database → Backups → Restore from snapshot
  2. RDS: `aws rds restore-db-instance-to-point-in-time --source-db-instance-identifier prod-db --target-db-instance-identifier prod-db-recovery --restore-time 2026-03-13T10:00:00Z`
  3. Update app's DATABASE_URL to point to recovered instance
  4. Verify data integrity, then switch DNS/env var to recovered instance
- **RTO (Recovery Time Objective):** < 1 hour (managed DB restore + env var update + deploy)
- **RPO (Recovery Point Objective):** < 24 hours (daily snapshots), < 5 minutes (point-in-time recovery)
-->
