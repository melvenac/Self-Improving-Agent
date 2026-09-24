/**
 * QA 92: print the route A5's MachineConfigWatch records, from the candidate's own code (recordChain is TS-private,
 * reachable at run time). Usage: tsx route.mts <open-brain tree>. Scratch dirs only; junctions need no privilege.
 * Shapes: ANCHOR = $XDG_CONFIG_HOME itself a junction (a link with TWO components after it);
 *         MID    = $XDG_CONFIG_HOME/git a junction (ONE component after it) — the control.
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const TREE = process.argv[2]!;
const { MachineConfigWatch } = await import(pathToFileURL(join(TREE, "src/harness/configwatch.ts")).href);
const root = realpathSync(mkdtempSync(join(tmpdir(), "qa92-route-")));
const out: Record<string, unknown> = { tree: TREE };
try {
  // ANCHOR
  const realXdg = join(root, "real-xdg");
  mkdirSync(join(realXdg, "git"), { recursive: true });
  writeFileSync(join(realXdg, "git", "config"), "[user]\n\tname = anchor\n");
  const xdgA = join(root, "xdgA");
  symlinkSync(realXdg, xdgA, "junction");
  const pA = join(xdgA, "git", "config");
  const wA = new MachineConfigWatch([{ scope: "xdg", path: pA, source: "qa92" }]);
  const chainA = (wA as any).recordChain(pA) as Array<{ path: string; kind: string }>;
  out.ANCHOR = { path: pA, realpath: realpathSync(pA), route: chainA.slice(-4).map((c) => `${c.kind} ${c.path}`), last: chainA.at(-1) };
  // MID
  const xdgM = join(root, "xdgM");
  mkdirSync(xdgM);
  const dot = join(root, "dotgit");
  mkdirSync(dot);
  writeFileSync(join(dot, "config"), "[user]\n\tname = mid\n");
  symlinkSync(dot, join(xdgM, "git"), "junction");
  const pM = join(xdgM, "git", "config");
  const wM = new MachineConfigWatch([{ scope: "xdg", path: pM, source: "qa92" }]);
  const chainM = (wM as any).recordChain(pM) as Array<{ path: string; kind: string }>;
  out.MID = { path: pM, realpath: realpathSync(pM), route: chainM.slice(-3).map((c) => `${c.kind} ${c.path}`), last: chainM.at(-1) };
  rmdirSync(xdgA);
  rmdirSync(join(xdgM, "git"));
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(JSON.stringify(out, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
