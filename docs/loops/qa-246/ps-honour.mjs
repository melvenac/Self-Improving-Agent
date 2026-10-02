// QA 246: does REAL Windows PowerShell 5.1 honour each character as whitespace, a parameter dash or a quote?
// One UTF-8-with-BOM .ps1 per character and role, run with powershell.exe -File, writing only under C:/qa-scratch/qa246-honour.
//   whitespace: Set-Content<ch>C:\...\ws-HEX.txt -Value x           honoured iff ws-HEX.txt exists
//   dash:       Set-Content <ch>Path C:\...\dash-HEX.txt <ch>Value x  honoured iff dash-HEX.txt exists
//   quote:      Set-Content <ch>C:\...\q-HEX.txt<ch> -Value x        honoured iff q-HEX.txt exists (no quote in the name)
// Also D-C: New-Item -Name with no -Path from cwd <tree>/open-brain/src writes <tree>/open-brain/src/x.ts.
// Usage: node ps-honour.mjs <out.json>
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";

const D = "C:/qa-scratch/qa246-honour";
const W = D.replace(/\//g, "\\");
rmSync(D, { recursive: true, force: true });
mkdirSync(D, { recursive: true });
const ps = (cmd, cwd = D) => {
  const f = "C:/qa-tmp/qa246-honour.ps1";
  writeFileSync(f, "\ufeff" + cmd + "\n", "utf8");
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", f], { cwd, encoding: "utf8", timeout: 60000 });
};
const ROLES = {
  ws: [0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000, 0x2028, 0x2029, 0x0085, 0x000b, 0x000c, 0x200b, 0xfeff, 0x00ad],
  dash: [0x2013, 0x2014, 0x2015, 0x2212, 0xff0d],
  sq: [0x2018, 0x2019, 0x201a, 0x201b],
  dq: [0x201c, 0x201d, 0x201e],
};
const rows = [];
for (const [role, cps] of Object.entries(ROLES)) {
  for (const cp of cps) {
    const c = String.fromCodePoint(cp);
    const h = cp.toString(16).toUpperCase().padStart(4, "0");
    const name = `${role}-${h}.txt`;
    const cmd =
      role === "ws" ? `Set-Content${c}${W}\\${name} -Value x`
      : role === "dash" ? `Set-Content ${c}Path ${W}\\${name} ${c}Value x`
      : `Set-Content ${c}${W}\\${name}${c} -Value x`;
    const r = ps(cmd);
    const honoured = existsSync(`${D}/${name}`);
    rows.push({ role, cp: `U+${h}`, honoured, err: honoured ? "" : (r.stderr || "").split(/\r?\n/).find((l) => l.trim()) ?? "" });
    console.log(`${honoured ? "HONOURED " : "not      "} ${role.padEnd(4)} U+${h}  ${honoured ? "" : rows.at(-1).err.slice(0, 110)}`);
  }
}
const stray = readdirSync(D).filter((n) => !/^(ws|dash|sq|dq)-[0-9A-F]{4}\.txt$/.test(n));
console.log("files with other names:", JSON.stringify(stray));

// D-C in real PowerShell: the item lands in the cwd
const S = "C:/qa-scratch/qa246-dc";
const dc = [];
for (const [cmd, cwdRel, target] of [
  ["New-Item -Name x.ts -ItemType File", "open-brain/src", "open-brain/src/x.ts"],
  ["New-Item -Name open-brain/src/x.ts -ItemType File", "", "open-brain/src/x.ts"],
  ["New-Item -Name x.ts -Value y", "open-brain/src", "open-brain/src/x.ts"],
  ["New-Item -Na x.ts -I File", "open-brain/src", "open-brain/src/x.ts"],
  ["New-Item -Name:x.ts -ItemType File", "open-brain/src", "open-brain/src/x.ts"],
  ["ni -Name x.ts -ItemType File", "open-brain/src", "open-brain/src/x.ts"],
  ["New-Item -Name ../src/x.ts -ItemType File", "open-brain/tests", "open-brain/src/x.ts"],
  ["New-Item -Name ../../open-brain/src/x.ts -ItemType File", "docs/loops", "open-brain/src/x.ts"],
]) {
  rmSync(S, { recursive: true, force: true });
  for (const d of ["open-brain/src", "open-brain/tests", "docs/loops"]) mkdirSync(`${S}/${d}`, { recursive: true });
  ps(cmd, `${S}/${cwdRel}`);
  const wrote = existsSync(`${S}/${target}`);
  dc.push({ cmd, cwd: cwdRel, target, wrote });
  console.log(`D-C real PS: wrote=${wrote} | cwd=${cwdRel || "."} | ${cmd}`);
}
writeFileSync(process.argv[2], JSON.stringify({ rows, stray, dc }, null, 1));
