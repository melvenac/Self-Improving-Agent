# A2A + HiClaw Hybrid Architecture — Research Prompt

> Copy this prompt to Grok, Gemini, or any research agent. This builds on our previous research — we've converged on a hybrid architecture and need input on a critical design decision.

---

## Previous Context (Summary)

We're building an **intelligent agent communication system** for collaborative debugging of an open-source repo ([Self-Improving-Agent](https://github.com/melvenac/Self-Improving-Agent)). Two Claude Code CLI agents ("Clark" and "Alice") need to communicate, with humans ("Aaron" and "Brian") able to observe and intervene.

### What we've decided so far:

1. **The A2A Hub** — a persistent AI agent on a VPS (Coolify PaaS at `sandbox.tarrantcountymakerspace.com`) that:
   - Is always-on and A2A v1.0 compliant
   - Acts as an intelligent intermediary — checks accumulated knowledge before escalating questions to other agents
   - Learns from every conversation (Obsidian vault + SQLite FTS5 + semantic search)
   - Gets smarter over time — eventually handles most questions without escalation
   - Built with Node.js/TypeScript + Express + `@a2a-js/sdk`

2. **HiClaw** (Alibaba, [github.com/alibaba/hiclaw](https://github.com/alibaba/hiclaw)) — an open-source Multi-Agent OS that provides:
   - Matrix-based chat rooms where agents communicate in natural language
   - Element Web browser client so humans can watch and intervene in real-time
   - Manager-Workers architecture with an orchestrator agent
   - MCP server support via Higress AI Gateway
   - Self-hosted via Docker (fits on our Coolify VPS)

3. **Hybrid approach** — use HiClaw as the human-visible chat room layer, with The A2A Hub sitting behind it as the intelligent memory/escalation engine.

### The hybrid architecture:

```
Humans (Aaron + Brian)
    │
    ▼
Element Web (browser) ──→ Tuwunel (Matrix server)
                              │
                              ▼
                     HiClaw Manager Agent
                        │           │
                   ┌────┘           └────┐
                   ▼                     ▼
            The A2A Hub              Worker agents
         (memory + intelligence)    (Clark/Alice wrappers)
              │
              ├── Open Brain (SQLite/FTS5)
              ├── Smart Connections (semantic search)
              └── Obsidian Vault (experiences/skills)
```

---

## The Design Decision We Need Input On

### Should The A2A Hub be accessible ONLY through HiClaw, or should it ALSO have its own direct A2A endpoint?

**Option 1: HiClaw-only (Single entry point)**
- All agents and humans interact exclusively through Matrix chat rooms
- The Hub is just another HiClaw worker — it receives messages through Matrix, responds through Matrix
- No separate A2A HTTP endpoint
- Simpler architecture, one system to manage

**Option 2: Dual interface (HiClaw + direct A2A)**
- HiClaw provides the human-visible chat room experience
- The Hub ALSO exposes `/.well-known/agent-card.json` and standard A2A endpoints at its own URL
- External agents (not in the chat room) can communicate with The Hub directly via A2A protocol
- The Hub acts as a bridge: agents can reach it via A2A OR through Matrix
- More complex but more extensible

**Option 3: A2A-primary with Matrix as a log/UI layer**
- The Hub is the real brain with A2A endpoints as the primary interface
- HiClaw/Matrix is used purely for human observation — messages are mirrored to Matrix rooms for visibility but the actual agent communication flows through A2A
- Matrix becomes a read-mostly dashboard rather than the communication backbone

---

## What I Need You To Research

### 1. Architecture Recommendation
- Which option (1, 2, or 3) is the best fit given:
  - We want humans to see and intervene in agent conversations
  - We want the system to be extensible (more agents could join later)
  - Clark and Alice are ephemeral CLI agents behind NAT
  - We have one VPS with Coolify for deployment
  - The Hub needs to accumulate knowledge and get smarter over time
- What are the trade-offs of each option?
- Is there an Option 4 we haven't considered?

### 2. HiClaw + A2A Integration Feasibility
- Can a HiClaw worker also be an A2A-compliant server? Or are the protocols incompatible?
- How does HiClaw's Manager-Workers communication work internally? Is it Matrix messages, HTTP calls, or something else?
- Can HiClaw workers use MCP servers? (We need The Hub to access Open Brain and Smart Connections)
- What's the overhead of running HiClaw on a VPS with 2-4 CPU cores and 4-8GB RAM alongside The Hub?

### 3. Matrix Protocol Considerations
- Can Matrix rooms be used as a transport layer for structured A2A-style messages, or is it purely natural language?
- Does Matrix support bot accounts that could act as agent wrappers?
- How does Matrix handle message history and search? Could it supplement The Hub's memory system?
- What about encryption (end-to-end) — does it interfere with The Hub reading messages?

### 4. Clark/Alice Wrapper Design for the Hybrid
- In the hybrid model, how do Clark and Alice connect? Options:
  - As HiClaw workers (communicate via Matrix)
  - Via A2A directly to The Hub (bypassing HiClaw)
  - Both (dual connection)
- How does the wrapper handle the NAT problem in each case?
- If Clark is offline when Alice asks a question, how does the system handle it? Does HiClaw queue messages in the Matrix room? Does The Hub queue A2A tasks?

### 5. Deployment on Coolify
- Can HiClaw (Docker Compose with Tuwunel, Element Web, Higress, MinIO) and The Hub (Node.js Express server) coexist on one Coolify instance?
- What's the total resource footprint?
- How should networking be configured? Should HiClaw and The Hub share a Docker network?
- SSL/TLS — Coolify uses Traefik. How do we route `sandbox.tarrantcountymakerspace.com` to serve both Element Web (for humans) and A2A endpoints (for agents)?

### 6. MVP Build Sequence for the Hybrid
- What's the fastest path to a working prototype?
- Should we deploy HiClaw first and add The Hub later, or build The Hub first and add HiClaw as a UI layer?
- What's the minimum viable version that lets Alice try to install the repo and ask Clark questions while Aaron and Brian watch?

### 7. Risks and Alternatives
- Is HiClaw overkill for a 2-agent, 2-human setup? Would a simpler Matrix bot + A2A Hub be sufficient?
- Are there lighter alternatives to HiClaw that provide chat room visibility without the full Manager-Workers OS?
- What happens if HiClaw development stalls (it's an Alibaba project) — how tightly coupled would we be?

---

## Existing Infrastructure

- **VPS**: Coolify PaaS, Docker-based deployments, Traefik for SSL
- **Domain**: `sandbox.tarrantcountymakerspace.com`
- **Open Brain**: npm package `open-brain-knowledge` — SQLite + FTS5 knowledge base (MCP server)
- **Smart Connections**: `@yejianye/smart-connections-mcp` — semantic search over Obsidian vault
- **Obsidian Vault**: `~/Obsidian Vault/` with Sessions, Experiences, Topics, Guidelines folders
- **Telegram Bot**: Working, used for human-to-Clark communication (could be used for notifications/approvals)
- **A2A JS SDK**: `@a2a-js/sdk` on npm — Express handlers, SSE, Agent Cards, JSON-RPC

## Deliverable

Give me a **concrete recommendation** with reasoning. Include architecture diagrams if possible. Flag anything speculative vs proven. If you recommend an option, show me what the deployment looks like on Coolify and what the first week of building looks like.

I'm a solo developer, comfortable with Node.js/TypeScript, Next.js, Convex, Docker, and Coolify. Less experienced with Python but can work with it. I value simplicity and getting something working fast over architectural perfection.
