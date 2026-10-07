#!/usr/bin/env node

/**
 * SessionEnd hook entry point — thin CLI wrapper.
 * Runs the 5-stage session-end pipeline: session summary, auto-feedback,
 * invocation logging, shadow recall, topics. They are numbered 1-4 and 7 in
 * index-v2.ts, because stages 5 and 6 were cut in Loop 10 along with the
 * reflection queue and the skill scan.
 *
 * Replaces open-brain/scripts/session-end-v2.mjs with compiled TypeScript.
 */

import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { openV2Database } from "./db-v2.js";
import { formatSessionEndLines, sessionEndV2 } from "./pipelines/session-end/index-v2.js";
import { resolveRecalledIdsObserved, formatRecalledResolution, formatForeignWriter, readRecalledFile } from "./pipelines/session-end/recalled-ids.js";
import { obsidianVaultDir } from "./shared/paths.js";
import { resolveHookProjectDir } from "./shared/repo-root.js";
import { resolveSessionId } from "./shared/active-session.js";
import { byPidDir, removeProcessSession } from "./shared/process-session.js";
import { resolvePaths } from "./shared/paths.js";
import { checkSessionHandoff, describeMissing, recordMissingHandoff, sessionIdsFromTranscript, sessionStartFromTranscript } from "./shared/handoff-guard.js";
import { readState } from "./shared/state-writer.js";
import {
  describeWorkAfterEnd,
  readObEndStamp,
  recordContentChangedSinceStamp,
  recordWorkAfterEnd,
  scanSessionWork,
  sessionWorkScanBlockedReason,
} from "./shared/end-record-guard.js";

const V2_DB = process.env.KNOWLEDGE_V2_DB || join(homedir(), ".claude", "open-brain", "knowledge-v2.db");
const V2_VAULT = obsidianVaultDir();

// The session uuid, from the hook payload on stdin — the same authoritative
// source cli-bootstrap.ts reads, and for the same reason.
//
// This previously read `process.env.CLAUDE_SESSION_ID`, which Claude Code does
// not set. The variable that exists is CLAUDE_CODE_SESSION_ID. So sessionId was
// the empty string on every session end this hook has ever run, and the effect
// was not a missing label but a silent no-op: resolveRecalledIds got a null
// session, could not match recall_log, and (since Loop 5 removed the
// .recalled-entries.json write) resolved nothing, so Stage 2's loop body never
// executed. The heuristic rating arm therefore produced zero rows in the
// entire life of the rating_method column — see
// ~/Obsidian Vault v2/Research/loop-7-c1-reconciliation-2026-09-15.md §2.
//
// Reading stdin rather than the corrected env name is deliberate: it is the
// documented contract, it matches the hook that works, and it is IDE-agnostic
// (Cursor sets no CLAUDE_* variable at all but does send a payload).
// CLAUDE_CODE_SESSION_ID stays as a fallback for a host that sends no stdin.
let hookPayload: Record<string, unknown> = {};
try {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString().trim();
  if (raw) hookPayload = JSON.parse(raw);
} catch { /* stdin unavailable — fall back to the environment below */ }

// T-003: remove THIS session's proof first, before anything slow or anything
// that can exit early. SessionEnd fires on /clear as well as on exit, so if the
// next session's SessionStart then fails, the server finds NO proof and refuses
// rather than writing as this session. Only this session's own id is removed:
// a proof the next SessionStart already wrote is left alone, whichever hook ran
// first. CLAUDE_PID is set by the host for hooks (see cli-bootstrap.ts).
try {
  const endingId = resolveSessionId(hookPayload)?.uuid;
  const claudePid = Number(process.env.CLAUDE_PID);
  if (endingId && Number.isInteger(claudePid) && claudePid > 0) {
    const r = removeProcessSession(byPidDir(resolvePaths(process.cwd()).activeSession), claudePid, endingId);
    console.log(`[session-end] session proof for claude process ${claudePid}: ${r}`);
  } else {
    console.log(`[session-end] session proof NOT checked: ${endingId ? "CLAUDE_PID is unset" : "the payload carried no session id"}`);
  }
} catch (err) {
  console.log(`[session-end] session proof NOT removed: ${err instanceof Error ? err.message : String(err)}`);
}

// T179-2: committed loop work with no handoff WARNS, before anything that can
// exit early (it needs git, not the memory module). It never blocks: /clear
// fires this hook, and a hook that fails there traps the user.
try {
  const dir = resolveHookProjectDir(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (existsSync(join(dir, ".agents"))) {
    const id = resolveSessionId(hookPayload)?.uuid || process.env.CLAUDE_CODE_SESSION_ID || "";
    if (!id) {
      console.log("[session-end] handoff check NOT RUN: the payload carried no session id");
    } else {
      const check = checkSessionHandoff(
        dir,
        sessionStartFromTranscript(hookPayload.transcript_path),
        sessionIdsFromTranscript(hookPayload.transcript_path),
        id,
      );
      if (check.status === "missing") {
        const msg = describeMissing(check, id);
        console.log(`[session-end] ${msg}`);
        console.error(`[session-end] ${msg}`);
        recordMissingHandoff(dir, id, check);
      } else if (check.status === "unknown") {
        console.log(`[session-end] handoff check NOT RUN: ${check.reason}`);
      } else {
        const noHandoff =
          check.status === "ok"
            ? `handoff committed (${check.handoffs.join(", ")})`
            : "no handoff or record update for this session";
        const unPart =
          check.unattributed > 0
            ? `; ${check.unattributed} commit(s) in the window carry no Claude-Session trailer: UNATTRIBUTED, not counted for any seat`
            : "";
        console.log(`[session-end] handoff check: ${noHandoff}${unPart}`);
      }
    }
  }
} catch (err) {
  console.log(`[session-end] handoff check NOT RUN: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
}

// T-246 E4: work after ob_end with no later record write — warn and record for the next greeting; never block.
try {
  const dir = resolveHookProjectDir(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (existsSync(join(dir, ".agents"))) {
    const id = resolveSessionId(hookPayload)?.uuid || process.env.CLAUDE_CODE_SESSION_ID || "";
    const transcriptIds = sessionIdsFromTranscript(hookPayload.transcript_path);
    {
      const stamp = readObEndStamp(dir);
      if (stamp?.ob_end_at && (!id || stamp.session === id)) {
        const since = stamp.ob_end_at;
        const blocked = sessionWorkScanBlockedReason(
          sessionStartFromTranscript(hookPayload.transcript_path),
          transcriptIds,
        );
        if (blocked) {
          console.log(`[session-end] work-after-end check NOT RUN: ${blocked}`);
        } else {
          const work = scanSessionWork(dir, since, transcriptIds);
          if (work.status === "unknown") {
            console.log(`[session-end] work-after-end check NOT RUN: ${work.reason ?? "could not scan session work"}`);
          } else {
            const changed = recordContentChangedSinceStamp(dir, stamp.session, stamp);
            const recordUpdated = changed === true;
            if (work.commits > 0 && !recordUpdated) {
              const msg = describeWorkAfterEnd(work, since);
              console.log(`[session-end] ${msg}`);
              console.error(`[session-end] ${msg}`);
              recordWorkAfterEnd(dir, stamp.session, msg, work);
            } else if (work.commits > 0) {
              console.log(`[session-end] work-after-end check: ${work.commits} commit(s) after ob_end and record updated`);
            } else {
              console.log("[session-end] work-after-end check: no commits after ob_end");
            }
          }
        }
      } else {
        const blocked = sessionWorkScanBlockedReason(
          sessionStartFromTranscript(hookPayload.transcript_path),
          transcriptIds,
        );
        if (blocked) {
          console.log(`[session-end] work-after-end check NOT RUN: ${blocked}`);
        } else {
          const probe = scanSessionWork(dir, new Date().toISOString(), transcriptIds);
          if (probe.status === "unknown") {
            console.log(`[session-end] work-after-end check NOT RUN: ${probe.reason ?? "could not scan session work"}`);
          } else {
            console.log("[session-end] work-after-end check: no ob_end stamp for this session");
          }
        }
      }
    }
  }
} catch (err) {
  console.log(`[session-end] work-after-end check NOT RUN: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
}

try {
  if (!existsSync(V2_DB)) {
    console.log("[session-end] v2 DB not found, skipping.");
    process.exit(0);
  }
  if (!existsSync(V2_VAULT)) {
    console.log("[session-end] v2 vault not found, skipping.");
    process.exit(0);
  }

  // Loop 4 R5: resolve the real project root (shared/repo-root.ts) so a hook
  // fired with a drifted cwd cannot write a stray `.agents/` into a subpackage.
  const projectDir = resolveHookProjectDir(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const sessionId =
    resolveSessionId(hookPayload)?.uuid || process.env.CLAUDE_CODE_SESSION_ID || "";
  const agentsDir = join(projectDir, ".agents");

  const project = projectDir.split(/[/\\]/).filter(Boolean).pop() || "General";

  const db = openV2Database(V2_DB);
  try {
    // recall_log for this session wins; the file is consulted only when it
    // names this same session. See resolveRecalledIds — the copy on disk had
    // been two sessions stale and was being rated as if it were current.
    const { resolved, foreign } = resolveRecalledIdsObserved({
      db,
      sessionId: sessionId || null,
      filePaths: [
        join(projectDir, ".recalled-entries.json"),
        join(homedir(), ".claude", "context-mode", ".recalled-entries.json"),
      ],
      readFile: readRecalledFile,
    });
    const recalledIds = resolved.ids;
    // Loop 5 R3: this hook runs unattended, so it was the worst place for a
    // silent no-rating. It previously spoke only when a file was refused; a
    // session with no id and no file said nothing at all and rated nothing.
    for (const line of [...formatRecalledResolution(resolved, ""), ...formatForeignWriter(foreign, "")]) console.log(`[session-end] ${line}`);
    const result = sessionEndV2({
      db,
      vaultDir: V2_VAULT,
      agentsDir,
      sessionId,
      sessionSummary: "", // self-generates from session .db when empty
      project,
      recalledEntryIds: recalledIds,
      recalledOrigin: resolved.origin === "none" ? undefined : resolved.origin,
      dryRun: false,
    });

    for (const line of formatSessionEndLines(result)) console.log(`[session-end] ${line}`);
  } finally {
    db.close();
  }
} catch (err) {
  console.error("[session-end] Error:", err instanceof Error ? err.message : err);
  process.exit(0); // Don't fail the hook
}
