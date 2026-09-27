// Stands in for a claude process: the writer it spawns is its DIRECT child, so
// the writer's process.ppid is this process, as an MCP server's is its claude.
// Prints its pid, waits for "go" on stdin (the test writes the proof in
// between), then runs argv[2..] and relays the child's output and status.
const { spawnSync } = require("child_process");
process.stdout.write(`PID ${process.pid}\n`);
let buf = "";
process.stdin.on("data", (d) => {
  buf += d;
  if (!buf.includes("\n")) return;
  const [cmd, ...args] = process.argv.slice(2);
  const r = spawnSync(cmd, args, { encoding: "utf-8", env: process.env });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  process.exit(r.status ?? 1);
});
