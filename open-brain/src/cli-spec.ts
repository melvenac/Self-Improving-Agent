import type { CommandSpec } from "./shared/cli-args.js";

/**
 * The flags each `open-brain` subcommand accepts (T-185). Kept apart from
 * cli.ts, which runs on import, so a test can walk every declaration.
 *
 * `state import` is NOT here: it has its own parser (T-150, importer round 2
 * R2-4) and its section of cli.ts is out of this change's scope.
 */
export const COMMAND_SPECS = {
  sync: {
    name: "sync",
    booleans: ["--check", "--score", "--json", "--history"],
    values: {},
    positionals: "directory",
  },
  start: {
    name: "start",
    booleans: [],
    values: {},
    positionals: "directory",
  },
  relocate: {
    name: "relocate",
    booleans: ["--apply"],
    values: { "--from": "both", "--to": "both" },
    positionals: "none",
  },
  topics: {
    name: "topics",
    booleans: ["--apply"],
    values: { "--min": "equals" },
    positionals: "none",
  },
  detach: {
    name: "detach",
    booleans: ["--dry-run", "--no-fetch", "--force"],
    values: {},
    positionals: "directory",
  },
  stateShow: {
    name: "state show",
    booleans: ["--json"],
    values: {},
    positionals: "directory",
  },
  stateMigrate: {
    name: "state migrate",
    booleans: ["--keep-revision", "--dry-run"],
    values: { "--seat": "space", "--last-session-seat": "space" },
    positionals: "any",
  },
} as const satisfies Record<string, CommandSpec>;
