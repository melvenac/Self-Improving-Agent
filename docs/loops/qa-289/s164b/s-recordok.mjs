// QA 289 row 8c: record_ok "" and "   " through the real ob_end (QA_OB selects the tree).
import { freshDir, oldLayout, transcript, prove, server, commit, iso, H, R, show, OB, ls } from "./lib.mjs";
const UUID = "28900000-0000-4000-8000-0000000000ab";
const CSE = "01QA289recordOkEmptyRRRRR";
for (const reason of ["", "   "]) {
  const tag = reason === "" ? "empty" : "spaces";
  const dir = freshDir(`recordok-${tag}-${OB.includes("-m6") ? "m6" : "head"}`);
  oldLayout(dir);
  const tr = transcript(dir, iso(-2 * H), CSE); await prove(UUID, tr);
  commit(dir, iso(-60 * 60e3), "src/a.ts", "a\n", CSE);
  const s = await server(dir, `${R}/db/recordok-${tag}.db`);
  const r = await s.call("ob_end", { session_summary: "x", record_ok: reason });
  show(`[${OB}] record_ok=${JSON.stringify(reason)}`, { isError: r.isError, first: r.text.split("\n").slice(0, 2).join(" | "), marker: ls(dir, ".agents/SESSIONS/.record-ok.jsonl") });
  await s.close();
}
