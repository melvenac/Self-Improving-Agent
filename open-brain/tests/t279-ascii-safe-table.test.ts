import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// Namespace import: a missing export fails its rows, not the file.
import * as ps from "../src/shared/process-session.js";

/**
 * T-279: Windows PowerShell 5.1 writes stdout in the console's OEM code page (437) with .NET best-fit, so a
 * non-ASCII character in a command line reaches Node lossily: → as the C0 byte 0x1A, · as 0xFA (decoded as
 * U+FFFD), — as "-", an emoji as "??". The table read escapes every UTF-16 code unit outside 0x20-0x7E to \uXXXX
 * inside PowerShell, so only printable ASCII crosses the pipe and JSON.parse restores the exact string.
 */

// → • § ¶ ← ↑ ↓ ↔ ☺ ► · ✓ é —, then one astral character (U+1F600, a surrogate pair)
const BMP = [0x2192, 0x2022, 0x00a7, 0x00b6, 0x2190, 0x2191, 0x2193, 0x2194, 0x263a, 0x25ba, 0x00b7, 0x2713, 0x00e9, 0x2014];
const ASTRAL = 0x1f600;
const BUILT = "a " + String.fromCharCode(...BMP) + String.fromCodePoint(ASTRAL) + " b";
const PRINTABLE = /^[\x20-\x7E]*$/;
// G-042: vitest does not yield between the tests of one file, and W1/W2 spawn PowerShell synchronously. A macrotask
// on either side of each spawn lets the worker answer its reporter.
const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

/** The PowerShell escape, mirrored in JS: UTF-16 code units, as .NET's regex sees them. */
function escapeLikePowerShell(json: string): string {
  return json.replace(/[^\x20-\x7E]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

describe("T-279 the Win32 process table crosses the PowerShell pipe as printable ASCII", () => {
  const win = process.platform === "win32";

  it("A1: asciiSafeJsonCommand wraps the pipeline in ConvertTo-Json -Compress and escapes every char outside 0x20-0x7E", () => {
    expect(ps.asciiSafeJsonCommand("P")).toBe(
      "[regex]::Replace((P | ConvertTo-Json -Compress), '[^\\x20-\\x7E]', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) '\\u{0:x4}' -f [int][char]$m.Value })",
    );
  });

  it("A2: the production pipeline is still the one CIM query", () => {
    expect(ps.WIN32_TABLE_PIPELINE).toBe("Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine");
  });

  it("A3: an escaped payload is printable ASCII and parses back to the exact command lines", () => {
    const payload = escapeLikePowerShell(
      JSON.stringify([
        { ProcessId: 7, ParentProcessId: 1, CommandLine: BUILT },
        { ProcessId: 8, ParentProcessId: 7, CommandLine: "x\u001ay" },
      ]),
    );
    expect(payload).toMatch(PRINTABLE);
    expect(payload).toContain("\\ud83d\\ude00");
    const r = ps.parseWin32ProcessTable(payload);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.get(7)?.commandLine).toBe(BUILT);
    expect(r.table.get(8)?.commandLine).toBe("x\u001ay");
  });

  it("A4: the production read spawns asciiSafeJsonCommand, and the table loads through it by default", () => {
    const src = readFileSync(join(import.meta.dirname, "../src/shared/process-session.ts"), "utf8");
    expect(src).toContain('["-NoProfile", "-NonInteractive", "-Command", asciiSafeJsonCommand(pipeline)]');
    expect(src).toContain("export function loadWin32ProcessTable(run: () => string = readWin32ProcessTableStdout): Win32TableResult {");
    expect(src).not.toContain('"Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"');
  });

  it(
    "W1: on win32 a synthetic row read through the production spawn arrives as printable ASCII and parses back exactly (unescaped it does not); elsewhere the spawn throws and the loader refuses",
    async () => {
      if (!win) {
        // No Windows PowerShell here (S4-9.2: no runIf): the production spawn throws, and the loader fails closed.
        expect(() => ps.readWin32ProcessTableStdout("Get-Date")).toThrow();
        const refused = ps.loadWin32ProcessTable();
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(refused.reason).toMatch(/^Win32 process table: /);
        return;
      }
      const lit = BMP.map((cp) => `[char]0x${cp.toString(16)}`).join("+") + `+[char]::ConvertFromUtf32(0x${ASTRAL.toString(16)})`;
      const synth = `[pscustomobject]@{ProcessId=7;ParentProcessId=1;CommandLine=('a '+${lit}+' b')} | Select-Object ProcessId,ParentProcessId,CommandLine`;
      await tick();
      const out = ps.readWin32ProcessTableStdout(synth);
      await tick();
      expect(out.trim()).toMatch(PRINTABLE);
      const r = ps.parseWin32ProcessTable(out);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.table.get(7)?.commandLine).toBe(BUILT);
      // The control, round 1's command: the same row with no escaping does not cross as printable ASCII.
      const raw = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `${synth} | ConvertTo-Json -Compress`], {
        encoding: "utf-8",
        timeout: 60_000,
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
      await tick();
      expect(raw.trim()).not.toMatch(PRINTABLE);
    },
  );

  it("W2: on win32 the real table reads as printable ASCII and loads; elsewhere the loader refuses", async () => {
    if (!win) {
      const refused = ps.loadWin32ProcessTable();
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.reason).toMatch(/^Win32 process table: /);
      return;
    }
    await tick();
    const out = ps.readWin32ProcessTableStdout();
    await tick();
    expect(out.trim()).toMatch(PRINTABLE);
    const r = ps.loadWin32ProcessTable(() => out);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.table.size).toBeGreaterThan(10);
  });
});
