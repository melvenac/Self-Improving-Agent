// QA 291 row 2: each mutant is one commit; show parent, files, the src diff; parent-vs-head src equality.
import { execFileSync } from "node:child_process";
const g = (...a) => execFileSync("git", ["-C", "C:/qa-scratch/qa291-wt", ...a], { encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const M = [
  ["215b3ec0aabae5bf0c7798829246cc3c7fbbd3c8", "f59d03bc7ae3a02b6b3c374eac503c318b40001c", "end-fix-mut-e4-pre"],
  ["5504e4f61d555b0e65a6b2fa0a7a275d702d4f89", "f59d03bc7ae3a02b6b3c374eac503c318b40001c", "end-fix-mut-e2-ignore"],
  ["2de4d150e635ca00abc11e318004021049768ff4", "f59d03bc7ae3a02b6b3c374eac503c318b40001c", "end-fix-mut-record-ws"],
  ["963e02f59abbb9c4f16e37d32e138611eb7e79bf", "f59d03bc7ae3a02b6b3c374eac503c318b40001c", "end-fix-mut-unknown"],
  ["dfc6f9cfc5c23c485d781e6782ece6934717b2f2", "f3aba754e7a870c4880639bb564a2d8e7e0e8d71", "import-cmds-mut-r2-1"],
  ["7ba515523aaeb047d422dc0483bfd9da6f0657a5", "f3aba754e7a870c4880639bb564a2d8e7e0e8d71", "import-cmds-mut-r2-2"],
  ["849aecd15a75489c0585d4c2e47c1b4bcc404a49", "f3aba754e7a870c4880639bb564a2d8e7e0e8d71", "import-cmds-mut-r2-3"],
  ["8b63eb9c1d22929f027ef900d962c796ac2c8842", "409c8c08542ebd73f6f15347cb97e52faaf17e04", "t247-mut-j1"],
];
try { g("fetch", "-q", "origin", ...M.map((m) => `+refs/heads/loop/${m[2]}:refs/remotes/origin/loop/${m[2]}`)); } catch (e) { console.log("fetch:", String(e.message).split("\n")[0]); }
for (const [sha, head, name] of M) {
  const parents = g("rev-list", "--parents", "-n1", sha).split(" ").slice(1);
  const p = parents[0];
  const remote = (() => { try { return g("rev-parse", `origin/loop/${name}`); } catch { return "(no remote ref)"; } })();
  const srcEq = g("rev-parse", `${p}:open-brain/src`) === g("rev-parse", `${head}:open-brain/src`);
  const headParent = g("rev-parse", `${head}^`);
  console.log(`=== ${name} ${sha.slice(0, 8)} remote=${remote.slice(0, 8)} parents=${parents.map((x) => x.slice(0, 8)).join(",")} parent==head:${p === head} parent==head^:${p === headParent} parent src tree == head src tree: ${srcEq}`);
  if (p !== head) console.log("    head vs parent files: " + g("diff", "--name-only", p, head).split("\n").join(", "));
  console.log("    files: " + g("diff", "--name-only", p, sha).split("\n").join(", "));
  console.log(g("diff", "-U1", p, sha, "--", "open-brain/src").split("\n").filter((l) => /^[-+@]/.test(l) && !/^(\+\+\+|---)/.test(l)).join("\n"));
}
