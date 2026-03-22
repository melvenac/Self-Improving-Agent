**Recommended Option: #3 — A2A-primary with Matrix as read-mostly log/UI layer**

This is the clear winner for your constraints (solo dev, Node/TS comfort, one VPS, ephemeral NAT agents, human visibility + intervention, future extensibility, and getting an MVP running fast). It keeps your core strength (A2A-compliant intelligent Hub with memory) intact while giving humans exactly the Element Web chat-room experience you want.

### Why Option 3 (proven trade-offs)
- **Human visibility & intervention**: Perfect. All A2A tasks, escalations, and responses are mirrored to a persistent Matrix room. Humans watch in real-time in Element Web (or any Matrix client) and can reply to intervene (the mirror bot forwards human messages back into the A2A task as a `USER_CONSENT_REQUIRED` or new message).
- **Extensibility**: Future agents (or external ones) connect directly via standard A2A (`/.well-known/agent-card.json` + JSON-RPC/SSE). No Matrix dependency for machines.
- **Ephemeral CLI agents behind NAT**: Local wrappers use **outbound-only** A2A (WebSocket/long-poll to the Hub). The Hub queues tasks if Clark is offline (A2A spec supports this via task state). Matrix room persistence acts as a backup log.
- **Knowledge accumulation**: The Hub stays in full control of Obsidian + SQLite + semantic search. No parsing natural-language Matrix messages.
- **Simplicity & speed**: You already planned the Hub in Node/Express + `@a2a-js/sdk`. Adding a lightweight mirror is ~100 lines of code (see below). No protocol translation hell.

**Trade-offs vs other options** (all proven from HiClaw docs & Matrix spec):
- **Option 1 (HiClaw-only)**: Forces your intelligent Hub to be just another HiClaw worker. Everything goes through Matrix natural-language rooms. You lose Agent Cards, JSON-RPC, SSE streaming, and direct A2A compliance. Your SDK becomes useless. Parsing install errors in chat is fragile. **Rejected** — breaks your entire memory/escalation design.
- **Option 2 (Dual)**: HiClaw workers **cannot expose HTTP endpoints** (they only talk Matrix + MinIO + Higress gateway). You'd have to hack custom runtimes and fight the architecture. Complexity explodes. **Rejected**.
- **Option 4 (lighter, what I recommend starting with)**: Skip full HiClaw entirely. Deploy just Tuwunel (Matrix server) + Element Web + one tiny mirror bot. HiClaw's Manager-Workers is overkill for 2 agents/2 humans (it's built for scalable teams with auto-worker creation). You already have Telegram as fallback. This is the fastest path and zero vendor lock-in.

**HiClaw + A2A feasibility** (direct from repo analysis):
- HiClaw communication is **100% Matrix** (Tuwunel) + MinIO files. Workers do **not** expose HTTP/A2A endpoints.
- MCP support (via Higress) is excellent — you could register Open Brain/Smart Connections easily.
- Resource footprint: 2–4 CPU / 4–8 GB RAM recommended (fits your VPS; Coolify Docker Compose handles it fine). But again, unnecessary overhead for your scale.
- No existing HiClaw + A2A integrations anywhere (searches returned zero results).

Matrix is fine as a UI layer (persistent history, search, E2EE optional, custom events for structured data), but **not** as primary agent transport — A2A is purpose-built for structured tasks, streaming, and discovery.

### Concrete Architecture (what you'll actually deploy)
```
Alice (local wrapper) ──A2A (JSON-RPC + SSE)──┐
                                               │
                                            The Hub (Node/Express + @a2a-js/sdk)
                                               │
                                               ├── Memory (Obsidian + Open Brain + Smart Connections)
                                               │
                                               └─A2A── Clark (local wrapper)

Humans (Aaron/Brian) ──Element Web──> Tuwunel Matrix Room <──Mirror Bot── Hub (logs every task/message)
```

- **Hub** = always-on A2A server at `https://sandbox.../a2a` (serves Agent Card + endpoints).
- **Mirror Bot** = tiny Node service that subscribes to Hub task events and posts to Matrix (and vice-versa for human replies).
- **Local wrappers** (Clark/Alice) = outbound A2A client (use `@a2a-js/sdk` client) + Claude Code subprocess. Optional: also post to Matrix for redundancy.

### Coolify Deployment (exact, 30-minute setup)
Coolify already has Traefik. Deploy two services (or three if you want full HiClaw later):

1. **A2A Hub** (your Node app)
   - Git repo or Dockerfile
   - Expose port 3000
   - Env: `ANTHROPIC_API_KEY`, paths to Obsidian vault
   - Route: `sandbox.../a2a` → Hub (subpath works perfectly with Express)

2. **Matrix Stack** (lightweight — just Tuwunel + Element + bot)
   - Use the official Tuwunel Docker Compose (or HiClaw's if you want to test Manager later).
   - Add `element-web` service.
   - Add `matrix-mirror-bot` (simple Node container).
   - Shared Docker network: `coolify-network` so bot can reach Hub.
   - Routes:
     - `sandbox.../` or `/element` → Element Web (humans)
     - `sandbox.../a2a` → Hub
   - Total footprint: <3 GB RAM with 2 workers (well under your VPS).

SSL is automatic via Traefik. Persistent volumes for Matrix SQLite + your Obsidian vault.

### MVP Build Sequence (1 week, solo, exactly as you like it)
**Week 1 — working prototype where Alice asks about install error and humans watch/intervene**

- **Day 1–2**: Deploy bare A2A Hub (copy the 20-line `@a2a-js/sdk` Express example from earlier research). Add memory check + LLM reasoning. Serve Agent Card with skills: `troubleshoot-installation`, `query-error-history`.
- **Day 3**: Build minimal Clark/Alice wrapper (Node daemon using A2A client SDK + `child_process` to pipe to Claude Code CLI). Test direct A2A escalation.
- **Day 4**: Add Matrix mirror bot (code below). Deploy Tuwunel + Element.
- **Day 5–6**: Test end-to-end: Alice sends install error → Hub checks memory → escalates to Clark if needed → everything logged to Matrix room. Humans reply in Element to approve/override.
- **Day 7**: Polish (Telegram fallback notifications, task queuing for offline agents).

**Mirror Bot code skeleton** (Node/TS, ~80 lines, copy-paste ready):
```ts
import { MatrixClient } from "matrix-js-sdk";
import { A2AClient } from "@a2a-js/sdk"; // or your Hub event listener

const matrix = new MatrixClient("https://your-tuwunel", accessToken);
const hubClient = new A2AClient("https://sandbox.../a2a");

matrix.startClient();
matrix.on("Room.timeline", async (event, room) => {
  if (event.getType() === "m.room.message" && event.getSender() !== botUser) {
    // Human replied in room → forward to Hub as new A2A message
    await hubClient.sendMessage(taskId, { role: "user", content: event.getContent().body });
  }
});

// Hub side: on every task update / message
hub.on("task.update", async (task) => {
  await matrix.sendTextMessage(roomId, `Hub: ${task.status} — ${task.result || task.reason}`);
});
```

### Risks & What Could Break First (all mitigated)
- HiClaw stalls: Zero impact — you're not coupled.
- Mirror latency: Negligible (Matrix is fast). Fallback to direct A2A.
- NAT/offline: Hub queues tasks (A2A native). Matrix room holds history.
- Hardest part: Only the wrapper session persistence (use Swival pattern from previous research).

This gets you a working Alice ↔ Clark debug session with humans watching **by next weekend**. Start with the Hub + mirror bot today — you can always layer full HiClaw Manager later if you fall in love with auto-worker creation.

Want the exact Coolify docker-compose snippets, full Agent Card JSON, or the complete mirror-bot repo template? Just say the word and I'll drop them. This is buildable right now.