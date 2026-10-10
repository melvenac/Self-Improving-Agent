// Shared helpers for Jev calibration 2 case-set scripts (extends calibration 1 patterns).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, "../../..");
export const MIN_QA = 253;

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
export function stable(value) {
  const sort = (v) =>
    Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}
export const writeJson = (name, value) => writeFileSync(join(HERE, name), stable(value));
