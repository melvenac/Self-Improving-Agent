// QA 241: what remote URLs git sees when remote.origin.url arrives through the environment (no network call).
import { spawnSync } from "node:child_process";
const S = "C:/qa-scratch/qa241-shell";
const cases = {
  GIT_CONFIG_COUNT: { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "remote.origin.url", GIT_CONFIG_VALUE_0: "https://github.com/evil/x" },
  GIT_CONFIG_PARAMETERS: { GIT_CONFIG_PARAMETERS: "'remote.origin.url'='https://github.com/evil/x'" },
};
for (const [k, e] of Object.entries(cases)) {
  const r = spawnSync("git", ["-C", S, "remote", "get-url", "--push", "--all", "origin"], { env: { ...process.env, ...e }, encoding: "utf8" });
  console.log(k, "push urls:", JSON.stringify(r.stdout.trim().split("\n")), r.stderr.trim());
}
