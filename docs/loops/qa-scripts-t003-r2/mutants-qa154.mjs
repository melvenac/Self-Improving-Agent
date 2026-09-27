// QA 154: the seat's own mutants on d781b59, at least one per required fix (D1, D3, R2-D1), none the developer's.
// Each is applied to a scratch worktree at d781b59 (every site must occur exactly once), built with `npm run build`
// (tsc: a mutant that does not compile is INVALID, not killed), then run against the FULL vitest suite and this
// seat's probes (q154-d, q154-r2d1) and QA 142's c1-t003/c3-start. The tree is restored in `finally`.
// usage: node mutants-qa154.mjs <mut-root> <scratch-dir> <qa154-scripts-dir> <qa142-scripts-dir> [only-id]
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";

const [MUT, S, Q154, Q142, ONLY] = process.argv.slice(2);
const OB = join(MUT, "open-brain");
const SV = "open-brain/src/server.ts", SW = "open-brain/src/shared/state-writer.ts";
const GUARD = "  if (mine && mine.checkout != null && mine.checkout !== checkout) {";
const MUTANTS = [
  { id: "M1-d1-callsite", fix: "D1", why: "ob_start turns 'no proof' back into 'discover' at the call site (sessionStart itself unchanged)", edits: [
    [SV, "      sessionId: proven.id,\n", "      sessionId: proven.id ?? undefined,\n"]] },
  { id: "M2-d1-greeting", fix: "D1", why: "the greeting prints the pipeline's id, not 'none — <reason>' (discovery stays off)", edits: [
    [SV, "    const sessionIdLine = proven.id === null\n      ? `Session ID: none — ${proven.reason}`\n      : `Session ID: ${result.session.sessionId ?? \"discovery failed\"}`;",
      "    const sessionIdLine = `Session ID: ${result.session.sessionId ?? \"discovery failed\"}`;"]] },
  { id: "M3-d3-sessionEnd-half", fix: "D3", why: "ob_end resolves recalls under the proven id but passes the NAMED id (none) to sessionEndV2", edits: [
    [SV, "      sessionId: endedId ?? \"\",\n", "      sessionId: args.session_id || \"\",\n"]] },
  { id: "M4-d3-resolve-half", fix: "D3", why: "ob_end resolves recalls under the NAMED id (none) and passes the proven id to sessionEndV2", edits: [
    [SV, "      sessionId: endedId,\n      explicitIds", "      sessionId: args.session_id || null,\n      explicitIds"]] },
  { id: "M5-r2d1-explicit-checkout-only", fix: "R2-D1", why: "the writer compares only when the caller passed `checkout` (the server never does)", edits: [
    [SW, GUARD, "  if (mine && mine.checkout != null && options.checkout !== undefined && mine.checkout !== checkout) {"]] },
  { id: "M6-r2d1-handoff-batches-only", fix: "R2-D1", why: "the writer refuses only batches that carry set_handoff; any other write moves the session record's checkout", edits: [
    [SW, GUARD, "  if (mine && mine.checkout != null && mine.checkout !== checkout && options.ops.some((o) => (o as { op?: unknown } | null)?.op === \"set_handoff\")) {"]] },
  { id: "M7-r2d1-null-refused", fix: "R2-D1", why: "a legacy session record (checkout null) is refused too (over-refusal)", edits: [
    [SW, GUARD, "  if (mine && mine.checkout !== checkout) {"]] },
];

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: OB, encoding: "utf8", shell: process.platform === "win32", timeout: 1_800_000, maxBuffer: 256 * 1024 * 1024, ...opts });
const restore = () => execFileSync("git", ["checkout", "--", "open-brain/src"], { cwd: MUT });
const build = () => { const r = sh("npm", ["run", "build"]); return r.status === 0 ? "ok" : `BUILD FAILED ${(r.stdout || "").slice(-600)}${(r.stderr || "").slice(-600)}`; };
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const vitest = (tag) => {
  const r = sh("npx", ["vitest", "run"]);
  const out = strip((r.stdout || "") + (r.stderr || ""));
  writeFileSync(join(S, `vitest-${tag}.log`), out);
  const tests = (out.match(/^\s*Tests\s+([^\n]+)/m) || [])[1] ?? "?";
  const failed = [...new Set([...out.matchAll(/^\s*FAIL\s+(tests\/[^\n]+ > [^\n]+)$/gm)].map((m) => m[1].trim()))];
  return { rc: r.status, tests: tests.trim(), failed };
};
const probe = (script, dir, tag) => {
  const d = join(S, "probe", tag, dir);
  rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true });
  cpSync(join(S, "live-rev132.json"), join(d, "live-rev132.json"));
  const r = spawnSync("node", [script, MUT, d, tag], { encoding: "utf8", timeout: 900_000 });
  const out = (r.stdout || "") + (r.stderr || "");
  writeFileSync(join(S, `probe-${tag}-${dir}.log`), out);
  const broken = [...out.matchAll(/^BROKEN\s+(\S+)/gm)].map((m) => m[1]);
  const summary = (out.match(/^(\d+) BROKEN$/m) || [])[1];
  return { broken, ok: summary !== undefined, rc: r.status };
};
const PROBES = [[join(Q154, "q154-d.mjs"), "qd"], [join(Q154, "q154-r2d1.mjs"), "qr"], [join(Q142, "c1-t003.mjs"), "c1"], [join(Q142, "c3-start.mjs"), "c3"]];
const runAll = (tag) => {
  const b = build();
  if (b !== "ok") return { build: b };
  const v = vitest(tag);
  const p = Object.fromEntries(PROBES.map(([s, d]) => [d, probe(s, d, tag)]));
  return { build: b, v, p };
};
const show = (tag, r, base) => {
  if (r.build !== "ok") { console.log(`${tag}: INVALID (does not build): ${r.build.replace(/\s+/g, " ").slice(0, 300)}`); return; }
  console.log(`${tag}: build ok; vitest rc ${r.v.rc}: Tests ${r.v.tests}`);
  for (const f of r.v.failed) console.log(`    vitest FAIL ${f}`);
  for (const [d, x] of Object.entries(r.p)) {
    const newly = base ? x.broken.filter((b) => !base.p[d].broken.includes(b)) : x.broken;
    console.log(`    probe ${d}: ${x.ok ? "" : `NO SUMMARY (rc ${x.rc}) `}BROKEN ${x.broken.length}${base ? `; newly BROKEN vs baseline: ${newly.join(", ") || "none"}` : `: ${x.broken.join(", ") || "none"}`}`);
  }
};

console.log(`# mutants-qa154 on ${execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: MUT, encoding: "utf8" }).trim()} at ${new Date().toISOString()}`);
restore();
const base = runAll("baseline");
show("BASELINE (unmutated)", base, null);
for (const m of MUTANTS) {
  if (ONLY && m.id !== ONLY) continue;
  try {
    for (const [f, from, to] of m.edits) {
      const p = join(MUT, f);
      const src = readFileSync(p, "utf8");
      const n = src.split(from).length - 1;
      if (n !== 1) throw new Error(`site occurs ${n} times in ${f}: ${from.slice(0, 80)}`);
      writeFileSync(p, src.replace(from, to));
    }
    console.log(`\n## ${m.id} (${m.fix}): ${m.why}`);
    console.log(execFileSync("git", ["diff", "--stat", "--", "open-brain/src"], { cwd: MUT, encoding: "utf8" }).trim());
    show(m.id, runAll(m.id), base);
  } catch (e) {
    console.log(`\n## ${m.id}: NOT APPLIED: ${e.message}`);
  } finally {
    restore();
  }
}
console.log(`\nrestored; git diff --stat: '${execFileSync("git", ["diff", "--stat"], { cwd: MUT, encoding: "utf8" }).trim()}'`);
console.log(`final build: ${build()}`);
