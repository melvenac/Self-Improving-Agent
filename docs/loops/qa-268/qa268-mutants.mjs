// QA 268 row 8: land each mutant in src, tsc --noEmit, run the one test file, restore src from HEAD.
// Writes each mutant's diff to ../../qa268-wt/docs/loops/qa-268/mutants/<name>.diff.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SRC = "src/pipelines/session-start/hub-presence.ts";
const TEST = "tests/pipelines/session-start/hub-presence.test.ts";
const OUT = "/home/agents/qa-scratch/qa268-wt/docs/loops/qa-268/mutants";
mkdirSync(OUT, { recursive: true });

const NOPOLL = 'if (typeof room.pollAgeMs !== "number") return `${partner.label}: listener not polling, ${unread} unread, no listener poll recorded`;';
const AGE = "return `${partner.label}: listener not polling, ${unread} unread since ${formatPollAge(room.pollAgeMs)}`;";
const PING = 'if (typeof room.pollingNow !== "boolean") return bad(`${rat}.pollingNow`, "is not a boolean");';

const mutants = [
  ["pr397-dev-m1-null-maps-to-0", [
    [NOPOLL, NOPOLL.replace('typeof room.pollAgeMs !== "number"', "room.pollAgeMs === undefined")],
    [AGE, AGE.replace("formatPollAge(room.pollAgeMs)", "formatPollAge(room.pollAgeMs ?? 0)")],
  ]],
  ["pr397-qa-m1-absent-still-since-0s", [
    [NOPOLL, NOPOLL.replace('typeof room.pollAgeMs !== "number"', "room.pollAgeMs === null")],
    [AGE, AGE.replace("formatPollAge(room.pollAgeMs)", "formatPollAge(room.pollAgeMs ?? 0)")],
  ]],
  ["pr397-qa-m2-null-room-dropped", [
    [PING, PING + "\n      if (room.pollAgeMs === null) { agent.rooms.splice(j, 1); continue; }"],
  ]],
  ["pr397-qa-p3-zero-age-is-no-poll", [
    [NOPOLL, NOPOLL.replace('typeof room.pollAgeMs !== "number"', "!room.pollAgeMs")],
  ]],
];

const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", shell: false });
const orig = readFileSync(SRC, "utf8");
for (const [name, edits] of mutants) {
  let text = orig;
  for (const [from, to] of edits) {
    if (!text.includes(from)) { console.log(`${name}: ANCHOR NOT FOUND`); process.exit(3); }
    text = text.replace(from, to);
  }
  writeFileSync(SRC, text);
  writeFileSync(`${OUT}/${name}.diff`, run("git", ["diff", "--", SRC]).stdout);
  const tsc = run("npx", ["tsc", "--noEmit"]);
  const vt = run("npx", ["vitest", "run", TEST]);
  const out = vt.stdout + vt.stderr;
  const counts = (out.match(/Tests\s+([^\n]*)/) ?? [, "?"])[1].replace(/\x1b\[[0-9;]*m/g, "").trim();
  const failed = [...out.matchAll(/×\s+(?:.*?>\s+)?(T237-[^\n]*?|R\d[^\n]*?|[^>\n]*?)\s+\d+ms/g)].map((m) => m[1].trim());
  console.log(`${name}: tsc=${tsc.status} vitest=${vt.status} ${counts}`);
  for (const f of failed) console.log(`   red: ${f}`);
  writeFileSync(SRC, orig);
}
const clean = run("git", ["status", "--short", "--", "src"]).stdout.trim();
console.log(`src after restore: ${clean === "" ? "clean" : clean}`);
