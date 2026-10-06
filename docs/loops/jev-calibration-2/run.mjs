#!/usr/bin/env node
/**
 * JEV-CAL-2 QA runner helpers. Each live row uses harness shadow-done with frozen --request.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
const TSX = join(ROOT, "open-brain/node_modules/tsx/dist/cli.mjs");
const CLI = join(ROOT, "open-brain/src/harness/cli.ts");
const RUNLIST = join(HERE, "runlist.json");

function harnessArgs(extra) {
  return [process.execPath, TSX, CLI, ...extra, "--repo", ROOT];
}

export function qaCommandForRow(row, phase) {
  const input = join(ROOT, row.input);
  const policy = join(ROOT, row.policy);
  const parts = [
    "harness",
    "shadow-done",
    "--request",
    input,
    "--policy",
    policy,
    "--phase",
    phase,
    "--case-id",
    row.case_id,
    "--runlist",
    RUNLIST,
    "--mode",
    "dry-run",
    "--records",
    join(HERE, "records"),
    "--repo",
    ROOT,
  ];
  return `node ${TSX} ${CLI} ${parts.slice(1).join(" ")}`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1]);
if (isMain || process.argv[1]?.endsWith("run.mjs")) {
  const sub = process.argv[2];
  if (sub === "sizes") {
    const r = spawnSync(...harnessArgs(["cal2-request-sizes"]), { encoding: "utf-8", cwd: ROOT });
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exit(r.status ?? 1);
  }
  if (sub === "print-commands") {
    const runlist = JSON.parse(readFileSync(RUNLIST, "utf-8"));
    for (const phase of ["dev", "heldout"]) {
      for (const row of runlist.phases[phase]) {
        process.stdout.write(`${qaCommandForRow(row, phase)}\n`);
      }
    }
    process.exit(0);
  }
  if (sub === "dry-run-one") {
    const caseId = process.argv[3];
    if (!caseId) {
      process.stderr.write("usage: run.mjs dry-run-one <case_id>\n");
      process.exit(2);
    }
    const runlist = JSON.parse(readFileSync(RUNLIST, "utf-8"));
    let row;
    let phase;
    for (const p of ["dev", "heldout"]) {
      row = runlist.phases[p].find((e) => e.case_id === caseId);
      if (row) {
        phase = p;
        break;
      }
    }
    if (!row) {
      process.stderr.write(`case ${caseId} not in runlist\n`);
      process.exit(2);
    }
    const r = spawnSync(
      ...harnessArgs([
        "shadow-done",
        "--request",
        join(ROOT, row.input),
        "--policy",
        join(ROOT, row.policy),
        "--phase",
        phase,
        "--case-id",
        row.case_id,
        "--runlist",
        RUNLIST,
        "--mode",
        "dry-run",
        "--records",
        join(HERE, "records"),
      ]),
      { encoding: "utf-8", cwd: ROOT },
    );
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    process.exit(r.status ?? 1);
  }
  process.stderr.write("usage: run.mjs sizes | print-commands | dry-run-one <case_id>\n");
  process.exit(2);
}
