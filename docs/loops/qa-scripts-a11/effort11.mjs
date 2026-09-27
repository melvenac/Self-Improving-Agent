// node effort10.mjs — QA 130 (QA 108 effort10.mjs, repointed): the model and effort of this session, read as JSON from
// the driver's stream (init line) and from the host transcript (every assistant entry), never by pattern match.
import { readFileSync } from "node:fs";
const U = "C:/Users/Aaron Melven";
const run = readFileSync(`${U}/sia-qa130/run-0.jsonl`, "utf-8").replace(/^\uFEFF/, "").split(/\r?\n/);
let sid = process.argv[2] ?? null;
for (const l of run) {
  if (!l.trim().startsWith("{")) continue;
  let o; try { o = JSON.parse(l); } catch { continue; }
  if (o.type === "system" && o.subtype === "init") {
    console.log("init:", JSON.stringify({ model: o.model, session_id: o.session_id, permissionMode: o.permissionMode, claude_code_version: o.claude_code_version, effort: o.effort ?? null, keys_with_effort: Object.keys(o).filter((k) => /effort/i.test(k)) }));
    sid ??= o.session_id;
    break;
  }
}
const t = readFileSync(`${U}/.claude/projects/C--Users-Aaron-Melven-Worktrees-sia-qa/${sid}.jsonl`, "utf-8").split(/\r?\n/);
const c = {}; let n = 0, first = null, last = null;
for (const l of t) {
  if (!l.trim()) continue;
  let o; try { o = JSON.parse(l); } catch { continue; }
  if (o.type !== "assistant") continue;
  n++;
  const k = `model=${o.message?.model} effort=${o.effort} perTurnEffort=${o.perTurnEffort}`;
  c[k] = (c[k] ?? 0) + 1;
  first ??= o.timestamp; last = o.timestamp;
}
console.log(`session ${sid}: assistant entries: ${n}, ${first} -> ${last}`);
for (const [k, v] of Object.entries(c)) console.log(`  ${v} x ${k}`);
