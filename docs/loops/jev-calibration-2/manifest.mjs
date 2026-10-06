// manifest.mjs — hashes for calibration 2 inputs + runlist (byte-stable).
//   node open-brain/node_modules/tsx/dist/cli.mjs docs/loops/jev-calibration-2/manifest.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HERE, REPO, readJson, sha256, writeJson } from "./lib.mjs";
import { isEligibleCase, POLICY_REL } from "./inputs.mjs";

export function runManifest() {
  const split = JSON.parse(readFileSync(join(HERE, "../jev-calibration-2-split.json"), "utf-8"));
  const collect = readJson("collect.json");
  const inputs = readJson("inputs.json");
  const byId = new Map(collect.cases.map((c) => [c.case_id, c]));
  const builtMap = new Map(inputs.built.map((b) => [b.case_id, b]));

  function entry(case_id, phase) {
    const b = builtMap.get(case_id);
    const c = byId.get(case_id);
    if (!b || !c) throw new Error(`runlist: missing built input for ${case_id}`);
    return {
      phase,
      case_id,
      case_no: c.case_no,
      label: c.label,
      input: `docs/loops/jev-calibration-2/${b.file}`,
      policy: POLICY_REL,
      leak_excluded: b.leak_excluded ?? false,
      merge_commit: c.merge_commit,
      scored_sha: c.candidate_sha,
      base_sha: c.base_sha,
      checks: c.checks_hint?.checks ?? "none",
    };
  }

  const heldSet = new Set(split.held_out.case_ids);
  const devIds = split.development.case_ids.filter((id) => {
    const c = byId.get(id);
    return c && isEligibleCase(c) && !heldSet.has(id);
  });
  const heldout = split.held_out.case_ids.map((id) => entry(id, "heldout"));
  const dev = devIds.map((id) => entry(id, "dev"));
  if (heldout.length !== split.held_out.case_ids.length) {
    throw new Error(`runlist heldout: expected ${split.held_out.case_ids.length}, got ${heldout.length}`);
  }
  for (const id of heldSet) {
    if (devIds.includes(id)) throw new Error(`held-out ${id} also in dev phase`);
  }

  const runlist = { policy: POLICY_REL, phases: { dev, heldout } };
  writeJson("runlist.json", runlist);

  const SCRIPTS = ["lib.mjs", "collect.mjs", "inputs.mjs", "manifest.mjs", "score.mjs", "dispatch-derive.mjs", "leak.mjs"];
  const DATA = ["collect.json", "inputs.json", "runlist.json", "pool.json"];
  const fileHash = (rel) => sha256(readFileSync(join(HERE, rel)));
  const policyHash = sha256(readFileSync(join(REPO, POLICY_REL)));
  const hashes = {
    scripts: Object.fromEntries(SCRIPTS.filter((f) => readdirSync(HERE).includes(f)).map((f) => [f, fileHash(f)])),
    data: Object.fromEntries(DATA.map((f) => [f, fileHash(f)])),
    inputs: Object.fromEntries(
      readdirSync(join(HERE, "inputs"))
        .sort()
        .map((f) => [`inputs/${f}`, fileHash(`inputs/${f}`)]),
    ),
    policies: { [POLICY_REL]: policyHash },
    score_mjs: fileHash("score.mjs"),
  };

  writeJson("MANIFEST.json", {
    freeze: "Jev calibration 2 round 2 inputs — frozen before any live Jev call.",
    split_seed: split.seed,
    counts: {
      inputs_built: inputs.built.length,
      inputs_refused: inputs.refused.length,
      inputs_leak_excluded: inputs.excluded_leak.length,
      phase_dev: dev.length,
      phase_heldout: heldout.length,
    },
    hashes,
  });

  console.log(`manifest: dev ${dev.length}, heldout ${heldout.length}, input files ${Object.keys(hashes.inputs).length}`);
  return { runlist, hashes };
}

const mainScript = [process.argv[1], process.argv[2]].find((a) => a?.endsWith("manifest.mjs"));
if (mainScript && fileURLToPath(import.meta.url) === resolve(mainScript)) runManifest();
