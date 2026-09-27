import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SIA = process.argv[2];
const { sessionStart } = await import(pathToFileURL(join(SIA, "open-brain/build/pipelines/session-start/index.js")).href);
const shapes = [
  ["empty-obj", "{}"],
  ["array", "[]"],
  ["null", "null"],
  ["number", "42"],
  ["string", JSON.stringify("text")],
  ["boolean", "true"],
  ["project-empty", JSON.stringify({ project: {} })],
];
for (const [label, bytes] of shapes) {
  const dir = join("C:/qa-tmp", `sj-${label}`);
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(join(dir, ".agents", "state.json"), bytes);
  const r = sessionStart({ projectRoot: dir, homePath: "C:/qa-tmp" });
  const sj = r.state.stateJson;
  console.log(JSON.stringify({ label, bytes, present: sj.present, valid: sj.valid, errorPath: sj.errorPath ?? null, mode: r.state.mode }));
}
