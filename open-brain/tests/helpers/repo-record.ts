import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseState, SCHEMA_VERSION, type State } from "../../src/shared/state-schema.js";
import { migrateStateText } from "../../src/pipelines/state-migrate/index.js";

/** The repository root, from `open-brain/tests/helpers`. */
export const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/**
 * THIS repository's own `.agents/state.json`, at the CURRENT schema.
 *
 * A branch that moves the schema cannot also move the live record: the record
 * is written only through `ob_state` and migrated by `open-brain state migrate`
 * after merge, never on a branch (T-163's brief). Until then the file on disk is
 * one version behind the code. So a record at an older version is migrated IN
 * MEMORY — by the same program that will migrate it for real, which writes
 * nothing here — and `migrated` says so, so a test can report which it read.
 *
 * Throws when neither the file nor its migration parses: a test that read this
 * record must never pass by reading nothing.
 */
export function readRepoRecord(): { state: State; migrated: boolean } {
  const text = readFileSync(join(REPO_ROOT, ".agents", "state.json"), "utf-8");
  const direct = parseState(text);
  if (direct.ok) return { state: direct.data, migrated: false };
  const m = migrateStateText(text, {}, "repository .agents/state.json");
  if (!m.ok || m.output === null) {
    throw new Error(`the repository's own state.json does not parse (${direct.error}) and does not migrate to v${SCHEMA_VERSION}: ${m.error}`);
  }
  const after = parseState(m.output);
  if (!after.ok) throw new Error(`the migrated record does not parse: ${after.error}`);
  return { state: after.data, migrated: true };
}
