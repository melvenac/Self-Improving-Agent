import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface AgentIdentity {
  name: string;
  role: string;
  partner: string | null;
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
  };
}
