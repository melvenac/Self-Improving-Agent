// QA 108: check the added C:\qa-tmp normalisation in shapev10.mjs and cmpj10.mjs on raw and JSON-escaped paths.
import { readFileSync } from "node:fs";
const grab = (f) => {
  const line = readFileSync(f, "utf8").split("\n").find((l) => l.includes("qa-tmp(") && l.includes(".replace("));
  const src = line.slice(line.indexOf(".replace(") + ".replace(".length, line.lastIndexOf(', "%T%/")'));
  return eval(src);
};
const samples = ["C:\\qa-tmp\\q108-abc\\x", JSON.stringify("C:\\qa-tmp\\q108-abc\\x"), "C:/qa-tmp/q108-abc/x"];
for (const f of ["shapev10.mjs", "cmpj10.mjs"]) {
  const re = grab(f);
  for (const s of samples) console.log(f, JSON.stringify(s), "->", JSON.stringify(s.replace(re, "%T%/")));
}
