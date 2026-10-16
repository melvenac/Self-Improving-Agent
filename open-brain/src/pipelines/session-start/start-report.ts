import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { sessionStart, type StateFileSize, type StateJsonResult } from "./index.js";
import { describeTreeCurrency } from "./tree-currency.js";
import { resolveRecordSource, type RecordSource } from "./record-source.js";
import { describeRoleFiles, renderRoleDocs, recordRoleReads } from "./role-files.js";
import { greetingFlag, handoffCheckout } from "./greeting-flags.js";
import { focusLine, seatsLine, seatOrder } from "./focus.js";
import { resolveCheckoutSeat } from "./seat-map.js";
import { SeatName, schemaVersionAdvice, type Seat } from "../../shared/state-schema.js";
import { readAgentIdentity } from "./agent-identity.js";
import { describeHubPresence } from "./hub-presence.js";
import { countWords, estimateTokens, STATE_JSON_REL } from "./state-reader.js";
import { renderState, missingHandoffLine } from "./state-render.js";
import { describeServingBuild } from "./serving-build.js";
import { describeCommitTrailer, describeTranscript } from "./transcript-check.js";
import { renderBriefing, describeUsage, describeWorkingTree, describeSkills, describeProblemStatement } from "./briefing.js";
import { oldStartCommandWarning } from "../bootstrap/index.js";
import { describeLatestBrief } from "./latest-brief.js";
import { describeReadsOwed } from "./reads-owed.js";
import { describeFleet, fleetFallback } from "./fleet.js";
import { formatScanCounts } from "./scan-counts.js";
import type { ProvenSession } from "../../shared/process-session.js";

/**
 * The whole `ob_start` report, with no memory imports (T-154): the MCP tool and
 * `open-brain start` both call this, so they print the same text. It must not
 * import server.ts or any MEMORY_SIDE file; `/sync`'s module-boundary check enforces that.
 */
export interface StartReportInput {
  projectRoot: string;
  /** T-161: a proven session may carry its transcript path, which the report checks for. */
  proven: ProvenSession;
  servingBuildDir?: string;
  stateBudgetLines?: number;
  /** Names the calling process in the partner-presence header. */
  callerLabel: string;
}

export interface StartReport {
  text: string;
  isError: boolean;
}

/** Display names for the four state files, keyed as in StateFileSize.file. */
const STATE_FILE_LABEL: Record<StateFileSize["file"], string> = {
  summary: "SUMMARY.md",
  inbox: "INBOX.md",
  taskFile: "task.md",
  nextSession: "next-session.md",
  stateJson: "state.json",
};

/**
 * The size block, with the state.json line describing what is RENDERED: when the record is read
 * from master, the local file's size would describe text that is not in the return (T-200).
 */
function sizesFor(sizes: StateFileSize[], src: RecordSource): StateFileSize[] {
  if (src.kind !== "master") return sizes;
  const lines = src.text.split("\n").length;
  const entry: StateFileSize = {
    file: "stateJson",
    path: `${STATE_JSON_REL} @ ${src.upstreamRef} ${src.sha}`,
    present: true,
    lines,
    sourceLines: lines,
    words: countWords(src.text),
    estTokens: estimateTokens(src.text),
    truncated: false,
  };
  return [...sizes.filter((s) => s.file !== "stateJson"), entry];
}

/**
 * The version-direction advice for this project's record, or null. An older
 * record is MIGRATED; rebuilding (the only advice this refusal gave before
 * T-163) would change nothing for it.
 */
function versionAdviceFor(projectRoot: string): string | null {
  try {
    const advice = schemaVersionAdvice(readFileSync(join(projectRoot, ".agents", "state.json"), "utf-8"));
    return advice ? advice.charAt(0).toUpperCase() + advice.slice(1) + "." : null;
  } catch {
    return null;
  }
}

/** Narrows a declared seat role to the closed set the record accepts. */
export function isSeat(role: string): role is Seat {
  return SeatName.safeParse(role).success;
}

export async function renderStartReport(input: StartReportInput): Promise<StartReport> {
  const projectRoot = input.projectRoot;
  const proven = input.proven;
  const result = sessionStart({
    projectRoot,
    homePath: homedir(),
    // The PROVEN session (T-003). null means there is no proof: do not
    // discover, or a shared checkout stamps the other session's transcript.
    sessionId: proven.id,
    stateBudgetLines: input.stateBudgetLines,
  });
  const sessionIdLine = proven.id === null
    ? `Session ID: none — ${proven.reason}`
    : `Session ID: ${result.session.sessionId ?? "discovery failed"}`;
  // T-161: one line when the proven session has no transcript on disk; null (nothing printed) otherwise.
  const transcript = describeTranscript(proven);
  const commitTrailer = describeCommitTrailer(proven);

  const lines: string[] = [];

  // FIRST, before the mode, the version, the drift line or the record itself.
  // A seat reading a stale tree's record needs to know that before it reads
  // any of it — on 2026-09-20 one read a rev-50 record as current and reported
  // four false claims about the project, with every other instrument green.
  // The line names `origin/master` and disclaims drift in its own words, so a
  // reader seeing it above `Drift: none` cannot take either as the other's
  // confirmation. See pipelines/session-start/tree-currency.ts.
  // T-233 A: the SERVING build comes before even that, because it is the code producing this greeting.
  const serving = describeServingBuild(input.servingBuildDir);
  lines.push(serving);
  lines.push(...describeTreeCurrency(projectRoot).lines);

  // T-200 / D-062: WHICH record the State block below is read from. When this tree's record
  // is older than origin/master's, the block and the role files come from master (git show)
  // and this line says so; when master cannot be read it says LOCAL and why. One line on every
  // path, so a stale read is never silent and a quiet one is never ambiguous.
  const recordSource = resolveRecordSource(projectRoot);
  lines.push(recordSource.line);
  lines.push("");

  lines.push(`Session Start — ${result.state.mode} mode`);
  // The name is the record's (bootstrap-fix BF-8, frogger F12): the header
  // printed `Project: v0.0.1` while the State block below said `frogger v0.0.1`.
  // The record actually rendered: master's when this tree is behind it (T-200), else its own.
  const sj: StateJsonResult =
    recordSource.kind === "master" ? { present: true, valid: true, data: recordSource.state } : result.state.stateJson;
  const recordName = sj.data?.project.name ?? null;
  lines.push(recordName ? `Project: ${recordName} v${result.state.version}` : `Project: v${result.state.version}`);

  // Drift is a result, not an instruction: the caller relays it, it does not
  // re-derive it. An explicit "none" line keeps an empty drift[] observable.
  if (result.drift.length > 0) {
    lines.push(`\nDrift detected (${result.drift.length}):`);
    for (const d of result.drift) {
      lines.push(`  ${d.field}: expected ${d.expected}, got ${d.actual}${d.fixed ? " (fixed)" : " (not fixed)"}`);
    }
  } else {
    lines.push(`\nDrift: none`);
  }

  // T-210: the newest brief by git commit date, so the briefing does not guess it from file names.
  // Omitted when there is no brief; says so when git could not answer.
  const latestBrief = describeLatestBrief(projectRoot);
  if (latestBrief) lines.push(latestBrief);

  if (result.session.logPath) {
    const localNote =
      result.session.sessionNumberSource === "local"
        ? " (local — from this checkout's session logs; no valid state.json)"
        : "";
    lines.push(
      `\nSession #${result.session.sessionNumber}${result.session.reused ? " (existing log for this session id — reused, nothing created)" : localNote}${result.session.takenNumber !== undefined ? ` (Session_${result.session.takenNumber}.md was already taken and was not overwritten; this session's log is Session_${result.session.sessionNumber}.md)` : ""}`,
    );
    lines.push(`Log: ${result.session.logPath}`);
    lines.push(sessionIdLine);
    if (transcript) lines.push(transcript);
    if (commitTrailer) lines.push(commitTrailer);
  } else if (result.session.skippedReason) {
    lines.push(`\nSession log: ${result.session.skippedReason}`);
    lines.push(sessionIdLine);
    if (transcript) lines.push(transcript);
    if (commitTrailer) lines.push(commitTrailer);
  }

  if (result.health.warnings.length > 0) {
    lines.push(`\nWarnings:`);
    for (const w of result.health.warnings) {
      lines.push(`  [${w.category}] ${w.message}`);
    }
  }
  // T-048 round 2: what the two scans could not read, at zero too.
  lines.push(...formatScanCounts(result.session, result.health));

  // Seat identity and the role knowledge that goes with it (C1 / G-032).
  //
  // `readAgentIdentity` is a READ-ONLY door: it parses AGENT.local.md then
  // AGENT.md and writes nothing. That matters on its own — the only other way
  // to ask which seat a checkout greets as was to run the SessionStart hook,
  // which calls writeActiveSession and, given no session id, GENERATES one and
  // stamps it over the checkout's slot. Checking identity reassigned identity.
  //
  // The CONTENT is returned, not just the filenames. A greeting that named the
  // files without loading them would satisfy "the greeting says it did" and
  // leave G-032 exactly where it was: tracked, and read by nothing.
  const roles = describeRoleFiles(
    projectRoot,
    readAgentIdentity(projectRoot),
    recordSource.kind === "master" ? { fromRef: recordSource.upstreamRef } : {},
  );
  lines.push("");
  lines.push(
    roles.seat
      ? `Seat: ${roles.seat.name} (${roles.seat.role})${roles.seat.partner ? ` — partner: ${roles.seat.partner}` : ""}`
      : `Seat: UNRESOLVED`
  );
  lines.push(...roles.lines);
  if (roles.problems.length > 0) {
    lines.push(`
ROLE KNOWLEDGE PROBLEMS (${roles.problems.length}):`);
    for (const p of roles.problems) lines.push(`  ${p}`);
  }

  const presence = await describeHubPresence({
    projectRoot,
    identity: roles.seat,
    callerLabel: input.callerLabel,
  });
  if (presence.lines.length > 0) {
    lines.push("");
    lines.push(...presence.lines);
  }

  // Size block precedes the content so a reader sees what is coming before
  // it arrives. Estimator: chars/4 rounded up (see StateFileSize).
  lines.push(`\n## Sizes (tokens estimated as chars/4)`);
  for (const s of sizesFor(result.sizes, recordSource)) {
    if (!s.present) {
      lines.push(`  ${STATE_FILE_LABEL[s.file]} (${s.path}): absent`);
      continue;
    }
    const cut = s.truncated ? `yes (${s.lines} of ${s.sourceLines} source lines)` : "no";
    lines.push(`  ${STATE_FILE_LABEL[s.file]} (${s.path}): ${s.lines} lines, ${s.words} words, ~${s.estTokens} tokens, truncated: ${cut}`);
  }

  // The state itself. A valid state.json replaces the four prose files (they
  // stay in the size block above so the shrink is visible). An invalid one
  // says so and falls back. Absent leaves v0.28.0 output untouched. Each
  // prose file sits under its own header; "absent" is spelled out so a
  // missing file and an empty one never look alike.
  if (sj.present && sj.valid && sj.data) {
    // The reader's OWN seat, so the greeting renders this seat's handoff and
    // names the others by their close-out commit. A greeting that shows the
    // developer's handoff to the planner is C4 failing on the row C2 exists for.
    // T-239: with handoff_by_checkout on, only THIS checkout's handoff is "yours", in both renders.
    const ownCheckout = handoffCheckout(projectRoot);
    const startNow = new Date();
    const projectName = sj.data.project.name;
    lines.push(...renderState(sj.data, result.state.version, {
      seat: roles.seat && isSeat(roles.seat.role) ? roles.seat.role : null,
      projectRoot,
      ownCheckout,
      compact: greetingFlag(projectRoot, "state_compact"),
    }));
    // T-233 B: the whole briefing, rendered here, so /start prints it instead of assembling it.
    lines.push("", ...renderBriefing({
      serving,
      state: sj.data,
      version: result.state.version,
      seat: roles.seat && isSeat(roles.seat.role) ? roles.seat.role : null,
      ownCheckout,
      sessionNumber: result.session.logPath ? result.session.sessionNumber : null,
      sessionNote: result.session.skippedReason,
      date: new Date().toISOString().slice(0, 10),
      drift: result.drift,
      usage: describeUsage(projectRoot, process.env, startNow),
      latestBrief,
      readsOwed: describeReadsOwed(
        projectRoot,
        sj.data,
        result.session.logPath ? result.session.sessionNumber : null,
        roles.seat && isSeat(roles.seat.role) ? roles.seat.role : null,
        ownCheckout ?? null,
      ),
      fleet: (() => {
        try {
          return describeFleet(projectRoot, projectName, process.env, startNow);
        } catch (err) {
          return fleetFallback(err, process.env);
        }
      })(),
      workingTree: describeWorkingTree(projectRoot),
      skills: describeSkills(projectRoot),
      // T-236 slice 2: OPT-IN per repo (.agents/SYSTEM/greeting.json); absent means the original layout, byte for byte.
      budget: greetingFlag(projectRoot, "briefing_budget"),
      // T-236 (c): OPT-IN, and only with the budget. The seat is the CHECKOUT's; presence is the roster fetched above.
      ...(greetingFlag(projectRoot, "briefing_budget") && greetingFlag(projectRoot, "briefing_focus")
        ? {
            focus: {
              focus: focusLine(sj.data, resolveCheckoutSeat(projectRoot)),
              seats: ((order) => (order ? seatsLine(sj.data, order, presence.liveByHubName ?? null) : null))(seatOrder(projectRoot)),
            },
          }
        : {}),
      // T-199, opt-in: a repo without `missing_handoff` renders exactly as before.
      missingHandoff: greetingFlag(projectRoot, "missing_handoff")
        ? missingHandoffLine(sj.data, { projectRoot, sessionUuid: proven.id, seat: roles.seat && isSeat(roles.seat.role) ? roles.seat.role : null })
        : null,
      oldStartCommand: oldStartCommandWarning(projectRoot),
      transcript,
      // T-167, opt-in: the PRD's own problem statement, one line above OBJECTIVE.
      problem: greetingFlag(projectRoot, "briefing_problem") ? describeProblemStatement(projectRoot) : null,
    }));
  } else {
    // F3: an unknown schema_version REFUSES, with no prose fallback.
    //
    // `ob_state` already refused a record it could not parse; `ob_start` did
    // not — it printed one notice line and then fell back to 59k characters of
    // prose, so a session started from a stale build against a migrated record
    // got a greeting that looked like the pre-state.json regime. The merge
    // choreography counts on that failure being loud, and it was loud on the
    // write side only.
    //
    // Narrow on purpose: this is the VERSION being unknown to this build, not
    // any invalid file. A record that is merely malformed still falls back,
    // because the prose is then the best available answer.
    if (sj.present && !sj.valid && sj.errorPath === "schema_version") {
      lines.push(
        `\nSTATE RECORD REFUSED: ${sj.error}.`,
        `This build cannot read this record's schema version. NOT falling back to the prose files: they are a DIFFERENT and older account of the project, and a greeting built from them would look ordinary while describing a state the record has moved past.`,
        versionAdviceFor(projectRoot) ?? `Rebuild the checkout this process runs from against a commit carrying the record's schema, then start again.`,
      );
      const text = lines.join("\n");
      return { text: `${text}\n\nTotal returned words: ${countWords(text)} (~${estimateTokens(text)} tokens)`, isError: true };
    }
    if (sj.present && !sj.valid) {
      lines.push(`\nstate.json invalid at ${sj.error} — falling back to files`);
    }
    // T-199, opt-in: the detector reads the record, so with no readable record it says it did not check.
    if (greetingFlag(projectRoot, "missing_handoff")) {
      lines.push(`\nHandoff check: not checked (${sj.present ? "state.json invalid" : "no .agents/state.json"}, so there is no record to read)`);
    }
    const content: Record<string, string | null> = {
      summary: result.state.summary,
      inbox: result.state.inbox,
      taskFile: result.state.taskFile,
      nextSession: result.state.nextSession,
    };
    for (const s of result.sizes) {
      if (s.file === "stateJson") continue;
      lines.push(`\n## ${STATE_FILE_LABEL[s.file]}`);
      const body = content[s.file];
      lines.push(body === null ? "absent" : body.replace(/\s+$/, ""));
    }
  }

  // The role knowledge itself, last: it is reference material the seat reads
  // once and refers back to, not a briefing it reads top to bottom.
  // T-236: with role_docs_by_sha on, a doc this seat already read at this sha is one line. The
  // read is recorded only after its full text is in `lines`, and only here.
  const roleDocs = renderRoleDocs(projectRoot, roles.files, roles.seat, greetingFlag(projectRoot, "role_docs_by_sha"));
  lines.push(...roleDocs.lines);
  const unrecorded = recordRoleReads(projectRoot, roles.seat, roleDocs.printedFull, new Date());
  if (unrecorded) lines.push(`\n${unrecorded}`);

  // Total is of everything above it — the measurement Part 1 of the
  // evaluation asks for. Computed last so it counts the real return.
  const text = lines.join("\n");
  const totalWords = countWords(text);
  return { text: `${text}\n\nTotal returned words: ${totalWords} (~${estimateTokens(text)} tokens)`, isError: false };
}
