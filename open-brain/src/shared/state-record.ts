import { existsSync, readFileSync } from "node:fs";

/**
 * Null when `path` is a record. A record is a JSON object that carries
 * `schema_version` (R-BF-17). An older schema is still a record; migrating it
 * is not bootstrap's job. The old template's `{{PROJECT}}` seed is not a
 * record, and neither is an empty file, whitespace, or non-JSON. Anything else
 * names what the file is, for `NOT A RECORD — state.json is <why>`.
 */
export function whyNotARecord(path: string): string | null {
  const text = readFileSync(path, "utf8");
  if (text.trim() === "") return text.length === 0 ? "zero bytes" : "only whitespace";
  let data: unknown;
  try { data = JSON.parse(text); } catch (err) { return `not JSON (${(err as Error).message})`; }
  const name = (data as { project?: { name?: unknown } } | null)?.project?.name;
  if (typeof name === "string" && name.includes("{{")) return `the old template's placeholder seed (project "${name}")`;
  return null;
}

/** A root marker only when the file exists and is a record (R-BF-18). A missing file is not one. */
export function isStateRecord(path: string): boolean {
  return existsSync(path) && whyNotARecord(path) === null;
}
