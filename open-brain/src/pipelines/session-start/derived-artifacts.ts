import type { CheckResult } from "../sync/types.js";
import { checkGitNexusIndex, checkBuildFreshness } from "../sync/checks.js";

/**
 * Derived-artifact state, reported at SESSION START rather than only at commit.
 *
 * ## Why this exists separately from `/sync`
 *
 * `/sync` guards the **commit** moment. The moment a stale derived artifact
 * actually causes harm is earlier and elsewhere: an agent calls `impact`
 * mid-edit, or the MCP server answers from a build made at another commit —
 * either can be hours from any commit. The session-start greeting is the one
 * thing every agent reads before touching code, so the warning belongs here too.
 *
 * ## Three rules this obeys, and the first is the one worth stating
 *
 * 1. **One implementation, two surfaces.** These call the very same check
 *    functions `/sync` calls. The comparison is NOT reimplemented here — two
 *    copies of a freshness rule drift, and the drift is silent, which is the
 *    failure mode the checks exist to catch.
 * 2. **Generic, not tool-specific.** This hook runs for EVERY project on this
 *    machine and most have no index and no stamped build. Nothing is said when
 *    an artifact is absent, so no project is told about a tool it does not use.
 * 3. **Silence means "nothing to act on" and there is NO all-clear line.** A
 *    passing artifact and an absent one both print nothing, because neither
 *    needs action — but nothing is ever printed that would let "not checked"
 *    read as "verified". The only output is a problem.
 */
export function describeDerivedArtifacts(projectRoot: string): string[] {
  const results: CheckResult[] = [];
  // Never let a reporting line break session start. A check that throws is a
  // check that told us nothing, which is exactly the silence case.
  for (const run of [checkGitNexusIndex, checkBuildFreshness]) {
    try {
      results.push(run(projectRoot));
    } catch {
      /* best-effort: a greeting must not fail the session */
    }
  }

  const lines: string[] = [];
  for (const r of results) {
    // "skip" is an absent artifact and "pass" is a current one. Neither is
    // actionable, and neither gets a line — see rule 3.
    if (r.severity !== "issue" && r.severity !== "warn") continue;
    const label = r.severity === "issue" ? "STALE" : "AGEING";
    lines.push(`${label}: ${r.name} — ${firstSentence(r.message)}`);
  }
  return lines;
}

/**
 * The check messages carry their provenance and limits in full, which is right
 * for `/sync` and too long for a greeting. Take the actionable clause and leave
 * the rest to `/sync`, which prints it verbatim.
 */
function firstSentence(message: string): string {
  const cut = message.indexOf(" (");
  const head = cut > 0 ? message.slice(0, cut) : message;
  return head.length > 200 ? `${head.slice(0, 197)}...` : head;
}
