// QA 161 probes (record session 161): /bootstrap r4 at d74c0e5.
//   node docs/loops/qa-161/qa161-probes.mjs <SIA checkout> <transcript.md>
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, appendFileSync, mkdtempSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const SIA = resolve(process.argv[2]);
const OUT = resolve(process.argv[3]);
const CLI = join(SIA, "open-brain", "build", "cli.js");
const SCRATCH = mkdtempSync(join(tmpdir(), "qa161-probes-"));
const HOME = join(SCRATCH, "home");
mkdirSync(HOME, { recursive: true });
const ENV = { ...process.env, HOME, USERPROFILE: HOME, KNOWLEDGE_V2_DB: join(HOME, ".claude", "open-brain", "knowledge-v2.db") };
const stamp = (() => { try { return JSON.parse(readFileSync(join(SIA, "open-brain/build/build-info.json"), "utf8")).commit; } catch { return "unread"; } })();
const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: SIA, encoding: "utf8" }).stdout.trim();

writeFileSync(OUT, `# QA 161 probes\n\nSIA: \`${SIA}\` at \`${head.slice(0, 7)}\`, build stamp \`${stamp}\`. Scratch: \`${SCRATCH}\`. Node ${process.version}, ${process.platform}.\n\n`);
const log = (s) => appendFileSync(OUT, s + "\n");
const results = [];
function row(id, what, ok, detail = "") { results.push({ id, what, ok, detail }); log(`**${ok ? "OK" : "FAIL"}** ${id} — ${what}${detail ? `: ${detail}` : ""}\n`); return ok; }
function run(cmd, args, cwd, { env = ENV, label } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  log("```\n$ " + (label ?? `${cmd} ${args.join(" ")}`) + `   (cwd ${cwd})\n` + out.replace(/\s+$/, "") + `\n[exit ${r.status}]\n` + "```\n");
  return { status: r.status, out };
}
const OB = (cwd, ...a) => run(process.execPath, [CLI, ...a], cwd, { label: `OB ${a.join(" ")}` });
function write(p, t) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, t); }
async function mod(rel) { return import(pathToFileURL(join(SIA, "open-brain/build", rel)).href); }

const SHAPES = [
  ["{}", "a JSON object with no schema_version"],
  ['{"project":{}}', "a JSON object with no schema_version"],
  ["[]", "JSON array"],
  ["null", "JSON null"],
  ["42", "JSON number"],
  ['"text"', "JSON string"],
  ["true", "JSON boolean"],
];

log(`## P-JSON-R4: seven non-record shapes, a v3 record, and an older schema\n`);
for (const [bytes, why] of SHAPES) {
  const dir = join(SCRATCH, "shape", bytes.replace(/[^a-z0-9]+/gi, "_"));
  write(join(dir, ".agents/state.json"), bytes);
  const c = OB(dir, "bootstrap", "check", dir);
  const notRecord = c.out.includes(`NOT A RECORD — state.json is ${why}`);
  const m = OB(dir, "bootstrap", "move-residue", dir);
  const moved = m.status === 0 && !existsSync(join(dir, ".agents/state.json"));
  const { sessionStart } = await mod("pipelines/session-start/index.js");
  const start = sessionStart({ projectRoot: dir, homePath: HOME });
  const startOut = `${start.greeting ?? ""}\n${(start.problems ?? []).map((p) => p.message ?? p).join("\n")}`;
  log(`### shape \`${bytes}\`\n`);
  log(`check NOT A RECORD: ${notRecord}; move-residue aside: ${moved}; /start excerpt:\n\`\`\`\n${startOut.slice(0, 500)}\n\`\`\`\n`);
  row(`P-JSON-${bytes}`, `NOT A RECORD (${why}), move-residue sets aside`, notRecord && moved);
  row(`P-START-${bytes}`, `/start on non-record reported (not scored)`, true, startOut.slice(0, 120).replace(/\n/g, " "));
}

for (const [label, body] of [
  ["v3-record", JSON.stringify({ schema_version: 3, revision: 1, project: { name: "t" }, session: { number: 1 }, tasks: { inbox: [] }, decisions: [], verified: [], gaps: [], handoff: { pick_up: [], watch_out: [], open_questions: [] }, objective: { text: "x" } })],
  ["v2-record", JSON.stringify({ schema_version: 2, revision: 1, project: { name: "old" } })],
]) {
  const dir = join(SCRATCH, "record", label);
  write(join(dir, ".agents/state.json"), body);
  const c = OB(dir, "bootstrap", "check", dir);
  const boot = /BOOTSTRAPPED/.test(c.out);
  const m = OB(dir, "bootstrap", "move-residue", dir);
  const refused = /refused|not residue|bootstrapped/i.test(m.out);
  row(`P-RECORD-${label}`, `${label} stays BOOTSTRAPPED; move-residue refuses`, boot && refused);
}

log(`## P-WALK-SIA: SIA's own root unchanged\n`);
const { resolveRepoRoot } = await mod("shared/repo-root.js");
const sia = SIA;
const cases = [
  ["root", sia],
  ["open-brain", join(sia, "open-brain")],
  ["open-brain/src", join(sia, "open-brain", "src")],
  ["docs", join(sia, "docs")],
];
for (const [name, start] of cases) {
  const got = resolveRepoRoot(start);
  row(`P-WALK-${name}`, `resolveRepoRoot from ${name} → SIA root`, resolve(got ?? "") === resolve(sia));
}

log(`## P-WALK-ZERO: zero-byte stray does not win (R-BF-18)\n`);
{
  const real = join(SCRATCH, "walk-real");
  write(join(real, ".agents/state.json"), JSON.stringify({ schema_version: 3, revision: 1, project: { name: "real" } }));
  const mid = join(real, "packages", "x");
  write(join(mid, ".agents/state.json"), "");
  const cwd = join(mid, "src");
  mkdirSync(cwd, { recursive: true });
  const { isProjectRoot } = await mod("shared/repo-root.js");
  row("P-WALK-ZERO", "zero-byte stray is not a root; walk reaches real project", !isProjectRoot(mid) && resolveRepoRoot(cwd) === resolve(real));
}

log(`## P-GREP-R21: no OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK in src/\n`);
{
  const g = spawnSync("git", ["grep", "-n", "OPEN_BRAIN_BOOTSTRAP_RENAME_HOOK", "--", "open-brain/src"], { cwd: SIA, encoding: "utf8" });
  row("P-GREP-R21", "git grep finds nothing", g.status === 1 && g.stdout === "");
}

log(`\n## Summary\n\n${results.filter((r) => !r.ok).length} failed of ${results.length}\n`);
process.exit(results.some((r) => !r.ok) ? 1 : 0);
