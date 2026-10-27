#!/usr/bin/env node

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSync } from "./pipelines/sync/index.js";
import {
  scoreConfigStructure,
  scoreKnowledgeQuality,
  scoreStaleness,
  scoreCoverage,
  scorePipelineHealth,
} from "./pipelines/sync/scorer.js";
import { appendScore, readHistory, calculateTrend } from "./pipelines/sync/history.js";
import { formatScoreCategoryLine } from "./pipelines/sync/score-line.js";
import { resolvePaths } from "./shared/paths.js";
import { resolveRepoRoot, describeNoRoot } from "./shared/repo-root.js";
import type { ScoreResult, CategoryScore, MemoryChecks } from "./pipelines/sync/types.js";
import { parseOrRefuse } from "./shared/cli-args.js";
import { COMMAND_SPECS } from "./cli-spec.js";

/**
 * Load the memory module's sync checks, or return undefined if it is not
 * installed.
 *
 * Loop 13 (the module boundary). This dynamic import is the composition root:
 * it is the ONE place that knows both halves exist. `checks-memory.js` pulls in
 * `better-sqlite3`, a native build, so a static import here would make the
 * protocol CLI — version strings, hook wiring, state views — unusable on any
 * machine that cannot compile it. Q1 of the original evaluation: installable by
 * a stranger with Node and git.
 *
 * A failure is swallowed deliberately, and `runSync` renders the absence as
 * three SKIPPED checks naming the reason. The caller never sees "passed".
 */
async function loadMemoryChecks(): Promise<MemoryChecks | undefined> {
  try {
    const mod = await import("./pipelines/sync/checks-memory.js");
    return {
      checkVaultIndexParity: mod.checkVaultIndexParity,
      checkSchemaVersion: mod.checkSchemaVersion,
      checkProjectDirsExist: mod.checkProjectDirsExist,
    };
  } catch {
    return undefined;
  }
}

// T-185's parseOrRefuse lives in shared/cli-args.ts since T-261 S2, so cli-memory.ts shares it.

const args = process.argv.slice(2);
const command = args[0];

if (command === "sync") {
  const opts = parseOrRefuse(COMMAND_SPECS.sync, args.slice(1));
  const checkOnly = opts.has("--check");
  const score = opts.has("--score");
  const scoreJson = opts.has("--json");
  const history = opts.has("--history");
  // R4 (Loop 3): resolve the real root before anything reads it. Run from
  // open-brain/ this used to score the sub-package and print a wrong answer.
  // An EXISTING directory still walks up to its project root; one that does not
  // exist was refused above, rather than walking up from the cwd (T-185).
  const startDir = opts.directory ?? resolve(".");
  const projectRoot = resolveRepoRoot(startDir);
  if (!projectRoot) {
    console.error(`sync refused: ${describeNoRoot(startDir)}`);
    process.exit(1);
  }

  if (opts.has("--retirements-rehash")) {
    const { runRetirementsRehashCli } = await import("./pipelines/sync/retirements-line-hash.js");
    process.exit(runRetirementsRehashCli(projectRoot, opts.has("--write")));
  }

  if (history) {
    const paths = resolvePaths(projectRoot);
    const entries = readHistory(paths.scoreHistory);
    if (entries.length === 0) {
      console.log("No score history found.");
    } else {
      const trend = calculateTrend(entries);
      console.log(`Score History (${entries.length} entries):`);
      for (const entry of entries.slice(-10)) {
        console.log(`  ${entry.date}: ${entry.total}/100`);
      }
      console.log(`Trend: ${trend}`);
    }
    process.exit(0);
  }

  const result = runSync({ projectRoot, checkOnly, score, scoreJson, history, memoryChecks: await loadMemoryChecks() });

  // Print results
  console.log(`\nSync — v${result.version}\n`);

  if (result.fixed.length > 0) {
    console.log("FIXED:");
    for (const c of result.fixed) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  if (result.issues.length > 0) {
    console.log("ISSUES:");
    for (const c of result.issues) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log("WARNINGS:");
    for (const c of result.warnings) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  if (result.skipped.length > 0) {
    console.log("SKIPPED:");
    for (const c of result.skipped) console.log(`  ${c.name}: ${c.message}`);
    console.log();
  }

  const reported = result.checks.filter((c) => c.report);
  if (reported.length > 0) {
    console.log("REPORTED (printed whatever the severity):");
    for (const c of reported) console.log(`  ${c.name} [${c.severity}]: ${c.message}`);
    console.log();
  }

  console.log(
    `Summary: ${result.passed.length} passed, ${result.fixed.length} fixed, ${result.warnings.length} warnings, ${result.issues.length} issues, ${result.skipped.length} skipped`
  );

  if (score) {
    const paths = resolvePaths(projectRoot);
    const { existsSync } = await import("node:fs");

    // Score against the same v2 database the MCP server uses. This path used to
    // open the retired v1 knowledge.db, so `open-brain sync --score` and
    // `ob_score` reported different totals for the same repo.
    const { computeScore } = await import("./pipelines/sync/score.js");
    const { openV2Database } = await import("./db-v2.js");

    if (!existsSync(paths.knowledgeV2Db)) {
      console.error(`Knowledge database not found at ${paths.knowledgeV2Db} — cannot score.`);
      process.exit(1);
    }

    const v2db = openV2Database(paths.knowledgeV2Db);
    let computed: ScoreResult;
    try {
      computed = computeScore(projectRoot, result.checks, v2db);
    } finally {
      v2db.close();
    }

    const categories: CategoryScore[] = computed.categories;
    const total = computed.total;

    const scoreResult: ScoreResult = {
      total,
      categories,
      date: computed.date,
    };

    if (scoreJson) {
      console.log(JSON.stringify(scoreResult, null, 2));
    } else {
      console.log(`\nHealth Score: ${total}/100\n`);
      for (const cat of categories) {
        console.log(formatScoreCategoryLine(cat));
      }
      appendScore(paths.scoreHistory, scoreResult);
      console.log(`\nAppended to score history.`);
    }
  }

  if (checkOnly && result.issues.length > 0) {
    process.exit(1);
  }
} else if (command === "start") {
  const startOpts = parseOrRefuse(COMMAND_SPECS.start, args.slice(1));
  const projectRoot = startOpts.directory ?? resolve(".");

  // T-154: the same report ob_start returns, from a module with no memory imports.
  const { renderStartReport } = await import("./pipelines/session-start/start-report.js");
  // T-314: --read-only is a probe: no session log, no role-read record, no greeting-metrics row.
  const r = await renderStartReport({ projectRoot: resolve(projectRoot), callerLabel: "open-brain CLI (start)", proven: { id: null, reason: "CLI start: no MCP server process, so no session is proven (T-154)" }, readOnly: startOpts.has("--read-only") });
  console.log(r.text);
  process.exitCode = r.isError ? 1 : 0;
} else if (command === "relocate" || command === "scrub-trigger-fires" || command === "trigger-keys" || command === "topics" || command === "rematch" || command === "list" || command === "stats") {
  // T-261 S2: the memory subcommands live in cli-memory.ts (memory side). This is their one lazy crossing.
  // T-295 S2: list and stats are the ob_list and ob_stats MCP tools, moved here.
  const { runMemoryCommand } = await import("./cli-memory.js");
  await runMemoryCommand(args);
} else if (command === "skills-audit") {
  const opts = parseOrRefuse(COMMAND_SPECS.skillsAudit, args.slice(1));
  const { auditSkills, renderAudit } = await import("./pipelines/skills-audit/index.js");
  const { homedir } = await import("node:os");

  const lastArg = opts.value("--last");
  const last = lastArg !== undefined ? Number(lastArg) : 5;
  if (!Number.isInteger(last) || last < 1) {
    console.error(`Invalid --last: expected a positive integer, got "${lastArg}".`);
    process.exit(1);
  }

  const runtimeArg = opts.value("--runtime");
  if (runtimeArg !== undefined && runtimeArg !== "claude" && runtimeArg !== "cursor") {
    console.error(`Invalid --runtime: expected claude or cursor, got "${runtimeArg}".`);
    process.exit(1);
  }
  const seatArg = opts.value("--seat");
  if (seatArg !== undefined && !/^[A-Za-z][\w-]*$/.test(seatArg)) {
    console.error(`Invalid --seat: expected a seat name, got "${seatArg}".`);
    process.exit(1);
  }

  try {
    const report = auditSkills({
      projectDir: resolve(opts.directory ?? "."),
      home: homedir(),
      session: opts.value("--session"),
      last,
      seat: seatArg,
      runtime: runtimeArg,
    });
    console.log(opts.has("--json") ? JSON.stringify(report, null, 2) : renderAudit(report));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
} else if (command === "detach") {
  // C3's concrete first piece: "return the tree to detached after a push." It had
  // been run by hand more than twenty times, which is exactly the shape C3
  // describes — a step that works because a seat remembers it.
  const opts = parseOrRefuse(COMMAND_SPECS.detach, args.slice(1));
  const { detachToUpstream } = await import("./pipelines/detach/index.js");
  const startDir = opts.directory ?? resolve(".");
  const repoRoot = resolveRepoRoot(startDir);
  if (!repoRoot) {
    console.error(`detach refused: ${describeNoRoot(startDir)}`);
    process.exit(1);
  }
  const r = detachToUpstream(repoRoot, {
    dryRun: opts.has("--dry-run"),
    noFetch: opts.has("--no-fetch"),
    force: opts.has("--force"),
  });
  console.log(`detach — ${repoRoot}`);
  for (const step of r.steps) console.log(`  ${step}`);
  if (!r.ok) {
    console.error(`
detach REFUSED: ${r.error}`);
    process.exit(1);
  }
  console.log(`
HEAD: ${r.headBefore?.slice(0, 7)}${r.branchBefore ? ` (${r.branchBefore})` : " (detached)"} -> ${r.headAfter?.slice(0, 7)} (detached)`);
  process.exit(0);
} else if (command === "main-rebuild") {
  // T-172 half 2: update, rebuild and verify the checkout whose build serves every session, or refuse and change
  // nothing. The tree is the one THIS CLI was built in (<tree>/open-brain/build/cli.js), not the cwd: it is the
  // build that serves. The module is loaded here, before anything is changed; it imports nothing lazily after that.
  const opts = parseOrRefuse(COMMAND_SPECS.mainRebuild, args.slice(1));
  const { mainRebuild, defaultDeps } = await import("./pipelines/main-rebuild/index.js");
  const tree = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const r = await mainRebuild(tree, { positionals: opts.positionals, dryRun: opts.has("--dry-run"), noFetch: opts.has("--no-fetch") }, defaultDeps());
  for (const line of r.lines) (r.exitCode === 0 || r.exitCode === 5 ? console.log : console.error)(line);
  process.exit(r.exitCode);
} else if (command === "metrics" && args[1] === "review") {
  // T-318 S1: read-only. The greetings whose metrics row tripped a review threshold; the rest are not reviewed by hand.
  const opts = parseOrRefuse(COMMAND_SPECS.metricsReview, args.slice(2));
  const since = opts.value("--since") ?? null;
  if (since !== null && !/^\d{4}-\d{2}-\d{2}/.test(since)) {
    console.error(`Invalid --since: expected a date (YYYY-MM-DD), got "${since}".`);
    process.exit(1);
  }
  const { greetingMetricsPath } = await import("./pipelines/session-start/greeting-metrics.js");
  const { reviewGreetingMetrics, renderReview, reviewEndMetrics, renderEndReview, reviewNoEnd, renderNoEnd } = await import("./pipelines/session-start/metrics-review.js");
  const { endMetricsPath } = await import("./shared/end-metrics.js");
  const main = greetingMetricsPath();
  console.log(renderReview(reviewGreetingMetrics([`${main}.1`, main], since), since, main).join("\n"));
  const end = endMetricsPath();
  console.log(renderEndReview(reviewEndMetrics([`${end}.1`, end], since), since, end).join("\n"));
  // T-318 S3: sessions that greeted and never ended, so a skipped /end is listed rather than found by a transcript read.
  console.log(renderNoEnd(reviewNoEnd([`${main}.1`, main], [`${end}.1`, end], since), end).join("\n"));
} else if (command === "bootstrap") {
  // /bootstrap's deterministic half (bootstrap-fix BF-3/4/6). The directory is
  // taken literally, never walked up: a fresh project may not be a repository
  // yet, and walking up could land in a PARENT project and scaffold that.
  const sub = args[1];
  const { inspectProject, moveResidue, scaffold, installCommands, formatMoveResidueFailure, SESSION_COMMAND_NAMES } = await import("./pipelines/bootstrap/index.js");
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (sub === "check") {
    const opts = parseOrRefuse(COMMAND_SPECS.bootstrapCheck, args.slice(2));
    const r = inspectProject(opts.directory ?? resolve("."));
    if (opts.has("--json")) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
    console.log(`bootstrap check — ${r.root}`);
    console.log(`Template:  ${r.template}${r.templateFound ? "" : "  — NOT FOUND"}`);
    const g = r.git;
    console.log(`git:       ${g.kind === "none" ? "NOT a repository" : g.kind === "nested" ? `inside another repository at ${g.toplevel}` : `repository root; ${g.commits ? "has commits" : "NO commit yet"}; ${g.dirty.length} uncommitted change(s)`}`);
    console.log(`CLAUDE.md: ${r.claudeMd === "absent" ? "absent" : r.claudeMd === "present" ? "present, without the SIA section" : "present, with the SIA section"}`);
    const a = r.agents;
    console.log(`.agents/:  ${a.kind === "residue" ? `RESIDUE — ${a.entries.join(", ")} (no state.json, no TASKS/)`
      : a.kind === "pre-state" ? "PRE-STATE — TASKS/ with no state.json (the import path)"
      : a.kind === "scaffolded" ? `SCAFFOLDED — not yet imported${a.inboxIsTemplate ? "; INBOX.md is still the template's" : ""}`
      : a.kind === "not-a-record" ? `NOT A RECORD — state.json is ${a.why}`
      : a.kind === "bootstrapped" ? "BOOTSTRAPPED — state.json is a record" : a.kind}`);
    console.log(`commands:  ${SESSION_COMMAND_NAMES.map((n) => `${n}.md ${r.commands[n]}`).join("; ")}`);
    console.log(`Next:      ${r.next}`);
    process.exit(0);
  } else if (sub === "move-residue") {
    const opts = parseOrRefuse(COMMAND_SPECS.bootstrapMoveResidue, args.slice(2));
    try {
      const r = moveResidue(opts.directory ?? resolve("."), today);
      console.log(`bootstrap move-residue — moved, nothing deleted`);
      console.log(`To:      ${r.to}/`);
      console.log(`Entries: ${r.entries.join(", ")}`);
      console.log(`It is local (the template gitignore ignores .agents/archive/). Delete it yourself once you have looked.`);
      process.exit(0);
    } catch (err) {
      // The words live in formatMoveResidueFailure. A read-back mismatch and a
      // failed undo both happen after a move, so neither is printed as "refused".
      console.error(formatMoveResidueFailure(err));
      process.exit(1);
    }
  } else if (sub === "scaffold") {
    const opts = parseOrRefuse(COMMAND_SPECS.bootstrapScaffold, args.slice(2));
    let r;
    try {
      r = scaffold(opts.directory ?? resolve("."));
    } catch (err) {
      console.error(`bootstrap scaffold refused: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    if (opts.has("--json")) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      console.log(`bootstrap scaffold — ${r.root}`);
      console.log(`Template: ${r.template}\n`);
      console.log("Written (tracked = committed with the project; local = this disk only, by design):");
      for (const w of r.written) console.log(`  ${w.tracked ? "tracked" : "local  "}  ${w.action.padEnd(9)} ${w.path} — ${w.why}`);
      if (r.skipped.length) { console.log("Skipped:"); for (const s of r.skipped) console.log(`  ${s.path} — ${s.reason}`); }
      console.log(r.verify.ok ? "\nVerified with git: every file above is tracked or ignored exactly as stated; state.json and next-session.md will be tracked; session logs and archive/ will not; .agents/ is eol=lf." : `\nVERIFY FAILED:\n${r.verify.problems.map((p) => `  ${p}`).join("\n")}`);
    }
    process.exit(r.verify.ok ? 0 : 1);
  } else if (sub === "install-commands") {
    const opts = parseOrRefuse(COMMAND_SPECS.bootstrapInstallCommands, args.slice(2));
    try {
      const r = installCommands(opts.directory ?? resolve("."), today);
      console.log(`bootstrap install-commands — ${r.root}`);
      if (r.archive) console.log(`Archive:   ${r.archive}/`);
      for (const line of r.lines) {
        const after = line.after === line.before ? `${line.before} (unchanged)` : line.after;
        console.log(`  ${line.name}.md: ${line.before} -> ${after}`);
      }
      process.exit(0);
    } catch (err) {
      console.error(`bootstrap install-commands refused: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  } else {
    console.error(`bootstrap: expected check, move-residue, scaffold or install-commands, got ${sub === undefined ? "nothing" : `"${sub}"`}. Nothing was run.`);
    process.exit(2);
  }
} else if (command === "state") {
  // Loop 4 C1: the one-shot migration door. `state import --draft` (default)
  // writes a reviewable draft + report; `--commit` applies the reviewed draft.
  const sub = args[1];
  if (sub !== "import" && sub !== "show" && sub !== "migrate" && sub !== "erasures") {
    console.error("Usage: open-brain state <show [--json] | erasures [dir] | import [--draft [--name <project name>] | --commit [--accept-stale] [--accept-changed]] [--force-snapshot] | migrate [--seat <planner|developer|qa>] [--last-session-seat <seat>] [--keep-revision] [--dry-run] <file...>> [dir]");
    process.exit(1);
  }

  // Loop 14 C2: schema v1 -> v2; T-163: v2 -> v3. `applyStateOps` cannot do this — it refuses a
  // file that does not validate against the CURRENT schema, so once the schema
  // moves the writer can no longer read the record it must migrate. The only
  // alternative is a hand-edit of the record, which is what the single-writer
  // rule exists to prevent. So the migration is a program, with a dry run, and
  // it runs identically on the live record, the shipped template and the fixture.
  if (sub === "migrate") {
    const opts = parseOrRefuse(COMMAND_SPECS.stateMigrate, args.slice(2));
    const { migrateStateFile } = await import("./pipelines/state-migrate/index.js");
    // --seat is read only for a v1 record (its one handoff does not say whose it
    // is); a v1 file named without it is refused by the per-file check below.
    const seat = opts.value("--seat");
    const files = opts.positionals;
    if (files.length === 0) {
      console.error("state migrate refused: name at least one state.json to migrate.");
      process.exit(1);
    }
    const dryRun = opts.has("--dry-run");
    const migrate = (f: string, asDryRun: boolean) =>
      migrateStateFile(resolve(f), {
        seat: seat as "planner" | "developer" | "qa" | undefined,
        lastSessionSeat: (opts.value("--last-session-seat") as "planner" | "developer" | "qa" | undefined) ?? null,
        dryRun: asDryRun,
        keepRevision: opts.has("--keep-revision"),
      });
    // R185-5: every named file is checked (a dry run: exists, parses, migrates
    // and validates) before ANY is written. Before this, a refusal said "nothing
    // was written for those" while an earlier file in the list had been migrated.
    const checks = files.map((f) => migrate(f, true));
    const failed = checks.filter((r) => !r.ok).length;
    if (failed > 0) {
      for (const r of checks) {
        console.log(`${dryRun ? "[dry run] " : ""}${r.path}`);
        console.log(r.ok ? "  not written: another named file was refused" : `  REFUSED: ${r.error}`);
      }
      console.error(`
${failed} file(s) refused — nothing was written for any named file.`);
      process.exit(1);
    }
    for (const [i, f] of files.entries()) {
      const r = dryRun ? checks[i]! : migrate(f, false);
      console.log(`${dryRun ? "[dry run] " : ""}${r.path}`);
      if (!r.ok) {
        // Only reachable if a file changed between the check and the write.
        console.log(`  REFUSED: ${r.error}`);
        console.error(`\n${r.path} refused after the check passed — files listed before it WERE written.`);
        process.exit(1);
      }
      for (const c of r.changes) console.log(`  ${c}`);
    }
    process.exit(0);
  }

  // G-006: the read door. ob_state was the only way to see the record, so with
  // the MCP server down the only remaining option was opening the JSON by hand.
  // Read-only by construction — no write path is added here, so the
  // single-writer rule (every mutation goes through applyStateOps) still holds.
  // T163-2: every record a committed write removed that another session had
  // added, across the WHOLE history including schema <3 (which /sync counts and
  // does not fail on). Read-only: it reads git objects and writes nothing.
  if (sub === "erasures") {
    const opts = parseOrRefuse(COMMAND_SPECS.stateErasures, args.slice(2));
    const { scanErasures, describeErasure } = await import("./pipelines/sync/record-erasure.js");
    const startDir = opts.directory ?? resolve(".");
    const projectRoot = resolveRepoRoot(startDir);
    if (!projectRoot) {
      console.error(`state erasures refused: ${describeNoRoot(startDir)}`);
      process.exit(1);
    }
    const r = scanErasures(projectRoot);
    if (!r.ok) {
      console.error(`state erasures could not run: ${r.skip}`);
      process.exit(1);
    }
    console.log(`Walked ${r.commits} commits on HEAD; ${r.steps} changes to .agents/state.json (${r.enforcedSteps} at schema v3+).`);
    console.log(`Erasures: ${r.erasures.length} (${r.erasures.filter((e) => e.enforced).length} at schema v3+, which /sync fails on)`);
    for (const e of r.erasures) console.log(`  ${e.enforced ? "[v3+]   " : "[legacy]"} ${describeErasure(e)}`);
    process.exit(0);
  }

  if (sub === "show") {
    const opts = parseOrRefuse(COMMAND_SPECS.stateShow, args.slice(2));
    const { readState } = await import("./shared/state-writer.js");
    const { lastSession } = await import("./shared/state-schema.js");
    const startDir = opts.directory ?? resolve(".");
    const projectRoot = resolveRepoRoot(startDir);
    if (!projectRoot) {
      console.error(`state show refused: ${describeNoRoot(startDir)}`);
      process.exit(1);
    }
    const r = readState(projectRoot);
    if (!r.ok) {
      console.error(`state show refused: ${r.error}`);
      process.exit(1);
    }
    if (opts.has("--json")) {
      console.log(JSON.stringify(r.data, null, 2));
      process.exit(0);
    }
    const st = r.data;
    const count = (pred: (t: (typeof st.tasks)[number]) => boolean) => st.tasks.filter(pred).length;
    console.log(`
state — ${st.project.name}
`);
    console.log(`Root: ${projectRoot}`);
    console.log(`File: ${r.path}`);
    console.log(`Revision: ${st.revision} · schema ${st.schema_version}`);
    const last = lastSession(st);
    console.log(last ? `Last session: ${last.n} (${last.date})${last.uuid ? ` · ${last.uuid}` : ""} · ${st.sessions.length} writing session(s) in the record` : `Last session: none recorded`);
    console.log(`Objective: ${st.objective ? `${st.objective.text} (since session ${st.objective.since_session})` : "none"}`);
    console.log(
      `Tasks: ${st.tasks.length} — open ${count((t) => t.status === "open")}, ` +
      `in_progress ${count((t) => t.status === "in_progress")}, blocked ${count((t) => t.status === "blocked")}, ` +
      `done ${count((t) => t.status === "done")} (retained)`
    );
    for (const p of ["P0", "P1", "P2", "P3"] as const) {
      const active = st.tasks.filter((t) => t.priority === p && t.status !== "done");
      if (active.length === 0) continue;
      console.log(`  ${p}: ${active.length}`);
      for (const t of active.slice(0, 5)) console.log(`    ${t.status === "in_progress" ? "~" : t.status === "blocked" ? "!" : " "} ${t.id} ${t.title}`);
      if (active.length > 5) console.log(`    ... +${active.length - 5} more`);
    }
    console.log(`Verified: ${st.verified.length} · gaps: ${st.gaps.length} · decisions: ${st.decisions.length}`);
    if (st.handoffs.length === 0) console.log(`Handoffs: none recorded`);
    for (const h of st.handoffs) {
      console.log(`Handoff [${h.seat} ${h.checkout ?? "legacy"}] (session ${h.session}${h.session_uuid ? ` · ${h.session_uuid}` : ""}): ${h.pick_up || "nothing recorded"}`);
      if (h.watch_out.length) console.log(`  watch out: ${h.watch_out.length} item(s)`);
      if (h.open_questions.length) console.log(`  open questions: ${h.open_questions.length}`);
      if (h.loop_state) {
        const l = h.loop_state;
        console.log(`  loop state: ${l.open_prs.length} open PR(s), frozen ${l.frozen_sha ?? "none"}, ${l.questions_for_aaron.length} question(s) for Aaron, ${l.rulings.length} ruling(s)`);
      }
    }
    console.log(`
Read-only. Change state through ob_state — never by editing the file.`);
    process.exit(0);
  }

  const { runDraft, runCommit, describeHandoffSeat, DRAFT_REL, REPORT_REL, STATE_REL, ACCEPT_STALE_FLAG, ACCEPT_CHANGED_FLAG, DRAFT_INPUTS_REL, NAME_FLAG, blocksCommit, inboxWarning, decisionsWarning, describeDecisionsUnreadable, describeLastSession } = await import("./pipelines/state-import/index.js");
  const { relative } = await import("node:path");
  const { existsSync, statSync } = await import("node:fs");
  // T-150's rule: an unrecognised flag refuses. Before this, a misspelled flag
  // was ignored, so `--comit` quietly ran a draft, and a misspelled
  // acknowledgement would have been indistinguishable from none.
  // Any token starting with "-", not only "--": `-accept-stale` used to fall
  // through to the directory slot (QA 102, D4).
  const importFlags = ["--draft", "--commit", "--force-snapshot", ACCEPT_STALE_FLAG, ACCEPT_CHANGED_FLAG, NAME_FLAG];
  // T-248: `--name <project name>` takes the next token as its value, so that token is neither a flag nor the directory.
  const rest = args.slice(2);
  if (rest.filter((a) => a === NAME_FLAG).length > 1) {
    console.error(`state import refused: ${NAME_FLAG} given more than once. Nothing written.`);
    process.exit(1);
  }
  const nameAt = rest.indexOf(NAME_FLAG);
  const nameValue = nameAt >= 0 ? rest[nameAt + 1] : undefined;
  if (nameAt >= 0 && (nameValue === undefined || nameValue.startsWith("-") || nameValue.trim() === "")) {
    console.error(`state import refused: ${NAME_FLAG} needs a project name after it, for example ${NAME_FLAG} "Tarrant County Makerspace". Nothing written.`);
    process.exit(1);
  }
  const plain = nameAt >= 0 ? [...rest.slice(0, nameAt), ...rest.slice(nameAt + 2)] : rest;
  const unknownFlags = plain.filter((a) => a.startsWith("-") && !importFlags.includes(a));
  if (unknownFlags.length > 0) {
    console.error(`state import refused: unrecognised flag(s) ${unknownFlags.join(", ")}. Known: ${importFlags.join(", ")}. Nothing written.`);
    process.exit(1);
  }
  // At most one positional, and it must name a directory that exists. A second
  // one, or one that names nothing, used to resolve against the cwd and walk up,
  // committing the cwd's project instead of the one named (QA 102, PROBE-12).
  const positionals = plain.filter((a) => !a.startsWith("-"));
  if (positionals.length > 1) {
    console.error(`state import refused: more than one directory given (${positionals.join(", ")}). Pass one project directory. Nothing written.`);
    process.exit(1);
  }
  if (positionals.length === 1 && !(existsSync(resolve(positionals[0])) && statSync(resolve(positionals[0])).isDirectory())) {
    console.error(`state import refused: ${positionals[0]} does not exist or is not a directory (resolved to ${resolve(positionals[0])}). Nothing written.`);
    process.exit(1);
  }
  const commit = args.includes("--commit");
  if (commit && args.includes("--draft")) {
    console.error("state import: pass --draft or --commit, not both");
    process.exit(1);
  }
  if (!commit && args.includes(ACCEPT_STALE_FLAG)) {
    console.error(`state import refused: ${ACCEPT_STALE_FLAG} applies only to --commit. Nothing written.`);
    process.exit(1);
  }
  if (!commit && args.includes(ACCEPT_CHANGED_FLAG)) {
    console.error(`state import refused: ${ACCEPT_CHANGED_FLAG} applies only to --commit. Nothing written.`);
    process.exit(1);
  }
  if (commit && nameAt >= 0) {
    console.error(`state import refused: ${NAME_FLAG} applies only to --draft; --commit writes the name the reviewed draft holds. Nothing written.`);
    process.exit(1);
  }
  // R-BF-9 (QA 135 D1, D2): the directory is taken literally, as `bootstrap
  // check` takes it. The import is the one command that writes a record, and a
  // walk up from a project with no package.json drafted — and would have
  // committed — a PARENT project's record. No package.json is needed: the
  // project name falls back to the folder's, and the draft says so.
  const projectRoot = resolve(positionals[0] ?? ".");
  if (!(existsSync(resolve(projectRoot, ".agents")) && statSync(resolve(projectRoot, ".agents")).isDirectory())) {
    console.error(`state import refused: ${projectRoot} has no .agents/ directory. The import reads THIS directory's .agents/ and never walks up into a parent, whose record is not this project's. Run it from the project root, or pass the project directory. Nothing written.`);
    process.exit(1);
  }
  // Local calendar date, not UTC: an evening run must not stamp tomorrow.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  try {
    if (!commit) {
      const r = runDraft(projectRoot, today, { name: nameValue });
      const rep = r.draft.report;
      console.log(`\nstate import — draft (nothing else changed)\n`);
      console.log(`Root: ${projectRoot}`);
      console.log(`Project: ${rep.project.name}${rep.project.name_from === "folder" ? " — the folder's name: there is no package.json name, and none is needed" : rep.project.name_from === "flag" ? ` — given with ${NAME_FLAG}` : ""}`);
      console.log(`Draft:  ${DRAFT_REL}`);
      console.log(`Report: ${REPORT_REL}`);
      console.log(`Validates: ${r.validation.ok ? "yes" : `NO — ${r.validation.error}`}`);
      console.log(`Current session: ${rep.current_session} (${rep.last_session.file})`);
      const judged = rep.staleness.inputs;
      const stale = judged.filter((i) => i.verdict === "stale");
      const unknown = judged.filter((i) => i.verdict === "could_not_tell");
      console.log(`Staleness: ${stale.length} stale${stale.length ? ` (${stale.map((i) => i.input).join(", ")})` : ""} · ${unknown.length} could not tell${unknown.length ? ` (${unknown.map((i) => i.input).join(", ")})` : ""} · ${judged.length - stale.length - unknown.length} current. Details are in the report's first section.`);
      if (stale.length) console.log(`--commit will REFUSE until those inputs are updated and the draft is re-run, or until ${ACCEPT_STALE_FLAG} is passed.`);
      const unreadable = unknown.filter(blocksCommit);
      if (unreadable.length) console.log(`--commit will REFUSE while ${unreadable.map((i) => i.input).join(", ")} cannot be read or judged (NUL bytes, UTF-32, an odd-length UTF-16BE file, or no heading line; the report says which): save as UTF-8 with a title and re-run the draft, or pass ${ACCEPT_STALE_FLAG}.`);
      const s = rep.inbox.by_status;
      console.log(`Tasks: ${rep.inbox.items} (open ${s.open}, in_progress ${s.in_progress}, blocked ${s.blocked}, done ${s.done}); superseded links ${rep.inbox.superseded_links.length}; unparsed lines ${rep.inbox.unparsed.length}${inboxWarning(rep) ? " — WARNING: see below" : ""}`);
      const warning = inboxWarning(rep);
      if (warning) console.log(warning);
      console.log(`Decisions: ${rep.decisions.imported} (${rep.decisions.skipped.length} skipped) · verified ${rep.verified_imported} · gaps ${rep.gaps_imported} · objective ${rep.objective.found ? "found" : "NOT found"}`);
      const decWarn = decisionsWarning(rep);
      if (decWarn) console.log(decWarn);
      if (rep.decisions_unreadable) for (const l of describeDecisionsUnreadable(rep.decisions_unreadable)) console.log(`  ${l}`);
      const lastDraft = describeLastSession(rep.last_session);
      if (lastDraft) console.log(lastDraft);
      console.log(describeHandoffSeat(rep.handoff_seat));
      console.log(`Handoff: pick_up ${rep.handoff.pick_up_lines} lines, watch_out ${rep.handoff.watch_out}, open_questions ${rep.handoff.open_questions}`);
      if (rep.handoff.not_imported.length) console.log(`Handoff: ${rep.handoff.not_imported.length} line(s) under Watch out / Open questions NOT imported — listed in the report`);
      if (rep.handoff.sections_not_imported.length) console.log(`Handoff: ${rep.handoff.sections_not_imported.length} section(s) NOT imported (${rep.handoff.sections_not_imported.join("; ")}); they stay only in the snapshot${rep.handoff.pick_up_lines === 0 ? ", and pick_up will point to it" : ""}`);
      if (rep.summary_removal) console.log(`SUMMARY.md: --commit will remove ${rep.summary_removal.total_lines_removed} lines (${rep.summary_removal.blockquote_lines} blockquote + ${rep.summary_removal.current_state_lines} Current State)`);
      console.log(`\nReview the report, then run: open-brain state import --commit`);
      process.exit(r.validation.ok ? 0 : 1);
    }
    const r = runCommit(projectRoot, today, { forceSnapshot: args.includes("--force-snapshot"), acceptStale: args.includes(ACCEPT_STALE_FLAG), acceptChanged: args.includes(ACCEPT_CHANGED_FLAG) });
    console.log(`\nstate import — committed\n`);
    console.log(`Root: ${projectRoot}`);
    if (r.accepted_stale.length) console.log(`Imported STALE under ${ACCEPT_STALE_FLAG}: ${r.accepted_stale.join(", ")}`);
    if (r.accepted_unreadable.length) console.log(`Imported UNREADABLE under ${ACCEPT_STALE_FLAG}: ${r.accepted_unreadable.join(", ")}`);
    if (r.accepted_changed.length) console.log(`Committed the draft over CHANGED inputs under ${ACCEPT_CHANGED_FLAG}: ${r.accepted_changed.join("; ")}`);
    if (r.inputs_unrecorded) console.log(`No input record for this draft (${DRAFT_INPUTS_REL}): whether an input changed since --draft was not checked`);
    const unknown = r.staleness.inputs.filter((i) => i.verdict === "could_not_tell");
    if (unknown.length) console.log(`Could not tell whether current: ${unknown.map((i) => i.input).join(", ")}`);
    if (r.decisions_unreadable) for (const l of describeDecisionsUnreadable(r.decisions_unreadable)) console.log(l);
    const lastCommit = describeLastSession(r.last_session);
    if (lastCommit) console.log(lastCommit);
    console.log(`Snapshot: ${relative(projectRoot, r.snapshot.dir)} (${r.snapshot.files} files)`);
    console.log(`Wrote:    ${STATE_REL} at revision 0`);
    if (r.summary) console.log(`SUMMARY.md: removed ${r.summary.total_lines_removed} lines (${r.summary.blockquote_lines} blockquote + ${r.summary.current_state_lines} Current State); kept ${r.summary.kept_headings.join(", ")}`);
    console.log(`Rendered: ${r.rendered.join(", ")}`);
    console.log(`Moved into snapshot: ${r.moved.join(", ")}`);
    console.log(`Role files: installed ${r.role_stubs.installed.length ? r.role_stubs.installed.join(", ") : "none"} · kept ${r.role_stubs.kept.length ? r.role_stubs.kept.join(", ") : "none"}${r.role_stubs.missing.length ? ` · missing in template: ${r.role_stubs.missing.join(", ")}` : ""}`);
    console.log(`Git files: ${r.merged_files.written.length ? r.merged_files.written.join(", ") : "none changed"}${r.merged_files.skipped.length ? ` · unchanged: ${r.merged_files.skipped.join("; ")}` : ""}. Commit them with the record.`);
  } catch (err) {
    console.error(`state import refused: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
} else {
  console.log("Usage: open-brain <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  sync [--check] [--score [--json]] [--history] [--retirements-rehash [--write]]");
  console.log("  start [--read-only]                       Start a session (--read-only: print the report, write nothing)");
  console.log("  end [--dry-run]                            End a session");
  console.log("  relocate [--from <dir> --to <dir> | --worktrees] [--apply]  Fold a renamed project's or a worktree's history forward");
  console.log("  rematch --id <n> --match <none|command: <key>|path: <glob>|error: <text>> [--dry-run]  Rewrite one lesson's MATCH: line in place, or add a first one, counts kept (T-322, T-162)");
  console.log(
    "  scrub-trigger-fires [--db <path>] [--dry-run]  One-time rewrite of trigger_fires.command + VACUUM (stop the MCP server and close Claude Code sessions first)",
  );
  console.log(
    "    Limits: an older MCP build may still hold the store during the run; a 0-byte or non-knowledge SQLite file may be accepted with its path printed; --dry-run may create empty -wal/-shm siblings.",
  );
  console.log("  trigger-keys                               Rewrite the recall trigger's key sidecar from the store (T-170)");
  console.log("  topics [--min=<n>] [--apply]               Generate Topic notes from subject tags");
  console.log("  list [--limit <n>] [--project <dir>]      Stored knowledge entries, newest first (default 20; T-295)");
  console.log("  stats                                      Knowledge store counts and censuses (T-295)");
  console.log("  skills-audit [--session <uuid>] [--last <n>] [--seat <name>] [--runtime claude|cursor] [--json] [dir]   Read-only: shell commands this session repeated (T-262)");
  console.log("  state show [--json]                                 Read .agents/state.json (read-only; write via ob_state)");
  console.log("  state import [--draft [--name <project name>]|--commit [--accept-stale] [--accept-changed]] [--force-snapshot]  Migrate .agents/ prose into state.json (once)");
  console.log("  state erasures [dir]                          Records a committed write removed that another session had added (T-163)");
  console.log("  state migrate [--seat <planner|developer|qa>] [--last-session-seat <seat>] [--keep-revision] [--dry-run] <file...>   (--seat and --last-session-seat: v1 records only)");
  console.log("                                             Migrate state.json schema v1 -> v2");
  console.log("  detach [--dry-run] [--no-fetch] [--force] [dir]      Return a seat worktree to detached at origin/master");
  console.log("  main-rebuild [<sha>] [--dry-run] [--no-fetch]  Update, rebuild and verify the main checkout's serving build, or refuse (T-172)");
  console.log("  metrics review [--since <YYYY-MM-DD>]        Read-only: the greetings and ob_end calls that tripped a review threshold (T-318)");
  console.log("  bootstrap check [--json] [dir]                Read-only: git, CLAUDE.md and .agents/ as /bootstrap needs them");
  console.log("  bootstrap move-residue [dir]                  Move a residue .agents/ under .agents/archive/ (never deletes)");
  console.log("  bootstrap scaffold [--json] [dir]             Copy the fresh-install files from project-template/ and verify tracking");
  console.log("  bootstrap install-commands [dir]              After import: install SIA session commands (refuses without a record or on a dirty tree)");
  process.exit(1);
}
