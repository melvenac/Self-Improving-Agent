import { readFileSync, writeFileSync, existsSync } from "node:fs";

export function readJson<T = unknown>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function readText(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

export function writeText(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
