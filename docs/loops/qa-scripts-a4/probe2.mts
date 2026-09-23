/**
 * Non-link probes for A2. QA seat, record session 85. Scratchpad only, not tracked.
 * Usage: npx tsx probe2.mts <open-brain tree> <probe> [...]
 * H        — CA-4c/D-A4: a GLOBAL filter through HOME/.gitconfig (GIT_CONFIG_GLOBAL unset), runtime vs no runtime
 * R34      — the generated file carries the planted VALUE core.autocrlf=input; control: the system value
 * SINGLE   — D-A3: a plain single-child timeout; the reason verbatim
 * DFORK    — D-A3: a double-forked heartbeat; the reason verbatim; survival by PID and heartbeat
 * DMGconfig/DMGhead/DMGindex — garbage .git/config|HEAD|index by a stub developer
 * COMPOSE  — CA-8: delete the checked-out branch AND plant a hook in one stage
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, mkdtempSync, writeFileSync, chmodSync, appendFileSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const TREE = process.argv[2]!;
const PROBES = process.argv.slice(3);
const imp = (p: string) => import(pathToFileURL(join(TREE, p)).href);
const { runLoop } = await imp("src/harness/runtime.ts");
const { StubDeveloper, StubPlanner, StubQa, ProcessRole, commandAdapter } = await imp("src/harness/roles.ts");
const { pinFor } = await imp("src/harness/git.ts");
const { makeRepo, exitingChecks } = await imp("tests/harness/fixture.ts");
const { writeRoleProcess, heartbeatCode, pidAlive, sizeOf, sleep } = await imp("tests/harness/candidate-a-fixture.ts");

const scratch = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)));
const sh = (p: string) => p.replace(/\\/g, "/");
const markerScript = (path: string, marker: string, tag: string) => {
  writeFileSync(path, `#!/bin/sh\necho "${tag}:$GIT_CONFIG_GLOBAL" >> "${sh(marker)}"\ncat\nexit 0\n`);
  chmodSync(path, 0o755);
  return path;
};
const lines = (m: string) => (existsSync(m) ? readFileSync(m, "utf-8").split(/\r?\n/).filter((l) => l.trim() !== "") : []);
function withEnv(vars: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) { saved[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  return () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
}
const dev = (act: (ctx: any) => void) => ({ role: "developer", run: async (ctx: any) => { const d = await new StubDeveloper().run(ctx); act(ctx); return d; } });
const cfg = (root: string, developer: any, over: Record<string, unknown> = {}) => ({
  repoRoot: root, loop: "t001", roles: { planner: new StubPlanner(), developer, qa: new StubQa() }, checks: exitingChecks(0, 0), log: () => {}, ...over,
});
const brief = (r: any) => ({ status: r?.status, code: r?.failure?.code ?? null, reason: r?.failure?.reason ?? null });

const out: Record<string, unknown> = { tree: TREE, at: new Date().toISOString() };
for (const probe of PROBES) {
  const tmp = scratch("qa87-p2-");
  const repo = makeRepo("qa87-p2-repo-");
  const R: Record<string, unknown> = {};
  try {
    if (probe === "H") {
      repo.write(".gitattributes", "*.txt filter=p\n"); repo.write("a.txt", "a\n"); repo.commitAll("filter target");
      const home = join(tmp, "home"); const xdg = join(tmp, "xdg-empty"); mkdirSync(home); mkdirSync(xdg);
      const marker = join(tmp, "marker.txt");
      const f = markerScript(join(tmp, "filter.sh"), marker, "global-home");
      writeFileSync(join(home, ".gitconfig"), `[filter "p"]\n\tclean = ${sh(f)}\n`);
      const restore = withEnv({ HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_GLOBAL: undefined });
      try {
        const r = await runLoop({ ...cfg(repo.root, dev((ctx) => writeFileSync(join(ctx.repoRoot, "a.txt"), "a changed\n"))), developerAllowlist: ["a.txt", "artifacts/iterations/t001/"] });
        R.loop = brief(r);
        R.markerAfterRuntime = lines(marker);
        writeFileSync(join(repo.root, "a.txt"), "control\n");
        const c = spawnSync("git", ["add", "a.txt"], { cwd: repo.root, env: process.env, encoding: "utf-8" });
        R.controlGitAddExit = c.status;
        R.markerAfterControl = lines(marker);
      } finally { restore(); }
    } else if (probe === "R34") {
      const g = join(tmp, "planted.gitconfig");
      writeFileSync(g, "[core]\n\tautocrlf = input\n\tsshCommand = /bin/evil\n");
      let generated: string | null = null;
      const restore = withEnv({ GIT_CONFIG_GLOBAL: g });
      try {
        const r = await runLoop(cfg(repo.root, dev((ctx) => { const pin = pinFor(ctx.repoRoot); generated = pin?.globalConfigPath ? readFileSync(pin.globalConfigPath, "utf-8") : null; })));
        R.loop = brief(r);
      } finally { restore(); }
      R.generated = generated;
      const gf = join(tmp, "gen.gitconfig"); writeFileSync(gf, generated ?? "");
      R.generatedAutocrlf = spawnSync("git", ["config", "--file", gf, "--get", "core.autocrlf"], { encoding: "utf-8" }).stdout.trim();
      const sys = spawnSync("git", ["config", "--system", "--get", "core.autocrlf"], { encoding: "utf-8" });
      R.systemAutocrlf = { exit: sys.status, value: sys.stdout.trim() };
    } else if (probe === "SINGLE" || probe === "DFORK") {
      const heartbeat = join(tmp, "heartbeat"); const pidFile = join(tmp, "pid");
      const code = probe === "SINGLE" ? null
        : `const cp=require("child_process"),fs=require("fs");const c=cp.spawn(process.execPath,["-e",${JSON.stringify(heartbeatCode(heartbeat))}],{detached:true,stdio:"ignore"});c.unref();fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setTimeout(()=>process.exit(0),300);`;
      const hookRel = ".git/hooks/post-commit";
      const { script, config } = writeRoleProcess(tmp, {
        writes: [{ path: "artifacts/iterations/t001/dev.md", content: "x\n" }],
        plant: probe === "DFORK" ? [{ path: hookRel, content: "#!/bin/sh\nexit 0\n" }] : [],
        grandchild: code ? { code, sync: true } : undefined,
        hangMs: 120000,
      });
      const role = new ProcessRole("developer", { adapter: commandAdapter(script, [config]), timeoutMs: probe === "SINGLE" ? 3000 : 4000 });
      const t0 = Date.now();
      const r = await runLoop(cfg(repo.root, role));
      R.loop = brief(r); R.ms = Date.now() - t0;
      R.hookAfter = existsSync(join(repo.root, hookRel));
      if (probe === "DFORK") {
        const pid = Number(readFileSync(pidFile, "utf-8"));
        const a = sizeOf(heartbeat); await sleep(1200); const b = sizeOf(heartbeat);
        R.dforkPid = pid; R.heartbeatGrewAfterLoop = [a, b]; R.pidAliveAfterLoop = pidAlive(pid);
        try { process.kill(pid); } catch {}
        await sleep(300); R.pidAliveAfterCleanup = pidAlive(pid);
      }
    } else if (probe.startsWith("DMG")) {
      const which = probe === "DMGconfig" ? ".git/config" : probe === "DMGhead" ? ".git/HEAD" : ".git/index";
      const bytes = probe === "DMGconfig" ? "[[[ this is not config\n" : probe === "DMGhead" ? "this is not a ref\n" : "DIRC garbage garbage garbage";
      let thrown: any = null; let r: any = null;
      try { r = await runLoop(cfg(repo.root, dev((ctx) => writeFileSync(join(ctx.repoRoot, which), bytes)))); } catch (e) { thrown = e; }
      R.thrown = thrown ? String(thrown.message).slice(0, 300) : null;
      R.loop = brief(r);
      R.failedMd = existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"));
      R.headResolves = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo.root, encoding: "utf-8" }).status === 0;
    } else if (probe === "COMPOSE") {
      const marker = join(tmp, "compose-marker.txt");
      const branch = execFileSync("git", ["-C", repo.root, "symbolic-ref", "--short", "HEAD"], { encoding: "utf-8" }).trim();
      let r: any = null; let thrown: any = null;
      try {
        r = await runLoop(cfg(repo.root, dev((ctx) => {
          execFileSync("git", ["-C", ctx.repoRoot, "update-ref", "-d", `refs/heads/${branch}`]);
          writeFileSync(join(ctx.repoRoot, ".git/hooks/post-commit"), `#!/bin/sh\necho ran >> "${sh(marker)}"\n`);
          chmodSync(join(ctx.repoRoot, ".git/hooks/post-commit"), 0o755);
        })));
      } catch (e) { thrown = e; }
      R.thrown = thrown ? String(thrown.message).slice(0, 300) : null;
      R.loop = brief(r);
      R.failedMd = existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"));
      R.headResolves = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo.root, encoding: "utf-8" }).status === 0;
      R.branchValue = spawnSync("git", ["rev-parse", `refs/heads/${branch}`], { cwd: repo.root, encoding: "utf-8" }).stdout.trim();
      R.baseTag = spawnSync("git", ["rev-parse", "loop-001-base^{commit}"], { cwd: repo.root, encoding: "utf-8" }).stdout.trim();
      R.hookPresent = existsSync(join(repo.root, ".git/hooks/post-commit"));
      R.marker = lines(marker);
    }
  } catch (e) {
    R.probeError = String((e as Error).stack ?? e).slice(0, 1500);
  } finally {
    await repo.cleanup().catch(() => {});
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
  out[probe] = R;
}
console.log(JSON.stringify(out, null, 2));
