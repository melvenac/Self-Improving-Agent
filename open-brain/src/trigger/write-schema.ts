/**
 * Regenerate the derived policy schema.
 *
 *     npx tsx src/trigger/write-schema.ts
 *
 * The zod contract in `policy.ts` is the source; the `.json` beside the values
 * is derived, and `tests/trigger/policy.test.ts` compares them byte for byte
 * (`D-021`'s pattern). A drifted file fails the suite rather than shipping,
 * and this is the one command that fixes it — named in the failure message so
 * nobody hand-edits the derived file back into agreement.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { policyDir, policyJsonSchema, serialisePolicySchema, POLICY_SCHEMA_FILE } from "./policy.js";

const out = join(policyDir(), POLICY_SCHEMA_FILE);
writeFileSync(out, serialisePolicySchema(policyJsonSchema()), "utf-8");
console.log(`wrote ${out}`);
