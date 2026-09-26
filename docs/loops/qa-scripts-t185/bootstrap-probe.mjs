#!/usr/bin/env node
// QA 120 (T-185, R185-1): does an unknown flag on the SessionStart hook change what it writes?
// Runs <tree>/open-brain/build/cli-bootstrap.js as setup.mjs registers it (no args for Claude Code,
// `--ide cursor` for Cursor) and with typo variants, each against a scratch project and a scratch slot file.
// Records exit code and the slot file's keys and `ide` field. Usage: node bootstrap-probe.mjs <tree>
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const tree = process.argv[2];
const hook = join(tree, "open-brain", "build", "cli-bootstrap.js");
const TMP = realpathSync(tmpdir());
const variants = [
  ["registered (Claude Code): no args", []],
  ["registered (Cursor): --ide cursor", ["--ide", "cursor"]],
  ["unknown flag: --idee cursor", ["--idee", "cursor"]],
  ["unknown flag: --verbose", ["--verbose"]],
  ["single-dash: -ide cursor", ["-ide", "cursor"]],
  ["typo in the VALUE: --ide cursr", ["--ide", "cursr"]],
  ["--ide with no value", ["--ide"]],
];
const payloads = [
  ["claude-shaped payload", (cwd) => ({ session_id: "11111111-2222-3333-4444-555555555555", cwd })],
  ["cursor-shaped payload (cursor_version)", (cwd) => ({ session_id: "11111111-2222-3333-4444-555555555555", cwd, cursor_version: "1.0" })],
];
const rows = [];
for (const [pname, mk] of payloads) {
  for (const [vname, argv] of variants) {
    const root = mkdtempSync(join(TMP, "qa120-boot-"));
    const proj = join(root, "proj");
    mkdirSync(join(proj, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(proj, "package.json"), "{}\n");
    const state = join(root, "_state"); mkdirSync(state);
    const slot = join(state, "active-session.json");
    const env = { ...process.env, HOME: state, USERPROFILE: state, OPEN_BRAIN_ACTIVE_SESSION: slot,
      KNOWLEDGE_V2_DB: join(state, "k.db"), OPEN_BRAIN_VAULT_DIR: join(state, "vault") };
    delete env.OPEN_BRAIN_IDE;
    const r = spawnSync(process.execPath, [hook, ...argv], { cwd: proj, env, input: JSON.stringify(mk(proj)), encoding: "utf8", timeout: 60_000 });
    let keys = "(no slot file)", ide = "";
    if (existsSync(slot)) {
      const j = JSON.parse(readFileSync(slot, "utf8"));
      const ks = Object.keys(j.sessions ?? j);
      keys = ks.map((k) => k.split("::").pop()).join(",");
      const first = (j.sessions ?? j)[ks[0]];
      ide = first?.ide ?? "";
    }
    rows.push({ payload: pname, variant: vname, status: r.status, slotKeySuffix: keys, ide, uuidLine: /SESSION_UUID: \S+/.test(r.stdout) });
    rmSync(root, { recursive: true, force: true });
  }
}
console.log("| payload | invocation | exit | slot key suffix | slot `ide` | SESSION_UUID printed |\n|---|---|---|---|---|---|");
for (const x of rows) console.log(`| ${x.payload} | ${x.variant} | ${x.status} | ${x.slotKeySuffix} | ${x.ide} | ${x.uuidLine} |`);
