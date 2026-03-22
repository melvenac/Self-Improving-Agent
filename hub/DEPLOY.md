# A2A Intelligent Hub — Coolify Deployment Guide

## Prerequisites

- Coolify instance running on your VPS
- GitHub repo pushed (PR #1 merged to master)
- Anthropic API key
- Telegram bot token + group ID
- GitHub PAT (for repo-fixer git push)

---

## Step 1: Merge the PR

```bash
cd ~/Projects/Self-Improving-Agent
gh pr merge 1 --merge
git checkout master && git pull
```

---

## Step 2: Deploy Self-Hosted Convex on Coolify

The Hub needs Convex for persistent state. Deploy it first.

1. **Log into Coolify** at your VPS
2. **Create new service** → Docker Image
3. **Image:** `ghcr.io/get-convex/convex-backend:latest`
4. **Ports:** Expose `3210`
5. **Volumes:** Add a persistent volume for `/convex_data` so data survives restarts
6. **Deploy** and note the internal Docker network URL (e.g., `http://convex:3210`)

### Initialize Convex schema

Once Convex is running, push the schema from your local machine:

```bash
cd ~/Projects/Self-Improving-Agent/hub
npx convex deploy --url http://<your-vps-ip>:3210
```

This creates all 5 tables (experiences, tasks, agents, conversations, repoFixes).

---

## Step 3: Deploy the Hub on Coolify

1. **Log into Coolify**
2. **Create new service** → Docker → GitHub repo
   - **Repository:** `melvenac/Self-Improving-Agent`
   - **Branch:** `master`
   - **Dockerfile path:** `hub/Dockerfile`
   - **Build context:** `hub/`
3. **Important:** The Dockerfile expects `dist/` to exist. Add a **build command** in Coolify:
   ```
   cd hub && npm ci && npm run build
   ```
   Or use a multi-stage Dockerfile (see note below).

4. **Set environment variables:**

   | Variable | Value | Notes |
   |----------|-------|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic API key |
   | `GITHUB_PAT` | `ghp_...` | For repo-fixer git push |
   | `TELEGRAM_BOT_TOKEN` | `123456:ABC-...` | From @BotFather |
   | `TELEGRAM_GROUP_ID` | `-100...` | Your Telegram group ID |
   | `CONVEX_URL` | `http://convex:3210` | Internal Docker network URL from Step 2 |
   | `HUB_BOOTSTRAP_KEY` | (generate one) | Initial API key for first agent registration |
   | `HUB_URL` | `https://sandbox.tarrantcountymakerspace.com` | Public URL |
   | `REPO_PATH` | `/tmp/Self-Improving-Agent` | Where repo-fixer clones the repo |
   | `CONFIDENCE_THRESHOLD` | `0.85` | Memory confidence cutoff |
   | `PORT` | `4000` | Express server port |

5. **Set domain:** `sandbox.tarrantcountymakerspace.com`
6. **Expose port:** `4000`
7. **Deploy**

### Note: Multi-stage Dockerfile (recommended)

If Coolify doesn't support build commands before Docker build, replace `hub/Dockerfile` with:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist/ ./dist/
COPY convex/ ./convex/
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

---

## Step 4: Verify Deployment

```bash
# Health check
curl https://sandbox.tarrantcountymakerspace.com/health
# Expected: {"status":"ok","agent":"Intelligent-Hub"}

# Agent Card
curl https://sandbox.tarrantcountymakerspace.com/.well-known/agent-card.json
# Expected: Full agent card JSON with 3 skills

# Check Telegram
# The bot should have posted "Hub is online" in your group
```

---

## Step 5: Run Your Local Wrapper (Clark)

```bash
cd ~/Projects/Self-Improving-Agent/wrapper
npm install
npx tsx src/index.ts \
  --hub https://sandbox.tarrantcountymakerspace.com \
  --key <your-bootstrap-key> \
  --name clark
```

You should see:
```
Registered: Agent clark registered
Wrapper started for clark
Polling https://sandbox.tarrantcountymakerspace.com every 5000ms
```

---

## Step 6: Test with Brian

1. **Build the wrapper for Brian:**
   ```bash
   cd wrapper && npm run build
   ```

2. **Brian runs:**
   ```bash
   node dist/index.js \
     --hub https://sandbox.tarrantcountymakerspace.com \
     --key <brians-key> \
     --name alice
   ```

3. **Send a test message via A2A:**
   ```bash
   curl -X POST https://sandbox.tarrantcountymakerspace.com/a2a/message/send \
     -H "Content-Type: application/json" \
     -H "X-Agent-Key: <your-key>" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "message/send",
       "params": {
         "message": {
           "role": "user",
           "parts": [{"kind": "text", "text": "npm ERR! ERESOLVE when installing Self-Improving-Agent"}]
         }
       }
     }'
   ```

4. **Verify in Telegram:**
   - Incoming question appears
   - Hub decision (memory hit or escalation)
   - Response from agent
   - Lesson stored notification

---

## Step 7: Tag Release

After everything works:

```bash
git tag -a v4.0.0 -m "A2A Intelligent Hub v1"
git push origin master --tags
```

---

## Future: Eliminate API Key Dependency

Currently the Hub makes two small API calls via `ANTHROPIC_API_KEY`:
- **Classifier** (`classifier.ts`) — 50 tokens max per call, categorizes root causes
- **Repo Fixer** (`repo-fixer.ts`) — 2000 tokens max, drafts doc fixes (occasional)

All heavy LLM work already runs through Claude Max subscription via wrapper `claude --print`.

**Options to evaluate later:**
1. **Route through wrappers** — Hub sends classification/fix-drafting tasks to a connected wrapper agent instead of calling the API directly. Zero API cost, all LLM calls use subscription.
2. **Install Claude Code on VPS** — Hub uses `claude --print` on the server. Requires authenticating Claude Code there.
3. **Keep hybrid** — Current approach. API costs are ~$0.01/day at moderate usage.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Hub can't reach Convex | Check `CONVEX_URL` — use Docker internal network name, not localhost |
| Telegram bot not posting | Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_GROUP_ID`, ensure bot is in the group |
| Wrapper can't connect | Check Hub URL is publicly accessible, verify API key |
| `npx convex deploy` fails | Ensure Convex service is running and port 3210 is accessible |
| Docker build fails on `dist/` | Use the multi-stage Dockerfile above |
