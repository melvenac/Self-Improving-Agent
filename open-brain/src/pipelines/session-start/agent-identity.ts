import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface AgentIdentity {
  name: string;
  role: string;
  partner: string | null;
  mailbox_channel: string | null;
}

export function readAgentIdentity(cwd: string): AgentIdentity | null {
  const path = join(cwd, ".agents", "AGENT.md");
  if (!existsSync(path)) return null;

  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const value = m[2].trim();
    if (!value || value.startsWith("<")) continue;
    fields[m[1]] = value;
  }

  if (!fields.name || !fields.role) return null;

  return {
    name: fields.name,
    role: fields.role,
    partner: fields.partner || null,
    mailbox_channel: fields.mailbox_channel || null,
  };
}

export interface MailboxState {
  inboxFile: string;
  messageCount: number;
  lastDecision: string | null;
}

export function readMailboxState(home: string, channel: string, agentName: string, partner: string): MailboxState | null {
  const channelDir = join(home, ".agents", "mailbox", "channels", channel);
  if (!existsSync(channelDir)) return null;

  const inboxFile = `${partner.toLowerCase()}-to-${agentName.toLowerCase()}.md`;
  const inboxPath = join(channelDir, inboxFile);

  let messageCount = 0;
  if (existsSync(inboxPath)) {
    const raw = readFileSync(inboxPath, "utf8");
    const matches = raw.match(/^## \[/gm);
    messageCount = matches ? matches.length : 0;
  }

  let lastDecision: string | null = null;
  const decisionsPath = join(channelDir, "decisions.md");
  if (existsSync(decisionsPath)) {
    const raw = readFileSync(decisionsPath, "utf8");
    const dates: string[] = [];
    for (const m of raw.matchAll(/^## (\d{4}-\d{2}-\d{2})/gm)) {
      dates.push(m[1]);
    }
    dates.sort();
    lastDecision = dates.length > 0 ? dates[dates.length - 1] : null;
  }

  return { inboxFile, messageCount, lastDecision };
}
