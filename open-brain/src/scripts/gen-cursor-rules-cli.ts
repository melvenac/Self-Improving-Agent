import { resolveRepoRoot } from "../shared/repo-root.js";
import { writeDeveloperBuildingChecksMdc } from "../pipelines/sync/developer-building-checks.js";

const root = resolveRepoRoot(process.cwd());
if (!root) {
  console.error("gen-cursor-rules: not inside a Self-Improving-Agent checkout");
  process.exit(1);
}
const { changed, path } = writeDeveloperBuildingChecksMdc(root);
console.log(changed ? `wrote ${path}` : `unchanged ${path}`);
