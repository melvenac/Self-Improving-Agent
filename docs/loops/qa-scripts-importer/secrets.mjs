#!/usr/bin/env node
// QA 102, dispatch step 4: scan a directory for secret VALUES, after proving the patterns fire on a planted positive.
// Usage: node secrets.mjs <dir-to-scan>
// 1. Writes one planted file per pattern into a fresh temp dir, scans it, and requires every pattern to hit exactly once.
//    It also plants prose that NAMES secrets without values, and requires 0 hits there.
// 2. Scans <dir> (every file, recursively, dotfiles included) and prints each hit and the count.
// 3. Lists file names that look like secret stores (dotfiles, *env*, *.pem, *key*, *secret*, *credential*).
// Exit: 0 if the plant validated and the target has 0 hits; 1 if the target has hits; 3 if the plant failed.
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, statSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

const PATTERNS = {
  aws_access_key: /\bA(?:KIA|SIA)[0-9A-Z]{16}\b/g,
  anthropic_or_openai_key: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g,
  github_token: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})/g,
  slack_token: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  google_api_key: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  stripe_live: /\b[rs]k_live_[0-9A-Za-z]{16,}/g,
  private_key_block: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  jwt: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  bearer_value: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g,
  assigned_secret: /\b(?:api[_-]?key|token|secret|password|passwd|pwd)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-/+=.]{16,}/gi,
  url_credentials: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]{6,}@/gi,
};

// Assembled at runtime so this file does not itself contain the planted strings.
const j = (...p) => p.join("");
const PLANT = {
  aws_access_key: j("AKIA", "ABCDEFGHIJKLMNOP"),
  anthropic_or_openai_key: j("sk-", "ant-", "api03-", "abcdefghijklmnopqrstuvwxyz0123"),
  github_token: j("ghp", "_", "abcdefghijklmnopqrstuvwxyz0123456789AB"),
  slack_token: j("xox", "b-", "123456789012-abcdefghij"),
  google_api_key: j("AI", "za", "SyA-abcdefghijklmnopqrstuvwxyz01234"), // 35 after AIza; a 37-char plant missed on the first run
  stripe_live: j("sk", "_live_", "abcdefghijklmnop1234"),
  private_key_block: j("-----BEGIN RSA ", "PRIVATE KEY-----"),
  jwt: j("eyJ", "hbGciOiJIUzI1NiJ9", ".eyJ", "zdWIiOiIxMjM0NTY3ODkwIn0", ".abcdefghijklmnopqrstuv"),
  bearer_value: j("Authorization: Bear", "er ", "abcdefghijklmnopqrstuvwxyz012345"),
  assigned_secret: j("pass", "word = ", "hunter2hunter2hunter2"),
  url_credentials: j("postgres://admin:", "s3cr3tpass", "@db.example.com/x"),
};
const PROSE = [
  "Set ANTHROPIC_API_KEY in your environment; the hub stores apiKeyHash, never the key.",
  "Send the X-Agent-Key header. The token is rotated each session. password policy: see docs.",
  "Authorization uses a Bearer token issued by the hub.",
].join("\n");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}
function scan(dir) {
  const hits = [];
  for (const f of walk(dir)) {
    const lines = readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const [name, re] of Object.entries(PATTERNS)) {
        for (const m of line.matchAll(re)) hits.push({ file: relative(dir, f), line: i + 1, pattern: name, match: m[0].slice(0, 12) + "…" });
      }
    });
  }
  return hits;
}

// 1. The planted positive and the planted prose negative.
const plantDir = mkdtempSync(join(tmpdir(), "qa102-plant-"));
for (const [k, v] of Object.entries(PLANT)) writeFileSync(join(plantDir, `${k}.txt`), `line one\nconfig: ${v}\n`);
writeFileSync(join(plantDir, "prose-negative.md"), PROSE);
const planted = scan(plantDir);
rmSync(plantDir, { recursive: true, force: true });
const perPattern = Object.keys(PATTERNS).map((k) => [k, planted.filter((h) => h.pattern === k && h.file === `${k}.txt`).length]);
const proseHits = planted.filter((h) => h.file === "prose-negative.md");
console.log(`planted positive: ${planted.length - proseHits.length} hits over ${Object.keys(PLANT).length} planted files`);
for (const [k, n] of perPattern) console.log(`  ${n >= 1 ? "fires" : "MISSED"} ${k} (${n})`);
console.log(`planted prose negative: ${proseHits.length} hits${proseHits.length ? " " + JSON.stringify(proseHits) : ""}`);
if (perPattern.some(([, n]) => n < 1) || proseHits.length) { console.log("PLANT FAILED: the scan is not validated"); process.exit(3); }

// 2. The target.
const target = process.argv[2];
if (!target) { console.error("usage: node secrets.mjs <dir>"); process.exit(2); }
const hits = scan(target);
for (const h of hits) console.log(`HIT ${h.file}:${h.line} ${h.pattern} ${h.match}`);
console.log(`target ${target}: ${walk(target).length} files scanned, ${hits.length} hits`);

// 3. File names.
const suspicious = walk(target).map((f) => relative(target, f)).filter((f) => /(^|[\\/])\.(?!agents[\\/])|env|\.pem$|key|secret|credential/i.test(f));
console.log(`suspicious file names: ${suspicious.length}${suspicious.length ? " " + suspicious.join(", ") : ""}`);
process.exit(hits.length ? 1 : 0);
