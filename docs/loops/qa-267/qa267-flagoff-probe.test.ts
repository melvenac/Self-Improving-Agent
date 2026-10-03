import { it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { handleStart } from "../../../src/server.js";

/**
 * QA 267 probe (rows 5 and 11): the WHOLE ob_start text, flag absent and every key false, over SIA's
 * fixture and A2A's fixture, written to files so master's tree and each candidate tree can be diffed
 * byte for byte. The project root is one fixed path, so no temp name enters the output.
 * Place at open-brain/tests/pipelines/session-start/; the tree name labels the output directory.
 */
const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
const TREE = basename(dirname(dirname(dirname(dirname(import.meta.dirname)))));
const OUT = join("/home/agents/qa-tmp/qa267-out", TREE);
const ROOT = "/home/agents/qa-tmp/qa267-probe-root";

const CASES: Array<[string, string, string | null]> = [
  ["sia-absent", "state.json", null],
  ["sia-false", "state.json", JSON.stringify({ briefing_budget: false, handoff_caps: false, role_docs_by_sha: false })],
  ["a2a-absent", "a2a-state-1c200b41.json", null],
  ["a2a-false", "a2a-state-1c200b41.json", JSON.stringify({ briefing_budget: false, handoff_caps: false, role_docs_by_sha: false })],
];

it.each(CASES)("%s", async (name, state, flags) => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(join(ROOT, "package.json"), JSON.stringify({ version: "1.0.0" }));
  for (const d of ["SYSTEM", "TASKS", "SESSIONS", "roles"]) mkdirSync(join(ROOT, ".agents", d), { recursive: true });
  writeFileSync(join(ROOT, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
  writeFileSync(join(ROOT, ".agents", "roles", "shared.md"), "# Shared rules\nSHARED-BODY\n");
  writeFileSync(join(ROOT, ".agents", "roles", "developer.md"), "# Developer seat\nDEV-BODY\n");
  writeFileSync(join(ROOT, ".agents", "AGENT.local.md"), "---\nname: Infra\nrole: developer\npartner: Atlas\n---\n");
  cpSync(join(FIXTURES, state), join(ROOT, ".agents", "state.json"));
  if (flags !== null) writeFileSync(join(ROOT, ".agents", "SYSTEM", "greeting.json"), flags);
  const text = (await handleStart({ project_root: ROOT })).content[0].text;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.txt`), text);
  expect(text.length).toBeGreaterThan(0);
});
