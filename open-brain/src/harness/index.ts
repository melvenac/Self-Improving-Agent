/**
 * The HoH loop runtime — slice one.
 *
 * An outer harness around the three seats this repo already has as documents:
 * planner, developer, QA. Its value here is **enforcement, not automation**.
 * The role files describe boundaries; nothing made a seat stay inside one, and
 * an intention is not a mechanism. This runtime freezes the candidate QA sees
 * and refuses writes outside a stage's allowlist.
 *
 * **The roles are stubs in this slice.** No model is called, no API key is read,
 * and no gate takes a decision. What exists is the machinery the gates will sit
 * on top of, and the two refusals that make the boundaries real.
 *
 * See `docs/HOH-JEV.md` for the loop contract and `docs/loops/loop-15-brief.md`
 * for this slice's scope.
 */

export {
  PlanSchema,
  EvidenceSchema,
  AcceptanceCriterionSchema,
  CheckOutcomeSchema,
  validatePlan,
  validateEvidence,
  validateDeliverable,
  jsonSchemas,
  serialiseSchema,
  type Plan,
  type Evidence,
  type CheckOutcome,
  type AcceptanceCriterion,
  type DeliverableKind,
  type ValidationOutcome,
} from "./schema.js";

export {
  git,
  gitTry,
  headSha,
  currentBranch,
  changedPaths,
  isClean,
  isRepo,
  refExists,
  resolveRef,
  commitPaths,
  tagAt,
  revertPaths,
  GitRefused,
  GitFailed,
  DENIED_SUBCOMMANDS,
} from "./git.js";

export {
  Allowlist,
  enforceAllowlist,
  normaliseRepoPath,
  requireCleanTree,
  verifyFrozen,
  fileExists,
  type FrozenCandidate,
  type AllowlistVerdict,
  type FreezeVerdict,
} from "./workspace.js";

export {
  runCheck,
  runDeterministicChecks,
  defaultChecks,
  reconcileReportedChecks,
  type CheckSpec,
  type DeterministicChecks,
  type CheckRunResults,
} from "./checks.js";

export {
  makeWriter,
  stubRoles,
  StubPlanner,
  StubDeveloper,
  StubQa,
  WriteRefused,
  type RoleName,
  type RoleContext,
  type RoleSession,
} from "./roles.js";

export {
  redact,
  renderPayload,
  DryRunTransport,
  UnconfiguredTransport,
  GateUnavailable,
  SECRET_ENV_VARS,
  type GatePayload,
  type GateAnswer,
  type GateTransport,
  type GateQuestion,
} from "./gate.js";

export {
  iterationDir,
  planMarkdownPath,
  planJsonPath,
  gitrefPath,
  evidencePath,
  failurePath,
  renderPlanMarkdown,
  renderGitref,
  renderEvidence,
  renderFailure,
  type FailureRecord,
} from "./artifacts.js";

export { runLoop, type LoopConfig, type LoopResult, type FailureCode, type GateMode } from "./runtime.js";
