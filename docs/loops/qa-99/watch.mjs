#!/usr/bin/env node
// Live, read-only view of a headless QA run on the QA PC: follows the driver's stream-json log over ssh and prints
// each step as a readable line. It never writes to the QA PC and never touches the run.
// Usage: node docs/loops/qa-99/watch.mjs [--dir sia-qaNN] [--attempt N] [--once]
//   --dir NAME   the driver's output folder under the profile (default sia-qa99; QA 102 is sia-qa102)
//   --attempt N  start from attempt N (default 0); the view moves on to the next attempt by itself
//   --once       print what has been logged so far and exit, instead of following
import { spawn, execFileSync } from "node:child_process";
import readline from "node:readline";

const HOST = "100.73.250.101";
const USER = "Aaron Melven";
const args = process.argv.slice(2);
const di = args.indexOf("--dir");
const dirName = di >= 0 ? args[di + 1] : "sia-qa99";
if (!/^sia-qa\d+$/.test(dirName ?? "")) { console.error(`watch: --dir must look like sia-qaNN, got '${dirName}'`); process.exit(2); }
const DIR = `C:\\Users\\AARONM~1\\${dirName}`; // the 8.3 name: no space, so no quoting through the remote cmd
const once = args.includes("--once");
const ai = args.indexOf("--attempt");
let attempt = ai >= 0 ? Number(args[ai + 1]) : 0;

const c = { dim: "\x1b[2m", cyan: "\x1b[36m", yellow: "\x1b[33m", green: "\x1b[32m", red: "\x1b[31m", bold: "\x1b[1m", off: "\x1b[0m" };
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const one = (s, n = 160) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const ssh = (remote) => ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "LogLevel=ERROR", "-l", USER, HOST, remote];

function toolLine(name, input = {}) {
  switch (name) {
    case "Bash": return `${c.cyan}$${c.off} ${one(input.command, 200)}`;
    case "Read": return `${c.cyan}read${c.off} ${input.file_path}`;
    case "Write": return `${c.cyan}write${c.off} ${input.file_path}`;
    case "Edit": return `${c.cyan}edit${c.off} ${input.file_path}`;
    case "Grep": return `${c.cyan}grep${c.off} ${one(input.pattern, 80)}${input.path ? "  in " + input.path : ""}`;
    case "Glob": return `${c.cyan}glob${c.off} ${input.pattern}`;
    default: return `${c.cyan}${name}${c.off} ${one(JSON.stringify(input), 140)}`;
  }
}

function resultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => (p.type === "text" ? p.text : `[${p.type}]`)).join(" ");
  return "";
}

let sawResult = false;
function show(line) {
  const i = line.indexOf("{");
  if (i < 0) return;
  let o;
  try { o = JSON.parse(line.slice(i)); } catch { return; }
  const t = `${c.dim}${now()}${c.off}`;
  if (o.type === "system" && o.subtype === "init") {
    console.log(`${t} ${c.bold}attempt ${attempt} started${c.off}  session ${o.session_id}  model ${o.model}  mode ${o.permissionMode}`);
  } else if (o.type === "assistant") {
    for (const p of o.message?.content ?? []) {
      if (p.type === "text" && p.text.trim()) console.log(`${t} ${c.yellow}QA:${c.off} ${p.text.trim()}`);
      else if (p.type === "tool_use") console.log(`${t} ${toolLine(p.name, p.input)}`);
    }
    if (o.message?.stop_reason === "refusal") {
      console.log(`${t} ${c.red}${c.bold}REFUSAL${c.off} ${JSON.stringify(o.message.stop_details ?? {})}`);
    }
  } else if (o.type === "user") {
    for (const p of o.message?.content ?? []) {
      if (p.type !== "tool_result") continue;
      const text = resultText(p.content);
      if (p.is_error) console.log(`${t}   ${c.red}✗ ${one(text, 200)}${c.off}`);
      else console.log(`${t}   ${c.dim}✓ ${text.split("\n").length} line(s)${text.trim() ? ": " + one(text.split("\n")[0], 100) : ""}${c.off}`);
    }
  } else if (o.type === "result") {
    sawResult = true;
    const colour = o.is_error ? c.red : c.green;
    console.log(`${t} ${colour}${c.bold}attempt ${attempt} ended${c.off}: ${o.subtype}, ${o.num_turns} turns, $${Number(o.total_cost_usd ?? 0).toFixed(2)}, ${(o.permission_denials ?? []).length} permission denial(s)`);
  }
}

function remoteExists(name) {
  const out = execFileSync("ssh", ssh(`if exist ${DIR}\\${name} (echo yes) else (echo no)`), { encoding: "utf8" });
  return out.trim().endsWith("yes");
}

async function follow() {
  const file = `${DIR}\\run-${attempt}.jsonl`;
  const ps = `powershell -NoProfile -Command [Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Content -Path ${file} -Encoding UTF8${once ? "" : " -Wait"}`;
  sawResult = false;
  const child = spawn("ssh", ssh(ps), { stdio: ["ignore", "pipe", "inherit"] });
  const rl = readline.createInterface({ input: child.stdout });
  rl.on("line", (l) => { show(l); if (sawResult && !once) child.kill(); });
  await new Promise((r) => child.on("close", r));
}

console.log(`${c.dim}watching ${dirName} on ${HOST} (read-only). Ctrl+C stops the view, not the run.${c.off}`);
for (;;) {
  await follow();
  if (once) break;
  // The attempt ended. Either the driver finished, or it is about to resume in the next attempt.
  for (;;) {
    if (remoteExists(`run-${attempt + 1}.jsonl`)) { attempt += 1; break; }
    if (remoteExists("done")) {
      console.log(`${c.bold}driver finished.${c.off} Its summary:`);
      console.log(execFileSync("ssh", ssh(`type ${DIR}\\drive.meta`), { encoding: "utf8" }));
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 20000));
  }
}
