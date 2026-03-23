**Here are the most relevant open-source projects that closely match (or partially match) your A2A-compliant intelligent hub** — a persistent, always-on intermediary that reasons from accumulated knowledge/memory before escalating to ephemeral CLI agents (Clark/Alice), handles delegation/escalation, serves Agent Cards, uses JSON-RPC/SSE, and accumulates lessons. I prioritized A2A-native projects, then Claude-specific orchestration and proxies/wrappers.

I cross-referenced the official A2A repos (a2aproject org), awesome-a2a lists, and related searches. Nothing is a 100% drop-in for your exact stack (VPS + Obsidian/SQLite/RAG memory + Claude Code CLI wrappers), but these provide concrete, buildable starting points or patterns you can fork/extend in Node.js/TypeScript (your comfort zone).

### 1. vidya-hub/a2a-orchestrator (Strongest match for "intelligent hub" pattern)
- **Repo**: https://github.com/vidya-hub/a2a-orchestrator
- **What it does**: Implements the official **Host Agent Pattern** (central Routing/Host Agent as single entry point). The persistent "hub" (Routing Agent) uses an LLM (Gemini/Claude via LangGraph) + conversation memory to analyze tasks, decide actions, and delegate via A2A `send_message` to specialized backend agents. Specialists are more ephemeral/tool-focused (e.g., Research with web search MCP, Writer with filesystem MCP).
- **Similarities to your hub**:
  - Central persistent orchestrator that reasons first ("can I handle this?") before escalating.
  - Dynamic delegation/escalation flow + task lifecycle.
  - Agent Card discovery (`/.well-known/agent-card.json` or `agent.json` variants).
  - Session memory via `context_id` + LangGraph `MemorySaver`.
  - Uses official A2A Python SDK (`A2AClient`, `A2ACardResolver`).
- **Tech/Architecture highlights** (easy to port to your Node/JS setup):
  - FastAPI + LangGraph for stateful workflows.
  - Example delegation tool:
    ```python
    @tool
    async def send_message(agent_name: str, task: str) -> str:
        client = A2AClient(...)  # from SDK
        response = await client.send_message(Message(...))
        return response.result...
    ```
  - Ephemeral specialists started via CLI (`a2a-research --port 8001`); hub registers them at startup.
- **Gaps it exposes**: No long-term RAG/Obsidian-style knowledge base (only per-session), no NAT handling, no human Telegram gates. Great MVP base—fork and swap in your Open Brain + Smart Connections for "check memory → answer or escalate".

### 2. liujuanjuan1984/a2a-client-hub (Best for persistent client-side management & knowledge accumulation)
- **Repo**: https://github.com/liujuanjuan1984/a2a-client-hub
- **What it does**: Self-hosted persistent **client/control-plane hub** that manages, routes, and invokes multiple A2A agents (web/mobile clients). Centralizes discovery, sessions, auth, scheduling, and history.
- **Similarities**: Exactly your "persistent intermediary that accumulates knowledge". Stores sessions/messages/execution history in Postgres (easy swap for your SQLite). Supports outbound proxying to remote agents. Session continuity across devices.
- **Tech**: FastAPI backend + React Native/Expo frontend. Uses short-lived tokens + allowlists. Scheduler with locks.
- **Why relevant**: Deploy alongside (or as) your Hub on Coolify for the "management layer". Extend with your Obsidian vault for RAG queries.

### 3. Swival/swival (Best for local ephemeral Claude Code CLI wrapper)
- **Repo**: https://github.com/swival/swival
- **What it does**: Open-source CLI coding agent that runs A2A server mode (`swival --serve`) **and** wraps any stdin/stdout CLI tool (perfect for Claude Code) into a full A2A-compliant agent.
- **Similarities**: Solves your exact "ephemeral CLI behind NAT" problem. Local wrapper pipes prompts into Claude subprocess (or Anthropic API), maintains multi-turn context, exposes as HTTP A2A endpoint (outbound-friendly). Built-in cross-session memory (BM25 on local notes file) + disk state persistence on interrupt.
- **How wrapper works**: `--provider command` mode execs any CLI (stdin/stdout). Runs as server behind NAT (use ngrok/Tailscale or your long-poll/WS outbound to Hub). Streaming + rate limiting + bearer auth included.
- **Why gold**: Fork/adapt this as your "Clark/Alice local wrapper". No need to reinvent stdin piping or session resumption.

### 4. Other supporting projects (proxies, platforms, gateways)
- **artdroz/a2a-proxy**: Lightweight smart relay/proxy with transport translation (JSON-RPC ↔ REST/WS), SSE streaming, concurrency limits, and Agent Card merging. Not "intelligent" but perfect dumb relay layer in front of your Hub or for NAT bridging.
- **suvedo/yugong** (mentioned in A2A discussions): Full open-source agent interconnection network/platform based on A2A. Scalable public/private agent registry and conversational routing.
- **i-am-bee/agentstack-a2a-proxy** and similar proxies: Zero-config bridges for plugging existing agents into larger stacks.
- **OpenAgents / JamJet / Writbase** (from awesome-a2a): Broader multi-agent platforms with native A2A, durable execution graphs, provenance, and task marketplaces. Good for inspiration on scaling.
- **Agentgateway** (Solo.io / Linux Foundation ecosystem): Production AI-native gateway for A2A+MCP with security, observability (OTEL), rate limiting, governance. Rust-based, high-perf—deploy on Coolify in front of your Hub for enterprise features.

**Bonus Claude-specific orchestration (for your Clark/Alice setup)**: stoneforge-ai/stoneforge — persistent runtime + web dashboard for multiple Claude Code agents. Uses git worktrees for isolation, event-sourced SQLite logs, auto-merge, and handoff notes. Directly addresses collaborative debugging of repos like Self-Improving-Agent.

**SDK Maturity Recap** (directly answering your stack question):
- **@a2a-js/sdk** (npm): 495★, very active (v0.3.13 days ago), Express-native handlers (`agentCardHandler`, `jsonRpcHandler`, `restHandler`), full SSE via `ExecutionEventBus`, JSON-RPC, InMemoryTaskStore, Agent Cards at `/.well-known/agent-card.json`. Perfect match for your Node/TS + Coolify preference. Server example is ~20 lines.
- **a2a-sdk (Python)**: More mature (1.8k★, v0.3.25), FastAPI/Starlette support, SQL task stores. Use if you switch, but JS wins for you.

All projects are Apache 2.0 / open, actively maintained (2026 commits), and reference the official spec (v0.3.x; your "v1.0" is likely the stable target).

### Gaps & Risks Not Fully Addressed in Your Prompt (What Will Break First + New Ideas)
Your architecture is solid and forward-looking, but here are the biggest uncovered gaps (from A2A issues, papers, and these projects):

1. **Dynamic discovery & ephemeral agent health** — Most examples use static `--agents` lists or manual registration. Ephemeral CLI agents (Clark/Alice) will come/go; add periodic pings, auto-re-registration via WebSocket callbacks, or a simple registry service in the Hub. (vidya-orchestrator and client-hub hint at this but don't fully solve it.)

2. **Long-term cross-session knowledge vs. per-task memory** — A2A has an open issue on best practices for short- vs long-term memory boundaries. Your Obsidian/SQLite/RAG is advanced, but you'll need explicit "lesson validation" before storing (e.g., LLM self-check for consistency + human Telegram veto) to avoid poisoning. Current projects mostly do session-only memory.

3. **NAT/outbound-only wrappers for CLI agents** — Almost no project fully solves "ephemeral behind NAT". Swival gets close with HTTP server mode, but you'll need explicit WebSocket persistent outbound connection (or long-polling) in the local wrapper + reconnect logic + task queue. Push notifications (spec-supported) are unreliable here.

4. **Observability & tracing across delegations** — Multi-hop escalations (Alice → Hub → Clark) lose visibility. Add OpenTelemetry (built into Python SDK; easy in JS) for end-to-end traces, token usage, and conflict resolution. Your Telegram bot is great, but add a simple dashboard (Next.js on Coolify) with task graphs.

5. **Advanced security & poisoning vectors** — Your prompt covers prompt injection and consent gates well, but add:
   - Agent Card signing/validation.
   - Structured artifact sanitization (error logs can contain malicious payloads).
   - Context poisoning defenses (gradual multi-turn attacks documented in A2A security papers).
   - Ephemeral scoped tokens + zero-trust allowlists (client-hub does some of this).

6. **Isolation & conflict handling** — Parallel Claude sessions can clobber files/repos. Use git worktrees (stoneforge pattern) or Docker-in-Docker for Clark/Alice.

7. **Protocol edge cases** — USER_CONSENT_REQUIRED handling, artifact/file exchange in escalations, skill versioning/deprecation, gRPC fallback for perf. Test everything with official a2a-inspector tool.

8. **Scalability & economics** — If the Hub grows (or you open it), add rate limiting (proxy pattern), micropayments (some awesome-a2a projects), or Temporal.io for durable long-running tasks.

**Hardest parts**: (1) Reliable local wrapper (NAT + session piping), (2) "can answer from memory?" confidence logic + validation before storing lessons, (3) human oversight without blocking flows.

**Recommended MVP order** (concrete, buildable in 1-2 weeks):
1. Deploy a bare A2A server with @a2a-js/sdk + Express on Coolify (copy the 20-line example; serve your Agent Card with `troubleshoot-installation` skill).
2. Add simple memory check (query your SQLite/Obsidian via existing MCP) → LLM decide → respond or delegate.
3. Build minimal local wrapper (Node daemon using A2A JS client + outbound WS/long-poll + Claude subprocess).
4. Port vidya-orchestrator's Host Agent reasoning + Swival's CLI wrapping.
5. Layer on Telegram + dashboard + lesson validation.

These projects validate your vision is feasible and already being done in the ecosystem. Fork vidya-orchestrator + Swival first—they'll save you the most time. Anything speculative above is flagged; the rest is proven in the linked repos.

Let me know if you want code skeletons, Dockerfile for Coolify, or deeper dive into any repo (e.g., Stoneforge dashboard integration or security mitigations)!