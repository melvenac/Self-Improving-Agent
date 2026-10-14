// T-159 N1: what a hook process loaded, written to LOAD_SPY_OUT on exit.
// Preloaded with --require, before `--import tsx/esm`, so it sees every native
// addon (process.dlopen) and every ESM resolve. require.cache cannot see ESM
// imports, so it is not used.
//
// The resolve spy is an ASYNC hook (module.register), not
// module.registerHooks: on Node 22 a synchronous resolve hook whose `next`
// reaches tsx's async loader throws ERR_METHOD_NOT_IMPLEMENTED (resolveSync),
// so the hook process cannot start at all. Registered before tsx, this hook
// runs after tsx's in the chain and records what tsx resolved each specifier
// to. It runs on the loader thread and appends there; the exit handler merges.
"use strict";
const fs = require("node:fs");
const mod = require("node:module");

const out = process.env.LOAD_SPY_OUT;
const resolvedFile = `${out}.resolved.jsonl`;
const dlopen = [];

const original = process.dlopen;
process.dlopen = function (module, filename, ...rest) {
  dlopen.push(String(filename));
  return original.call(this, module, filename, ...rest);
};

const loader = `
import { appendFileSync } from "node:fs";
export async function resolve(specifier, context, next) {
  const r = await next(specifier, context);
  appendFileSync(${JSON.stringify(resolvedFile)}, JSON.stringify({ specifier, url: r.url }) + "\\n");
  return r;
}`;
mod.register(`data:text/javascript,${encodeURIComponent(loader)}`);

process.on("exit", () => {
  let resolved = [];
  try {
    resolved = fs.readFileSync(resolvedFile, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    /* nothing resolved */
  }
  fs.writeFileSync(out, JSON.stringify({ dlopen, resolved }), "utf-8");
});
