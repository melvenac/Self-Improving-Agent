// QA 237 generator for P3 (PowerShell is matched; P1 applies to the listed cmdlets and redirects, read from -Path,
// -LiteralPath, -Destination or the first positional; dynamic code is refused with a named cause).
// Own oracle: PowerShell's parameter binding as documented (named, unambiguous prefix, ALIAS, common parameters,
// positional order), and the path the cmdlet receives resolved with path.win32.resolve against the cwd.
// Usage: node gen-p3.mjs <out.json>
import { win32 } from "node:path";
import { writeFileSync } from "node:fs";
import { makeFixture, runAll, pwsh, rng, pick } from "./lib.mjs";

const FXR = makeFixture();
const R = rng(237004);
const chance = (p) => R() < p;
const PROTECTED_RE = [/^open-brain\/src(\/|$)/i, /^open-brain\/tests(\/|$)/i, /^scripts(\/|$)/i, /^hooks(\/|$)/i, /^open-brain\/build(\/|$)/i,
  /(^|\/)package\.json$/i, /^\.agents\/state\.json$/i, /^\.agents\/tasks\/inbox\.md$/i, /^\.agents\/tasks\/task\.md$/i, /^\.agents\/sessions\/next-session\.md$/i];
function oracle(cwdAbs, received) {
  const abs = win32.resolve(cwdAbs, received).replace(/\\/g, "/");
  const a = abs.toLowerCase(), r = FXR.toLowerCase();
  if (!a.startsWith(`${r}/`)) return { protect: false, abs };
  return { protect: PROTECTED_RE.some((re) => re.test(abs.slice(FXR.length + 1))), abs };
}
const PROT = ["open-brain/src/a.ts", "open-brain/tests/t.ts", "scripts/s.ps1", "hooks/h.js", "package.json", ".agents/state.json", ".agents/TASKS/INBOX.md"];
const OPEN = ["docs/loops/q.md", "README.md", "C:/qa-tmp/o.txt", "C:/qa-tmp/open-brain/src/a.ts"];
const CWDS = ["", "open-brain", "docs/loops", ".agents"];
const SRC = "C:/qa-tmp/src.txt";

// cmdlet -> how its written path is named. pos: positional slot of the written path; named: [full, prefixes, aliases].
const CMDLETS = [
  { names: ["Set-Content", "sc"], tail: "x", named: ["-Path", "-Pa", "-LiteralPath", "-Lit", "-LP", "-PSPath"], pos: 0, value: "-Value x" },
  { names: ["Add-Content", "ac"], tail: "x", named: ["-Path", "-LiteralPath", "-LP"], pos: 0, value: "-Value x" },
  { names: ["Out-File"], pipe: "'x' | ", named: ["-FilePath", "-FileP", "-Path", "-LiteralPath", "-LP"], pos: 0 },
  { names: ["New-Item", "ni"], named: ["-Path", "-Pa"], pos: 0, extra: ["-ItemType File", "-Type File", "-Force"] },
  { names: ["Copy-Item", "cpi", "copy"], src: true, named: ["-Destination", "-Dest", "-De"], pos: 1 },
  { names: ["Move-Item", "mi", "move"], src: true, named: ["-Destination", "-Dest"], pos: 1 },
  { names: ["Remove-Item", "ri", "del"], named: ["-Path", "-LiteralPath", "-LP"], pos: 0 },
  { names: ["Tee-Object"], pipe: "'x' | ", named: ["-FilePath", "-Path", "-LiteralPath", "-LP"], pos: 0 },
];
// Parameters that TAKE A VALUE and are not the path: common parameters and their aliases (about_CommonParameters).
const NOISE = ["-ErrorAction Stop", "-EA 0", "-WarningAction 0", "-WA 0", "-OutVariable o", "-OV o", "-ErrorVariable e", "-EV e",
  "-InformationAction 0", "-InfA 0", "-OutBuffer 1", "-OB 1", "-PipelineVariable p", "-PV p", "-Force", "-Encoding utf8"];

function spellPs(p, how) {
  const mode = pick(R, ["plain", "plain", "sq", "dq", "backslash", "dotslash"]);
  how.push(`spell:${mode}`);
  if (mode === "sq") return `'${p}'`;
  if (mode === "dq") return `"${p}"`;
  if (mode === "backslash") return p.replace(/\//g, "\\");
  if (mode === "dotslash" && !/^[A-Za-z]:/.test(p)) return `.\\${p.replace(/\//g, "\\")}`;
  return p;
}

const cases = [];
for (let n = 0; n < 300; n++) {
  const how = [];
  const c = pick(R, CMDLETS);
  const name = pick(R, c.names);
  const target = chance(0.65) ? pick(R, PROT) : pick(R, OPEN);
  const cwdRel = pick(R, CWDS);
  const cwdAbs = cwdRel ? `${FXR}/${cwdRel}` : FXR;
  const recv = /^[A-Za-z]:/.test(target) ? target : chance(0.5) ? `${FXR}/${target}` : win32.relative(cwdAbs, `${FXR}/${target}`).replace(/\\/g, "/");
  const o = oracle(cwdAbs, recv);
  const t = spellPs(recv, how);
  const style = pick(R, ["positional", "positional", "named", "named", "colon"]);
  how.push(`param:${style}`);
  const args = [];
  const noise = chance(0.4) ? pick(R, NOISE) : null;
  if (noise) how.push(`noise:${noise.split(" ")[0]}`);
  if (noise) args.push(noise); // a value-taking parameter BEFORE the positionals (PowerShell binds it by name)
  if (c.src) args.push(SRC.replace(/\//g, "\\"));
  let nm = null;
  if (style === "positional") args.push(t);
  else {
    nm = pick(R, c.named);
    how.push(`name:${nm}`);
    args.push(style === "colon" ? `${nm}:${t}` : `${nm} ${t}`);
  }
  if (c.extra && chance(0.6)) { const e = pick(R, c.extra); args.push(e); how.push(`extra:${e.split(" ")[0]}`); }
  if (c.tail) args.push(style === "positional" ? c.tail : c.value);
  let cmd = `${c.pipe ?? ""}${name} ${args.join(" ")}`;
  const ctx = pick(R, ["plain", "plain", "plain", "semi", "pipe-out", "newline", "if-block", "subexpr-path", "splat"]);
  how.push(`ctx:${ctx}`);
  let expect = o.protect ? "deny" : "allow";
  if (ctx === "semi") cmd = `Get-Date; ${cmd}`;
  if (ctx === "pipe-out") cmd = `${cmd} | Out-Null`;
  if (ctx === "newline") cmd = `Get-Date\n${cmd}`;
  if (ctx === "if-block") { cmd = `if ($true) { ${cmd} }`; expect = "deny-named"; }
  if (ctx === "subexpr-path") { // the path computed by a parenthesised expression: not a literal, refused with a cause
    cmd = cmd.replace(t, `(Join-Path '${FXR}' '${target.replace(/^C:\/qa-tmp\//, "../../qa-tmp/")}')`);
    expect = "deny-named";
  }
  if (ctx === "splat") { // splatting: the path is in a variable, so not a literal; refused with a cause
    cmd = `$a = @('${recv}'); ${name} @a${c.tail ? " -Value x" : ""}`;
    expect = "deny-named";
  }
  cases.push({ id: `ps ${JSON.stringify(cmd)} @${cwdRel || "."}`, payload: pwsh(cmd, cwdAbs), expect, how, landsAbs: o.abs, cwdAbs, cmd });
}
// Dynamic code: refused with a named cause.
const DYN = [
  (p) => `Invoke-Expression "Set-Content ${p} x"`, (p) => `iex 'Set-Content ${p} x'`, (p) => `Invoke-Command { Set-Content ${p} x }`,
  (p) => `& { Set-Content ${p} x }`, (p) => `. { 'x' > ${p} }`, (p) => `[scriptblock]::Create('Set-Content ${p} x').Invoke()`,
  (p) => `powershell -NoProfile -Command "Set-Content ${p} x"`, (p) => `powershell -NoProfile Set-Content ${p} x`,
  (p) => `pwsh -c "Set-Content ${p} x"`, (p) => `$c = 'Set-Content ${p} x'; iex $c`,
];
for (let n = 0; n < 60; n++) {
  const target = pick(R, PROT);
  const k = Math.floor(R() * DYN.length);
  const cmd = DYN[k](`${FXR}/${target}`);
  // #6 and #8 hand a literal -Command string to a shell, which the hook parses: a plain protected-path deny is right.
  cases.push({ id: `ps-dyn#${k} ${JSON.stringify(cmd)}`, payload: pwsh(cmd, FXR), expect: k === 6 || k === 8 ? "deny" : "deny-named", how: [`dyn:${k}`], landsAbs: `${FXR}/${target}`, cwdAbs: FXR, cmd });
}

const res = await runAll(cases);
const NAMED = /cannot be determined|cannot read statically|shell expansion|parenthesis|script block/;
const rows = res.map((r) => {
  const pass = r.expect === "deny-named" ? r.decision === "deny" && NAMED.test(r.reason) : r.decision === r.expect;
  return { id: r.id, how: r.how, expect: r.expect, got: r.decision, pass, landsAbs: r.landsAbs, cwdAbs: r.cwdAbs, cmd: r.cmd, reason: pass ? undefined : r.reason.slice(0, 300) };
});
const fails = rows.filter((r) => !r.pass);
const byClass = {};
for (const f of fails) for (const h of f.how) byClass[h] = (byClass[h] ?? 0) + 1;
const summary = { cases: rows.length, agree: rows.length - fails.length, disagree: fails.length,
  failOpen: fails.filter((f) => f.got === "allow").length, failClosed: fails.filter((f) => f.got !== "allow").length, failuresByTag: byClass };
writeFileSync(process.argv[2], JSON.stringify({ summary, disagreements: fails, all: rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const f of fails) console.log(`DISAGREE expect=${f.expect} got=${f.got} ${f.id.slice(0, 200)}`);
