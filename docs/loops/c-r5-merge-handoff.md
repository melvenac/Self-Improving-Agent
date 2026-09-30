# C r5 merge handoff

Merged `origin/master` (5950826f) into `loop/15-slice-3-candidate-c` (was 0dc20ff, code c339427). Only conflict: `open-brain/src/harness/cli.ts`, 4 hunks. No test edited.

## Resolution, one line per hunk

1. **Usage text:** kept both. C's three shadow-verdict lines, then master's validate plan, plan-gate, dispatch-check, dispatch.
2. **flagMap:** kept master's permissive skip of positionals (`plan-gate <D_t.json>` needs it) and added a `strict` parameter (default false). `cmdShadow` calls `flagMap(rest, true)`, which throws C's `unrecognised argument "<arg>"`. plan-gate, dispatch-check and dispatch keep the default, so both sides' behaviour is unchanged.
3. **Functions:** kept C's `requiredFlag`, `requireCliSha`, `cmdShadow` and master's `PLAN_GATE_MODES`, `positionalArgs`, `cmdPlanGate`, `cmdDispatchCheck`, `cmdDispatch`. The textual merge left `cmdShadow` without its closing brace; added it.
4. **main() dispatch:** kept `shadow-verdict` plus `plan-gate`, `dispatch-check`, `dispatch`.

## Verification (from `open-brain/`, TEMP/TMP under dev-scratch/tmp)

- `npm ci`: exit 0
- `npm run build`: exit 0
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0
- `npx vitest run tests/harness`: exit 1. Tests 4 failed | 473 passed | 75 skipped (552). Files 1 failed | 27 passed | 7 skipped (35). Every test file importing `harness/cli` (b2-et, cli, policies, schema, shadow-merge, t195-plan-gate) is under tests/harness and passes.
- The 4 failures are all in `tests/harness/config-channel.test.ts` (CA-4a fsmonitor, CA-4c, CA-4e, CA-4g: "the control writes the marker"). They fail identically at C's unmerged tip 0dc20ff on this machine (checked in a separate worktree), and that file does not import cli. Machine-dependent, not caused by the merge.

## Scope

`git diff c339427 HEAD -- open-brain/src/harness open-brain/src/shared` shows brief-plan-gate.ts, state-schema.ts and state-writer.ts (all master) and cli.ts (master plus C plus this resolution).

## cli.ts diff against origin/master

```diff
diff --git a/open-brain/src/harness/cli.ts b/open-brain/src/harness/cli.ts
index 875803a4..8a53e012 100644
--- a/open-brain/src/harness/cli.ts
+++ b/open-brain/src/harness/cli.ts
@@ -15,7 +15,7 @@
  * boundary cannot widen by omission* — applied to argument parsing.
  */
 
-import { readFileSync, writeFileSync } from "node:fs";
+import { existsSync, readFileSync, writeFileSync } from "node:fs";
 import { dirname, join, resolve } from "node:path";
 import { fileURLToPath } from "node:url";
 import { runLoop, type GateMode } from "./runtime.js";
@@ -30,12 +30,16 @@ import {
 import { jsonSchemas, serialiseSchema, validateEvidence, validatePlan, type DeliverableKind } from "./schema.js";
 import { defaultChecks, type CheckSpec } from "./checks.js";
 import { policyJsonSchemas } from "./policies.js";
+import { decideShadowVerdict, isLowerHexSha, ledgerPath, prepareShadowVerdict, summariseLedger } from "./shadow-merge.js";
 
 const USAGE = `harness — HoH loop runtime (slice one: roles are stubbed)
 
   harness run --loop <tNNN> [options]
   harness schemas [--write]
   harness validate evidence <file>
+  harness shadow-verdict prepare --loop <id> --candidate <sha> --criteria-sha <sha> --criteria <path> --evidence <file>
+  harness shadow-verdict decide --loop <id> --candidate <sha> (--merged <sha> | --declined | --replaced <sha>)
+  harness shadow-verdict summary
   harness validate plan <file>
   harness plan-gate <D_t.json> [--brief <brief.md>] [--mode live|dry-run]
   harness dispatch-check <brief.md> [--repo <dir>]
@@ -164,8 +168,12 @@ export const schemaFileName = (kind: DeliverableKind): string =>
  * too — becoming exactly the stale authoritative-looking artifact this file
  * already refuses to create.
  */
-export const policySchemaFileName = (kind: "plan" | "done"): string =>
-  kind === "plan" ? "policy-plan.schema.json" : "policy-developer-done.schema.json";
+export const policySchemaFileName = (kind: "plan" | "done" | "merge"): string =>
+  kind === "plan"
+    ? "policy-plan.schema.json"
+    : kind === "done"
+      ? "policy-developer-done.schema.json"
+      : "policy-merge.schema.json";
 
 /**
  * Validate an `E_t` file with the runtime's own validator.
@@ -202,11 +210,18 @@ function cmdValidate(argv: readonly string[]): number {
   return 1;
 }
 
-function flagMap(argv: readonly string[]): Map<string, string | true> {
+/**
+ * Master's commands (plan-gate takes a positional file) skip positionals; the
+ * shadow-verdict rows pass strict=true and reject any stray positional.
+ */
+function flagMap(argv: readonly string[], strict = false): Map<string, string | true> {
   const flags = new Map<string, string | true>();
   for (let i = 0; i < argv.length; i++) {
     const arg = argv[i]!;
-    if (!arg.startsWith("--")) continue;
+    if (!arg.startsWith("--")) {
+      if (strict) throw new UsageError(`unrecognised argument "${arg}"`);
+      continue;
+    }
     const key = arg.slice(2);
     const next = argv[i + 1];
     if (next === undefined || next.startsWith("--")) flags.set(key, true);
@@ -218,6 +233,93 @@ function flagMap(argv: readonly string[]): Map<string, string | true> {
   return flags;
 }
 
+function requiredFlag(flags: Map<string, string | true>, name: string): string {
+  const value = flags.get(name);
+  if (typeof value !== "string" || value === "") throw new UsageError(`--${name} requires a value`);
+  return value;
+}
+
+/**
+ * T-155. prepare writes the verdict. decide records Aaron's action. Neither
+ * merges, pushes, or touches a remote.
+ */
+function requireCliSha(flag: string, value: unknown): string {
+  if (!isLowerHexSha(value)) {
+    const shown = typeof value === "string" && value !== "" ? value : "(none)";
+    throw new UsageError(`--${flag} refuses ${shown}: a sha must be 40 lowercase hex characters`);
+  }
+  return value;
+}
+
+function cmdShadow(argv: readonly string[]): number {
+  const [action, ...rest] = argv;
+  if (action !== "prepare" && action !== "decide" && action !== "summary") {
+    throw new UsageError("usage: harness shadow-verdict <prepare|decide|summary>");
+  }
+  const flags = flagMap(rest, true);
+  const allowed: Record<typeof action, ReadonlySet<string>> = {
+    summary: new Set(["repo"]),
+    prepare: new Set(["repo", "loop", "candidate", "criteria-sha", "criteria", "evidence", "gate"]),
+    decide: new Set(["repo", "loop", "candidate", "merged", "declined", "replaced"]),
+  };
+  for (const key of flags.keys()) {
+    if (!allowed[action].has(key)) throw new UsageError(`unrecognised flag "--${key}"`);
+  }
+  const repo = typeof flags.get("repo") === "string" ? (flags.get("repo") as string) : process.cwd();
+  if (action === "summary") {
+    // Summary reads the ledger and writes nothing. It takes no sha.
+    const path = ledgerPath(repo);
+    const text = existsSync(path) ? readFileSync(path, "utf8") : "";
+    process.stdout.write(`${JSON.stringify(summariseLedger(text), null, 2)}\n`);
+    return 0;
+  }
+  const loop = requiredFlag(flags, "loop");
+  const candidate = requireCliSha("candidate", requiredFlag(flags, "candidate"));
+  if (action === "prepare") {
+    const gate = flags.get("gate");
+    if (gate !== undefined && gate !== "live" && gate !== "dry-run" && gate !== "skip") {
+      throw new UsageError(`--gate must be skip, dry-run, or live, not "${String(gate)}"`);
+    }
+    const gateMode = gate === "live" || gate === "dry-run" ? gate : "skip";
+    const evidencePath = resolve(requiredFlag(flags, "evidence"));
+    let evidence: unknown;
+    try {
+      evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as unknown;
+    } catch (err) {
+      evidence = { error: `unreadable evidence: ${(err as Error).message}` };
+    }
+    const result = prepareShadowVerdict({
+      repo,
+      loop,
+      candidateSha: candidate,
+      criteriaSha: requireCliSha("criteria-sha", requiredFlag(flags, "criteria-sha")),
+      criteriaPath: requiredFlag(flags, "criteria"),
+      evidence,
+      gateMode,
+    });
+    process.stdout.write(`${result.path}\n`);
+    return 0;
+  }
+  const merged = flags.get("merged");
+  const replaced = flags.get("replaced");
+  const declined = flags.get("declined");
+  if (replaced === true) throw new UsageError("--replaced requires a 40-character sha");
+  if (typeof replaced === "string") requireCliSha("replaced", replaced);
+  if (typeof merged === "string") requireCliSha("merged", merged);
+  const chosen = [merged, replaced, declined].filter((v) => v !== undefined).length;
+  if (chosen !== 1) throw new UsageError("decide takes exactly one of --merged, --declined, --replaced");
+  const result = decideShadowVerdict({
+    repo,
+    loop,
+    candidateSha: candidate,
+    action: typeof merged === "string" ? "merged" : typeof replaced === "string" ? "replaced" : "declined",
+    mergeCommitSha: typeof merged === "string" ? merged : undefined,
+    replacedSha: typeof replaced === "string" ? replaced : undefined,
+  });
+  process.stdout.write(`${JSON.stringify(result.line)}\n`);
+  return 0;
+}
+
 const PLAN_GATE_MODES: readonly BriefPlanGateMode[] = ["live", "dry-run"];
 
 function positionalArgs(argv: readonly string[], flags: Map<string, string | true>): string[] {
@@ -335,7 +437,7 @@ function cmdSchemas(argv: readonly string[]): number {
   }
   const schemas = jsonSchemas();
   const policySchemas = policyJsonSchemas();
-  for (const kind of ["plan", "done"] as const) {
+  for (const kind of ["plan", "done", "merge"] as const) {
     const text = serialiseSchema(policySchemas[kind]);
     if (write) {
       const target = join(schemaDir(), policySchemaFileName(kind));
@@ -398,6 +500,7 @@ export async function main(argv: readonly string[]): Promise<number> {
     if (sub === "run") return await cmdRun(rest);
     if (sub === "schemas") return cmdSchemas(rest);
     if (sub === "validate") return cmdValidate(rest);
+    if (sub === "shadow-verdict") return cmdShadow(rest);
     if (sub === "plan-gate") return await cmdPlanGate(rest);
     if (sub === "dispatch-check") return cmdDispatchCheck(rest);
     if (sub === "dispatch") return await cmdDispatch(rest);
```
