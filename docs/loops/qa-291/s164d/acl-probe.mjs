// QA 291 row 12: is an ACL deny enforced against this process? (diagnostic for the L2 method)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, renameSync } from "node:fs";
const d = "C:\\qa-tmp\\qa291\\acltest\\d";
rmSync("C:/qa-tmp/qa291/acltest", { recursive: true, force: true });
mkdirSync(d, { recursive: true });
writeFileSync(`${d}\\old.txt`, "x");
const WHOAMI = "C:\\Windows\\System32\\whoami.exe"; // not Git Bash's coreutils whoami
const x = (c0, a) => { const c = c0 === "whoami" ? WHOAMI : c0; try { return execFileSync(c, a, { encoding: "utf8" }).trim(); } catch (e) { return `ERR ${e.status}: ${(e.stdout ?? "") + (e.stderr ?? "")}`.trim(); } };
console.log("whoami:", x("whoami", []));
console.log("user sid:", x("whoami", ["/user"]).split("\n").pop());
console.log("groups (mandatory/admin):", x("whoami", ["/groups"]).split("\n").filter((l) => /Mandatory|Administrators/i.test(l)).map((l) => l.replace(/\s+/g, " ")).join(" | "));
const sid = x("whoami", ["/user"]).split("\n").pop().trim().split(/\s+/).pop();
console.log("deny by SID:", x("icacls", [d, "/deny", `*${sid}:(OI)(CI)(W,D,DC)`]).split("\n")[0]);
console.log(x("icacls", [d]));
const t = (label, f) => { try { f(); console.log(`${label}: ALLOWED`); } catch (e) { console.log(`${label}: BLOCKED ${e.code}`); } };
t("node create file", () => writeFileSync(`${d}\\new.txt`, "x"));
t("node rename out", () => renameSync(`${d}\\old.txt`, "C:\\qa-tmp\\qa291\\acltest\\moved.txt"));
console.log("powershell create:", x("powershell", ["-NoProfile", "-Command", `try { [IO.File]::WriteAllText('${d}\\ps.txt','x'); 'ALLOWED' } catch { 'BLOCKED ' + $_.Exception.GetType().Name }`]));
console.log("undo:", x("icacls", [d, "/remove:d", `*${sid}`]).split("\n")[0]);
