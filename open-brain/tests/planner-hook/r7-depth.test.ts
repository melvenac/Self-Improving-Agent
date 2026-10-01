/**
 * T-194 r7, P0b: the target validator, driven DIRECTLY for every write source with a shape the parse gate would refuse first
 * (a PowerShell provider path, a drive-relative path, a non-ASCII name). Through the hook the gate shadows the validator for PowerShell,
 * so a mutant that bypasses the validator for one source would pass; these rows call detectBashWriteTargets (which gathers the targets of
 * every source and validates each one) and so see it.
 */
import { describe, it, expect } from "vitest";
import { detectBashWriteTargets } from "../../src/planner-hook/bash.js";
import { pathShapeProblem, validateTarget } from "../../src/planner-hook/paths.js";

const ROOT = "/tmp/r7-depth-root";
const BAD = ["FileSystem::C:/x/open-brain/src/x.ts", "C:open-brain/src/x.ts", "docs/loops/caf\u00e9.md"];

type Src = [string, "bash" | "powershell", (t: string) => string];
const SOURCES: Src[] = [
  ["bash redirect >", "bash", (t) => `echo x > '${t}'`],
  ["bash redirect >>", "bash", (t) => `echo x >> '${t}'`],
  ["bash redirect 2>", "bash", (t) => `echo x 2> '${t}'`],
  ["bash tee", "bash", (t) => `echo x | tee '${t}'`],
  ["bash cp", "bash", (t) => `cp a.txt '${t}'`],
  ["bash mv", "bash", (t) => `mv a.txt '${t}'`],
  ["bash install", "bash", (t) => `install a.txt '${t}'`],
  ["bash sed -i", "bash", (t) => `sed -i 's/a/b/' '${t}'`],
  ["bash scp (local end)", "bash", (t) => `scp host:a.txt '${t}'`],
  ["powershell redirect >", "powershell", (t) => `Write-Output x > '${t}'`],
  ["powershell redirect >>", "powershell", (t) => `Write-Output x >> '${t}'`],
  ["powershell redirect 2>", "powershell", (t) => `Write-Output x 2> '${t}'`],
  ["powershell Set-Content -Path", "powershell", (t) => `Set-Content -Path '${t}' -Value x`],
  ["powershell Set-Content positional", "powershell", (t) => `Set-Content '${t}' x`],
  ["powershell Out-File -FilePath", "powershell", (t) => `Out-File -FilePath '${t}'`],
  ["powershell Add-Content -LiteralPath", "powershell", (t) => `Add-Content -LiteralPath '${t}' -Value x`],
  ["powershell Copy-Item -Destination", "powershell", (t) => `Copy-Item a.txt -Destination '${t}'`],
  ["powershell Move-Item positional destination", "powershell", (t) => `Move-Item a.txt '${t}'`],
  ["powershell Remove-Item", "powershell", (t) => `Remove-Item '${t}'`],
  ["powershell New-Item -Path", "powershell", (t) => `New-Item -Path '${t}' -ItemType File`],
  ["powershell New-Item -Name alone", "powershell", (t) => `New-Item -Name '${t}' -ItemType File`],
  ["powershell New-Item -Path and -Name", "powershell", (t) => `New-Item -Path . -Name '${t}' -ItemType File`],
];

describe("P0b — every write source goes through the one validator", () => {
  describe.each(SOURCES)("%s", (_name, flavor, make) => {
    // scp reads `host:path` as a remote end, so a `Word::` provider path is a REMOTE spec there and not a local write
    it.each(BAD.filter((t) => !(_name.startsWith("bash scp") && t.includes("::"))))("refuses the shape %s", (target) => {
      const hits = detectBashWriteTargets(make(target), ROOT, ROOT, flavor);
      expect(hits, make(target)).not.toEqual([]);
    });

    it("lets an ordinary ASCII docs target through", () => {
      expect(detectBashWriteTargets(make("docs/loops/q.md"), ROOT, ROOT, flavor)).toEqual([]);
    });

    it("refuses a protected target", () => {
      expect(detectBashWriteTargets(make("open-brain/src/x.ts"), ROOT, ROOT, flavor)).not.toEqual([]);
    });
  });
});

describe("the validator itself", () => {
  it("names the shape problems in one place", () => {
    expect(pathShapeProblem("FileSystem::C:/x")).toBe("provider path (::)");
    expect(pathShapeProblem("C:foo")).toBe("drive-relative path (C:name)");
    expect(pathShapeProblem("caf\u00e9")).toContain("non-ASCII character U+00E9");
    expect(pathShapeProblem("C:/foo")).toBeNull();
    expect(pathShapeProblem("docs/loops/q.md")).toBeNull();
  });

  it("returns the location for the file tools: a protected path, an outside path, or an inside one", () => {
    expect(validateTarget("open-brain/src/x.ts", "open-brain/src/x.ts", false, ROOT, ROOT, false)).toMatchObject({ kind: "protected" });
    expect(validateTarget("docs/q.md", "docs/q.md", false, ROOT, ROOT, false)).toMatchObject({ kind: "ok", outside: false, rel: "docs/q.md" });
    expect(validateTarget("/elsewhere/q.md", "/elsewhere/q.md", false, ROOT, ROOT, false)).toMatchObject({ kind: "ok", outside: true });
    expect(validateTarget("C:foo", "C:foo", false, ROOT, ROOT, false)).toMatchObject({ kind: "refused" });
  });
});
