// T-315 step 0 probe: how does Claude Code treat a stdio MCP server that (a) exits after a call, (b) adds a tool mid-session?
// Run from open-brain/ (it resolves @modelcontextprotocol/sdk from open-brain/node_modules):
//   node probe-server.mjs <exit|listchanged> <log file>
// Every start and every tool call is appended to the log file, so the run shows whether the host respawned the process.
import { appendFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const [mode, log] = process.argv.slice(2);
const note = (line) => appendFileSync(log, `${new Date().toISOString()} pid=${process.pid} ${line}\n`);
note(`START mode=${mode}`);

const server = new McpServer({ name: "probe", version: "0.0.1" });

if (mode === "exit") {
  // (a) Answers once, then exits as a server would on noticing a new build.
  server.tool("probe_ping", "Returns this server's process id.", async () => {
    note("CALL probe_ping");
    setTimeout(() => { note("EXIT"); process.exit(0); }, 300);
    return { content: [{ type: "text", text: `pid ${process.pid}` }] };
  });
} else {
  // (b) Calling probe_a registers probe_b after connect; the SDK then sends notifications/tools/list_changed.
  server.tool("probe_a", "Call this first. It makes a second tool, probe_b, available.", async () => {
    note("CALL probe_a");
    server.tool("probe_b", "Returns the word RELOADED.", async () => {
      note("CALL probe_b");
      return { content: [{ type: "text", text: "RELOADED" }] };
    });
    note("REGISTERED probe_b (list_changed sent)");
    return { content: [{ type: "text", text: "probe_b is now registered" }] };
  });
}

await server.connect(new StdioServerTransport());
