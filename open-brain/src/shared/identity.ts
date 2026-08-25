// Who the agent is talking to, and what it calls itself.
//
// The slash-command prompts (/start, /end, …) address the user by name and give
// the agent a persona. Those names used to be hard-coded to the framework
// author's, so every consumer who installed the commands was greeted as
// "Aaron" by an agent called "Clark". The templates now carry placeholders and
// this module is the one place that knows how to fill them:
//
//   {{USER_NAME}}   → identity.user_name
//   {{AGENT_NAME}}  → identity.agent_name
//
// setup.mjs collects the values during onboarding and renders the templates as
// it installs them; the /sync mirror-parity check renders the template the same
// way before comparing, so a personalised install is not reported as drift.
// One renderer, two callers — this repo has shipped bugs from two copies of one
// rule often enough that the second copy is not an option.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir, userInfo } from "node:os";

export interface Identity {
  /** What the agent calls the person it is working with. */
  user_name: string;
  /** What the agent calls itself. */
  agent_name: string;
}

export const USER_PLACEHOLDER = "{{USER_NAME}}";
export const AGENT_PLACEHOLDER = "{{AGENT_NAME}}";

/** Any `{{…}}` token left in a rendered file — evidence a copy was never rendered. */
const PLACEHOLDER_PATTERN = /\{\{[A-Z_]+\}\}/g;

export const DEFAULT_AGENT_NAME = "Claude";

/**
 * Where the identity lives. Sits beside the other open-brain state under
 * ~/.claude/open-brain/. The env override exists for tests and for the
 * unattended install path, matching the convention in shared/paths.ts.
 */
export function identityPath(home: string = homedir()): string {
  return process.env.OPEN_BRAIN_IDENTITY || join(home, ".claude", "open-brain", "identity.json");
}

/**
 * The stored identity, or null when onboarding has not run. Null rather than a
 * default so callers can tell "not configured" from "configured as the default":
 * the parity check needs that distinction to decide whether to render at all.
 *
 * A malformed or partial file is treated as absent. Refusing to load half an
 * identity means a rendered command can never contain one real name and one
 * literal placeholder.
 */
export function loadIdentity(home: string = homedir()): Identity | null {
  const path = identityPath(home);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    if (typeof raw?.user_name !== "string" || typeof raw?.agent_name !== "string") return null;
    const user_name = raw.user_name.trim();
    const agent_name = raw.agent_name.trim();
    if (!user_name || !agent_name) return null;
    return { user_name, agent_name };
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity, home: string = homedir()): string {
  const path = identityPath(home);
  mkdirSync(dirname(path), { recursive: true });
  const body = {
    user_name: identity.user_name.trim(),
    agent_name: identity.agent_name.trim(),
  };
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n", "utf-8");
  return path;
}

/**
 * Best-guess identity for a machine that has not been onboarded, used to
 * pre-fill the interactive prompt and as the answer on a non-interactive run.
 *
 * Precedence for the user's name: the first word of `git config user.name`
 * (what a developer actually goes by), then the OS account name, then a plain
 * "there" so the greeting still reads as a sentence ("Hey there"). Each is
 * title-cased — an account name like `jsmith` becomes `Jsmith`, which is at
 * least a name-shaped thing to correct rather than a login string.
 */
export function defaultIdentity(opts: { gitUserName?: string | null; osUserName?: string | null } = {}): Identity {
  const os = opts.osUserName === undefined ? safeOsUserName() : opts.osUserName;
  const candidates = [opts.gitUserName, os];
  for (const c of candidates) {
    const first = (c ?? "").trim().split(/\s+/)[0];
    if (first) return { user_name: titleCase(first), agent_name: DEFAULT_AGENT_NAME };
  }
  return { user_name: "there", agent_name: DEFAULT_AGENT_NAME };
}

function safeOsUserName(): string | null {
  try {
    return userInfo().username || null;
  } catch {
    return null;
  }
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Fill every placeholder. Text without placeholders passes through unchanged. */
export function renderIdentity(text: string, identity: Identity): string {
  return text
    .split(USER_PLACEHOLDER).join(identity.user_name)
    .split(AGENT_PLACEHOLDER).join(identity.agent_name);
}

/** Placeholders still present in `text`, deduplicated, in order of appearance. */
export function unrenderedPlaceholders(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER_PATTERN) ?? [])];
}
