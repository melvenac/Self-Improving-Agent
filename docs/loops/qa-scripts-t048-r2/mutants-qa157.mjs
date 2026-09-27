// QA 157 mutants for T-048 r2 (candidate 5b9a403). Each mutant is an anchored substitution set: every anchor must
// match EXACTLY ONCE, the diff must be non-empty, `tsc --noEmit -p .` must exit 0. Local run: the named files.
// Sources are restored and hash-checked after every local run.
// Usage: node mutants-qa157.mjs <mutTreeRoot> [--only <name>] [--commit <name>]
//   --commit <name>: apply, tsc, commit on qa/t048-r2-mut-<name> from 5b9a403 (git -c user.name="QA 157 (Claude)"), leave the branch checked out.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const S = "open-brain/src/";
const MUTANTS = {
  "hook-old-lines": {
    breaks: "the SessionEnd hook prints the pre-T-048 three lines again (the distinctions never reach the hook's printed line)",
    edits: [
      [S + "cli-session-end.ts", 'import { formatSessionEndLines, sessionEndV2 } from "./pipelines/session-end/index-v2.js";', 'import { sessionEndV2 } from "./pipelines/session-end/index-v2.js";'],
      [S + "cli-session-end.ts", "    for (const line of formatSessionEndLines(result)) console.log(`[session-end] ${line}`);",
        '    const genLabel = result.summary.selfGenerated ? " (self-generated)" : "";\n' +
        '    console.log(`[session-end] Summary: ${result.summary.written ? "written" : "skipped"}${genLabel}`);\n' +
        "    console.log(`[session-end] Feedback: ${result.feedback.processed} entries`);\n" +
        "    console.log(`[session-end] Invocations: ${result.invocations.logged} logged`);"],
    ],
  },
  "s5-omitted-fabricated": {
    breaks: "an omitted judgment is named AND rated from the tag match (R-010's fabricated rating returns)",
    edits: [[S + "pipelines/session-end/index-v2.ts", "    if (supplied === undefined) {\n      omitted.push(id);\n      continue;\n    }", "    if (supplied === undefined) {\n      omitted.push(id);\n    }"]],
  },
  "s16-counter-before-event": {
    breaks: "the knowledge_index counter moves before the feedback_log write, as at 1646567 (the count and the name stay right)",
    edits: [
      [S + "pipelines/session-end/index-v2.ts", "    let wrote = true;\n    if (sessionId) {", "    updateFeedbackV2(db, row.vault_path, rating);\n    let wrote = true;\n    if (sessionId) {"],
      [S + "pipelines/session-end/index-v2.ts", "    if (!wrote) continue;\n    updateFeedbackV2(db, row.vault_path, rating);\n", "    if (!wrote) continue;\n"],
    ],
  },
  "s6-corrupt-earns-recency": {
    breaks: "Pipeline Health names the log state but scores a corrupt or unreadable log as a run within 24 h",
    edits: [
      [S + "pipelines/sync/scorer.ts", '    invocationLog = "corrupt";\n', '    invocationLog = "corrupt";\n    hookRecency = 4;\n'],
      [S + "pipelines/sync/scorer.ts", '    invocationLog = "unreadable";\n', '    invocationLog = "unreadable";\n    hookRecency = 4;\n'],
    ],
  },
  "s14-skip-over-match": {
    breaks: "any unreadable db in the sessions dir hides the db that DOES hold the session (skip instead of summary)",
    edits: [
      [S + "pipelines/session-end/session-summary.ts", "    const unreadable: string[] = [];\n", "    const unreadable: string[] = [];\n    let matched: string | null = null;\n"],
      [S + "pipelines/session-end/session-summary.ts", "        if (meta?.session_id === targetSessionId) return file.path;", "        if (meta?.session_id === targetSessionId) matched = file.path;"],
      [S + "pipelines/session-end/session-summary.ts", '    return { skipped: "no db holds this session" };\n', '    if (matched) return matched;\n    return { skipped: "no db holds this session" };\n'],
    ],
  },
  "s15-notadb-escapes": {
    breaks: "the new catch in extractSessionSummary is removed: a garbage session db throws SQLITE_NOTADB out of session end again",
    edits: [[S + "pipelines/session-end/session-summary.ts",
      "  } catch (err) {\n    // better-sqlite3 reports a garbage file on the first statement, not the\n    // constructor. That throw used to escape session end (SILENT 15).\n    return { skipped: `summary db unreadable: ${errorText(err)}` };\n  } finally {",
      "  } finally {"]],
  },
};
const FILES = ["tests/t048-r2.test.ts", "tests/pipelines/session-end/index-v2.test.ts", "tests/pipelines/sync/pipeline-health.test.ts",
  "tests/pipelines/sync/scorer.test.ts", "tests/rating-method.test.ts", "tests/server.test.ts", "tests/shared/handoff-guard.test.ts"];

const [root, ...rest] = process.argv.slice(2);
const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const only = opt("--only"), commit = opt("--commit");
const ob = join(root, "open-brain");
const sh = (cmd, args, cwd, extra = {}) => spawnSync(cmd, args, { cwd, encoding: "utf8", shell: cmd === "npx" && process.platform === "win32", maxBuffer: 64 << 20, ...extra });
const hash = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");

function apply(name) {
  const m = MUTANTS[name];
  const touched = new Map();
  for (const [rel, from, to] of m.edits) {
    const f = join(root, rel);
    const src = touched.get(f) ?? readFileSync(f, "utf8");
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error(`${name}: anchor matched ${n} times in ${rel}: ${JSON.stringify(from.slice(0, 80))}`);
    touched.set(f, src.replace(from, to));
  }
  const originals = new Map();
  for (const [f, s] of touched) { originals.set(f, { text: readFileSync(f, "utf8"), sha: hash(f) }); writeFileSync(f, s); }
  return originals;
}
function restore(originals) {
  let ok = true;
  for (const [f, o] of originals) { writeFileSync(f, o.text); ok &&= hash(f) === o.sha; }
  return ok;
}

if (commit) {
  const branch = `qa/t048-r2-mut-${commit}`;
  let r = sh("git", ["checkout", "-q", "-B", branch, "5b9a403"], root);
  if (r.status !== 0) throw new Error(r.stderr);
  apply(commit);
  const diff = sh("git", ["diff", "--stat"], root).stdout.trim();
  if (!diff) throw new Error("empty diff");
  const tsc = sh("npx", ["tsc", "--noEmit", "-p", "."], ob);
  if (tsc.status !== 0) throw new Error(`tsc failed: ${tsc.stdout}`);
  sh("git", ["add", "-A", "open-brain/src"], root);
  r = sh("git", ["-c", "user.name=QA 157 (Claude)", "-c", "user.email=melvenac@gmail.com", "commit", "-q", "-m",
    `qa(t048-r2): mutant ${commit}, NOT FOR MERGE (QA 157)\n\n${MUTANTS[commit].breaks}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`], root);
  if (r.status !== 0) throw new Error(r.stderr + r.stdout);
  console.log(`${branch} ${sh("git", ["rev-parse", "HEAD"], root).stdout.trim()} (${diff.split("\n").pop().trim()})`);
} else {
  for (const name of only ? [only] : Object.keys(MUTANTS)) {
    const originals = apply(name);
    const diff = sh("git", ["diff", "--stat"], root).stdout.trim();
    const tsc = sh("npx", ["tsc", "--noEmit", "-p", "."], ob);
    const t = sh("npx", ["vitest", "run", ...FILES], ob, { env: { ...process.env, NO_COLOR: "1" } });
    const out = t.stdout + t.stderr;
    const tests = (out.match(/^\s*Tests\s+.*$/m) || ["(no Tests line)"])[0].trim();
    const fails = [...new Set((out.match(/^\s*(?:FAIL|×)\s+tests\/.*$/gm) || []).map((l) => l.trim()))];
    const ok = restore(originals);
    console.log(`== ${name}: diff ${diff ? "non-empty" : "EMPTY"}; tsc exit ${tsc.status}; ${tests}; restored: ${ok}`);
    for (const f of fails) console.log(`   ${f.slice(0, 220)}`);
  }
}
