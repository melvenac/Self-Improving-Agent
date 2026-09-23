/**
 * CA-15 loop-level probes. QA seat, record session 87 (from session 85's probe15b). Scratchpad only, not tracked.
 * Usage: npx tsx probe15.mts <open-brain tree> <probe> [<probe> ...]
 * Every victim is a scratch directory created here. No real directory is ever a target.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync, lstatSync, linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync,
  renameSync, rmdirSync, symlinkSync, writeFileSync, appendFileSync, unlinkSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const TREE = process.argv[2]!;
const PROBES = process.argv.slice(3);
const imp = (p: string) => import(pathToFileURL(join(TREE, p)).href);
const rt = await imp("src/harness/runtime.ts");
const roles = await imp("src/harness/roles.ts");
const fx = await imp("tests/harness/fixture.ts");
const { runLoop, LoopRefused } = rt;
const { StubDeveloper, StubPlanner, StubQa } = roles;
const { makeRepo, exitingChecks } = fx;

const sha16 = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 16);
const scratch = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)));

/** lstat-based listing of a victim: name, kind, sha, mode. Never follows a link. */
function listVictim(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string, rel: string) => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      const st = lstatSync(p);
      const r = rel ? `${rel}/${n}` : n;
      if (st.isSymbolicLink()) out.push(`${r} LINK`);
      else if (st.isDirectory()) { out.push(`${r}/ DIR`); walk(p, r); }
      else out.push(`${r} ${sha16(readFileSync(p))} ${(st.mode & 0o777).toString(8)} nlink=${st.nlink}`);
    }
  };
  walk(dir, "");
  return out;
}

/** Token search, lstat walk, never entering a link. Returns the paths that hit. */
function tokenHits(root: string, token: string): string[] {
  const hits: string[] = [];
  if (!existsSync(root)) return hits;
  const walk = (d: string) => {
    let names: string[] = [];
    try { names = readdirSync(d); } catch { return; }
    for (const n of names) {
      const p = join(d, n);
      let st; try { st = lstatSync(p); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) walk(p);
      else { try { if (readFileSync(p).includes(token)) hits.push(p); } catch { /* unreadable */ } }
    }
  };
  const st = lstatSync(root);
  if (st.isDirectory()) walk(root); else if (readFileSync(root).includes(token)) hits.push(root);
  return hits;
}

const replacer = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

function envFor(home: string) {
  const xdg = join(home, "xdg");
  mkdirSync(join(xdg, "git"), { recursive: true });
  writeFileSync(join(xdg, "git", "config"), "[user]\n\tname = base\n");
  const g = join(home, ".gitconfig");
  const s = join(home, "system.gitconfig");
  writeFileSync(g, "[user]\n\tname = basehome\n");
  writeFileSync(s, "");
  const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: xdg, GIT_CONFIG_SYSTEM: s } as NodeJS.ProcessEnv;
  delete env.GIT_CONFIG_GLOBAL;
  return { env, xdg, gitconfig: g };
}

function mkVictim(root: string, name: string, token: string): string {
  const v = join(root, name);
  mkdirSync(v);
  writeFileSync(join(v, "canA.txt"), `CANARY-A ${token}\n`);
  writeFileSync(join(v, "canB.txt"), `CANARY-B ${token}\n`);
  return v;
}

type Plant = (ctx: { repoRoot: string }) => Record<string, unknown>;

async function loopWith(repoRoot: string, env: NodeJS.ProcessEnv, plant: Plant, qaAct?: () => void, loop = "t001") {
  const planted: Record<string, unknown> = {};
  const logs: string[] = [];
  const cfg = {
    repoRoot, loop, env,
    roles: {
      planner: new StubPlanner(),
      developer: {
        role: "developer",
        run: async (ctx: any) => {
          const d = await new StubDeveloper().run(ctx);
          Object.assign(planted, plant(ctx));
          return d;
        },
      },
      qa: qaAct
        ? { role: "qa", run: async (ctx: any) => { qaAct(); return new StubQa().run(ctx); } }
        : new StubQa(),
    },
    checks: exitingChecks(0, 0),
    log: (l: string) => logs.push(l),
  };
  let result: any = null; let thrown: any = null;
  try { result = await runLoop(cfg); } catch (e) { thrown = e; }
  return { planted, result, thrown, logs };
}

function summarize(repoRoot: string, r: { result: any; thrown: any; planted: any; logs: string[] }, token: string, victim: string | null) {
  const res = r.result;
  const failedPath = join(repoRoot, "artifacts", "iterations", "t001", "FAILED.md");
  const blob = JSON.stringify(res, replacer) ?? "";
  return {
    planted: r.planted,
    thrown: r.thrown ? `${r.thrown.constructor?.name}: ${r.thrown.code ?? ""} ${String(r.thrown.message).slice(0, 400)}` : null,
    status: res?.status ?? null,
    code: res?.failure?.code ?? null,
    stage: res?.failure?.stage ?? null,
    reason: res?.failure?.reason ?? null,
    failedMd: existsSync(failedPath),
    configVerdicts: res?.configVerdicts?.map((v: any) => ({ stage: v.stage, ok: v.ok, examined: v.examined, changes: v.changes, unrestored: v.unrestored, ancestorLink: v.ancestorLink })) ?? null,
    machineFindings: res?.machineConfigFindings ?? null,
    findings: res?.findings ?? null,
    tokenInLoopResult: blob.includes(token),
    tokenInRepo: tokenHits(repoRoot, token),
    tokenKnownPositive: victim ? tokenHits(victim, token).length : null,
  };
}

function repairGit(root: string) {
  const dot = join(root, ".git");
  try { if (lstatSync(dot).isSymbolicLink()) rmdirSync(dot); } catch {}
  try { if (lstatSync(join(root, ".git-aside")).isDirectory() && !existsSync(dot)) renameSync(join(root, ".git-aside"), dot); } catch {}
}

const out: Record<string, unknown> = { tree: TREE, at: new Date().toISOString() };

for (const probe of PROBES) {
  const token = `TOK${randomBytes(6).toString("hex")}`;
  const outside = scratch("qa87-victims-");
  const home = scratch("qa87-home-");
  const { env, xdg, gitconfig } = envFor(home);
  const repo = makeRepo("qa87-repo-");
  const R: Record<string, unknown> = { token };
  try {
    if (["a1", "a2", "a3", "a5"].includes(probe)) {
      const victim = mkVictim(outside, "victim", token);
      const before = listVictim(victim);
      const r = await loopWith(repo.root, env, (ctx) => {
        const git = join(ctx.repoRoot, ".git");
        let at = "";
        if (probe === "a1") { at = join(git, "hooks"); renameSync(at, join(git, "hooks-aside")); }
        if (probe === "a2") { at = join(git, "info"); renameSync(at, join(git, "info-aside")); }
        if (probe === "a3") { at = join(git, "hooks", "sub"); }
        if (probe === "a5") { at = git; renameSync(git, join(ctx.repoRoot, ".git-aside")); }
        symlinkSync(victim, at, "junction");
        return { at, isLink: lstatSync(at).isSymbolicLink() };
      });
      const at = (r.planted as any).at as string;
      let afterAt: string;
      try { const st = lstatSync(at); afterAt = st.isSymbolicLink() ? "LINK" : st.isDirectory() ? "dir" : "file"; } catch { afterAt = "absent"; }
      R.summary = summarize(repo.root, r, token, victim);
      R.watchedPathAfter = afterAt;
      R.victimBefore = before;
      R.victimAfter = listVictim(victim);
      R.victimUnchanged = JSON.stringify(before) === JSON.stringify(R.victimAfter);
      if (probe === "a5") repairGit(repo.root);
    } else if (probe === "a4" || probe === "a4pre") {
      // linked worktree; a4pre: <git-dir>/info exists with a file at base
      const wt = join(dirname(repo.root), `qa87-wt-${randomBytes(3).toString("hex")}`);
      execFileSync("git", ["-C", repo.root, "worktree", "add", "--detach", wt], { stdio: "ignore" });
      const gd = execFileSync("git", ["-C", wt, "rev-parse", "--absolute-git-dir"], { encoding: "utf-8" }).trim();
      if (probe === "a4pre") { mkdirSync(join(gd, "info")); writeFileSync(join(gd, "info", "exclude"), "# base\n"); }
      R.gitDirInfoAtBase = existsSync(join(gd, "info")) ? listVictim(join(gd, "info")) : "absent";
      const victim = mkVictim(outside, "victim", token);
      const before = listVictim(victim);
      const r = await loopWith(wt, env, () => {
        const at = join(gd, "info");
        if (existsSync(at)) renameSync(at, join(gd, "info-aside"));
        symlinkSync(victim, at, "junction");
        return { at, isLink: lstatSync(at).isSymbolicLink() };
      });
      const at = join(gd, "info");
      let afterAt: string;
      try { const st = lstatSync(at); afterAt = st.isSymbolicLink() ? "LINK" : st.isDirectory() ? `dir[${readdirSync(at).join(",")}]` : "file"; } catch { afterAt = "absent"; }
      R.summary = summarize(wt, r, token, victim);
      R.watchedPathAfter = afterAt;
      R.victimUnchanged = JSON.stringify(before) === JSON.stringify(listVictim(victim));
      try { if (lstatSync(at).isSymbolicLink()) rmdirSync(at); } catch {}
      try { execFileSync("git", ["-C", repo.root, "worktree", "remove", "--force", wt], { stdio: "ignore" }); } catch {}
      await rm(wt, { recursive: true, force: true }).catch(() => {});
    } else if (probe === "a6config" || probe === "a6hook") {
      const victimFile = join(outside, "victim-hard");
      writeFileSync(victimFile, `HARD-CANARY ${token}\n`);
      const vHash = sha16(readFileSync(victimFile));
      const r = await loopWith(repo.root, env, (ctx) => {
        const at = probe === "a6config" ? join(ctx.repoRoot, ".git", "config") : join(ctx.repoRoot, ".git", "hooks", "pre-commit.sample");
        renameSync(at, `${at}-aside`);
        linkSync(victimFile, at);
        return { at, nlink: lstatSync(at).nlink };
      });
      R.summary = summarize(repo.root, r, token, victimFile);
      R.victimHash16 = vHash;
      R.victimBytesUnchanged = readFileSync(victimFile, "utf-8") === `HARD-CANARY ${token}\n`;
      R.victimNlinkAfter = lstatSync(victimFile).nlink;
      const at = (r.planted as any).at as string;
      R.watchedAfter = existsSync(at) ? { nlink: lstatSync(at).nlink, sha: sha16(readFileSync(at)) } : "absent";
      R.readThroughHardLink = JSON.stringify((R.summary as any).configVerdicts ?? []).includes(vHash);
    } else if (probe === "base" || probe === "baseCtl") {
      const victim = mkVictim(outside, "victim", token);
      const before = listVictim(victim);
      const hooks = join(repo.root, ".git", "hooks");
      if (probe === "base") { renameSync(hooks, join(repo.root, ".git", "hooks-aside")); symlinkSync(victim, hooks, "junction"); }
      const head = execFileSync("git", ["-C", repo.root, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
      let thrown: any = null; let result: any = null;
      try { result = await runLoop({ repoRoot: repo.root, loop: "t001", env, roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() }, checks: exitingChecks(0, 0), log: () => {} }); }
      catch (e) { thrown = e; }
      R.thrown = thrown ? `${thrown.constructor?.name} ${thrown.code} ${String(thrown.message).slice(0, 300)}` : null;
      R.isLoopRefused = thrown instanceof LoopRefused;
      R.status = result?.status ?? null; R.code = result?.failure?.code ?? null;
      R.tags = execFileSync("git", ["-C", repo.root, "tag", "--list", "loop-*"], { encoding: "utf-8" }).trim();
      R.headUnmoved = probe === "base" ? execFileSync("git", ["-C", repo.root, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim() === head : "n/a";
      R.artifacts = existsSync(join(repo.root, "artifacts"));
      R.victimUnchanged = JSON.stringify(before) === JSON.stringify(listVictim(victim));
      if (probe === "base") { rmdirSync(hooks); renameSync(join(repo.root, ".git", "hooks-aside"), hooks); }
    } else if (probe === "baseDotGitRepo" || probe === "baseDotGitVictim") {
      // .git itself a junction AT BASE. Repo: to the real git dir, renamed aside. Victim: to a scratch non-repo dir.
      const victim = mkVictim(outside, "victim", token);
      const before = listVictim(victim);
      renameSync(join(repo.root, ".git"), join(repo.root, ".git-aside"));
      symlinkSync(probe === "baseDotGitRepo" ? join(repo.root, ".git-aside") : victim, join(repo.root, ".git"), "junction");
      const asideBefore = listVictim(join(repo.root, ".git-aside"));
      let thrown: any = null; let result: any = null;
      try { result = await runLoop({ repoRoot: repo.root, loop: "t001", env, roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() }, checks: exitingChecks(0, 0), log: () => {} }); }
      catch (e) { thrown = e; }
      R.thrown = thrown ? `${thrown.constructor?.name} ${thrown.code} ${String(thrown.message).slice(0, 300)}` : null;
      R.isLoopRefused = thrown instanceof LoopRefused;
      R.status = result?.status ?? null; R.code = result?.failure?.code ?? null; R.reason = result?.failure?.reason?.slice(0, 300) ?? null;
      R.artifactsInRepo = existsSync(join(repo.root, "artifacts"));
      R.victimUnchanged = JSON.stringify(before) === JSON.stringify(listVictim(victim));
      R.asideUnchanged = JSON.stringify(asideBefore) === JSON.stringify(listVictim(join(repo.root, ".git-aside")));
      repairGit(repo.root);
    } else if (probe === "r35base") {
      // a junction at $XDG_CONFIG_HOME/git AT BASE (a dotfiles setup): must proceed; record must carry type and target
      const dot = join(outside, "dotfiles-git");
      mkdirSync(dot);
      writeFileSync(join(dot, "config"), "[user]\n\tname = dotfiles\n");
      renameSync(join(xdg, "git"), join(xdg, "git-real"));
      symlinkSync(dot, join(xdg, "git"), "junction");
      const r = await loopWith(repo.root, env, () => ({}));
      R.summary = summarize(repo.root, r, token, null);
      R.baseNoteFindings = (r.result?.findings ?? []).filter((f: string) => /link at base|junction|symlink|dotfiles-git/i.test(f));
      rmdirSync(join(xdg, "git"));
    } else if (probe === "machineNext") {
      // developer plants a junction at $XDG_CONFIG_HOME/git AFTER base; the next stage (qa) edits the victim's config.
      const victimM = join(outside, "victim-xdg");
      mkdirSync(victimM);
      writeFileSync(join(victimM, "config"), `[user]\n\tname = ${token}\n`);
      const h0 = sha16(readFileSync(join(victimM, "config")));
      let h1 = "";
      const r = await loopWith(repo.root, env, () => {
        const at = join(xdg, "git");
        renameSync(at, join(xdg, "git-aside"));
        symlinkSync(victimM, at, "junction");
        return { at, isLink: lstatSync(at).isSymbolicLink() };
      }, () => {
        appendFileSync(join(victimM, "config"), "# qa stage edit\n");
        h1 = sha16(readFileSync(join(victimM, "config")));
      });
      R.summary = summarize(repo.root, r, token, victimM);
      R.victimHashBeforeQa = h0; R.victimHashAfterQa = h1;
      const mf = JSON.stringify(r.result?.machineConfigFindings ?? []);
      R.victimHashesInRecord = { h0: mf.includes(h0), h1: mf.includes(h1) };
      try { rmdirSync(join(xdg, "git")); } catch {}
    } else if (probe === "machineHard") {
      // developer replaces HOME/.gitconfig with a HARD link to an outside file; qa then edits the victim (R43+R44)
      const victimG = join(outside, "victim-gitconfig");
      writeFileSync(victimG, `[user]\n\tname = ${token}\n`);
      const vh = sha16(readFileSync(victimG));
      let vh2 = "";
      const r = await loopWith(repo.root, env, () => {
        renameSync(gitconfig, `${gitconfig}-aside`);
        linkSync(victimG, gitconfig);
        return { at: gitconfig, nlink: lstatSync(gitconfig).nlink };
      }, () => { appendFileSync(victimG, "# qa edit\n"); vh2 = sha16(readFileSync(victimG)); });
      R.summary = summarize(repo.root, r, token, victimG);
      R.victimHash16 = vh; R.victimHashAfterQa = vh2;
      const mf = JSON.stringify(r.result?.machineConfigFindings ?? []);
      R.victimHashInRecord = { before: mf.includes(vh), afterQa: mf.includes(vh2) };
    } else if (probe === "machineHardAbsent") {
      // NEW (session 87): $XDG_CONFIG_HOME/git/config ABSENT at base; developer creates it as a HARD link to an outside file;
      // qa then edits the victim. R43: nothing is read through a hard link that was not there at base, machine paths included.
      const victimX = join(outside, "victim-xdgconfig");
      writeFileSync(victimX, `[user]\n\tname = ${token}\n`);
      const xc = join(xdg, "git", "config");
      unlinkSync(xc);
      R.xdgConfigAtBase = existsSync(xc) ? "present" : "absent";
      const vh = sha16(readFileSync(victimX));
      let vh2 = "";
      const r = await loopWith(repo.root, env, () => {
        linkSync(victimX, xc);
        return { at: xc, nlink: lstatSync(xc).nlink };
      }, () => { appendFileSync(victimX, "# qa edit\n"); vh2 = sha16(readFileSync(victimX)); });
      R.summary = summarize(repo.root, r, token, victimX);
      R.victimHash16 = vh; R.victimHashAfterQa = vh2;
      const mf = JSON.stringify(r.result?.machineConfigFindings ?? []);
      R.victimHashInRecord = { before: mf.includes(vh), afterQa: mf.includes(vh2) };
    } else if (probe === "r35chainJ" || probe === "r35chainH") {
      // NEW (session 87): a dotfiles link AT BASE ($XDG_CONFIG_HOME/git -> dot, allowed by R35). The developer then
      // changes what is BEYOND the base link: J = renames dot aside and junctions dot -> a victim dir;
      // H = replaces dot/config with a HARD link to a victim file. Either is a link that was not there at base.
      const dot = join(outside, "dotfiles-git");
      mkdirSync(dot);
      writeFileSync(join(dot, "config"), "[user]\n\tname = dotfiles\n");
      renameSync(join(xdg, "git"), join(xdg, "git-real"));
      symlinkSync(dot, join(xdg, "git"), "junction");
      const victimD = join(outside, "victim-chain");
      mkdirSync(victimD);
      writeFileSync(join(victimD, "config"), `[user]\n\tname = ${token}\n`);
      const vh = sha16(readFileSync(join(victimD, "config")));
      let vh2 = "";
      const r = await loopWith(repo.root, env, () => {
        if (probe === "r35chainJ") {
          renameSync(dot, `${dot}-aside`);
          symlinkSync(victimD, dot, "junction");
          return { at: dot, isLink: lstatSync(dot).isSymbolicLink() };
        }
        renameSync(join(dot, "config"), join(dot, "config-aside"));
        linkSync(join(victimD, "config"), join(dot, "config"));
        return { at: join(dot, "config"), nlink: lstatSync(join(dot, "config")).nlink };
      }, () => { appendFileSync(join(victimD, "config"), "# qa edit\n"); vh2 = sha16(readFileSync(join(victimD, "config"))); });
      R.summary = summarize(repo.root, r, token, join(victimD, "config"));
      R.victimHash16 = vh; R.victimHashAfterQa = vh2;
      const mf = JSON.stringify(r.result?.machineConfigFindings ?? []);
      R.victimHashInRecord = { before: mf.includes(vh), afterQa: mf.includes(vh2) };
      R.victimConfigUnchangedExceptQaEdit = readFileSync(join(victimD, "config"), "utf-8") === `[user]\n\tname = ${token}\n# qa edit\n`;
      try { if (lstatSync(dot).isSymbolicLink()) rmdirSync(dot); } catch {}
      try { rmdirSync(join(xdg, "git")); } catch {}
    } else if (probe === "baseHard") {
      // NEW (session 87): a HARD link already at a repository watched file AT BASE (.git/hooks/pre-commit.sample ->
      // an outside file), then an ordinary stub loop. Nothing in the loop changes it.
      const outsideFile = join(outside, "base-hard");
      writeFileSync(outsideFile, `BASE-HARD ${token}\n`);
      const at = join(repo.root, ".git", "hooks", "pre-commit.sample");
      renameSync(at, `${at}-orig`);
      linkSync(outsideFile, at);
      unlinkSync(`${at}-orig`);
      R.nlinkAtBase = lstatSync(at).nlink;
      const before = readFileSync(outsideFile, "utf-8");
      let thrown: any = null; let result: any = null;
      try { result = await runLoop({ repoRoot: repo.root, loop: "t001", env, roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() }, checks: exitingChecks(0, 0), log: () => {} }); }
      catch (e) { thrown = e; }
      R.thrown = thrown ? `${thrown.constructor?.name} ${thrown.code} ${String(thrown.message).slice(0, 300)}` : null;
      R.status = result?.status ?? null; R.code = result?.failure?.code ?? null; R.stage = result?.failure?.stage ?? null;
      R.reason = result?.failure?.reason?.slice(0, 900) ?? null;
      R.configVerdicts = result?.configVerdicts?.map((v: any) => ({ stage: v.stage, ok: v.ok, changes: v.changes, unrestored: v.unrestored })) ?? null;
      R.outsideUnchanged = readFileSync(outsideFile, "utf-8") === before;
      R.nlinkAfter = existsSync(at) ? lstatSync(at).nlink : "absent";
    } else {
      R.error = `unknown probe ${probe}`;
    }
  } catch (e) {
    R.probeError = String((e as Error).stack ?? e).slice(0, 1200);
  } finally {
    repairGit(repo.root);
    await repo.cleanup().catch(() => {});
    await rm(outside, { recursive: true, force: true }).catch(() => {});
    await rm(home, { recursive: true, force: true }).catch(() => {});
  }
  out[probe] = R;
}
console.log(JSON.stringify(out, replacer, 2));
