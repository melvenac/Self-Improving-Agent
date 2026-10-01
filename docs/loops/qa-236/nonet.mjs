// QA 236 T216-5: network tripwire, loaded with `node --import`. Every outbound attempt (net/tls socket connect,
// http/https request, fetch, dns lookup/resolve, dgram) is APPENDED to the log and refused BEFORE any byte leaves.
// Child processes are logged (argv only) so a git or helper spawn is visible. Log path: NONET_LOG.
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import dgram from "node:dgram";
import cp from "node:child_process";
import { appendFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const LOG = process.env.NONET_LOG ?? "C:/qa-tmp/qa236-nonet.log";
const rec = (kind, detail) => appendFileSync(LOG, JSON.stringify({ pid: process.pid, kind, detail: String(detail).slice(0, 300) }) + "\n");
const refuse = (kind, detail) => { rec(kind, detail); throw new Error(`QA236 NONET: refused ${kind} ${detail}`); };
rec("armed", process.argv.slice(1).join(" "));

const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...a) {
  const o = a[0];
  const d = typeof o === "object" && o !== null ? JSON.stringify({ host: o.host, port: o.port, path: o.path }) : JSON.stringify(a.slice(0, 2));
  // Local IPC (named pipes / unix sockets) is not network; record it but allow it.
  if (typeof o === "object" && o?.path) { rec("ipc", d); return origConnect.apply(this, a); }
  refuse("net.connect", d);
};
for (const [mod, name] of [[net, "connect"], [net, "createConnection"], [tls, "connect"]]) {
  const orig = mod[name];
  mod[name] = function (...a) {
    const o = a[0];
    if (typeof o === "object" && o?.path) { rec("ipc", o.path); return orig.apply(this, a); }
    refuse(`${name}`, JSON.stringify(a[0]));
  };
}
for (const m of [http, https]) for (const name of ["request", "get"]) m[name] = (...a) => refuse(`http.${name}`, typeof a[0] === "string" ? a[0] : JSON.stringify(a[0]?.href ?? a[0]?.host ?? a[0]));
globalThis.fetch = async (u) => refuse("fetch", typeof u === "string" ? u : u?.url ?? u);
for (const name of ["lookup", "resolve", "resolve4", "resolve6"]) dns[name] = (h) => refuse(`dns.${name}`, h);
dns.promises.lookup = async (h) => refuse("dns.promises.lookup", h);
dgram.createSocket = () => refuse("dgram", "createSocket");
for (const name of ["spawn", "spawnSync", "execFile", "execFileSync", "exec", "execSync"]) {
  const orig = cp[name];
  cp[name] = function (...a) { rec(`child.${name}`, [a[0], ...(Array.isArray(a[1]) ? a[1] : [])].join(" ")); return orig.apply(this, a); };
}
syncBuiltinESMExports();
