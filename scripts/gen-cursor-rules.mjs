#!/usr/bin/env node
/**
 * Regenerate `.cursor/rules/developer-building-checks.mdc` from `.agents/roles/developer.md`
 * (FLEET-AE A1). Safe to run repeatedly: a second run is a no-op when already current.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsx = join(root, "open-brain", "node_modules", "tsx", "dist", "cli.mjs");
const cli = join(root, "open-brain", "src", "scripts", "gen-cursor-rules-cli.ts");

execFileSync(process.execPath, [tsx, cli], { cwd: root, stdio: "inherit" });
