// QA 253 rows 4 and 7: call the candidate's ob_start handler (handleStart) on a SCRATCH worktree at the
// candidate, with every writable path redirected into ~/qa-scratch/qa253-home. Never the live record or DB.
// Run from ~/qa-scratch/qa253-cand/open-brain: npx tsx <this file>
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCR = "/home/agents/qa-scratch";
const HOME = join(SCR, "qa253-home");
const PROJECT = join(SCR, "qa253-live");
mkdirSync(join(HOME, ".claude", "open-brain"), { recursive: true });
Object.assign(process.env, {
  HOME, USERPROFILE: HOME, TMPDIR: "/home/agents/qa-tmp",
  KNOWLEDGE_V2_DB: join(HOME, ".claude", "open-brain", "knowledge-v2.db"),
  OPEN_BRAIN_SCORE_HISTORY: join(HOME, "score-history.jsonl"),
  OPEN_BRAIN_SHADOW_LOG: join(HOME, "shadow-recall.jsonl"),
  OPEN_BRAIN_ACTIVE_SESSION: join(HOME, "active-session.json"),
  OPEN_BRAIN_VAULT_DIR: join(HOME, "vault"),
});

const statePath = join(PROJECT, ".agents", "state.json");
const rawBefore = readFileSync(statePath, "utf8");
const gapsBefore = (JSON.parse(rawBefore).gaps as { id: string; opened_session: number; status?: string }[]);

const { handleStart } = await import("/home/agents/qa-scratch/qa253-cand/open-brain/src/server.ts");
const text = (await handleStart({ project_root: PROJECT })).content[0]!.text as string;

const rawAfter = readFileSync(statePath, "utf8");
const gapsAfter = (JSON.parse(rawAfter).gaps as { id: string }[]);
const lines = text.split("\n");
const gi = lines.findIndex((l) => /^Gaps \(\d+\):/.test(l));
console.log("record gaps[] order (first 12):", gapsBefore.slice(0, 12).map((g) => `${g.id}@${g.opened_session}${g.status === "closed" ? "(closed)" : ""}`).join(" "));
console.log("rendered gaps section (first 12):");
for (const l of lines.slice(gi, gi + 13)) console.log("  | " + l.slice(0, 90));
console.log("gaps[] ids identical before/after:", JSON.stringify(gapsBefore.map((g) => g.id)) === JSON.stringify(gapsAfter.map((g) => g.id)));
console.log("state.json byte-identical before/after:", rawBefore === rawAfter);
console.log("Latest brief lines:", JSON.stringify(lines.filter((l) => l.startsWith("Latest brief"))));
