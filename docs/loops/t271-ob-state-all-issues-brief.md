# T-271: an ob_state refusal lists every issue of each invalid op, with the op's expected shape

Runtime: CC (claude -p, Opus 5.5)
SEAT: a one-off on any Windows host; clark picks it (the QA PC while the desktop is saturated). No hub key. Code PR.
Ends at READY with a PR, no merge.
ROOM: none
REPLY: write the full reply to an ABSOLUTE path under the user's %TEMP% named t271-reply.md (a reply path in the
launcher's line wins). Resolve and print that absolute path FIRST.

**By:** Atlas (planner), 2026-10-13, session 170. **Task:** T-271 (P2). **Tag:** `T-271`. **Size:** SMALL-MEDIUM.
**Base:** `7bdf24839263887172b75df3dfdb489bb4c3cb9d` (origin/master after #685, T-275; it also holds #678 and #673).
If clark re-pins it at launch, that SHA wins. **Checklist:** `~/Worktrees/cursor-brief-checklist.md`.

```text
IMPACT-TARGETS: applyStateOps (open-brain/src/shared/state-writer.ts: only the per-op check in its op loop; new exports opShape, opNames, ISSUES_SHOWN_MAX, OPS_SHOWN_MAX; new module open-brain/src/shared/op-shape.ts; one sentence in the ob_state description in open-brain/src/server.ts; covered by tests/shared/t271-op-refusals.test.ts, tests/shared/op-shape.test.ts, tests/shared/state-writer.test.ts, tests/server.test.ts)
```

## Why

T-271 (read its note). In its first session, Prism needed four dry-run refusals in 70 s to learn two op shapes. The
planner's evaluation records them in order: `add_verified`'s `claim`, then `evidence`'s type, then its entries, then
`set_handoff`'s `loop_state`. Each refusal named ONE field.

**The cause is in `open-brain/src/shared/state-writer.ts`, `applyStateOps`, lines 322-337 at the base:**
- `OpSchema.safeParse(op)` already returns EVERY issue of the op. zod 4 checks every key of a strict object, then
  reports unrecognized keys as one more issue.
- The writer prints only `v.error.issues[0]`.
- It also returns at the FIRST invalid op, so a second invalid op in the same batch (Prism's `set_handoff`) is reported
  only on the next attempt.
- Nothing tells the caller what the op should look like. The `ob_state` description lists the op names but not their
  fields.

**The fix:**
- A refused op lists every issue.
- It prints the op's expected shape, derived from `OpSchema` itself through zod 4's public `z.toJSONSchema`, so the
  shape cannot drift from the schema.
- Every later op in the batch that fails the same checks is described in the same refusal.

The first line of every refusal stays byte-identical to today's, so every existing row that pins it stays green.

**Out of scope:**
- A semantic refusal (an unknown id, a done task) still names its one op and stops there, as today. Schema problems in
  ops AFTER a semantic failure are not listed: semantic checks need the state that earlier ops produce.
- The tool description does NOT carry the shapes. All 14 come to about 1.9 KB (the planner measured the hand-derived
  lines below), which every session would pay in its tool list for something only a refusal needs. One sentence is
  added instead, about 150 characters.

## Ruling (exact; paths under `open-brain/`)

1. **New file `src/shared/op-shape.ts`**, exactly:
   ```ts
   import { z } from "zod";

   /**
    * T-271: an ob_state op's expected shape as one line of text, derived from its zod schema through zod 4's public
    * z.toJSONSchema, so the shape a refusal prints cannot drift from the schema that refused.
    */

   /** The longest expected-shape line a refusal prints; a longer one is cut with "…". */
   export const SHAPE_MAX = 800;

   type JsonNode = Record<string, unknown>;

   /** One node of z.toJSONSchema's output as compact text. Properties print in schema order; `?` marks an optional key. */
   export function renderJsonShape(s: JsonNode): string {
     if (Array.isArray(s.anyOf)) return (s.anyOf as JsonNode[]).map(renderJsonShape).join(" | ");
     if ("const" in s) return JSON.stringify(s.const);
     if (Array.isArray(s.enum)) return (s.enum as unknown[]).map((v) => JSON.stringify(v)).join("|");
     switch (s.type) {
       case "object": {
         const required = new Set(Array.isArray(s.required) ? (s.required as string[]) : []);
         const props = Object.entries((s.properties ?? {}) as Record<string, JsonNode>);
         return `{${props.map(([k, v]) => `${k}${required.has(k) ? "" : "?"}: ${renderJsonShape(v)}`).join(", ")}}`;
       }
       case "array": {
         const items = renderJsonShape((s.items ?? {}) as JsonNode);
         const n = s.minItems;
         const min = typeof n === "number" && n > 0 ? (n === 1 ? " (non-empty)" : ` (>= ${n} items)`) : "";
         return `[${items}]${min}`;
       }
       case "string": {
         const parts: string[] = [];
         const n = s.minLength;
         if (typeof n === "number" && n > 0) parts.push(n === 1 ? "non-empty" : `length >= ${n}`);
         if (typeof s.pattern === "string") parts.push(`matching /${s.pattern}/`);
         return parts.length > 0 ? `string (${parts.join(", ")})` : "string";
       }
       case "integer":
       case "number": {
         // zod 4's int() puts the safe-integer range into the JSON Schema; only a bound the schema set is shown.
         if (typeof s.exclusiveMinimum === "number") return `${String(s.type)} (> ${s.exclusiveMinimum})`;
         if (typeof s.minimum === "number" && s.minimum > Number.MIN_SAFE_INTEGER) return `${String(s.type)} (>= ${s.minimum})`;
         return String(s.type);
       }
       case "boolean":
       case "null":
         return String(s.type);
       default:
         return "unknown";
     }
   }

   /** A zod schema's expected shape as one line, cut at SHAPE_MAX characters. */
   export function describeShape(schema: z.ZodType): string {
     const line = renderJsonShape(z.toJSONSchema(schema) as JsonNode);
     return line.length > SHAPE_MAX ? `${line.slice(0, SHAPE_MAX - 1)}…` : line;
   }
   ```
   If `tsc` objects to a type in this block, fix the type only. Never change what it prints.

2. **`src/shared/state-writer.ts`:**
   a. Add `import { describeShape } from "./op-shape.js";` after the `handoff-caps.js` import.
   b. In the header comment, after the bullet ending `failing op fails the batch; nothing is written.` (line 11), add
      exactly:
      ```
       * - A refused op's message lists every issue of it, and of up to four later invalid ops, each with its expected
       *   shape from op-shape.ts (T-271). A semantic refusal (an unknown id) still names its one op.
      ```
   c. Directly after `const RETIRED_FIELDS ... = { ... };` (it ends at line 117), add:
      ```ts
      /** The most zod issues one invalid op lists, and the most invalid ops one refusal describes (T-271). */
      export const ISSUES_SHOWN_MAX = 8;
      export const OPS_SHOWN_MAX = 5;

      let opShapeCache: Map<string, string> | null = null;
      /** Every op name and its expected shape, in OpSchema order, derived on first use (T-271). */
      function opShapes(): Map<string, string> {
        if (opShapeCache === null) {
          const m = new Map<string, string>();
          for (const option of OpSchema.options) {
            const name = [...option.shape.op.values][0] as string;
            let line: string;
            try {
              line = describeShape(option);
            } catch (err) {
              line = `(shape unavailable: ${err instanceof Error ? err.message : String(err)})`;
            }
            m.set(name, line);
          }
          opShapeCache = m;
        }
        return opShapeCache;
      }

      /** T-271: an op's expected shape, derived from OpSchema; null for a name OpSchema does not have. */
      export function opShape(name: string): string | null {
        return opShapes().get(name) ?? null;
      }

      /** T-271: the op names OpSchema accepts, in its order. */
      export function opNames(): string[] {
        return [...opShapes().keys()];
      }

      const issuePath = (path: readonly PropertyKey[]): string => (path.length ? path.map(String).join(".") : "$");

      function issuesLine(i: number, name: string, issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): string {
        const shown = issues.slice(0, ISSUES_SHOWN_MAX).map((is) => `${issuePath(is.path)}: ${is.message}`);
        const more = issues.length - shown.length;
        return `  ops[${i}] ${name}: ${issues.length} ${issues.length === 1 ? "issue" : "issues"}: ${shown.join("; ")}${more > 0 ? `; and ${more} more` : ""}`;
      }

      function expectsLine(i: number, name: string): string {
        const shape = opShape(name);
        return shape === null ? `  ops[${i}] op must be one of: ${opNames().join(", ")}` : `  ops[${i}] ${name} expects: ${shape}`;
      }

      type OpCheck = { ok: true; data: StateOp } | { ok: false; head: string; lines: string[] };

      /**
       * T-271: one op's pre-apply checks, in their existing order: a retired op, a retired field, then the schema.
       * `head` is the refusal's first line exactly as it was before T-271. `lines` add every issue and the op's shape.
       */
      function checkOp(raw: unknown, i: number): OpCheck {
        const opName = (raw as { op?: unknown } | null)?.op;
        const name = typeof opName === "string" ? opName : "?";
        if (typeof opName === "string" && opName in RETIRED_OPS) {
          return { ok: false, head: `ops[${i}] (${opName}): ${RETIRED_OPS[opName]}`, lines: [] };
        }
        if (typeof opName === "string" && opName in RETIRED_FIELDS) {
          const present = Object.keys(RETIRED_FIELDS[opName]).filter((f) => f in (raw as object));
          if (present.length > 0) {
            const rest = Object.fromEntries(Object.entries(raw as object).filter(([k]) => !present.includes(k)));
            const r = OpSchema.safeParse(rest);
            return {
              ok: false,
              head: `ops[${i}] (${opName}): ${RETIRED_FIELDS[opName][present[0]]}`,
              lines: [...(r.success ? [] : [issuesLine(i, name, r.error.issues)]), expectsLine(i, name)],
            };
          }
        }
        const v = OpSchema.safeParse(raw);
        if (v.success) return { ok: true, data: v.data };
        const first = v.error.issues[0];
        return {
          ok: false,
          head: `ops[${i}] invalid at ${issuePath(first.path)}: ${first.message}`,
          lines: [...(v.error.issues.length > 1 ? [issuesLine(i, name, v.error.issues)] : []), expectsLine(i, name)],
        };
      }
      ```
   d. In `applyStateOps`, replace the op loop's body, lines 323-340 at the base (from `const opName = ...` through
      `applied.push({ op: v.data.op, id: r.id });`), with:
      ```ts
          const c = checkOp(options.ops[i], i);
          if (!c.ok) {
            // T-271: every later op that fails the same checks is described too, up to OPS_SHOWN_MAX ops in all.
            const out = [c.head, ...c.lines];
            let described = 1;
            let notShown = 0;
            for (let j = i + 1; j < options.ops.length; j++) {
              const later = checkOp(options.ops[j], j);
              if (later.ok) continue;
              if (described < OPS_SHOWN_MAX) {
                out.push(`  ${later.head}`, ...later.lines);
                described++;
              } else {
                notShown++;
              }
            }
            if (notShown > 0) out.push(`  and ${notShown} more invalid op(s) not shown`);
            return refuse(before, out.join("\n"));
          }
          const r = applyOne(next, c.data, ctx);
          if (!r.ok) return refuse(before, `ops[${i}] (${c.data.op}): ${r.error}`);
          applied.push({ op: c.data.op, id: r.id });
      ```
      Change nothing else in `applyStateOps`. A dry run takes the same path, so its refusal text is identical.

3. **`src/server.ts`, the `ob_state` description (line 604):** directly after `Atomic: all ops apply or none. `, insert
   exactly this, ending with one space:
   `A refusal lists every invalid field of an invalid op (8 at most per op, 5 ops at most) and prints that op's expected shape, or the op names for an unknown op (T-271). `
   Change nothing else in the line. Leave `handleState` unchanged: it already prints `ob_state refused: ${r.error}`, and
   the extra lines follow as they are.

**What a refusal looks like** (Prism's first attempt, row A1 below):
```text
ops[0] invalid at claim: Invalid input: expected string, received undefined
  ops[0] add_verified: 3 issues: claim: Invalid input: expected string, received undefined; evidence: Invalid input: expected array, received string; $: Unrecognized key: "what"
  ops[0] add_verified expects: {op: "add_verified", id?: string, claim: string (non-empty), evidence: [{type: string, path: string, observation: string}] (non-empty)}
  ops[1] invalid at loop_state: Invalid input: expected object, received string
  ops[1] set_handoff expects: {op: "set_handoff", seat: "planner"|"developer"|"qa", pick_up: string, watch_out: [...], open_questions: [...], loop_state?: {...} | null}
```
The last line is shortened here. The full text is the `SET_HANDOFF_SHAPE` constant below.

## New rows (two new files under `open-brain/tests/shared/`)

**A. `tests/shared/t271-op-refusals.test.ts`.** It imports only `applyStateOps`, which exists at the base, so the file
loads at commit 1.
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyStateOps } from "../../src/shared/state-writer.js";

/**
 * T-271: an ob_state refusal names EVERY issue of each invalid op and prints that op's expected shape, so a seat learns an
 * op's shape in one round trip, not one field per attempt (Prism, session 1: four dry-run refusals in 70 s).
 */
const fixturesDir = join(import.meta.dirname, "../fixtures");
const stateFixture = join(import.meta.dirname, "../fixtures-state/state.json");
const STATE = ".agents/state.json";
const SESSION = 55; // the fixture's last session is 54
const UUID = "u-t271";

const ADD_VERIFIED_SHAPE = `{op: "add_verified", id?: string, claim: string (non-empty), evidence: [{type: string, path: string, observation: string}] (non-empty)}`;
const SET_HANDOFF_SHAPE = String.raw`{op: "set_handoff", seat: "planner"|"developer"|"qa", pick_up: string, watch_out: [string | {text: string (non-empty), expires?: integer (> 0) | string (matching /^\d{4}-\d{2}-\d{2}$/)}], open_questions: [string | {text: string (non-empty), resolved_by?: string (non-empty), owner?: string (non-empty)}], loop_state?: {open_prs: [{ref: string (non-empty), qa_status: "not_started"|"in_progress"|"accepted"|"rejected"|"not_required", note: string}], frozen_sha: string | null, questions_for_aaron: [string], rulings: [string]} | null}`;
const UPDATE_TASK_SHAPE = `{op: "update_task", id: string, title?: string (non-empty), priority?: "P0"|"P1"|"P2"|"P3", status?: "open"|"in_progress"|"blocked", assignee?: string (non-empty) | null, append_note?: string (non-empty), replace_note?: string, replace_other_sessions?: true}`;
const OP_NAMES = "open_task, update_task, close_task, reopen_task, add_verified, reopen_verified, add_gap, update_gap, close_gap, reopen_gap, add_decision, set_standing, set_objective, set_handoff";

// Prism's first attempt, reconstructed from the planner's evaluation (the transcript stays out of this public repo): the
// claim under the wrong key, the evidence as a string, and the planner handoff's loop_state as a string.
const ATTEMPT_1 = [
  { op: "add_verified", what: "PR #1 merged", evidence: "PR #1 merged" },
  { op: "set_handoff", seat: "planner", pick_up: "x", watch_out: [], open_questions: [], loop_state: "idle" },
];
const FIXED = [
  { op: "add_verified", claim: "PR #1 merged", evidence: [{ type: "pr", path: "#1", observation: "merged" }] },
  { op: "set_handoff", seat: "planner", pick_up: "x", watch_out: [], open_questions: [], loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } },
];

describe("T-271 an ob_state refusal names every issue and the op's shape", () => {
  let root: string;
  let before: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-t271-"));
    cpSync(fixturesDir, root, { recursive: true });
    cpSync(stateFixture, join(root, STATE));
    before = readFileSync(join(root, STATE), "utf-8");
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });
  const write = (ops: unknown[], dry_run = false) =>
    applyStateOps(root, { session: SESSION, expected_revision: 7, ops, dry_run, session_uuid: UUID });

  it("A1 Prism's first attempt: one refusal names every issue of both ops, each with its shape", () => {
    const r = write(ATTEMPT_1);
    expect(r.ok).toBe(false);
    expect(r.error!.split("\n")).toEqual([
      "ops[0] invalid at claim: Invalid input: expected string, received undefined",
      `  ops[0] add_verified: 3 issues: claim: Invalid input: expected string, received undefined; evidence: Invalid input: expected array, received string; $: Unrecognized key: "what"`,
      `  ops[0] add_verified expects: ${ADD_VERIFIED_SHAPE}`,
      "  ops[1] invalid at loop_state: Invalid input: expected object, received string",
      `  ops[1] set_handoff expects: ${SET_HANDOFF_SHAPE}`,
    ]);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  it("A2 evidence entries that are not objects: every entry is named", () => {
    const r = write([{ op: "add_verified", claim: "PR #1 merged", evidence: ["PR #1 merged", "CI green"] }]);
    expect(r.error!.split("\n")).toEqual([
      "ops[0] invalid at evidence.0: Invalid input: expected object, received string",
      "  ops[0] add_verified: 2 issues: evidence.0: Invalid input: expected object, received string; evidence.1: Invalid input: expected object, received string",
      `  ops[0] add_verified expects: ${ADD_VERIFIED_SHAPE}`,
    ]);
  });

  it("A3 the fixed batch passes a dry run (a valid batch is unchanged)", () => {
    const r = write(FIXED, true);
    expect(r.ok, r.error).toBe(true);
    expect(r.error).toBeUndefined();
    expect(r.applied.map((a) => a.op)).toEqual(["add_verified", "set_handoff"]);
    expect(readFileSync(join(root, STATE), "utf-8")).toBe(before);
  });

  it("A4 a dry run refuses with the same text as a write", () => {
    const wet = write(ATTEMPT_1);
    const dry = write(ATTEMPT_1, true);
    expect(dry.ok).toBe(false);
    expect(dry.dry_run).toBe(true);
    expect(dry.error).toBe(wet.error);
    expect(dry.error).toContain("  ops[1] set_handoff expects: ");
  });

  it("A5 an unknown op names the ops there are", () => {
    const r = write([{ op: "delete_everything" }]);
    expect(r.error!.split("\n")).toEqual(["ops[0] invalid at op: Invalid input", `  ops[0] op must be one of: ${OP_NAMES}`]);
  });

  it("A6 a retired field still refuses first, and the rest of the op is checked too", () => {
    const r = write([{ op: "update_task", id: "T-001", note: "x", priority: "P9" }]);
    const lines = r.error!.split("\n");
    expect(lines[0]).toMatch(/^ops\[0\] \(update_task\): `note` is retired on update_task \(T-171\)/);
    expect(lines.slice(1)).toEqual([
      `  ops[0] update_task: 1 issue: priority: Invalid option: expected one of "P0"|"P1"|"P2"|"P3"`,
      `  ops[0] update_task expects: ${UPDATE_TASK_SHAPE}`,
    ]);
  });

  it("A7 an op with more than 8 issues lists 8 and counts the rest", () => {
    const r = write([{ op: "set_handoff", seat: "x", pick_up: 1, watch_out: [1, 2, 3, 4, 5, 6, 7, 8], open_questions: 0 }]);
    expect(r.error!.split("\n")).toEqual([
      `ops[0] invalid at seat: Invalid option: expected one of "planner"|"developer"|"qa"`,
      `  ops[0] set_handoff: 11 issues: seat: Invalid option: expected one of "planner"|"developer"|"qa"; pick_up: Invalid input: expected string, received number; watch_out.0: Invalid input; watch_out.1: Invalid input; watch_out.2: Invalid input; watch_out.3: Invalid input; watch_out.4: Invalid input; watch_out.5: Invalid input; and 3 more`,
      `  ops[0] set_handoff expects: ${SET_HANDOFF_SHAPE}`,
    ]);
  });

  it("A8 a batch with more than 5 invalid ops describes 5 and counts the rest", () => {
    const r = write(Array.from({ length: 7 }, () => ({ op: "close_gap" })));
    const lines = r.error!.split("\n");
    expect(lines).toHaveLength(11);
    expect(lines[0]).toBe("ops[0] invalid at id: Invalid input: expected string, received undefined");
    expect(lines[1]).toBe(`  ops[0] close_gap expects: {op: "close_gap", id: string}`);
    expect(lines[8]).toBe("  ops[4] invalid at id: Invalid input: expected string, received undefined");
    expect(lines[9]).toBe(`  ops[4] close_gap expects: {op: "close_gap", id: string}`);
    expect(lines[10]).toBe("  and 2 more invalid op(s) not shown");
    expect(r.error).not.toContain("ops[5]");
  });

  it("A9 a semantic refusal still names its one op, as before T-271", () => {
    const r = write([{ op: "close_task", id: "T-999" }, { op: "set_handoff" }]);
    expect(r.error).toBe("ops[0] (close_task): unknown task T-999");
  });

  it("A10 the ob_state description says what a refusal carries", () => {
    const server = readFileSync(join(import.meta.dirname, "../../src/server.ts"), "utf-8");
    const line = server.split("\n").find((l) => l.includes("Write .agents/state.json through typed operations"));
    expect(line).toContain("A refusal lists every invalid field of an invalid op");
    expect(line).toContain("prints that op's expected shape");
  });
});
```

**B. `tests/shared/op-shape.test.ts`.** At commit 1 the whole file fails to load, because `op-shape.ts` does not exist
yet. That is its red.
```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { renderJsonShape, describeShape, SHAPE_MAX } from "../../src/shared/op-shape.js";
import { opNames, opShape } from "../../src/shared/state-writer.js";

describe("T-271 op-shape: an op's expected shape from its zod schema", () => {
  it.each([
    [{ anyOf: [{ type: "string" }, { type: "null" }] }, "string | null"],
    [{ type: "string", const: "x" }, `"x"`],
    [{ type: "string", enum: ["a", "b"] }, `"a"|"b"`],
    [{ type: "array", items: { type: "string" }, minItems: 1 }, "[string] (non-empty)"],
    [{ type: "array", items: { type: "string" }, minItems: 2 }, "[string] (>= 2 items)"],
    [{ type: "array", items: { type: "boolean" } }, "[boolean]"],
    [{ type: "string", minLength: 1, pattern: "^a$" }, "string (non-empty, matching /^a$/)"],
    [{ type: "string", minLength: 3 }, "string (length >= 3)"],
    [{ type: "integer", exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER }, "integer (> 0)"],
    [{ type: "integer", minimum: Number.MIN_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER }, "integer"],
    [{ type: "number", minimum: 0 }, "number (>= 0)"],
    [{ type: "object", properties: { a: { type: "string" }, b: { type: "boolean" } }, required: ["a"] }, "{a: string, b?: boolean}"],
    [{ type: "null" }, "null"],
    [{}, "unknown"],
  ])("S1 renderJsonShape(%j) is %s", (node, text) => {
    expect(renderJsonShape(node as Record<string, unknown>)).toBe(text);
  });

  it("S2 describeShape goes through z.toJSONSchema, and cuts at SHAPE_MAX", () => {
    expect(describeShape(z.strictObject({ op: z.literal("close_gap"), id: z.string() }))).toBe(`{op: "close_gap", id: string}`);
    const values = Array.from({ length: 200 }, (_, i) => `value_${i}`) as [string, ...string[]];
    const long = describeShape(z.strictObject({ k: z.enum(values) }));
    expect(long).toHaveLength(SHAPE_MAX);
    expect(long.endsWith("…")).toBe(true);
  });

  it("S3 every op has a shape, in OpSchema order, and an unknown name has none", () => {
    expect(opNames()).toEqual(["open_task", "update_task", "close_task", "reopen_task", "add_verified", "reopen_verified", "add_gap", "update_gap", "close_gap", "reopen_gap", "add_decision", "set_standing", "set_objective", "set_handoff"]);
    for (const n of opNames()) {
      const s = opShape(n)!;
      expect(s.startsWith(`{op: "${n}"`), s).toBe(true);
      expect(s.length).toBeLessThanOrEqual(SHAPE_MAX);
    }
    expect(opShape("delete_everything")).toBeNull();
  });
});
```

**The expected strings are hand-derived.** The zod 4.3.6 messages come from its `en` locale; each shape comes from
running zod's JSON Schema processors through ruling 1 by hand.
- **zod messages:** commit 1's red run shows zod's real text for every first line, because those lines come from
  unchanged base code. If a received first line differs from this brief's, update every expected string that quotes
  that message to zod's actual text, and say so in the reply (old text, new text).
- **Shapes:** if, at commit 2, an `expects:` line differs from a constant here ONLY because `z.toJSONSchema` emitted a
  different node than this brief assumed, keep `renderJsonShape` exactly as ruled. Update the constant to the line it
  really prints, and paste both versions in the reply.
- **Never** change ruling 1's rendering rules to make a row pass. If that is the only way, STOP, `BLOCKED T-271 <row>`.

## Existing tests (planner-read at 7bdf2483; verdicts)

- `tests/shared/state-writer.test.ts`:
  - **Stay green:** the regexes on refusal first lines, which are unchanged:
    - `:92` `invalid at priority`, `:94` `invalid at op`, `:96` the extra key;
    - `:172` `status`, `:198` `note`, `:227` `evidence`, `:289` `evidence`;
    - `:488` `date: expected YYYY-MM-DD`, `:554` `seat`.
    None ends in `$`, so the added lines cannot break them.
  - **Stays green:** `:85` (`^ops\[1\] \(close_task\): unknown task T-999$`), a semantic refusal whose text does not
    change.
  - **Stays green:** `:299` RG4 (the description still lists `reopen_gap`).
- `tests/shared/state-writer-notes.test.ts:82`, `:90`: the retired-`note` regexes match the unchanged first line;
  **stay green**.
- `tests/shared/closeout-erasure.test.ts:135` (`end_session.*retired`): the retired-op first line is unchanged; **stays
  green**.
- `tests/server.test.ts:732-741` (a bad `priority`: `invalid at priority`, and no `reconnect` or
  `Rebuild the checkout`): **stays green**. The open_task `expects:` line contains neither word.
- `tests/server.test.ts:307` (`ob_state refused: revision mismatch ...`): **stays green** (untouched path).
- Every other caller passes valid ops or `ops: []`, so is **untouched**. The other two src callers,
  `state-import/index.ts:1226` and `sync/checks-state.ts:85`, pass `ops: []`.
- `.agents/retirements.json` pins one line in `state-writer.ts` (R-007) and lines in `server.ts` (R-002, R-004,
  R-011). Edit none of those lines. The new text must contain none of the retired terms: `skill scan`, `dream`,
  `reflection queue`/`log`/`clusters`/`stage`, `kb_`, `knowledge-mcp`, `project.version`, `db.ts`, `mailbox`,
  `atlas-to-forge`, `forge-to-atlas`, `enableHeuristicRatings`, `maturity lifecycle`/`boosts`, `apoptosis`,
  `success_rate`, `progenitor`. `retirements-live.test.ts` is in the runs.
- `tests/pipelines/sync/module-boundary.test.ts`: **stays green**. `op-shape.ts` imports only `zod`.
- Any other newly failing row: STOP, `BLOCKED T-271 <row>`.

## Steps

1. PowerShell: `$reply = [System.IO.Path]::GetFullPath((Join-Path $env:TEMP "t271-reply.md")); "REPLY_PATH=$reply"`,
   then `$env:Path = 'C:\Program Files\nodejs;' + $env:Path` and `node -v`. It must print `v22.*`, otherwise BLOCKED.
2. **Start state.**
   - Work in the fresh clone the launcher named. If it named none, run
     `git clone -q https://github.com/melvenac/Self-Improving-Agent.git (Join-Path $env:TEMP "t271-wt")` and
     `Set-Location` into it.
   - `git checkout -q -b feat/t271-ob-state-all-issues 7bdf24839263887172b75df3dfdb489bb4c3cb9d`. `git rev-parse HEAD`
     must print that SHA and `git status --porcelain` must be empty, else STOP, BLOCKED.
   - In `open-brain`: `npm ci`, then `node -e "require('better-sqlite3')"`. If that fails with "Could not locate the
     bindings file", run `npm rebuild better-sqlite3`, say so, and re-run the check.
   - **Forbidden:** `git stash`, `reset --hard`, `--force`, rebase, amend, a `cd` into any other checkout,
     `npm run test:heavy`, killing any process by name, and any src edit other than rulings 1-3 (a mutant, step 7,
     is always reverted).
3. **Base run** (in `open-brain`, 30-minute cap): `npx vitest run <REGRESSION> --no-file-parallelism --testTimeout=180000`,
   where `<REGRESSION>` is:
   `tests/shared tests/server.test.ts tests/end-fix-q12.test.ts tests/end-fix-q3.test.ts tests/end-fix-q6.test.ts tests/end-fix-r2-pins.test.ts tests/end-fix-r4-pins.test.ts tests/pipelines/bootstrap-fix.test.ts tests/pipelines/fleet-ae-f4.test.ts tests/pipelines/fleet-ae-f7.test.ts tests/pipelines/fleet-ae-f8.test.ts tests/pipelines/session-start/briefing.test.ts tests/pipelines/session-start/handoff-by-checkout.test.ts tests/pipelines/session-start/record-session-number.test.ts tests/pipelines/state-import-v3.test.ts tests/pipelines/state-import.test.ts tests/pipelines/summary-bom.test.ts tests/pipelines/sync/checks-state.test.ts tests/pipelines/sync/record-erasure.test.ts tests/pipelines/sync/module-boundary.test.ts tests/pipelines/sync/retirements-live.test.ts tests/t003-r2.test.ts tests/t003-session-proof.test.ts tests/t259-erasure-scan.test.ts`
   (every test file that calls `applyStateOps` or `handleState`, plus the two guards). Paste the summary and every
   failing row: a row red here is pre-existing and must be the same row after.
4. **Commit 1, `T-271: failing rows for refusals that name every issue and the op's shape`:** files A and B. Run
   `npx vitest run tests/shared/t271-op-refusals.test.ts tests/shared/op-shape.test.ts --no-file-parallelism --testTimeout=180000`.
   - **Red:** `op-shape.test.ts` fails to load, and in `t271-op-refusals.test.ts` A1, A2, A4, A5, A6, A7, A8 and A10
     fail.
   - **Green:** A3 and A9.
   - **Check zod's first lines:** each red row's received value shows today's single-line refusal. Paste A1's, A2's,
     A5's, A7's and A8's received first lines, and apply the zod-message rule above if one differs.
   - Any other partition: STOP, BLOCKED. Paste the run.
5. **Commit 2, `T-271: an ob_state refusal lists every issue of each invalid op, with the op's expected shape`:**
   rulings 1-3. Run step 4's command (all green), then step 3's `<REGRESSION>` (the same reds as the base run, no new
   ones). Then run `npx tsc --noEmit`, which must exit 0. Paste all three.
6. End both commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   `git log --oneline 7bdf2483..HEAD` shows 2 lines, and `git status --porcelain` is empty after each commit.
7. **Mutants.** For each: edit, run step 4's command, paste the failing row names, then `git checkout -- <file>` and
   confirm a clean tree. Never commit one. The rows named must go red.

   | Mutant | File | Edit | Rows that go red |
   |---|---|---|---|
   | M1 | `state-writer.ts` | in `issuesLine`, `issues.slice(0, ISSUES_SHOWN_MAX)` → `issues.slice(0, 1)` | A1, A2, A7 |
   | M2 | `state-writer.ts` | `for (let j = i + 1;` → `for (let j = options.ops.length;` | A1, A4, A8 |
   | M3 | `op-shape.ts` | `${required.has(k) ? "" : "?"}` → `` (empty) | A1, A6, S1, S3 |
   | M4 | `state-writer.ts` | `ISSUES_SHOWN_MAX = 8` → `9` | A7 |
   | M5 | `state-writer.ts` | `OPS_SHOWN_MAX = 5` → `6` | A8 |
   | M6 | `state-writer.ts` | `expectsLine` always returns `` `  ops[${i}] ${name} expects: ${shape}` `` | A5 |
   | M7 | `state-writer.ts` | the retired-field branch's `lines` → `[expectsLine(i, name)]` | A6 |
   | M8 | `server.ts` | delete the T-271 sentence | A10 |
8. **Scope.** `git diff --name-only 7bdf2483..HEAD` must show exactly these files, and nothing else (otherwise STOP,
   BLOCKED):
   - `open-brain/src/server.ts`
   - `open-brain/src/shared/op-shape.ts`
   - `open-brain/src/shared/state-writer.ts`
   - `open-brain/tests/shared/op-shape.test.ts`
   - `open-brain/tests/shared/t271-op-refusals.test.ts`
9. **Push and PR.**
   - `git push origin feat/t271-ob-state-all-issues` (never force).
     `git ls-remote origin refs/heads/feat/t271-ob-state-all-issues` must equal `git rev-parse HEAD`. If the push is
     rejected, STOP.
   - Then `gh pr create --base master --head feat/t271-ob-state-all-issues --title "T-271: an ob_state refusal lists every issue of each invalid op, with the op's expected shape" --body "Brief: docs/loops/t271-ob-state-all-issues-brief.md. Code (src): needs a QA ACCEPT and Aaron's word naming it."`
   - Wait for CI (`gh pr checks <n> --watch --interval 30`, cap 20 min) and paste the `test` conclusion.
   - At most 2 attempts at any failing step, then STOP with BLOCKED. Never "fix until green".

## Reply

- The first line is `READY T-271 <sha40> PR #<n>` or `BLOCKED T-271 <reason>`.
- Then each command with its output:
  - the base run;
  - commit 1's red run, with the five received first lines;
  - commit 2's green run, the regression run and tsc;
  - the eight mutants;
  - the name-only diff;
  - `ls-remote` = `rev-parse`;
  - the PR URL and CI.
- List every expected string you updated under the hand-derivation rule, old and new.
- Paste test output with `grep -a`, or without grep. Mark anything not run `NOT RUN`.
- Name any HIGH, CRITICAL or UNKNOWN IMPACT target from the launcher's prompt, and say which rows cover its callers.
  `applyStateOps` is covered through `handleState` by `server.test.ts`, and directly by `state-writer.test.ts`, A1-A9.
- If the code differs from a line this brief quotes, follow the ruling's intent and say what differed. Do not merge.
