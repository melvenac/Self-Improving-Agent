import { readdirSync, readFileSync } from "node:fs";
const pick = (d) => JSON.parse(readFileSync(d + "/" + readdirSync(d).find((f) => f.startsWith("cal2-qa250-t-222.")), "utf-8"));
const a = pick("C:/qa-tmp/qa285/dry-records"), b = pick("C:/qa-tmp/qa285/shim-dry");
const skip = new Set(["requested_at", "answered_at", "attempt_id", "attempted_at"]);
const diffs = Object.keys({ ...a, ...b }).filter((k) => !skip.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
console.log(`CLI dry-run record vs shim dry-run record, fields differing (timestamps/attempt_id excluded): ${JSON.stringify(diffs)}; fields compared ${Object.keys(a).length - skip.size}`);
