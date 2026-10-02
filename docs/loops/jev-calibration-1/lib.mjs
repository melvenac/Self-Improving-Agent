// Shared helpers for the Jev calibration 1 case-set scripts. Pure reads of git and of this directory.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, "../../..");
export const SEED = 20261002;

export function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync("git", args, { cwd: REPO, encoding: "utf-8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] }).replace(/\r\n/g, "\n");
  } catch (e) {
    if (allowFail) return null;
    throw e;
  }
}

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
export const readJson = (name) => JSON.parse(readFileSync(join(HERE, name), "utf-8"));
/** Stable JSON: sorted keys, two-space indent, LF, trailing newline. */
export function stable(value) {
  const sort = (v) =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}
export const writeJson = (name, value) => writeFileSync(join(HERE, name), stable(value));

/** mulberry32: a small seeded PRNG, so a draw is reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
