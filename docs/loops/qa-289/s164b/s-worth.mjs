// QA 289 row 4 (+Q1, Q4, Q6 on the old layout): beab87e9's shape end to end.
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { freshDir, oldLayout, transcript, prove, server, hook, greet, commit, git, iso, H, R, show, pick, ls } from "./lib.mjs";

const name = process.argv[2] || "worth";
const UUID = "28900000-0000-4000-8000-0000000000a4";
const CSE = "01QA289worthItShapeAAAAAA";
const db = `${R}/db/${name}.db`;
const dir = freshDir(name);
oldLayout(dir);
const tr = transcript(dir, iso(-2 * H), CSE);
await prove(UUID, tr);
const c1 = commit(dir, iso(-90 * 60e3), "src/a.ts", "a\n", CSE, "feat: a");
const c2 = commit(dir, iso(-80 * 60e3), "src/b.ts", "b\n", CSE, "feat: b");
git(dir, "tag", "v0.14.0");
const c3 = commit(dir, iso(-70 * 60e3), "package.json", JSON.stringify({ name: "w", version: "0.15.0" }, null, 2) + "\n", CSE, "release 0.15.0");
git(dir, "tag", "v0.15.0");
show("fixture", { dir, branch: git(dir, "branch", "--show-current"), commits: [c1, c2, c3], tags: git(dir, "tag", "-l"), stateJson: existsSync(join(dir, ".agents/state.json")) });

const vaultBefore = existsSync(`${R}/vault`) ? readdirSync(`${R}/vault`, { recursive: true }).length : 0;
const s = await server(dir, db);
const r1 = await s.call("ob_end", { session_summary: "worth-it shape" });
show("ob_end #1 (expect refuse)", r1);
show("after refusal: stamp / record-ok marker", { stamp: ls(dir, ".agents/SESSIONS/.ob-end-stamp.json"), recordOk: ls(dir, ".agents/SESSIONS/.record-ok.jsonl"), vaultFilesDelta: (existsSync(`${R}/vault`) ? readdirSync(`${R}/vault`, { recursive: true }).length : 0) - vaultBefore, status: git(dir, "status", "--porcelain") });

const r2 = await s.call("ob_end", { session_summary: "worth-it shape", record_ok: "QA289 deliberately closing without a record update" });
show("ob_end #2 record_ok (expect close)", r2);
show("stamp", ls(dir, ".agents/SESSIONS/.ob-end-stamp.json"));
await s.close();

const c4 = commit(dir, iso(2 * 60e3), "src/after.ts", "after\n", CSE, "feat: after /end");
show("commit after /end", c4);
const h = hook(dir, { session_id: UUID, transcript_path: tr, hook_event_name: "SessionEnd", reason: "clear" }, db);
show(`SessionEnd hook exit ${h.status}`, h.out);
const NEXT = "28900000-0000-4000-8000-0000000000b4";
for (const n of [1, 2]) {
  const g = greet(dir, NEXT, db);
  show(`greeting #${n} exit ${g.status} (notice lines)`, pick(g.out, /WORK AFTER|RECORD OK|HANDOFF MISSING|OLD LAYOUT|RECORD NOT/).join("\n") || "(none)");
  if (n === 1 && process.env.QA_FULL) show("greeting #1 full", g.out);
}
