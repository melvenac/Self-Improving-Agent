import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// T-308: /end tells the seat that a mistake made in text (not its own Bash call) cannot fire, so it is keyed lookup-only.
const REPO = join(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8").replace(/\r\n/g, "\n");
const RULE = "A mistake made in TEXT, not in this seat's own Bash call (a command handed to the user, a grep written into a brief\nanother seat runs), never reaches the trigger: key it `none — lookup only` (T-308).";

describe("T-308: a text mistake is keyed lookup-only in every end.md copy", () => {
  it.each([".claude/commands/end.md", "project-template/.claude/commands/end.md", "project-template/.cursor/commands/end.md"])("L1: %s carries the rule after the path:/error: sentence", (rel) => {
    const text = read(rel);
    expect(text).toContain(`a key under 6 characters is lookup-only.\n${RULE}`);
  });
});
