// QA 237 generator for P1 ("protected if, and only if, the location the tool will write to is under a protected path").
// Built from the property text, NOT from Forge's generator or the hook's paths.ts. Real built CLI, fixture stdin.
// Oracle: path.win32.resolve(cwd, the path the shell hands the program) + QA 237's own protected-prefix check.
// The spelling is constructed FROM the intended path by bash's quoting rules, so the oracle knows what bash receives.
// Usage: node gen-p1.mjs <out.json>
import { win32 } from "node:path";
import { writeFileSync } from "node:fs";
import { makeFixture, runAll, bash, write, edit, rng, pick } from "./lib.mjs";

const FXR = makeFixture();
const R = rng(237001);
const chance = (p) => R() < p;

// ---- the oracle (QA 237's own reading of the protected list in the r5 dispatch / PH-1, PH-2) ----
const PROTECTED_RE = [/^open-brain\/src(\/|$)/i, /^open-brain\/tests(\/|$)/i, /^scripts(\/|$)/i, /^hooks(\/|$)/i, /^open-brain\/build(\/|$)/i,
  /(^|\/)package\.json$/i, /^\.agents\/state\.json$/i, /^\.agents\/tasks\/inbox\.md$/i, /^\.agents\/tasks\/task\.md$/i, /^\.agents\/sessions\/next-session\.md$/i];
function oracle(cwdAbs, received) {
  const abs = win32.resolve(cwdAbs, received).replace(/\\/g, "/");
  const root = FXR.replace(/\\/g, "/");
  const a = abs.toLowerCase(), r = root.toLowerCase();
  if (!a.startsWith(`${r}/`)) return { protect: false, where: "outside" };
  const rel = abs.slice(root.length + 1).replace(/\/+/g, "/");
  return { protect: PROTECTED_RE.some((re) => re.test(rel)), where: rel };
}

const PROT = ["open-brain/src/a.ts", "open-brain/src/planner-hook/run.ts", "open-brain/tests/t.test.ts", "scripts/s.sh", "hooks/h.js",
  "open-brain/build/b.js", "package.json", "open-brain/package.json", ".agents/state.json", ".agents/TASKS/INBOX.md",
  ".agents/TASKS/task.md", ".agents/SESSIONS/next-session.md"];
const OPEN_IN = ["docs/loops/q.md", "README.md", "open-brain/srcx/a.ts", ".agents/SYSTEM/PRD.md", "open-brain/notes.md"];
const OUTSIDE = ["C:/qa-tmp/o.txt", "C:/qa-tmp/open-brain/src/a.ts", "C:/qa-scratch/qa241-q237-fx-x/open-brain/src/a.ts", "C:/qa-scratch/qa241-q237-sib/scripts/s.sh"];
const CWDS = ["", "open-brain", "open-brain/src", "docs/loops", ".agents", "scratch"];

/** Intended path (what the program must receive), relative or absolute, from the cwd. */
function intended(target, cwdRel) {
  const cwdAbs = cwdRel ? `${FXR}/${cwdRel}` : FXR;
  const isAbsTarget = /^[A-Za-z]:/.test(target);
  const abs = isAbsTarget ? target : `${FXR}/${target}`;
  const how = [];
  let p;
  if (isAbsTarget || chance(0.35)) {
    how.push("abs");
    p = abs;
  } else {
    how.push("rel");
    p = win32.relative(cwdAbs, abs).replace(/\\/g, "/") || ".";
  }
  if (chance(0.15)) { how.push("detour"); p = p.replace(/\/([^/]+)$/, "/zz/../$1"); }
  if (chance(0.15) && !p.startsWith("/") && !/^[A-Za-z]:/.test(p)) { how.push("dot"); p = `./${p}`; }
  if (chance(0.2)) { how.push("case"); p = p.replace(/[a-z]+/g, (m, off) => (off % 3 === 0 ? m.toUpperCase() : m)); }
  return { p, cwdAbs, how };
}

/** A bash spelling that bash turns back into exactly `p`. Classes Forge's generator does not produce are marked new:*. */
function spellBash(p, how) {
  const segs = p.split("/");
  const mode = pick(R, ["plain", "plain", "dq", "sq", "mid-dq", "mid-sq", "bs-escape", "backslash-sep", "gitbash", "bs-newline"]);
  how.push(`spell:${mode}`);
  const k = segs.findIndex((s) => /^[A-Za-z][A-Za-z.-]{2,}$/.test(s));
  switch (mode) {
    case "dq": return `"${p}"`;
    case "sq": return `'${p}'`;
    case "mid-dq": // new: quotes inside one segment, sr"c"
      if (k < 0) return p;
      segs[k] = `${segs[k].slice(0, 2)}"${segs[k].slice(2)}"`;
      return segs.join("/");
    case "mid-sq":
      if (k < 0) return p;
      segs[k] = `${segs[k][0]}'${segs[k].slice(1)}'`;
      return segs.join("/");
    case "bs-escape": // new: bash removes a backslash before an ordinary character: open\-brain -> open-brain
      if (k < 0) return p;
      segs[k] = segs[k].replace(/([-a-z])/, "\\$1");
      return segs.join("/");
    case "backslash-sep": // Windows separators, single-quoted so bash keeps them
      if (!/^[A-Za-z]:/.test(p)) return `'${p.replace(/\//g, "\\")}'`;
      return `'${p.replace(/\//g, "\\")}'`;
    case "gitbash":
      return /^[A-Za-z]:/.test(p) ? `/${p[0].toLowerCase()}${p.slice(2)}` : p;
    case "bs-newline": { // new: a backslash-newline is removed by bash before word splitting
      const cut = Math.max(1, Math.floor(p.length / 2));
      return `${p.slice(0, cut)}\\\n${p.slice(cut)}`;
    }
    default: return p;
  }
}

const SRC = "C:/qa-tmp/src.txt";
const WRITERS = [
  (t) => `echo x > ${t}`, (t) => `echo x >> ${t}`, (t) => `echo x 2>${t}`, (t) => `echo x &>> ${t}`, (t) => `echo x >| ${t}`,
  (t) => `echo x | tee ${t}`, (t) => `echo x | tee -a C:/qa-tmp/o2.txt ${t}`, (t) => `cp ${SRC} ${t}`, (t) => `cp -f -- ${SRC} ${t}`,
  (t) => `mv ${SRC} ${t}`, (t) => `install -m 644 ${SRC} ${t}`, (t) => `sed -i -e s/a/b/ ${t}`, (t) => `sed -i'' s/a/b/ ${t}`,
];
// Contexts: what surrounds the write on the command line. new:* are classes Forge's CHAINS do not contain.
const CONTEXTS = [
  ["plain", (w) => w], ["and", (w) => `true && ${w}`], ["semi", (w) => `ls; ${w}`], ["or", (w) => `false || ${w}`],
  ["pipe-in", (w) => `cat README.md | ${w}`], ["newline", (w) => `ls\n${w}`], ["subshell", (w) => `(${w})`],
  ["new:background", (w) => `${w} & wait`], ["new:brace-group", (w) => `{ ${w}; }`], ["new:if-then", (w) => `if true; then ${w}; fi`],
  ["new:for-do", (w) => `for i in 1; do ${w}; done`], ["new:bang", (w) => `! ${w}`], ["new:time", (w) => `time ${w}`],
  ["new:timeout", (w) => `timeout 9 ${w}`], ["new:trailing-comment", (w) => `${w} # done`], ["new:pipe-out", (w) => `${w} | cat`],
  ["new:bash-c", (w) => `bash -c '${w.replace(/'/g, `'\\''`)}'`],
];

const cases = [];
for (let n = 0; n < 320; n++) {
  const bucket = R();
  const target = bucket < 0.55 ? pick(R, PROT) : bucket < 0.75 ? pick(R, OPEN_IN) : pick(R, OUTSIDE);
  const cwdRel = pick(R, CWDS);
  const { p, cwdAbs, how } = intended(target, cwdRel);
  const o = oracle(cwdAbs, p);
  const tool = R() < 0.82 ? "bash" : R() < 0.5 ? "edit" : "write";
  if (tool !== "bash") {
    const fp = chance(0.3) ? p.replace(/\//g, "\\") : p;
    cases.push({ id: `${tool} ${JSON.stringify(fp)} @${cwdRel || "."}`, payload: tool === "edit" ? edit(fp, cwdAbs) : write(fp, cwdAbs), expect: o.protect ? "deny" : "allow", how: [...how, tool], lands: o.where });
    continue;
  }
  const t = spellBash(p, how);
  const w = pick(R, WRITERS)(t);
  const [ctx, f] = pick(R, CONTEXTS);
  // The writer itself may need a writable source/target that does not exist here; the hook never runs it.
  const cmd = ctx === "new:bash-c" && t.includes("\n") ? f(w.replace("\\\n", "")) : f(w);
  cases.push({ id: `bash ${JSON.stringify(cmd)} @${cwdRel || "."}`, payload: bash(cmd, cwdAbs), expect: o.protect ? "deny" : "allow", how: [...how, `ctx:${ctx}`], lands: o.where });
}

// Non-literal targets: refused with a named cause, whatever they would expand to (and in any context).
const NONLIT = [["tilde", (p) => `~/${p}`], ["tilde-user", (p) => `~aaron/${p}`], ["dollar", (p) => `$PWD/${p}`], ["dollar-brace", (p) => `\${PWD}/${p}`],
  ["cmdsub", (p) => `$(pwd)/${p}`], ["backtick", (p) => "`pwd`/" + p], ["star", (p) => p.replace(/[^/]+$/, "*")], ["qmark", (p) => p.replace(/.$/, "?")],
  ["bracket", (p) => p.replace(/[^/]+$/, "[ab].ts")], ["brace", (p) => p.replace(/[^/]+$/, "{a,b}.ts")], ["tmpdir", () => "$TMPDIR/x"]];
for (let n = 0; n < 80; n++) {
  const target = pick(R, [...PROT, ...OUTSIDE]);
  const cwdRel = pick(R, CWDS);
  const { p, cwdAbs, how } = intended(target, cwdRel);
  const [nm, f] = pick(R, NONLIT);
  const t = f(p);
  const qt = chance(0.3) ? `"${t}"` : t;
  const [ctx, g] = pick(R, CONTEXTS.slice(0, 8));
  const cmd = g(pick(R, WRITERS)(qt));
  cases.push({ id: `nonliteral:${nm} ${JSON.stringify(cmd)}`, payload: bash(cmd, cwdAbs), expect: "deny-named", how: [...how, `nonlit:${nm}`, `ctx:${ctx}`], lands: "(non-literal)" });
}

const res = await runAll(cases);
const NAMED = /cannot be determined|shell expansion|glob|brace|starts with ~|parenthesis/;
const rows = res.map((r) => {
  const got = r.decision;
  const pass = r.expect === "deny-named" ? got === "deny" && NAMED.test(r.reason) : got === r.expect;
  // A deny on the "only if" side is excused only if it names a stated cause (non-literal, cd, 8.3 short name).
  return { id: r.id, how: r.how, lands: r.lands, expect: r.expect, got, pass, reason: pass ? undefined : r.reason.slice(0, 300) };
});
const fails = rows.filter((r) => !r.pass);
const byClass = {};
for (const f of fails) for (const h of f.how.filter((x) => /^(spell|ctx|nonlit)/.test(x))) byClass[h] = (byClass[h] ?? 0) + 1;
const summary = { cases: rows.length, agree: rows.length - fails.length, disagree: fails.length,
  denyExpected: rows.filter((r) => r.expect !== "allow").length, allowExpected: rows.filter((r) => r.expect === "allow").length, failuresByClassTag: byClass };
writeFileSync(process.argv[2], JSON.stringify({ summary, disagreements: fails, all: rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const f of fails) console.log(`DISAGREE expect=${f.expect} got=${f.got} ${f.id.slice(0, 170)}`);
