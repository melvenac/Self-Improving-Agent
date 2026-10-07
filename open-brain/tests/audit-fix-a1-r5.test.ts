import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initSchemaV2 } from "../src/db-v2.js";
import { recordFire } from "../src/trigger/fires.js";
import { CANONICAL_COMMAND_FIRE_RE, formatCommandFireLog } from "../src/trigger/command-log.js";

const SESSION = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function storedCommand(db: Database.Database): string {
  const row = db.prepare("SELECT command FROM trigger_fires ORDER BY id DESC LIMIT 1").get() as {
    command: string;
  };
  return row.command;
}

function fire(command: string, db: Database.Database): void {
  recordFire(db, {
    sessionUuid: SESSION,
    command,
    query: "",
    state: "not-asked",
    injectedIds: [],
  });
}

describe("AUDIT-FIX A1 r5 — command fire log is program name only", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initSchemaV2(db);
  });

  afterEach(() => db.close());

  it('stores "git push origin main --token abc" as git only', () => {
    const cmd = "git push origin main --token abc";
    expect(formatCommandFireLog(cmd)).toBe("git");
    fire(cmd, db);
    expect(storedCommand(db)).toBe("git");
    expect(storedCommand(db)).not.toContain("abc");
  });

  const secretCommands: Array<{ label: string; command: string; secret: string }> = [
    { label: "deploy --token", command: "deploy --token abc123supersecrettokenvalue", secret: "abc123super" },
    { label: "TYPESAFE_API_KEY", command: "export TYPESAFE_API_KEY=sk-live-abcdefghijklmnop", secret: "sk-live" },
    { label: "url userinfo", command: "curl https://user:pass@api.example.com/v1", secret: "pass@" },
    {
      label: "x-access-token url",
      command: "git clone https://x-access-token:ghp_abc123xyz@github.com/o/r",
      secret: "ghp_abc",
    },
    { label: "Authorization Bearer", command: "http --headers Authorization: Bearer eyJhbGciOiJIUz", secret: "eyJhbGci" },
    { label: "X-Api-Key header", command: 'curl -H "X-Api-Key: supersecret12345"', secret: "supersecret" },
    { label: "curl -u", command: "curl -u alice:bobsecret https://example.com", secret: "bobsecret" },
    { label: "json api_key", command: '{"api_key": "my-secret-value"}', secret: "my-secret" },
    { label: "password=", command: "export password=SuperSecret1", secret: "SuperSecret" },
    { label: "api_key=", command: "cfg api_key=abc123hexvalue", secret: "abc123hex" },
    { label: "Token=", command: "env Token=MyTokenValue", secret: "MyToken" },
    { label: "github_token=", command: "github_token=gho_abcdefghijklmnop", secret: "gho_abc" },
    { label: "SECRET_KEY=", command: "SECRET_KEY=shhh", secret: "shhh" },
    { label: "AWS_SECRET_ACCESS_KEY=", command: "AWS_SECRET_ACCESS_KEY=AKIASECRET", secret: "AKIASECRET" },
    { label: "PRIVATE_KEY=", command: "PRIVATE_KEY=-----BEGIN", secret: "BEGIN" },
    { label: "mysql -p", command: "mysql -pS3cretPass! db", secret: "S3cretPass" },
    { label: "quoted pat", command: "run.sh 'ghp_abcdefghijklmnopqrstuvwxyz1234567890'", secret: "ghp_abc" },
    { label: "JWT fragment", command: "node -e eyJhbGciOiJIUzI1NiJ9.payload.sig", secret: "eyJhbGci" },
    {
      label: "PAT as token0",
      command: "ghp_abcdefghijklmnopqrstuvwxyz1234567890 status",
      secret: "ghp_abc",
    },
    {
      label: "path token0",
      command:
        "C:\\secrets\\ghp_abcdefghijklmnopqrstuvwxyz1234567890 push",
      secret: "ghp_abc",
    },
    {
      label: "echo pipe docker login",
      command: "echo correct-horse-battery | docker login -u user --password-stdin",
      secret: "correct-horse",
    },
    {
      label: "printf pipe sudo -S",
      command: "printf winter2026 | sudo -S id",
      secret: "winter2026",
    },
    {
      label: "NBSP between tokens",
      command: `git\u00a0status --porcelain supersecret`,
      secret: "supersecret",
    },
  ];

  for (const { label, command, secret } of secretCommands) {
    it(`stores no secret bytes for ${label}`, () => {
      const expected = formatCommandFireLog(command);
      fire(command, db);
      const stored = storedCommand(db);
      expect(stored).toBe(expected);
      expect(stored).toMatch(CANONICAL_COMMAND_FIRE_RE);
      expect(stored.toLowerCase()).not.toContain(secret.toLowerCase());
    });
  }

  it("identical commands store the same program label", () => {
    const cmd = "npm test -- --run secret-file";
    expect(formatCommandFireLog(cmd)).toBe("npm");
    fire(cmd, db);
    fire(cmd, db);
    const rows = db.prepare("SELECT command FROM trigger_fires").all() as Array<{ command: string }>;
    expect(rows[0].command).toBe("npm");
    expect(rows[1].command).toBe("npm");
  });
});
