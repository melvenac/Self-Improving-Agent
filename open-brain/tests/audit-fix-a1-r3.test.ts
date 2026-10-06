import { describe, it, expect } from "vitest";
import { sanitizeCommandLogText, COMMAND_LOG_REDACTED } from "../src/trigger/command-log.js";

const GIT_SHA_LOWER = "a4d0eda7714a3c84cd515e618f7ac639aa4f402d";
const GIT_SHA_UPPER = "A4D0EDA7714A3C84CD515E618F7AC639AA4F402D";
const SHA256_64 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const HEX32 = "0123456789abcdef0123456789abcdef";

describe("AUDIT-FIX A1 r3 — redaction regressions", () => {
  const redactCases: Array<{ label: string; input: string; mustNotContain: string }> = [
    { label: "password= case insensitive", input: "export password=SuperSecret1", mustNotContain: "SuperSecret" },
    { label: "api_key= lowercase", input: "cfg api_key=abc123hexvalue", mustNotContain: "abc123hex" },
    { label: "Token= capital T", input: "env Token=MyTokenValue", mustNotContain: "MyToken" },
    { label: "github_token=", input: "github_token=gho_abcdefghijklmnop", mustNotContain: "gho_abc" },
    { label: "32-hex key", input: `cache key ${HEX32} end`, mustNotContain: HEX32 },
    { label: "mysql -p standalone", input: "mysql -pS3cretPass! db", mustNotContain: "S3cretPass" },
    { label: "secret flag quoted", input: "tool --password='long-secret-value-here'", mustNotContain: "long-secret" },
  ];

  for (const { label, input, mustNotContain } of redactCases) {
    it(`redacts ${label}`, () => {
      const out = sanitizeCommandLogText(input);
      expect(out).toContain(COMMAND_LOG_REDACTED);
      expect(out).not.toContain(mustNotContain);
    });
  }

  const spareCases: Array<{ label: string; input: string; keep: string }> = [
    { label: "left-pad", input: "git cherry-pick left-pad my-project", keep: "left-pad" },
    { label: "cherry-pick", input: "git cherry-pick abc", keep: "cherry-pick" },
    { label: "my-project", input: "cd my-project", keep: "my-project" },
    { label: "hub-presence", input: "open-brain/src/pipelines/session-start/hub-presence.ts", keep: "hub-presence" },
    { label: "--prefix", input: "cmd --prefix foo", keep: "--prefix" },
    { label: "--password-stdin", input: "psql --password-stdin", keep: "--password-stdin" },
    { label: "ordinary single-quoted", input: "npm run 'fix the build again'", keep: "fix the build again" },
    { label: "parseFrontmatter quote", input: "node -e 'parseFrontmatter'", keep: "parseFrontmatter" },
    { label: "40-hex sha lower", input: `git reset ${GIT_SHA_LOWER}`, keep: GIT_SHA_LOWER },
    { label: "40-hex sha upper", input: `git reset ${GIT_SHA_UPPER}`, keep: GIT_SHA_UPPER },
    { label: "64-hex sha256", input: `sha256 ${SHA256_64}`, keep: SHA256_64 },
    { label: "monkey=", input: "echo monkey=banana", keep: "monkey=banana" },
  ];

  for (const { label, input, keep } of spareCases) {
    it(`spares ${label}`, () => {
      const out = sanitizeCommandLogText(input);
      expect(out).toContain(keep);
      expect(out).not.toContain(COMMAND_LOG_REDACTED);
    });
  }
});
