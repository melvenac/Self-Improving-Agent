#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, readJson } from "./lib.mjs";
import { readCal2Input, requestSizeStats, CAL2_MAX_WIRE_BYTES } from "../../../open-brain/src/harness/cal2-frozen.ts";

const runlist = readJson("runlist.json");
const repo = join(HERE, "../../..");

function phaseStats(phase) {
  const bodies = [];
  for (const row of runlist.phases[phase]) {
    const { wireBody } = readCal2Input(join(repo, row.input));
    bodies.push(wireBody.length);
  }
  const s = requestSizeStats(bodies);
  return { phase, ...s, over_90kb: bodies.filter((b) => b > CAL2_MAX_WIRE_BYTES).length };
}

const dev = phaseStats("dev");
const held = phaseStats("heldout");
console.log(JSON.stringify({ ceiling_bytes: CAL2_MAX_WIRE_BYTES, dev, heldout: held }, null, 2));
