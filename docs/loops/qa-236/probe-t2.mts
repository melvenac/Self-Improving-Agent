// QA 236 T216-2: do plan and evidence agree on every loop-id probe? (zod field, full validatePlan, JSON patterns)
// Usage (from open-brain/): npx tsx C:/qa-scratch/qa236/probe-t2.ts <checkout open-brain dir>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
const s = await import(pathToFileURL(join(root, "src/harness/schema.ts")).href);
const planJson = JSON.parse(readFileSync(join(root, "src/harness/schemas/plan.schema.json"), "utf8"));
const evJson = JSON.parse(readFileSync(join(root, "src/harness/schemas/evidence.schema.json"), "utf8"));
const pj = new RegExp(planJson.properties.loop.pattern, "u");
const ej = new RegExp(evJson.properties.loop.pattern, "u");

const accept = ["15-slice-4", "15-slice-3-c", "t001", "t1234"];
const refuse = ["", "15/slice", "../x", "15", "T001", "15-", " 15-slice-4", "15-slice-4\n", "15-slice.4", "15\\slice",
  "t01", "t001-x", "15-Slice", "15--slice", "15-slice-4 ", "..", "x-1"];

const plan = (loop: string) => ({
  loop, objective: "o", tasks: ["t"], out_of_scope: ["n"], preserve: ["p"],
  acceptance: [{ id: "A1", observable: "x", type: "blackbox" }], repair_targets: ["g"], new_capability: "c",
});
const planShape = (s.PlanSchema.shape ?? s.PlanSchema._def?.schema?.shape).loop;
const evShape = (s.EvidenceSchema.shape ?? s.EvidenceSchema._def?.schema?.shape).loop;

let disagree = 0, wrong = 0;
const rows: string[] = [];
for (const id of [...accept, ...refuse]) {
  const want = accept.includes(id);
  const r = {
    planZod: planShape.safeParse(id).success,
    planFull: s.validatePlan(plan(id)).ok,
    evZod: evShape.safeParse(id).success,
    planJson: pj.test(id),
    evJson: ej.test(id),
  };
  const vals = Object.values(r);
  const agree = vals.every((v) => v === vals[0]);
  if (!agree) disagree++;
  if (vals.some((v) => v !== want)) wrong++;
  rows.push(`| ${JSON.stringify(id)} | ${want ? "accept" : "refuse"} | ${r.planZod} | ${r.planFull} | ${r.evZod} | ${r.planJson} | ${r.evJson} | ${agree ? "yes" : "NO"} |`);
}
console.log("| id | want | plan zod | validatePlan | evidence zod | plan.schema.json | evidence.schema.json | agree |");
console.log("|---|---|---|---|---|---|---|---|");
console.log(rows.join("\n"));
console.log(`probes=${accept.length + refuse.length} disagreements=${disagree} off-spec=${wrong}`);
console.log(`same object: ${s.EVIDENCE_LOOP_PATTERN === s.LOOP_ID_PATTERN}; plan JSON === evidence JSON pattern: ${planJson.properties.loop.pattern === evJson.properties.loop.pattern}`);
