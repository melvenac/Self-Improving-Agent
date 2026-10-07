import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { canonicalizeProjectDir, resolvePaths } from "./paths.js";

/** Per-project END-FIX markers live outside the repo (T-246 N6). */
export function endRecordProjectDir(projectRoot: string): string {
  const paths = resolvePaths(projectRoot);
  const root = join(dirname(paths.knowledgeV2Db), "end-record");
  const canon = canonicalizeProjectDir(resolve(projectRoot)) ?? resolve(projectRoot);
  const key = createHash("sha256").update(canon).digest("hex");
  const dir = join(root, key);
  mkdirSync(dir, { recursive: true });
  return dir;
}
