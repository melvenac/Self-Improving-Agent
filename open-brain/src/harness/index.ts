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
  EVIDENCE_LOOP_PATTERN,
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

export { parseDeclared, DeclaredParseError, type DeclaredBlock } from "./declared.js";

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
  allRefs,
  symbolicHeadRef,
  setRefTo,
  deleteRef,
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
  isRuntimeConstructed,
  type RoleName,
  type RoleContext,
  type RoleSession,
} from "./roles.js";

export {
  redact,
  renderPayload,
  buildJevRequest,
  toWireQuestion,
  DryRunTransport,
  UnconfiguredTransport,
  JevTransport,
  GateUnavailable,
  GateCallFailed,
  SECRET_ENV_VARS,
  JEV_KEY_VAR,
  JEV_ENDPOINT,
  PLAN_GATE_QUESTIONS,
  DONE_GATE_QUESTIONS,
  type GatePayload,
  type GateAnswer,
  type GateTransport,
  type GateQuestion,
  type GateFailureClass,
  type JevTransportOptions,
} from "./gate.js";

export {
  loadPolicies,
  policiesDir,
  policyJsonSchemas,
  decidePlanGate,
  decideDoneGate,
  PolicyUnreadable,
  POLICY_FILES,
  PlanGatePolicySchema,
  DoneGatePolicySchema,
  type Policies,
  type PlanGatePolicy,
  type DoneGatePolicy,
  type GateDecision,
  type GateVerdict,
} from "./policies.js";

export {
  RefWatch,
  type RefDelta,
  type RefVerdict,
  type RefChange,
} from "./refwatch.js";

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
  gateRecordPath,
  renderGateRecord,
  type FailureRecord,
  type GateRecord,
  type GateRecordKind,
} from "./artifacts.js";

export {
  runLoop,
  LoopRefused,
  type LoopConfig,
  type LoopResult,
  type FailureCode,
  type GateMode,
} from "./runtime.js";
