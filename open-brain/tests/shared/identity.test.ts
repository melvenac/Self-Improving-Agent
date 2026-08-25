import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  identityPath,
  loadIdentity,
  saveIdentity,
  defaultIdentity,
  renderIdentity,
  unrenderedPlaceholders,
  USER_PLACEHOLDER,
  AGENT_PLACEHOLDER,
  DEFAULT_AGENT_NAME,
} from "../../src/shared/identity.js";

describe("identity", () => {
  let home: string;
  let savedEnv: string | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ob-identity-home-"));
    // The global setup-env redirects OPEN_BRAIN_IDENTITY; these tests exercise
    // the $HOME-relative path, so clear it and restore it afterwards.
    savedEnv = process.env.OPEN_BRAIN_IDENTITY;
    delete process.env.OPEN_BRAIN_IDENTITY;
  });

  afterEach(() => {
    if (savedEnv !== undefined) process.env.OPEN_BRAIN_IDENTITY = savedEnv;
    rmSync(home, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("lives beside the other open-brain state under ~/.claude/open-brain/", () => {
    expect(identityPath(home)).toBe(join(home, ".claude", "open-brain", "identity.json"));
  });

  it("honours the OPEN_BRAIN_IDENTITY override", () => {
    process.env.OPEN_BRAIN_IDENTITY = join(home, "elsewhere.json");
    expect(identityPath(home)).toBe(join(home, "elsewhere.json"));
  });

  it("returns null when onboarding has not run", () => {
    expect(loadIdentity(home)).toBeNull();
  });

  it("round-trips through save and load, trimming whitespace", () => {
    const path = saveIdentity({ user_name: "  Jack ", agent_name: "Clark\n" }, home);
    expect(path).toBe(identityPath(home));
    expect(loadIdentity(home)).toEqual({ user_name: "Jack", agent_name: "Clark" });
    expect(JSON.parse(readFileSync(path, "utf-8"))).toEqual({ user_name: "Jack", agent_name: "Clark" });
  });

  it("treats a partial identity as absent — never half-renders a command", () => {
    mkdirSync(join(home, ".claude", "open-brain"), { recursive: true });
    writeFileSync(identityPath(home), JSON.stringify({ user_name: "Jack" }));
    expect(loadIdentity(home)).toBeNull();
  });

  it("treats an empty name as absent", () => {
    saveIdentity({ user_name: "   ", agent_name: "Clark" }, home);
    expect(loadIdentity(home)).toBeNull();
  });

  it("treats malformed JSON as absent rather than throwing", () => {
    mkdirSync(join(home, ".claude", "open-brain"), { recursive: true });
    writeFileSync(identityPath(home), "{not json");
    expect(loadIdentity(home)).toBeNull();
  });

  describe("defaultIdentity", () => {
    it("prefers the first word of the git user.name", () => {
      expect(defaultIdentity({ gitUserName: "jack smith", osUserName: "jsmith" }))
        .toEqual({ user_name: "Jack", agent_name: DEFAULT_AGENT_NAME });
    });

    it("falls back to the OS account name, title-cased", () => {
      expect(defaultIdentity({ gitUserName: "", osUserName: "jsmith" }).user_name).toBe("Jsmith");
      expect(defaultIdentity({ gitUserName: null, osUserName: "jsmith" }).user_name).toBe("Jsmith");
    });

    it("falls back to a greeting-safe word when nothing is known", () => {
      expect(defaultIdentity({ gitUserName: null, osUserName: null }).user_name).toBe("there");
    });
  });

  describe("renderIdentity", () => {
    const id = { user_name: "Jack", agent_name: "Clark" };

    it("fills every occurrence of both placeholders", () => {
      const text = `Greet ${USER_PLACEHOLDER} by name. You are ${AGENT_PLACEHOLDER}.\nHey ${USER_PLACEHOLDER} — {date}`;
      expect(renderIdentity(text, id)).toBe("Greet Jack by name. You are Clark.\nHey Jack — {date}");
    });

    it("leaves text without placeholders untouched", () => {
      const text = "# /sync\nReport output. Use {cwd} and ${VAR} literally.\n";
      expect(renderIdentity(text, id)).toBe(text);
    });
  });

  describe("unrenderedPlaceholders", () => {
    it("lists each remaining placeholder once", () => {
      const text = `${USER_PLACEHOLDER} ${AGENT_PLACEHOLDER} ${USER_PLACEHOLDER} {{OTHER_THING}}`;
      expect(unrenderedPlaceholders(text)).toEqual([USER_PLACEHOLDER, AGENT_PLACEHOLDER, "{{OTHER_THING}}"]);
    });

    it("returns nothing for a rendered file", () => {
      expect(unrenderedPlaceholders("Greet Jack. You are Clark.")).toEqual([]);
    });
  });
});
