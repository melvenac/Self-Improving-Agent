/**
 * T-261 S2: the memory subcommands, moved out of the core CLI.
 *
 * `relocate`, `scrub-trigger-fires`, `trigger-keys` and `topics` read or rewrite the knowledge store, so they are
 * memory by definition. `cli.ts` forwards these four names here through one dynamic import, the only
 * `DYNAMIC_MEMORY_LOADS` entry they need. The bodies are unchanged from cli.ts: the same flags, output and exit codes.
 */
import { resolve } from "node:path";
import { resolvePaths } from "./shared/paths.js";
import { parseOrRefuse } from "./shared/cli-args.js";
import { COMMAND_SPECS } from "./cli-spec.js";

export async function runMemoryCommand(args: readonly string[]): Promise<void> {
  const command = args[0];
  if (command === "relocate") {
    // Parsed before the database is opened: a refusal must not have touched it.
    const opts = parseOrRefuse(COMMAND_SPECS.relocate, args.slice(1));
    const from = opts.value("--from");
    const to = opts.value("--to");
    if (opts.has("--worktrees") && (from !== undefined || to !== undefined)) {
      console.error("relocate refused: --worktrees finds its own folds and cannot be combined with --from/--to.\nNothing was run.");
      process.exit(2);
    }

    const { openV2Database } = await import("./db-v2.js");
    const { planRelocate, applyRelocate, detectMissingProjects, planWorktreeFolds, unresolvableProjectDirs } = await import("./relocate.js");
    const { obsidianVaultDir } = await import("./shared/paths.js");

    const paths = resolvePaths(resolve("."));
    const db = openV2Database(paths.knowledgeV2Db);
    const vaultDir = obsidianVaultDir();

    if (opts.has("--worktrees")) {
      // T-249: every linked-worktree key, folded onto its repository.
      const plans = planWorktreeFolds(db, vaultDir);
      const unresolvable = unresolvableProjectDirs(db);
      for (const u of unresolvable) console.log(`  unresolvable (not on disk): ${u}`);
      if (plans.length === 0) {
        console.log(`\nWorktree folds: nothing to fold.`);
        process.exit(0);
      }
      console.log(`\nWorktree folds: ${plans.length}\n`);
      for (const p of plans) {
        console.log(`  ${p.fromCanonical}\n    →  ${p.toCanonical}`);
        console.log(`    ${p.knowledgeRows} knowledge entries, ${p.sessionRows} sessions, ${p.noteMoves.length} notes → Experiences/${p.toDisplay}/`);
        for (const c of p.collisions) console.log(`    name collision, NOT moved: ${c.from}`);
      }
      if (!opts.has("--apply")) {
        console.log(`\nDry run. Re-run with --apply to make these changes.`);
        process.exit(0);
      }

      // A fold rewrites keys across two tables; the backup is the undo.
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
      const backupPath = `${paths.knowledgeV2Db}.bak-${stamp}-relocate`;
      try {
        await db.backup(backupPath);
      } catch (e) {
        console.error(`relocate refused: backup to ${backupPath} failed (${e instanceof Error ? e.message : String(e)}). Nothing was changed.`);
        process.exit(1);
      }
      console.log(`\nBackup: ${backupPath}`);

      let failed = 0;
      for (const p of plans) {
        const result = applyRelocate(db, p);
        console.log(`Applied ${p.fromCanonical}: ${result.knowledgeRows} entries, ${result.sessionRows} sessions, ${result.notesMoved} notes moved.`);
        for (const f of result.noteFailures) console.log(`  FAILED to move ${f.path}: ${f.reason}`);
        failed += result.noteFailures.length;
      }
      process.exit(failed > 0 ? 1 : 0);
    }

    if (!from || !to) {
      // No arguments means "tell me what is wrong", not an error. The detector is
      // the reason this command exists; the rename is the remedy.
      const missing = detectMissingProjects(db);
      console.log(`\nProject directories that no longer exist on disk: ${missing.length}\n`);
      for (const m of missing) {
        console.log(`  ${m.projectDir}`);
        console.log(`    ${m.entries} knowledge entries, ${m.sessions} sessions — unreachable by project-scoped recall`);
      }
      if (missing.length > 0) {
        console.log(`\nTo fold one onto its new location:`);
        console.log(`  open-brain relocate --from "<old path>" --to "<new path>" [--apply]`);
      }
      console.log(`\nRead-only. Nothing was written.`);
      process.exit(0);
    }

    const plan = planRelocate(db, vaultDir, from, to);
    console.log(`\nRelocate  ${plan.fromCanonical}\n       →  ${plan.toCanonical}\n`);
    if (!plan.targetExistsOnDisk) {
      console.log(`  WARNING: the target directory does not exist on disk either.`);
    }
    console.log(`  knowledge entries : ${plan.knowledgeRows}`);
    console.log(`  sessions          : ${plan.sessionRows}`);
    console.log(`  vault notes to move: ${plan.noteMoves.length} → Experiences/${plan.toDisplay}/`);
    if (plan.collisions.length > 0) {
      console.log(`\n  ${plan.collisions.length} name collision(s) — these are NOT moved and NOT overwritten:`);
      for (const c of plan.collisions) console.log(`    ${c.from}`);
    }

    if (!opts.has("--apply")) {
      console.log(`\nDry run. Re-run with --apply to make these changes.`);
      process.exit(0);
    }

    const result = applyRelocate(db, plan);
    console.log(`\nApplied: ${result.knowledgeRows} entries, ${result.sessionRows} sessions, ${result.notesMoved} notes moved.`);
    for (const f of result.noteFailures) console.log(`  FAILED to move ${f.path}: ${f.reason}`);
    process.exit(result.noteFailures.length > 0 ? 1 : 0);
  } else if (command === "scrub-trigger-fires") {
    const opts = parseOrRefuse(COMMAND_SPECS.scrubTriggerFires, args.slice(1));
    const { runScrubTriggerFires, printScrubTriggerFiresResult } = await import(
      "./scrub-trigger-fires.js"
    );
    const paths = resolvePaths(resolve("."));
    const dbOpt = opts.value("--db");
    if (dbOpt !== undefined && dbOpt.trim() === "") {
      console.error("scrub-trigger-fires refused: --db requires a non-empty path");
      process.exit(2);
    }
    const dbPath = resolve(dbOpt ?? paths.knowledgeV2Db);
    try {
      const result = runScrubTriggerFires(dbPath, { dryRun: opts.has("--dry-run") });
      printScrubTriggerFiresResult(result);
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  } else if (command === "trigger-keys") {
    parseOrRefuse(COMMAND_SPECS.triggerKeys, args.slice(1));
    // T-170: write the recall trigger's key sidecar from the default store.
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const dbPath = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
    if (!existsSync(dbPath)) {
      console.log(`trigger keys: no store at ${dbPath}`);
      process.exit(1);
    }
    const { default: Database } = await import("better-sqlite3");
    const { writeTriggerKeys } = await import("./trigger/keys-writer.js");
    const { triggerKeysPath } = await import("./trigger/match-keys.js");
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const path = triggerKeysPath(dbPath);
      const r = writeTriggerKeys(db, path);
      console.log(`trigger keys: ${r.written} command key(s), ${r.unusable} unusable -> ${path}`);
    } finally {
      db.close();
    }
    process.exit(0);
  } else if (command === "rematch") {
    // T-322: rewrite one lesson's MATCH: line in place (id and counts kept), then refresh the trigger key sidecar.
    const opts = parseOrRefuse(COMMAND_SPECS.rematch, args.slice(1));
    const idArg = opts.value("--id");
    const match = opts.value("--match");
    const id = Number(idArg);
    if (idArg === undefined || !Number.isInteger(id) || id < 1 || match === undefined) {
      console.error("rematch refused: --id <positive integer> and --match <none|command: <key>|path: <glob>|error: <text>> are both required");
      process.exitCode = 1;
      return;
    }
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const dbPath = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
    if (!existsSync(dbPath)) {
      console.error(`rematch refused: no store at ${dbPath}`);
      process.exitCode = 1;
      return;
    }
    const { default: Database } = await import("better-sqlite3");
    const { rematch } = await import("./pipelines/store/rematch.js");
    const { writeTriggerKeys } = await import("./trigger/keys-writer.js");
    const { triggerKeysPath } = await import("./trigger/match-keys.js");
    const db = new Database(dbPath, { fileMustExist: true });
    try {
      const r = rematch(db, id, match, { dryRun: opts.has("--dry-run") });
      if (!r.ok) {
        console.error(`rematch refused: ${r.error}`);
        process.exitCode = 1;
        return;
      }
      const verb = r.added ? ["would add", "added"] : ["would change", "rewritten"];
      const what = r.unchanged ? "unchanged" : r.dryRun ? `${verb[0]} (dry run, nothing written)` : verb[1];
      // T-162: an added line has no before.
      const change = r.added ? `"${r.after}"` : `"${r.before}" -> "${r.after}"`;
      console.log(`rematch: entry ${r.id} (${r.key}) ${what}: ${change}`);
      if (!r.unchanged && !r.dryRun) {
        const path = triggerKeysPath(dbPath);
        const k = writeTriggerKeys(db, path);
        console.log(`trigger keys: ${k.written} command key(s), ${k.unusable} unusable -> ${path}`);
      }
    } finally {
      db.close();
    }
  } else if (command === "topics") {
    const opts = parseOrRefuse(COMMAND_SPECS.topics, args.slice(1));
    const { openV2Database } = await import("./db-v2.js");
    const { planTopics, writeTopics } = await import("./pipelines/topics/index.js");
    const { obsidianVaultDir } = await import("./shared/paths.js");

    const paths = resolvePaths(resolve("."));
    const db = openV2Database(paths.knowledgeV2Db);
    const vaultDir = obsidianVaultDir();

    const minArg = opts.value("--min");
    const min = minArg !== undefined ? Number(minArg) : 5;
    if (!Number.isFinite(min) || min < 1) {
      console.error(`Invalid --min: expected a positive number, got "${minArg}".`);
      process.exit(1);
    }

    const plans = planTopics(db, vaultDir, { min });
    console.log(`\nTopics — ${plans.length} tags with >= ${min} entries\n`);
    for (const p of plans.slice(0, 20)) console.log(`  ${String(p.links.length).padStart(4)}  ${p.tag}`);
    if (plans.length > 20) console.log(`  ... +${plans.length - 20} more`);

    if (!opts.has("--apply")) {
      console.log(`\nDry run. Re-run with --apply to write Topics/ into the vault.`);
      process.exit(0);
    }

    const result = writeTopics(vaultDir, plans);
    console.log(`\nWrote ${result.written.length} topic note(s); removed ${result.removed.length} now below threshold.`);
    if (result.skippedForeign.length > 0) {
      console.log(`Left ${result.skippedForeign.length} hand-written note(s) in Topics/ untouched:`);
      for (const f of result.skippedForeign.slice(0, 10)) console.log(`  ${f}`);
    }
  } else if (command === "list") {
    // T-295 S2: the ob_list MCP tool, moved here. Parsed before the database is opened: a refusal must not have touched it.
    const opts = parseOrRefuse(COMMAND_SPECS.list, args.slice(1));
    const limitArg = opts.value("--limit");
    const limit = limitArg !== undefined ? Number(limitArg) : 20;
    if (!Number.isInteger(limit) || limit < 1) {
      console.error(`list refused: --limit expects a positive integer, got "${limitArg}".\nNothing was run.`);
      process.exit(2);
    }
    const { openV2Database } = await import("./db-v2.js");
    const { knowledgeListText } = await import("./pipelines/store/knowledge-report.js");
    const paths = resolvePaths(resolve("."));
    console.log(knowledgeListText(openV2Database(paths.knowledgeV2Db), limit, opts.value("--project")));
    process.exit(0);
  } else if (command === "stats") {
    // T-295 S2: the ob_stats MCP tool, moved here.
    parseOrRefuse(COMMAND_SPECS.stats, args.slice(1));
    const { openV2Database } = await import("./db-v2.js");
    const { knowledgeStatsText } = await import("./pipelines/store/knowledge-report.js");
    const paths = resolvePaths(resolve("."));
    console.log(knowledgeStatsText(openV2Database(paths.knowledgeV2Db), paths.knowledgeV2Db));
    process.exit(0);
  }
}
