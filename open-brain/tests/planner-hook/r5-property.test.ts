/**
 * T-194 r5: PROPERTY tests. r2-r4 failed because each brief listed spellings and the build fixed
 * exactly those. Here the spellings are GENERATED from combinators (case, slashes, quotes, `.exe` and full
 * paths, flag permutations, cwd and `..` combinations, every expansion character), at least 200 cases per
 * property, from a seeded generator so a failure reproduces. Each case carries the parameters that built it;
 * the verdict the hook must give comes from an INDEPENDENT ORACLE over those parameters, never from the
 * hook's own code:
 *   P1  path.resolve (win32 on a Windows checkout, posix otherwise) against the cwd, then a protected-prefix
 *       check written here;  non-literal characters and a cd in the line are always refused.
 *   P2  the exact no-grant grammar, decided from how the case was assembled (prefix, flags, suffix).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { posix, win32 } from "node:path";
import { writeFileSync } from "node:fs";
import { grantPath } from "../../src/planner-hook/grant.js";
import { makeFixture, type Fixture } from "./r5-fixture.js";

// ---------------------------------------------------------------- seeded generator
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const chance = (rng: Rng, p: number): boolean => rng() < p;

let fx: Fixture;
beforeAll(() => {
  fx = makeFixture("r5prop");
});
afterAll(() => fx.dispose());
beforeEach(() => fx.resetGrant());

// ---------------------------------------------------------------- P1: the oracle
const PROTECTED_TARGETS = [
  "open-brain/src/cli.ts", "open-brain/src/planner-hook/run.ts", "open-brain/tests/x.test.ts", "scripts/setup.sh",
  "hooks/h.js", "open-brain/build/x.js", "package.json", "open-brain/package.json", ".agents/state.json",
  ".agents/TASKS/INBOX.md", ".agents/TASKS/task.md", ".agents/SESSIONS/next-session.md",
];
const OPEN_TARGETS = [
  "docs/loops/q.md", "scratch/x.txt", "README.md", "open-brain/notes.md", ".agents/SYSTEM/PRD.md", "docs/x.md",
  "open-brain/srcx/a.ts", "open-brain/testsx/a.ts",
];
const CWDS = ["", "open-brain", "open-brain/src", "open-brain/tests", "docs/loops", ".agents", ".agents/TASKS", "scratch", "scripts"];
const DETOURS = ["docs", "scratch", "open-brain", ".agents", "scripts"];
const OUTSIDE_SOURCE = "/tmp/outside-source.ts";

/** Is the file this spelling names, resolved from `cwdAbs`, one of the protected paths? Independent of the hook. */
function oracleProtected(root: string, cwdAbs: string, spelled: string, windows: boolean): boolean {
  const lib = windows ? win32 : posix;
  const resolved = lib.resolve(cwdAbs, spelled);
  const slash = (s: string): string => s.replace(/\\/g, "/");
  const r = slash(root).replace(/\/+$/, "");
  const a = slash(resolved);
  // NTFS folds case; a POSIX checkout does not. The same rules are matched case-insensitively or exactly.
  const fold = (s: string): string => (windows ? s.toLowerCase() : s);
  if (fold(a) !== fold(r) && !fold(a).startsWith(`${fold(r)}/`)) return false;
  const rel = a.slice(r.length + 1);
  const flags = windows ? "i" : "";
  const rules = [
    "^open-brain/src(/|$)", "^open-brain/tests(/|$)", "^scripts(/|$)", "^hooks(/|$)", "^open-brain/build(/|$)",
    "(^|/)package\\.json$", "^\\.agents/state\\.json$", "^\\.agents/TASKS/INBOX\\.md$", "^\\.agents/TASKS/task\\.md$",
    "^\\.agents/SESSIONS/next-session\\.md$",
  ];
  return rules.some((src) => new RegExp(src, flags).test(rel));
}

interface PathCase {
  rel: string;
  cwdRel: string;
  spelled: string;
  /** What the oracle says. */
  protect: boolean;
  how: string[];
}

function caseSegments(rng: Rng, rel: string, how: string[]): string {
  const mode = pick(rng, ["keep", "keep", "upper", "mixed"] as const);
  if (mode === "keep") return rel;
  how.push(`case:${mode}`);
  return rel
    .split("/")
    .map((seg, i) => (mode === "upper" ? seg.toUpperCase() : i % 2 === 0 ? seg.toUpperCase() : seg))
    .join("/");
}

function genPath(rng: Rng, root: string, windows: boolean): PathCase {
  const how: string[] = [];
  const rel = pick(rng, chance(rng, 0.6) ? PROTECTED_TARGETS : OPEN_TARGETS);
  const cwdRel = pick(rng, CWDS);
  const cwdAbs = cwdRel ? `${root}/${cwdRel}` : root;
  let body = caseSegments(rng, rel, how);
  let spelled: string;
  if (chance(rng, 0.5)) {
    how.push("absolute");
    spelled = `${root}/${body}`;
    if (chance(rng, 0.3)) {
      how.push("detour");
      spelled = `${root}/${pick(rng, DETOURS)}/../${body}`;
    }
  } else {
    how.push("relative");
    const toRoot = cwdRel === "" ? "" : `${cwdRel.split("/").map(() => "..").join("/")}/`;
    spelled = `${toRoot}${body}`;
    if (chance(rng, 0.3)) {
      how.push("dot");
      spelled = `./${spelled}`;
    }
    if (chance(rng, 0.25)) {
      how.push("detour");
      spelled = `${toRoot}${pick(rng, DETOURS)}/../${body}`;
    }
  }
  if (chance(rng, 0.2)) {
    how.push("double-slash");
    spelled = spelled.replace(/([^:/])\/(?=[^/])/, "$1//");
  }
  // The oracle sees the spelling as the shell would receive it (after quote removal), so it is computed before quoting.
  body = spelled;
  return { rel, cwdRel, spelled: body, protect: oracleProtected(root, cwdAbs, body, windows), how };
}

function quoteIt(rng: Rng, text: string, how: string[], psFlavor: boolean): string {
  const mode = pick(rng, ["none", "none", "dq", "sq", "partial"] as const);
  if (mode === "none") return text;
  how.push(`quote:${mode}`);
  if (mode === "dq") return `"${text}"`;
  if (mode === "sq") return `'${text}'`;
  // quote one leading segment: "open-brain"/src/cli.ts
  const i = text.indexOf("/");
  if (i <= 0 || /[\\:]/.test(text.slice(0, i))) return psFlavor ? `'${text}'` : `"${text}"`;
  return `"${text.slice(0, i)}"${text.slice(i)}`;
}

function toBackslashes(rng: Rng, text: string, how: string[], windows: boolean): string {
  if (!windows || !chance(rng, 0.3)) return text;
  how.push("backslash");
  return text.replace(/\//g, "\\");
}

/** Bash writers. `T` is the quoted target. The checks cover the write-target families the hook claims to read. */
const BASH_WRITERS: Array<(t: string) => string> = [
  (t) => `echo x > ${t}`,
  (t) => `echo x >> ${t}`,
  (t) => `echo x >${t}`,
  (t) => `echo x 2> ${t}`,
  (t) => `echo x &> ${t}`,
  (t) => `echo x >| ${t}`,
  (t) => `echo x | tee ${t}`,
  (t) => `echo x | tee -a ${t}`,
  (t) => `echo x | tee ${OUTSIDE_SOURCE} ${t}`,
  (t) => `cp ${OUTSIDE_SOURCE} ${t}`,
  (t) => `cp -f ${OUTSIDE_SOURCE} ${t}`,
  (t) => `cp -t ${t} ${OUTSIDE_SOURCE}`,
  (t) => `mv ${OUTSIDE_SOURCE} ${t}`,
  (t) => `sed -i s/a/b/ ${t}`,
  (t) => `sed -i -e s/a/b/ ${t}`,
  (t) => `sed -i.bak -e s/a/b/ -e s/c/d/ ${t}`,
  (t) => `sed --in-place s/a/b/ ${t}`,
];
const CHAINS: Array<(w: string) => string> = [
  (w) => w,
  (w) => `true && ${w}`,
  (w) => `${w}; true`,
  (w) => `(${w})`,
  (w) => `false || ${w}`,
  (w) => `env X=1 ${w}`,
  (w) => `echo a | ${w}`,
];

const PS_WRITERS: Array<(t: string) => string> = [
  (t) => `Set-Content ${t} x`,
  (t) => `Set-Content -Path ${t} -Value x`,
  (t) => `Set-Content -Value x -Path ${t}`,
  (t) => `Set-Content -LiteralPath ${t} x`,
  (t) => `Set-Content -Lit ${t} x`,
  (t) => `'x' | Out-File ${t}`,
  (t) => `'x' | Out-File -FilePath ${t} -Append`,
  (t) => `Add-Content ${t} x`,
  (t) => `Copy-Item ${OUTSIDE_SOURCE} ${t}`,
  (t) => `Copy-Item -Path ${OUTSIDE_SOURCE} -Destination ${t}`,
  (t) => `Copy-Item -Dest ${t} ${OUTSIDE_SOURCE}`,
  (t) => `Move-Item ${OUTSIDE_SOURCE} ${t}`,
  (t) => `New-Item ${t}`,
  (t) => `New-Item -Path ${t} -ItemType File`,
  (t) => `Remove-Item ${t}`,
  (t) => `Remove-Item -Force -Path ${t}`,
  (t) => `echo x > ${t}`,
  (t) => `echo x >> ${t}`,
];
const PS_CHAINS: Array<(w: string) => string> = [(w) => w, (w) => `Get-Date; ${w}`, (w) => `${w}; Get-Date`, (w) => `Write-Output hi | Out-Null; ${w}`];

interface Case {
  name: string;
  run: () => ReturnType<Fixture["bash"]>;
  expect: "deny" | "allow";
  how: string[];
}

const SEED = 20260930;

function genP1Paths(count: number): Case[] {
  const rng = mulberry32(SEED);
  const out: Case[] = [];
  for (let n = 0; n < count; n++) {
    const root = fx.fwd;
    const pc = genPath(rng, root, fx.windows);
    const how = [...pc.how];
    const kind = pick(rng, ["bash", "bash", "bash", "ps", "edit", "write"] as const);
    const cwd = pc.cwdRel ? `${root}/${pc.cwdRel}` : root;
    if (kind === "edit" || kind === "write") {
      const t = toBackslashes(rng, pc.spelled, how, fx.windows);
      out.push({
        name: `${kind} ${t} @ ${pc.cwdRel || "."}`,
        run: () => (kind === "edit" ? fx.edit(t, cwd) : fx.write(t, cwd)),
        expect: pc.protect ? "deny" : "allow",
        how: [...how, kind],
      });
      continue;
    }
    if (kind === "bash") {
      let t = toBackslashes(rng, pc.spelled, how, fx.windows);
      // Backslashes survive only in single quotes in bash; the hook treats them as separators either way.
      t = how.includes("backslash") ? `'${t}'` : quoteIt(rng, t, how, false);
      if (/\s/.test(t) && !/^["']/.test(t)) t = `"${t}"`;
      const cmd = pick(rng, CHAINS)(pick(rng, BASH_WRITERS)(t));
      out.push({ name: `bash ${cmd} @ ${pc.cwdRel || "."}`, run: () => fx.bash(cmd, cwd), expect: pc.protect ? "deny" : "allow", how: [...how, "bash"] });
    } else {
      let t = toBackslashes(rng, pc.spelled, how, fx.windows);
      t = quoteIt(rng, t, how, true);
      if (/\s/.test(t) && !/^["']/.test(t)) t = `"${t}"`;
      const cmd = pick(rng, PS_CHAINS)(pick(rng, PS_WRITERS)(t));
      out.push({ name: `ps ${cmd} @ ${pc.cwdRel || "."}`, run: () => fx.ps(cmd, cwd), expect: pc.protect ? "deny" : "allow", how: [...how, "ps"] });
    }
  }
  return out;
}

const EXPANSIONS: Array<(spelled: string) => string> = [
  (s) => `~/${s}`,
  (s) => `~root/${s}`,
  (s) => `$HOME/${s}`,
  (s) => `\${HOME}/${s}`,
  (s) => `$(pwd)/${s}`,
  (s) => "`pwd`/" + s,
  (s) => s.replace(/\/([^/]+)$/, "/*"),
  (s) => s.replace(/\/([^/]+)$/, "/?"),
  (s) => s.replace(/\/([^/]+)$/, "/[a-z]*"),
  (s) => s.replace(/\/([^/]+)$/, "/{a,b}"),
  (s) => s.replace(/^[^/]*\//, (m) => `${m.slice(0, -1)}*/`),
  (s) => `$TMP/${s}`,
];

function genP1NonLiteral(count: number): Case[] {
  const rng = mulberry32(SEED + 1);
  const out: Case[] = [];
  for (let n = 0; n < count; n++) {
    const pc = genPath(rng, fx.fwd, fx.windows);
    const how = [...pc.how, "nonliteral"];
    const idx = Math.floor(rng() * EXPANSIONS.length);
    how.push(`expansion:${idx}`);
    let decorated = EXPANSIONS[idx](pc.spelled);
    if (decorated === pc.spelled) decorated = `~/${pc.spelled}`;
    const cwd = pc.cwdRel ? `${fx.fwd}/${pc.cwdRel}` : fx.fwd;
    const kind = pick(rng, ["bash", "ps", "edit"] as const);
    if (kind === "edit") {
      // A file tool has no shell; `$(pwd)` and a backtick still contain `$`/a backtick and are refused.
      out.push({ name: `edit ${decorated}`, run: () => fx.edit(decorated, cwd), expect: "deny", how: [...how, "edit"] });
    } else if (kind === "bash") {
      const t = chance(rng, 0.3) ? `'${decorated}'` : chance(rng, 0.3) ? `"${decorated}"` : decorated;
      const cmd = pick(rng, CHAINS)(pick(rng, BASH_WRITERS)(t));
      out.push({ name: `bash ${cmd}`, run: () => fx.bash(cmd, cwd), expect: "deny", how: [...how, "bash"] });
    } else {
      const cmd = pick(rng, PS_CHAINS)(pick(rng, PS_WRITERS)(decorated));
      out.push({ name: `ps ${cmd}`, run: () => fx.ps(cmd, cwd), expect: "deny", how: [...how, "ps"] });
    }
  }
  return out;
}

const CD_FORMS: Array<(w: string, dir: string) => string> = [
  (w, d) => `cd ${d} && ${w}`,
  (w, d) => `(cd ${d}; ${w})`,
  (w, d) => `pushd ${d}; ${w}`,
  (w, d) => `${w}; cd ${d}`,
  (w, d) => `cd ${d}\n${w}`,
  (w, d) => `command cd ${d} && ${w}`,
  (w, d) => `true && cd ${d} && ${w}`,
];

function genP1Cd(count: number): Case[] {
  const rng = mulberry32(SEED + 2);
  const out: Case[] = [];
  for (let n = 0; n < count; n++) {
    const pc = genPath(rng, fx.fwd, fx.windows);
    const how = [...pc.how, "cd"];
    const dir = pick(rng, ["open-brain", "docs/loops", "..", "src", ".agents", "scratch"]);
    const cwd = pc.cwdRel ? `${fx.fwd}/${pc.cwdRel}` : fx.fwd;
    if (chance(rng, 0.7)) {
      const cmd = pick(rng, CD_FORMS)(pick(rng, BASH_WRITERS)(pc.spelled), dir);
      // a cd and a write on one line: refused whatever the target is, protected or not
      out.push({ name: `bash ${cmd}`, run: () => fx.bash(cmd, cwd), expect: "deny", how: [...how, "bash"] });
    } else {
      const cmd = pick(rng, [
        (w: string, d: string) => `Set-Location ${d}; ${w}`,
        (w: string, d: string) => `cd ${d}; ${w}`,
        (w: string, d: string) => `Push-Location ${d}; ${w}`,
        (w: string, d: string) => `${w}; sl ${d}`,
      ])(pick(rng, PS_WRITERS)(pc.spelled), dir);
      out.push({ name: `ps ${cmd}`, run: () => fx.ps(cmd, cwd), expect: "deny", how: [...how, "ps"] });
    }
  }
  return out;
}

/** A cd with no write is fine; so is a write with no cd (decided by the P1 path oracle above). */
function genP1CdControls(count: number): Case[] {
  const rng = mulberry32(SEED + 3);
  const out: Case[] = [];
  for (let n = 0; n < count; n++) {
    const dir = pick(rng, ["open-brain", "docs/loops", "..", ".agents", "scratch"]);
    const reader = pick(rng, ["ls", "git status", "npm test 2>/dev/null", "cat README.md", "ls -la 2>&1 >/dev/null"]);
    const cmd = pick(rng, CD_FORMS)(reader, dir);
    out.push({ name: `bash ${cmd}`, run: () => fx.bash(cmd, fx.fwd), expect: "allow", how: ["cd-control"] });
  }
  return out;
}

function runCases(title: string, cases: () => Case[], min: number, required: string[], needDeny: boolean): void {
  describe(title, () => {
    it(`generates at least ${min} cases and covers every variant it claims`, () => {
      const cs = cases();
      expect(cs.length).toBeGreaterThanOrEqual(min);
      const seen = new Set(cs.flatMap((c) => c.how));
      for (const needed of required) expect(seen.has(needed), `no ${needed} case generated`).toBe(true);
      if (needDeny) expect(cs.some((c) => c.expect === "deny")).toBe(true);
      if (title.includes("real write location")) expect(cs.some((c) => c.expect === "allow")).toBe(true);
    });

    it("every case matches the oracle", () => {
      const cs = cases();
      const wrong: string[] = [];
      for (const c of cs) {
        const r = c.run();
        const got = r.decision === "deny" ? "deny" : "allow";
        if (got !== c.expect) wrong.push(`${c.name}  expected ${c.expect}, hook said ${r.decision}${r.reason ? ` (${r.reason.slice(0, 120)})` : ""}  [${c.how.join(",")}]`);
      }
      expect(wrong, `${wrong.length} of ${cs.length} cases disagree with the oracle:\n${wrong.slice(0, 25).join("\n")}`).toEqual([]);
    });
  });
}

runCases("P1 — the real write location, 400 generated spellings vs. path.resolve + a protected-prefix check", () => genP1Paths(400), 400, ["bash", "ps", "edit", "write", "absolute", "relative", "detour", "dot", "double-slash"], true);
runCases("P1 — any non-literal target is refused, 200 generated expansions", () => genP1NonLiteral(200), 200, ["bash", "ps", "edit", "nonliteral"], true);
runCases("P1 — a cd on the same line as a write is refused, 200 generated forms", () => genP1Cd(200), 200, ["bash", "ps", "cd"], true);
runCases("P1 — a cd with no write is not refused, 60 generated controls", () => genP1CdControls(60), 60, ["cd-control"], false);

// ---------------------------------------------------------------- P2: the exact no-grant grammar
const ALLOWED_FLAGS = ["--squash", "--merge", "--rebase", "--delete-branch", "-s", "-m", "-r", "-d"];
const OTHER_FLAGS = ["--repo o/x", "-R o/x", "-Ro/x", "--repo=o/x", "--admin", "--auto", "--body hi", "-b hi", "--subject s", "--match-head-commit abc", "-sd", "--squash=true"];
const GH_BASH = ["gh", "GH", "Gh", "gH", "gh.exe", "gh.EXE", "GH.EXE", '"gh"', "'gh'", '"gh.exe"', '"C:/Program Files/GitHub CLI/gh.exe"', "'C:\\Program Files\\GitHub CLI\\gh.exe'"];
const GH_PS = [...GH_BASH, ".\\gh.exe", '& "C:\\Program Files\\GitHub CLI\\gh.exe"', "& 'gh'", "& gh"];
const PREFIX_BASH = ["GH_REPO=o/x ", "GH_HOST=h ", "env ", "env GH_REPO=o/x ", "command ", "sudo ", "time ", "nice ", "xargs ", "FOO=1 BAR=2 "];
const PREFIX_PS = ['$env:GH_REPO="o/x"; ', "Get-Date; ", "echo hi | ", "if ($true) { "];
const SUFFIX_BASH = [" && echo ok", " ; echo ok", " | cat", " > out.txt", "\necho ok", " || true", " &", " $(echo)", " `echo`", " # note", " 2> err.log", " ; git push origin master"];
const SUFFIX_PS = [" ; echo ok", " | Out-Null", " > out.txt", "\necho ok", " ; Get-Date", " $(echo)"];
const PRE_FLAGS = ["--repo o/x ", "-R o/x ", "-Ro/x ", "--repo=o/x ", "--hostname h "];

interface MergeCase {
  name: string;
  tool: "Bash" | "PowerShell";
  command: string;
  pr: "1" | "2";
  eligible: boolean;
  how: string[];
}

function genMerge(count: number): MergeCase[] {
  const rng = mulberry32(SEED + 4);
  const out: MergeCase[] = [];
  for (let n = 0; n < count; n++) {
    const ps = chance(rng, 0.35);
    const how: string[] = [ps ? "ps" : "bash"];
    let eligible = true;
    const ghForm = pick(rng, ps ? GH_PS : GH_BASH);
    how.push(`gh:${ghForm}`);
    let command = ghForm;
    let prefix = "";
    if (chance(rng, 0.25)) {
      prefix = pick(rng, ps ? PREFIX_PS : PREFIX_BASH);
      eligible = false;
      how.push("prefix");
    }
    command += " ";
    if (chance(rng, 0.2)) {
      command += pick(rng, PRE_FLAGS);
      eligible = false;
      how.push("preflags");
    }
    command += "pr merge";
    const pr = pick(rng, ["1", "2"] as const);
    const target = chance(rng, 0.2) ? `https://github.com/melvenac/Self-Improving-Agent/pull/${pr}` : pr;
    const flags: string[] = [];
    const k = Math.floor(rng() * 4);
    for (let i = 0; i < k; i++) flags.push(pick(rng, ALLOWED_FLAGS));
    if (chance(rng, 0.25)) {
      flags.splice(Math.floor(rng() * (flags.length + 1)), 0, pick(rng, OTHER_FLAGS));
      eligible = false;
      how.push("otherflag");
    }
    if (chance(rng, 0.1) && flags.length > 0) {
      // flags BEFORE the target are outside the grammar
      command += ` ${flags.join(" ")} ${target}`;
      eligible = false;
      how.push("flags-before-target");
    } else {
      command += ` ${target}${flags.length ? ` ${flags.join(" ")}` : ""}`;
    }
    let suffix = "";
    if (chance(rng, 0.2)) {
      suffix = pick(rng, ps ? SUFFIX_PS : SUFFIX_BASH);
      eligible = false;
      how.push("suffix");
    }
    let full = `${prefix}${command}${suffix}`;
    if (prefix === "if ($true) { ") full += " }";
    if (chance(rng, 0.15)) {
      const inner = full;
      const wrapped = ps ? `powershell -Command "${inner.replace(/"/g, "'")}"` : `bash -c '${inner.replace(/'/g, '"')}'`;
      full = wrapped;
      eligible = false;
      how.push("nested");
    }
    if (chance(rng, 0.1)) {
      full = `  ${full}  `;
      how.push("padded");
    }
    out.push({ name: full, tool: ps ? "PowerShell" : "Bash", command: full, pr, eligible, how });
  }
  return out;
}

const NON_MERGE = [
  "gh pr view N", "gh pr list --state merged", "gh --repo o/x pr checks N", "gh pr diff N", "gh issue view N",
  "GH pr view N", "gh.exe pr status", "echo gh pr", "gh pr comment N --body hi", "gh api repos/o/x",
];

describe("P2 — a merge is `gh ... pr ... merge` in any spelling; one grammar needs no grant", () => {
  it("generates at least 300 merge cases and covers every dimension", () => {
    const cs = genMerge(300);
    expect(cs.length).toBeGreaterThanOrEqual(300);
    const seen = new Set(cs.flatMap((c) => c.how.map((h) => h.split(":")[0])));
    for (const d of ["ps", "bash", "gh", "prefix", "preflags", "otherflag", "suffix", "nested", "flags-before-target", "padded"]) {
      expect(seen.has(d), `no case varied ${d}`).toBe(true);
    }
    expect(cs.some((c) => c.eligible)).toBe(true);
    expect(cs.some((c) => !c.eligible)).toBe(true);
  });

  it("every merge case matches the grammar oracle: ineligible = deny with zero fetches; eligible = decided by the PR's files", async () => {
    const cs = genMerge(300);
    const wrong: string[] = [];
    for (const c of cs) {
      const r = await fx.merge(c.tool, c.command);
      const fetched = fx.calls.length;
      if (!c.eligible) {
        if (r.decision !== "deny" || fetched !== 0) wrong.push(`${JSON.stringify(c.command)} [${c.tool}] should be denied with 0 fetches; got ${r.decision}, ${fetched} fetch(es)`);
      } else if (c.pr === "1") {
        if (r.decision !== "allow" || fetched === 0) wrong.push(`${JSON.stringify(c.command)} [${c.tool}] is an exact docs-only merge: expected allow after a read; got ${r.decision}, ${fetched} fetch(es)`);
      } else if (r.decision !== "deny" || !(r.reason ?? "").includes("unlisted path")) {
        wrong.push(`${JSON.stringify(c.command)} [${c.tool}] is an exact code merge: expected deny naming the unlisted path; got ${r.decision} ${(r.reason ?? "").slice(0, 100)}`);
      }
    }
    expect(wrong, `${wrong.length} of ${cs.length} disagree:\n${wrong.slice(0, 25).join("\n")}`).toEqual([]);
  });

  it("100 generated non-merge gh commands are never read as merges", async () => {
    const rng = mulberry32(SEED + 5);
    const wrong: string[] = [];
    for (let n = 0; n < 100; n++) {
      const tool = chance(rng, 0.3) ? "PowerShell" : "Bash";
      const base = pick(rng, NON_MERGE).replace("N", pick(rng, ["1", "2", "34"]));
      const command = chance(rng, 0.2) ? `${tool === "PowerShell" ? "Get-Date; " : "true && "}${base}` : base;
      const r = await fx.merge(tool, command);
      if (r.decision !== "allow" || fx.calls.length !== 0) wrong.push(`${command} [${tool}]: ${r.decision}, ${fx.calls.length} fetch(es)`);
    }
    expect(wrong).toEqual([]);
  });
});

// ---------------------------------------------------------------- P2b: git merge, tag and push
const GIT_BASH = ["git", "GIT", "Git", "gIt", "git.exe", "GIT.EXE", "Git.Exe", '"git"', "'git'", '"git.exe"', '"C:/Program Files/Git/cmd/git.exe"', "'C:\Program Files\Git\cmd\git.exe'"];
const GIT_PS_EXTRA = [".\git.exe", "& git", '& "C:\Program Files\Git\cmd\git.exe"', "& 'git'"];
const GIT_OPTS = ["", "", "-C docs ", "-C ../x ", "-c user.name=x ", "--git-dir=.git ", "--git-dir .git ", "--no-pager ", "--work-tree=. ", "-c a=b -C d --no-pager ", "--no-pager -c core.x=1 "];
const STANDING_BRANCHES = ["loop/x", "loop/t194-planner-hook", "qa/y", "docs/z", "chore/w", "refs/heads/loop/q", "HEAD:loop/x", "HEAD:refs/heads/docs/n"];
const PUSH_FLAGS_OK = ["", "", "-u ", "--set-upstream ", "--no-verify ", "-v ", "--quiet "];
const PUSH_NEEDS_GRANT = [
  "push", "push origin", "push origin master", "push origin main", "push origin HEAD:master", "push origin HEAD:refs/heads/master",
  "push origin +loop/x", "push origin :loop/x", "push origin loop/x master", "push origin feature/x", "push origin loopx/x",
  "push upstream loop/x", "push https://example.com/r.git loop/x", "push --force origin loop/x", "push origin loop/x --force",
  "push -f origin loop/x", "push -fu origin loop/x", "push -uf origin loop/x", "push --force-with-lease origin loop/x",
  "push --force-if-includes origin loop/x", "push --tags", "push --follow-tags origin loop/x", "push --mirror", "push --all",
  "push --delete origin loop/x", "push -d origin loop/x", "push --prune origin loop/x",
];
const GIT_NON_RESTRICTED = ["status", "log --oneline -5", "log --grep push", "log --grep merge", "merge-base a b", "diff --stat", "fetch origin", "branch -D loop/old", "checkout --detach origin/master", 'commit -m "push origin master and git tag v1"'];
const GIT_MERGE_TAG = ["merge origin/master", "merge --no-ff x", "MERGE x", "tag v1.0.0", "tag -a v1 -m x", "tag -d v1"];

describe("P2b — a git merge, tag or push goes through the same grant check, in any spelling", () => {
  interface GitCase {
    command: string;
    tool: "Bash" | "PowerShell";
    restricted: boolean;
    how: string[];
  }
  function genGit(count: number): GitCase[] {
    const rng = mulberry32(SEED + 6);
    const out: GitCase[] = [];
    for (let n = 0; n < count; n++) {
      const ps = chance(rng, 0.3);
      const how: string[] = [ps ? "ps" : "bash"];
      const gitWord = pick(rng, ps ? [...GIT_BASH, ...GIT_PS_EXTRA] : GIT_BASH);
      const opts = pick(rng, GIT_OPTS);
      if (opts) how.push("options");
      if (gitWord !== "git") how.push("spelling");
      const family = pick(rng, ["standing", "standing", "grant", "grant", "mergetag", "plain"] as const);
      how.push(family);
      let body: string;
      let restricted: boolean;
      if (family === "standing") {
        const branches = chance(rng, 0.2) ? `${pick(rng, STANDING_BRANCHES)} ${pick(rng, STANDING_BRANCHES)}` : pick(rng, STANDING_BRANCHES);
        body = `push ${pick(rng, PUSH_FLAGS_OK)}origin ${branches}`;
        restricted = false;
      } else if (family === "grant") {
        body = pick(rng, PUSH_NEEDS_GRANT);
        restricted = true;
      } else if (family === "mergetag") {
        body = pick(rng, GIT_MERGE_TAG);
        restricted = true;
      } else {
        body = pick(rng, GIT_NON_RESTRICTED);
        restricted = false;
      }
      let command = `${gitWord} ${opts}${body}`;
      const wrap = pick(rng, ["none", "none", "none", "chain", "nested", "sub", "env"] as const);
      if (wrap === "chain") {
        command = ps ? `Get-Date; ${command}` : pick(rng, [`true && ${command}`, `${command}; true`, `(${command})`, `echo a | ${command}`]);
        how.push("chain");
      } else if (wrap === "nested") {
        const inner = command.replace(/'/g, '"');
        command = ps ? `powershell -Command "${inner.replace(/"/g, "'")}"` : `bash -c '${inner}'`;
        how.push("nested");
      } else if (wrap === "sub") {
        command = ps ? `Write-Output $(${command})` : `echo $(${command})`;
        how.push("substitution");
      } else if (wrap === "env" && !ps) {
        command = `env X=1 ${command}`;
        how.push("env");
      }
      out.push({ command, tool: ps ? "PowerShell" : "Bash", restricted, how });
    }
    return out;
  }

  it("generates at least 300 cases and covers every dimension", () => {
    const cs = genGit(300);
    expect(cs.length).toBeGreaterThanOrEqual(300);
    const seen = new Set(cs.flatMap((c) => c.how));
    for (const d of ["ps", "bash", "options", "spelling", "standing", "grant", "mergetag", "plain", "chain", "nested", "substitution", "env"]) {
      expect(seen.has(d), `no case varied ${d}`).toBe(true);
    }
    expect(cs.some((c) => c.restricted)).toBe(true);
    expect(cs.some((c) => !c.restricted)).toBe(true);
  });

  it("every case matches the oracle: restricted = denied without a grant; everything else = allowed", () => {
    const cs = genGit(300);
    const wrong: string[] = [];
    for (const c of cs) {
      const r = c.tool === "Bash" ? fx.bash(c.command) : fx.ps(c.command);
      const got = r.decision === "deny" ? "deny" : "allow";
      const want = c.restricted ? "deny" : "allow";
      if (got !== want) wrong.push(`${JSON.stringify(c.command)} [${c.tool}] expected ${want}, hook said ${r.decision}  [${c.how.join(",")}]`);
    }
    expect(wrong, `${wrong.length} of ${cs.length} disagree:\n${wrong.slice(0, 25).join("\n")}`).toEqual([]);
  });

  it("an exact grant allows the command it was written for, once, whatever its spelling", () => {
    const rng = mulberry32(SEED + 7);
    for (let n = 0; n < 40; n++) {
      const command = `${pick(rng, GIT_BASH)} ${pick(rng, GIT_OPTS)}${pick(rng, PUSH_NEEDS_GRANT)}`;
      writeGrant(command);
      expect(fx.bash(command).decision, command).toBe("allow");
      expect(fx.bash(command).decision, `${command} (second use, grant consumed)`).toBe("deny");
      fx.resetGrant();
    }
  });
});

function writeGrant(command: string): void {
  writeFileSync(grantPath(fx.repo), JSON.stringify({ command }), "utf-8");
}
