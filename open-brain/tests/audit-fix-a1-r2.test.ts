import { describe, it, expect } from "vitest";
import { sanitizeCommandLogText, COMMAND_LOG_REDACTED } from "../src/trigger/command-log.js";

const GIT_SHA = "a4d0eda7714a3c84cd515e618f7ac639aa4f402d";

describe("AUDIT-FIX A1 r2 — command log redaction shapes", () => {
  const redactCases: Array<{ label: string; input: string; mustNotContain?: string }> = [
    { label: "url userinfo", input: "curl https://user:pass@api.example.com/v1", mustNotContain: "pass@" },
    { label: "x-access-token in url", input: "git clone https://x-access-token:ghp_abc123xyz@github.com/o/r", mustNotContain: "ghp_abc" },
    { label: "Authorization header", input: "http --headers Authorization: Bearer eyJhbGciOiJIUz", mustNotContain: "eyJhbGci" },
    { label: "X-Api-Key header", input: "curl -H X-Api-Key: supersecret12345", mustNotContain: "supersecret" },
    { label: "curl -u", input: "curl -u alice:bobsecret https://example.com", mustNotContain: "bobsecret" },
    { label: "json key", input: '{"api_key": "my-secret-value"}', mustNotContain: "my-secret" },
    { label: "colon api_key", input: "config api_key: sk-abcdefghijklmnop", mustNotContain: "sk-abcdef" },
    { label: "--access-token", input: "tool --access-token at_1234567890", mustNotContain: "at_123" },
    { label: "--client-secret", input: "oauth --client-secret cs_live_abcdef", mustNotContain: "cs_live" },
    { label: "-p password", input: "mysql -pS3cretPass!", mustNotContain: "S3cretPass" },
    { label: "quoted secret", input: "run.sh 'ghp_abcdefghijklmnopqrstuvwxyz1234567890'", mustNotContain: "ghp_abc" },
    { label: "github pat prefix", input: "token ghp_1234567890abcdefghijklmnopQRSTUV", mustNotContain: "ghp_1234" },
    { label: "slack xoxb", input: "notify xoxb-123-456-789-AbCdEfGhIjKlMnOpQrStUvWx", mustNotContain: "xoxb-123" },
  ];

  for (const { label, input, mustNotContain } of redactCases) {
    it(`redacts ${label}`, () => {
      const out = sanitizeCommandLogText(input);
      expect(out).toContain(COMMAND_LOG_REDACTED);
      if (mustNotContain) expect(out).not.toContain(mustNotContain);
    });
  }

  const spareCases: Array<{ label: string; input: string; keep: string }> = [
    { label: "40-char git sha", input: `git reset ${GIT_SHA}`, keep: GIT_SHA },
    { label: "ordinary path", input: "ls /var/log/myapp/access.log", keep: "/var/log/myapp/access.log" },
    { label: "monkey word", input: "echo monkey=banana", keep: "monkey=banana" },
  ];

  for (const { label, input, keep } of spareCases) {
    it(`spares ${label}`, () => {
      const out = sanitizeCommandLogText(input);
      expect(out).toContain(keep);
      expect(out).not.toContain(COMMAND_LOG_REDACTED);
    });
  }
});
