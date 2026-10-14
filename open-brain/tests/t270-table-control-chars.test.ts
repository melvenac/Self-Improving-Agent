import { describe, it, expect } from "vitest";
// Namespace imports: a missing export fails its rows, not the file.
import * as ps from "../src/shared/process-session.js";
import * as owner from "../src/suite-owner.js";

type Win32Row = { ProcessId: number; ParentProcessId: number; CommandLine: string };

/**
 * A raw control character inside a CommandLine string (T-270). Windows PowerShell 5.1's ConvertTo-Json escapes
 * control characters; the raw byte came from the console's cp437 best-fit encoder on the pipe (→ arrives as 0x1A).
 * The read now escapes to ASCII (T-279); these rows keep the parse's defence in depth. JSON.stringify escapes the
 * character, so put the raw one back.
 */
function rawPayload(rows: Win32Row | Win32Row[], codes: number[]): string {
  let json = JSON.stringify(rows);
  for (const code of codes) {
    const escaped = "\\u" + code.toString(16).padStart(4, "0");
    expect(json).toContain(escaped);
    json = json.split(escaped).join(String.fromCharCode(code));
    expect(json).toContain(String.fromCharCode(code));
  }
  return json;
}

const SUB = "\u001a";

describe("T-270 the Win32 process table parses when a command line holds a raw control character", () => {
  it("C1: one row with a raw 0x1A parses, the row present and its ppid kept", () => {
    const raw = rawPayload({ ProcessId: 5, ParentProcessId: 4, CommandLine: `bash.exe -c "a${SUB}b"` }, [0x1a]);
    expect(raw).toContain(SUB);
    const r = ps.parseWin32ProcessTable(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.get(5)?.ppid).toBe(4);
  });

  it("C2: raw 0x00, 0x07 and 0x1B in three rows parse, all three rows present", () => {
    const raw = rawPayload(
      [
        { ProcessId: 1, ParentProcessId: 0, CommandLine: "a\u0000b" },
        { ProcessId: 2, ParentProcessId: 1, CommandLine: "c\u0007d" },
        { ProcessId: 3, ParentProcessId: 2, CommandLine: "e\u001be" },
      ],
      [0x00, 0x07, 0x1b],
    );
    const r = ps.parseWin32ProcessTable(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.table.keys()].sort()).toEqual([1, 2, 3]);
  });

  it("C3: only the middle row of three holds 0x1A; all three rows present, ppids intact", () => {
    const raw = rawPayload(
      [
        { ProcessId: 11, ParentProcessId: 1, CommandLine: "first.exe" },
        { ProcessId: 12, ParentProcessId: 11, CommandLine: `bash.exe x${SUB}y` },
        { ProcessId: 13, ParentProcessId: 12, CommandLine: "third.exe" },
      ],
      [0x1a],
    );
    const r = ps.parseWin32ProcessTable(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.get(11)?.ppid).toBe(1);
    expect(r.table.get(12)?.ppid).toBe(11);
    expect(r.table.get(13)?.ppid).toBe(12);
  });

  it("C4: pretty-printed JSON with newlines and tabs between tokens still parses", () => {
    const raw = JSON.stringify(
      [
        { ProcessId: 1, ParentProcessId: 0, CommandLine: "a" },
        { ProcessId: 2, ParentProcessId: 1, CommandLine: "b" },
      ],
      null,
      "\t",
    );
    expect(raw).toContain("\n\t");
    const r = ps.parseWin32ProcessTable(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.size).toBe(2);
  });

  it("C5: JSON still invalid after the replacement is unparseable", () => {
    const r = ps.parseWin32ProcessTable('[{"ProcessId": 1,}]');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason.startsWith("Win32 process table: unparseable JSON")).toBe(true);
  });

  it("C6: liveOwnerProbe reaches claude.exe while an unrelated row holds 0x1A", () => {
    const raw = rawPayload(
      [
        { ProcessId: 10, ParentProcessId: 20, CommandLine: "node.exe tsx cli-suite-run.ts" },
        { ProcessId: 20, ParentProcessId: 30, CommandLine: String.raw`C:\Program Files\Git\usr\bin\bash.exe` },
        { ProcessId: 30, ParentProcessId: 1, CommandLine: String.raw`C:\Users\me\.local\bin\claude.exe --print` },
        { ProcessId: 99, ParentProcessId: 1, CommandLine: `bash.exe -c "x${SUB}y"` },
      ],
      [0x1a],
    );
    const got = owner.liveOwnerProbe(10, () => ps.parseWin32ProcessTable(raw));
    expect(got).toMatchObject({ pid: 30, source: "claude.exe" });
  });

  it("C7: resolveCursorAgentHost reaches the cursor-agent host while an unrelated row holds 0x1A", () => {
    const raw = rawPayload(
      [
        { ProcessId: 10, ParentProcessId: 20, CommandLine: "node.exe hook.js" },
        { ProcessId: 20, ParentProcessId: 1, CommandLine: String.raw`C:\Users\me\AppData\Local\cursor-agent\versions\1.0\index.js` },
        { ProcessId: 99, ParentProcessId: 1, CommandLine: `bash.exe -c "x${SUB}y"` },
      ],
      [0x1a],
    );
    const got = ps.resolveCursorAgentHost(10, undefined, () => ps.parseWin32ProcessTable(raw));
    expect(got.pid).toBe(20);
  });

  it("C8: claude.exe followed by a raw 0x1A still matches isClaudeExeCommandLine", () => {
    const raw = rawPayload({ ProcessId: 7, ParentProcessId: 1, CommandLine: String.raw`C:\x\claude.exe` + SUB + "--print" }, [0x1a]);
    const r = ps.parseWin32ProcessTable(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = r.table.get(7);
    expect(row).toBeDefined();
    expect(owner.isClaudeExeCommandLine(row!.commandLine)).toBe(true);
  });
});
