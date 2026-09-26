#!/usr/bin/env node
// QA 114 (T-183): does the omission line's command print what the greeting omitted?
//
// Runs the command EXACTLY as the greeting prints it (`node open-brain/build/cli.js state show --json`),
// from the project root (the only directory where that relative path resolves), and checks that
// every verified claim the render leaves out is in its output with its FULL claim text, byte-identical
// to state.json. Also runs plain `state show` to confirm the handoff's claim that it prints only the count,
// and checks the command writes nothing (git status before/after, state.json bytes before/after).
//
// Usage: node omission-command.mjs <project-root>
import { execSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
const statePath = join(root, ".agents", "state.json");
const bytesBefore = readFileSync(statePath);
const statusBefore = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" });
const state = JSON.parse(bytesBefore.toString("utf8"));

const { renderState, VERIFIED_FULL_TEXT } = await import(pathToFileURL(join(root, "open-brain", "build", "pipelines", "session-start", "state-render.js")).href);
const render = renderState(state, "x", { seat: "planner" }).join("\n");
const omissionLine = render.split("\n").find((l) => l.startsWith("  … ") && l.includes("verified"));
const cmd = omissionLine.slice(omissionLine.indexOf("all of them: ") + "all of them: ".length);

const shownIds = new Set([...render.matchAll(/^  (V-\d+) — /gm)].map((m) => m[1]));
const omitted = state.verified.filter((v) => !shownIds.has(v.id));

const out = execSync(cmd, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
let parsed, parseError = null;
try { parsed = JSON.parse(out); } catch (e) { parseError = String(e).slice(0, 200); }
const printed = parsed?.verified ?? parsed?.data?.verified ?? null;
const byId = new Map((printed ?? []).map((v) => [v.id, v]));
const missing = omitted.filter((v) => !byId.has(v.id)).map((v) => v.id);
const altered = omitted.filter((v) => byId.has(v.id) && byId.get(v.id).claim !== v.claim).map((v) => v.id);
const wholeEqual = printed ? JSON.stringify(printed) === JSON.stringify(state.verified) : false;

const plain = execSync(cmd.replace(/ --json$/, ""), { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
const plainVerified = plain.split("\n").filter((l) => /verified/i.test(l));

const bytesAfter = readFileSync(statePath);
const statusAfter = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" });

console.log(JSON.stringify({
  omission_line: omissionLine, command: cmd, command_matches_constant: cmd === VERIFIED_FULL_TEXT,
  shown: shownIds.size, omitted: omitted.length, total: state.verified.length,
  output_chars: out.length, json_parse_error: parseError,
  omitted_missing_from_output: missing, omitted_with_altered_claim: altered,
  verified_array_identical_to_state_json: wholeEqual,
  plain_state_show_verified_lines: plainVerified,
  state_json_unchanged: Buffer.compare(bytesBefore, bytesAfter) === 0,
  git_status_unchanged: statusBefore === statusAfter,
}, null, 2));
