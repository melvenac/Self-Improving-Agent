import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initSchemaV2 } from "../src/db-v2.js";
import { recordFire } from "../src/trigger/fires.js";
import { COMMAND_LOG_REDACTED, COMMAND_LOG_MAX_LEN } from "../src/trigger/command-log.js";

const SESSION = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("AUDIT-FIX A1 — trigger_fires command redaction", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initSchemaV2(db);
  });

  afterEach(() => db.close());

  it("stores redacted, truncated command text (not raw secrets)", () => {
    const secretToken = "abc123supersecrettokenvalue";
    const command = `deploy --token ${secretToken} && export TYPESAFE_API_KEY=sk-live-abcdefghijklmnop`;

    recordFire(db, {
      sessionUuid: SESSION,
      command,
      query: "",
      state: "not-asked",
      injectedIds: [],
    });

    const row = db
      .prepare("SELECT command FROM trigger_fires WHERE session_uuid = ?")
      .get(SESSION) as { command: string };

    expect(row.command).not.toContain(secretToken);
    expect(row.command).not.toContain("sk-live-abcdefghijklmnop");
    expect(row.command).toContain(COMMAND_LOG_REDACTED);
    expect(row.command).toContain("deploy");
    const longTail = `deploy ${"x".repeat(300)}`;
    recordFire(db, {
      sessionUuid: SESSION,
      command: longTail,
      query: "",
      state: "not-asked",
      injectedIds: [],
    });
    const longRow = db.prepare("SELECT command FROM trigger_fires ORDER BY id DESC LIMIT 1")
      .get() as { command: string };
    expect(longRow.command.length).toBeLessThanOrEqual(COMMAND_LOG_MAX_LEN + 1);
  });
});
