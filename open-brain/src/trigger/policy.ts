/**
 * The trigger's thresholds as DATA — the floor, and how many entries may be
 * injected at once.
 *
 * Ruling 5 and amendment 2 R14: the same three-part pattern the harness uses
 * for its gate thresholds — a zod contract, JSON values read from disk at run
 * time, and a derived schema file a drift test compares byte for byte —
 * REBUILT HERE rather than imported. Brief §3 forbids an edge between the
 * trigger and `src/harness/`, so `src/harness/policies.ts` is not reused; only
 * its shape is. The two directories will drift, and that is the accepted cost
 * of the boundary.
 *
 * ## The floor is corpus-relative, and that is not a detail
 *
 * The floor is compared against bm25, whose IDF term is a function of HOW MANY
 * DOCUMENTS IN THE STORE contain each term. Measured 2026-09-20: against the
 * live store (599 entries) the G-039 query scores entry 299 at **14.01**, with
 * the fifth and weakest match at **6.03**; against a three-document fixture
 * every score collapses to about **5e-6**, because a term present in most of a
 * tiny corpus carries almost no information.
 *
 * So **one number cannot serve both a real store and a toy fixture**, and a
 * test whose corpus does not resemble production cannot test this value at
 * all: at the shipped floor a small fixture is silent for EVERY input, which
 * would make "the floor silences the weak match" pass without the floor doing
 * any work. `tests/trigger/floor.test.ts` therefore builds a corpus of
 * production scale rather than a handful of rows. The number below was
 * measured, and the measurement is named where it was taken.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * What a trigger policy file may contain.
 *
 * `.strict()` throughout: a typo in the file is a refusal, not a key silently
 * ignored in favour of a default. The alternative is a trigger that runs at a
 * threshold nobody chose because a name was misspelled.
 */
export const TriggerPolicySchema = z.strictObject({
  /**
   * Minimum relevance (negated bm25, higher is better) for an entry to be
   * injected. Below it the trigger is silent — it does not inject the best of
   * a bad set, and it does not announce that it found nothing.
   */
  relevance_floor: z.number(),
  /**
   * How many entries may be injected for one command. One by default: a
   * channel nobody asked for earns attention by being short.
   */
  max_injected: z.number().int().min(1),
  /**
   * WHERE `relevance_floor` WAS MEASURED, AND AGAINST WHAT — required, not
   * decorative (R19).
   *
   * An absolute bm25 floor is a cut on a scale that moves: IDF falls for a
   * term as more entries carry it, so a floor calibrated against 599 entries
   * is not the same cut on a store of 2,000. The loop accepted that as a
   * stated limit rather than repairing it, and a limit nobody can see is not
   * stated. Required by the contract so it cannot be dropped in an edit that
   * changes the number, and `floor.test.ts` asserts it still names a corpus
   * size and a date — otherwise this is one more field that rots quietly,
   * which is the defect this repo keeps finding.
   */
  provenance: z.string().min(1),
});

export type TriggerPolicy = z.infer<typeof TriggerPolicySchema>;

/** The file name, used by the loader and by the drift test. */
export const POLICY_FILE = "recall-trigger.json";
/** The derived schema's file name — written beside the values, never read at run time. */
export const POLICY_SCHEMA_FILE = "recall-trigger.schema.json";

/**
 * Where the values live, resolved relative to THIS module so the built copy
 * reads the built copy. `scripts/copy-build-assets.mjs` copies the directory
 * into `build/` for exactly this reason.
 */
export function policyDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "policies");
}

/**
 * Read the policy from disk and validate it.
 *
 * Takes a directory so a test can point it somewhere else — which is what
 * makes A4 observable: the floor changes, the behaviour changes, and no source
 * file is touched.
 *
 * Fails loudly in both directions. A missing file is an error rather than a
 * default, because a default here is a threshold nobody chose; an invalid file
 * is an error rather than a partial read.
 */
export function loadPolicy(dir: string = policyDir()): TriggerPolicy {
  const path = join(dir, POLICY_FILE);
  if (!existsSync(path)) {
    throw new Error(
      `trigger policy ${path} not found. The floor is data, not a literal, so there is no value ` +
        `to fall back to — a default here would be a threshold nobody chose.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch (err) {
    throw new Error(`trigger policy ${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const parsed = TriggerPolicySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`trigger policy ${path} does not match the policy schema: ${parsed.error.message}`);
  }
  return parsed.data;
}

/** The JSON Schema derived from the zod contract — the source for the file on disk. */
export function policyJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(TriggerPolicySchema, { io: "input" }) as Record<string, unknown>;
}

/** One serialisation, used to write the file and to compare against it. */
export function serialisePolicySchema(schema: Record<string, unknown>): string {
  return `${JSON.stringify(schema, null, 2)}\n`;
}
