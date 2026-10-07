// QA 289 row 11 E6(a): a foreign .recalled-entries.json is never rated for this session.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { freshDir, oldLayout, transcript, prove, server, iso, H, R, show } from "./lib.mjs";

const UUID = "28900000-0000-4000-8000-0000000000e6";
const FOREIGN = "fc49e982-0000-4000-8000-000000000000";
const db = `${R}/db/e6-${Date.now()}.db`;
const dir = freshDir("e6");
oldLayout(dir);
const tr = transcript(dir, iso(-2 * H), "01QA289e6EEEEEEEEEEEEEEEE"); await prove(UUID, tr);
const s = await server(dir, db);
await s.call("ob_store", { content: "Ocelot lesson one.", key: "ocelot-one" });
await s.call("ob_store", { content: "Ocelot lesson two.", key: "ocelot-two" });
writeFileSync(join(dir, ".recalled-entries.json"), JSON.stringify({ session_id: FOREIGN, entries: [{ id: 1 }, { id: 2 }] }));
show("ob_recalled with a foreign file only", (await s.call("ob_recalled")).text);
const e = await s.call("ob_end", { session_summary: "ocelot lesson one two", dry_run: true });
show("ob_end dry_run with a foreign file only", e.text.split("\n").filter((l) => /Recalled|rated|Foreign|Nothing/i.test(l)).join("\n"));
await s.close();
const Database = (await import("file:///C:/qa-scratch/qa289-pr489/open-brain/node_modules/better-sqlite3/lib/index.js")).default;
const d = new Database(db, { readonly: true });
show("feedback_log rows", d.prepare("SELECT count(*) n FROM feedback_log").get());
d.close();
