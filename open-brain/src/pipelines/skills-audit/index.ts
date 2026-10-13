import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { readAgentIdentity } from "../session-start/agent-identity.js";
import { deriveProjectKey } from "../session-start/session-discovery.js";

/**
 * T-262 part 1: the shell commands a session repeated, read from its transcripts.
 *
 * Deterministic and read-only: it opens transcripts and the seat's `-ops` skill
 * directory for reading and writes nothing. It imports no memory-side module, so
 * it runs where better-sqlite3 does not.
 *
 * A key is "program plus subcommand or script name, generic tools dropped".
 * Keying on the full command found almost nothing repeated; keying on the first
 * word alone was swamped by grep, sed and cat. Sequences of consecutive calls were
 * dominated by `git fetch` next to everything and are not detected.
 */

export const GENERIC_PROGRAMS: ReadonlySet<string> = new Set([
  "grep", "sed", "cat", "head", "tail", "wc", "ls", "echo", "awk", "sleep",
  "for", "while", "if", "printf", "cut", "sort", "uniq", "tr", "test", "true",
  "mkdir", "rm", "cp", "mv", "cd", "export", "set", "done", "do", "then",
  "fi", "iconv", "find", "xargs", "jq", "Get-Content", "Select-Object", "Select-String", "Write-Output", "break",
  "continue", "exit", "case", "esac", "timeout", "date", "return", "local", "read", "Q",
]);

const SCRIPT_RUNNERS = new Set(["node", "bash", "sh", "python", "tsx", "pwsh", "powershell"]);
const SUBCOMMAND_WORDS: Record<string, number> = { gh: 2, git: 1, npm: 1, npx: 1 };
const SCRIPT_TOKEN = /\.(m?js|cjs|ts|sh|py|ps1)['"]?$/;
const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;
const UUID_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HIT_THRESHOLD = 3;

/** Cursor's project key: every run of non-alphanumerics becomes one `-`, ends trimmed. */
const projectKey = (dir: string): string => dir.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const stripPath = (token: string): string => token.replace(/^.*[\\/]/, "");

export function commandKeys(command: string): string[] {
  const heredoc = command.search(/<<-?'?\w+'?/);
  const body = heredoc === -1 ? command : command.slice(0, heredoc);
  const flat = body.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, "Q").replace(/\$\([^()]*\)/g, "Q");

  const keys: string[] = [];
  for (const raw of flat.split(/\s*(?:&&|\|\||;|\||\n)\s*/)) {
    const tokens = raw.trim().replace(/^(\w+=\S*\s+)+/, "").split(/\s+/);
    // A segment that is only an assignment (`S=C:/a/scripts`) has no program.
    if (/^\w+=/.test(tokens[0])) continue;
    const p = stripPath(tokens[0]);
    if (!/^[A-Za-z][\w.-]*$/.test(p) || GENERIC_PROGRAMS.has(p)) continue;
    const rest = tokens.slice(1);

    let key = p;
    if (p in SUBCOMMAND_WORDS) {
      const words = rest.filter((t) => /^[a-z][a-z-]*$/.test(t)).slice(0, SUBCOMMAND_WORDS[p]);
      key = [p, ...words].join(" ");
    } else if (SCRIPT_RUNNERS.has(p)) {
      const script = rest.find((t) => SCRIPT_TOKEN.test(t));
      if (script) key = `${p} ${stripPath(script.replace(/['"]/g, ""))}`;
      else if (rest[0] === "-e") key = `${p} -e`;
    }
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

export type AuditRuntime = "claude" | "cursor";

export function readShellCommands(file: string, runtime: AuditRuntime = "claude"): { commands: string[]; unparsed: number } {
  const commands: string[] = [];
  let unparsed = 0;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      unparsed++;
      continue;
    }
    if (runtime === "cursor") {
      // Cursor lines carry no `type`: {"role":"assistant","message":{"content":[...]}}.
      if (entry?.role !== "assistant" || !Array.isArray(entry.message?.content)) continue;
      for (const item of entry.message.content) {
        if (item?.type === "tool_use" && item.name === "Shell" && typeof item.input?.command === "string") {
          commands.push(item.input.command);
        }
      }
      continue;
    }
    if (entry?.type !== "assistant" || entry.isSidechain === true || !Array.isArray(entry.message?.content)) continue;
    for (const item of entry.message.content) {
      if (item?.type === "tool_use" && (item.name === "Bash" || item.name === "PowerShell") && typeof item.input?.command === "string") {
        commands.push(item.input.command);
      }
    }
  }
  return { commands, unparsed };
}

export interface AuditOptions {
  projectDir: string;
  home: string;
  session?: string;
  last?: number;
  seat?: string;
  runtime?: AuditRuntime;
  /** Absolute path to one transcript file; it is this session and `session` is ignored. */
  transcript?: string;
}

export interface AuditRow {
  key: string;
  thisSession: number;
  sessions: number;
  windowTotal: number;
  status: "by-hand" | "script";
}

export interface AuditReport {
  runtime: AuditRuntime;
  seat: string | null;
  opsDir: string | null;
  transcriptDir: string;
  session: string;
  window: string[];
  shellCalls: number;
  unparsed: number;
  rows: AuditRow[];
  ignoredHits: number;
  scriptsCalled: { script: string; count: number }[];
}

/** One line per key; text after the first ` # ` is a reason. */
function readIgnored(opsDir: string | null): Set<string> {
  const file = opsDir && join(opsDir, "audit-ignore.txt");
  if (!file || !existsSync(file)) return new Set();
  const keys = new Set<string>();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    const cut = line.indexOf(" # ");
    keys.add((cut === -1 ? line : line.slice(0, cut)).trim());
  }
  return keys;
}

function countKeys(commands: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of commands) for (const k of commandKeys(c)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

interface TranscriptFile {
  name: string;
  path: string;
  mtime: number;
}

const byNewest = (a: TranscriptFile, b: TranscriptFile): number =>
  b.mtime - a.mtime || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Claude Code: `<dir>/<uuid>.jsonl`. Cursor: `<dir>/<uuid>/<uuid>.jsonl`, nothing deeper. */
function listTranscripts(dir: string, runtime: AuditRuntime): TranscriptFile[] {
  const out: TranscriptFile[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (runtime === "claude") {
      if (!e.isFile() || !UUID_FILE.test(e.name)) continue;
      const path = join(dir, e.name);
      out.push({ name: e.name, path, mtime: statSync(path).mtimeMs });
    } else {
      if (!e.isDirectory() || !UUID_NAME.test(e.name)) continue;
      const path = join(dir, e.name, `${e.name}.jsonl`);
      if (existsSync(path)) out.push({ name: `${e.name}.jsonl`, path, mtime: statSync(path).mtimeMs });
    }
  }
  return out.sort(byNewest);
}

/** Throws an Error whose message is the CLI's stderr line when there is nothing to read. */
export function auditSkills(opts: AuditOptions): AuditReport {
  const runtime: AuditRuntime = opts.runtime ?? "claude";
  const seat = opts.seat?.trim().toLowerCase() || (readAgentIdentity(opts.projectDir)?.name.toLowerCase() ?? null);
  const candidate = seat ? join(opts.home, ".claude", "skills", `${seat}-ops`) : null;
  const opsDir = candidate && existsSync(candidate) ? candidate : null;

  const projects = join(opts.home, runtime === "cursor" ? ".cursor" : ".claude", "projects");
  let transcriptDir: string | null;
  if (opts.transcript !== undefined) {
    const holder = dirname(opts.transcript);
    transcriptDir = runtime === "cursor" ? dirname(holder) : holder;
  } else if (runtime === "cursor") {
    const expected = projectKey(opts.projectDir).toLowerCase();
    const dirName = existsSync(projects) ? readdirSync(projects).find((d) => d.toLowerCase() === expected) : undefined;
    transcriptDir = dirName ? join(projects, dirName, "agent-transcripts") : null;
  } else {
    const expected = deriveProjectKey(opts.projectDir).toLowerCase();
    const dirName = existsSync(projects) ? readdirSync(projects).find((d) => d.toLowerCase() === expected) : undefined;
    transcriptDir = dirName ? join(projects, dirName) : null;
  }
  const files = transcriptDir && existsSync(transcriptDir) ? listTranscripts(transcriptDir, runtime) : [];
  if (opts.transcript !== undefined && existsSync(opts.transcript)) {
    // A named file is this session even when its name is not a uuid.
    const want = resolve(opts.transcript).toLowerCase();
    if (!files.some((f) => resolve(f.path).toLowerCase() === want)) {
      const name = basename(opts.transcript);
      files.unshift({ name, path: opts.transcript, mtime: statSync(opts.transcript).mtimeMs });
    }
  }
  if (!transcriptDir || files.length === 0) {
    throw new Error(`skills-audit: no transcripts for ${opts.projectDir} under ${projects}`);
  }

  let start: number;
  if (opts.transcript !== undefined) {
    const want = resolve(opts.transcript).toLowerCase();
    start = files.findIndex((f) => resolve(f.path).toLowerCase() === want);
    if (start === -1) throw new Error(`skills-audit: no transcript ${opts.transcript} in ${transcriptDir}`);
  } else {
    start = opts.session === undefined ? 0 : files.findIndex((f) => f.name === `${opts.session}.jsonl`);
    if (start === -1) {
      throw new Error(`skills-audit: no transcript ${opts.session}.jsonl in ${transcriptDir}`);
    }
  }
  const picked = files.slice(start, start + Math.max(1, opts.last ?? 5));

  const perFile = picked.map((f) => {
    const read = readShellCommands(f.path, runtime);
    return { read, counts: countKeys(read.commands) };
  });
  const [current] = perFile;

  const ignored = readIgnored(opsDir);
  const scriptsDir = opsDir ? join(opsDir, "scripts") : null;
  const scriptNames = new Set(scriptsDir && existsSync(scriptsDir) ? readdirSync(scriptsDir) : []);
  const statusOf = (key: string): "ignored" | "script" | "by-hand" => {
    if (ignored.has(key)) return "ignored";
    const words = key.split(" ");
    return words.length >= 2 && scriptNames.has(words[words.length - 1]) ? "script" : "by-hand";
  };

  const rows: AuditRow[] = [];
  const scriptsCalled: { script: string; count: number }[] = [];
  let ignoredHits = 0;
  for (const [key, thisSession] of current.counts) {
    const status = statusOf(key);
    if (status === "script") scriptsCalled.push({ script: key.split(" ").pop()!, count: thisSession });
    if (thisSession < HIT_THRESHOLD) continue;
    if (status === "ignored") {
      ignoredHits++;
      continue;
    }
    rows.push({
      key,
      thisSession,
      sessions: perFile.filter((f) => f.counts.has(key)).length,
      windowTotal: perFile.reduce((n, f) => n + (f.counts.get(key) ?? 0), 0),
      status,
    });
  }
  rows.sort((a, b) => b.thisSession - a.thisSession || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  scriptsCalled.sort((a, b) => b.count - a.count || (a.script < b.script ? -1 : a.script > b.script ? 1 : 0));

  return {
    runtime,
    seat,
    opsDir,
    transcriptDir,
    session: picked[0].name.replace(/\.jsonl$/, ""),
    window: picked.map((f) => f.name.replace(/\.jsonl$/, "")),
    shellCalls: current.read.commands.length,
    unparsed: current.read.unparsed,
    rows,
    ignoredHits,
    scriptsCalled,
  };
}

export function renderAudit(report: AuditReport): string {
  const byHand = report.rows.filter((r) => r.status === "by-hand").length;
  const script = report.rows.length - byHand;
  const lines = [
    `skills-audit: seat ${report.seat ?? "none"} · ops ${report.opsDir ?? "none"} · session ${report.session.slice(0, 8)} · window ${report.window.length} sessions · ${report.shellCalls} shell calls · ${report.unparsed} unparsed lines${report.runtime === "cursor" ? " · cursor" : ""}`,
    "this  sess  window  status   key",
    ...report.rows.map(
      (r) => `${String(r.thisSession).padStart(4)}  ${String(r.sessions).padStart(4)}  ${String(r.windowTotal).padStart(6)}  ${r.status.padEnd(7)}  ${r.key}`,
    ),
    `hits: ${byHand} by-hand, ${script} script, ${report.ignoredHits} ignored`,
    `scripts called: ${report.scriptsCalled.length ? report.scriptsCalled.map((s) => `${s.script}×${s.count}`).join(", ") : "none"}`,
  ];
  return lines.join("\n");
}
