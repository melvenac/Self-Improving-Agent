import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function retirementLineRegex(pattern: string, ignoreCase?: boolean): RegExp {
  return new RegExp(pattern, ignoreCase ? "i" : "");
}

/** SHA-256 hex of the trimmed line — one entry per matching line (multiset). */
export function hashTrimmedLine(line: string): string {
  return createHash("sha256").update(line.trim(), "utf8").digest("hex");
}

/** Every line whose trimmed text matches the retirement pattern. */
export function matchingLineHashes(text: string, pattern: string, ignoreCase?: boolean): string[] {
  const re = retirementLineRegex(pattern, ignoreCase);
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (re.test(trimmed)) out.push(hashTrimmedLine(line));
  }
  return out;
}

function countMultiset(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of items) m.set(h, (m.get(h) ?? 0) + 1);
  return m;
}

export type ReferrerHashDiff =
  | { status: "ok" }
  | { status: "missing_file" }
  | { status: "missing_line_hashes" }
  | { status: "stale"; detail: string }
  | { status: "unexpected"; detail: string };

/** Compare allowed line_hashes to live matching lines (multiset). */
export function diffReferrerLineHashes(
  allowed: string[] | undefined,
  actual: string[],
): ReferrerHashDiff {
  if (!allowed || allowed.length === 0) {
    if (actual.length === 0) return { status: "missing_line_hashes" };
    return { status: "unexpected", detail: "line_hashes missing but the file still matches" };
  }
  const allow = countMultiset(allowed);
  const live = countMultiset(actual);
  for (const [h, n] of live) {
    const cap = allow.get(h) ?? 0;
    if (n > cap) {
      return {
        status: "unexpected",
        detail: cap === 0 ? `new matching line hash ${h.slice(0, 12)}…` : `duplicate matching line hash ${h.slice(0, 12)}… (${n} live, ${cap} allowed)`,
      };
    }
  }
  for (const [h, n] of allow) {
    const have = live.get(h) ?? 0;
    if (have < n) {
      return { status: "stale", detail: `missing ${n - have} allowed line(s) hash ${h.slice(0, 12)}…` };
    }
  }
  return { status: "ok" };
}

export interface RetirementReferrer {
  path: string;
  class: string;
  why: string;
  line_hashes?: string[];
}

export interface RetirementEntry {
  id?: string;
  name: string;
  pattern: string;
  event: string;
  ruled: string;
  classes?: string[];
  ignore_case?: boolean;
  allowed_referrers?: RetirementReferrer[];
}

export interface RetirementRecordFile {
  historical?: string[];
  retirements?: RetirementEntry[];
  $schema_note?: string;
  $rehash_note?: string;
}

export type RehashProposalLine = {
  retirement: string;
  path: string;
  before: string[];
  after: string[];
};

export function proposeRetirementsRehash(projectRoot: string, record: RetirementRecordFile): RehashProposalLine[] {
  const lines: RehashProposalLine[] = [];
  for (const r of record.retirements ?? []) {
    const re = () => retirementLineRegex(r.pattern, r.ignore_case);
    for (const a of r.allowed_referrers ?? []) {
      const abs = join(projectRoot, a.path);
      if (!existsSync(abs)) continue;
      const text = readFileSync(abs, "utf8");
      if (!re().test(text)) continue;
      const after = matchingLineHashes(text, r.pattern, r.ignore_case);
      const before = a.line_hashes ?? [];
      if (before.join() !== after.join()) {
        lines.push({ retirement: r.name, path: a.path, before: [...before], after });
      }
    }
  }
  return lines;
}

export function applyRetirementsRehash(record: RetirementRecordFile, proposals: RehashProposalLine[]): RetirementRecordFile {
  const byKey = new Map(proposals.map((p) => [`${p.retirement}\0${p.path}`, p]));
  const next = structuredClone(record);
  for (const r of next.retirements ?? []) {
    for (const a of r.allowed_referrers ?? []) {
      const p = byKey.get(`${r.name}\0${a.path}`);
      if (p) a.line_hashes = [...p.after];
    }
  }
  return next;
}

export function runRetirementsRehashCli(projectRoot: string, write: boolean): number {
  const recordPath = join(projectRoot, ".agents", "retirements.json");
  if (!existsSync(recordPath)) {
    console.error("retirements-rehash: .agents/retirements.json not found");
    return 1;
  }
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as RetirementRecordFile;
  const proposals = proposeRetirementsRehash(projectRoot, record);
  if (proposals.length === 0) {
    console.log("retirements-rehash: no line_hash changes proposed");
    return 0;
  }
  for (const p of proposals) {
    console.log(`${p.retirement}  ${p.path}`);
    console.log(`  - ${p.before.length ? p.before.join(", ") : "(none)"}`);
    console.log(`  + ${p.after.join(", ")}`);
  }
  if (!write) {
    console.log("retirements-rehash: dry run — no file written (pass --write to apply)");
    return 0;
  }
  const updated = applyRetirementsRehash(record, proposals);
  writeFileSync(recordPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`retirements-rehash: wrote ${recordPath}`);
  return 0;
}
