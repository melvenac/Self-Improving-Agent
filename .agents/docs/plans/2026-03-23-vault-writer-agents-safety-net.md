# Vault-Writer .agents/ Safety Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stage 5 to vault-writer.mjs that auto-fills `.agents/SESSIONS/Session_N.md` when `/end` is skipped.

**Architecture:** New function `updateAgentsSessionLog()` called from `main()` after Stage 4. Reads the session template, detects empty sections via regex, fills them with already-extracted session data. Skips gracefully if no `.agents/` or no in-progress session.

**Tech Stack:** Node.js (ESM), better-sqlite3 (already imported), fs/path (already imported)

**Spec:** `docs/superpowers/specs/2026-03-23-vault-writer-agents-safety-net-design.md`

---

## File Structure

- **Modify:** `~/.claude/knowledge-mcp/scripts/vault-writer.mjs` — add `updateAgentsSessionLog()` function + call from `main()`
- **Test script:** `~/.claude/knowledge-mcp/scripts/test-stage5.mjs` — manual test harness (create temp `.agents/` structure, run function, verify output)

---

### Task 1: Write the test harness

**Files:**
- Create: `C:/Users/melve/.claude/knowledge-mcp/scripts/test-stage5.mjs`

- [ ] **Step 1: Create test script with empty template fixture**

```javascript
/**
 * test-stage5.mjs — Manual test for vault-writer Stage 5
 * Run: node test-stage5.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'test-stage5-' + Date.now());
const SESSIONS_DIR = join(TEST_DIR, '.agents', 'SESSIONS');

// --- Fixtures ---

const EMPTY_SESSION = `# Session 1 — 2026-03-23

> **Objective:** Test session
> **Status:** In Progress

---

## Work Log

### What Was Done
-

### Files Modified
-

### Files Created
-

---

## Gotchas & Lessons Learned

-

---

## Decisions Made

-

---

## Post-Session Checklist

- [ ] Session log completed (this file)
- [ ] SUMMARY.md updated with current state
- [ ] DECISIONS.md updated (if applicable)

---

## Next Session Recommendations

-
`;

const PARTIAL_SESSION = `# Session 2 — 2026-03-23

> **Objective:** Partial test
> **Status:** In Progress

---

## Work Log

### What Was Done
- Fixed the auth bug
- Refactored the login flow

### Files Modified
- src/auth.ts
- src/login.ts

### Files Created
-

---

## Gotchas & Lessons Learned

-

---

## Decisions Made

- Chose JWT over session cookies

---

## Post-Session Checklist

- [x] Session log completed (this file)
- [ ] SUMMARY.md updated with current state

---

## Next Session Recommendations

-
`;

// --- Test Cases ---

const tests = [];

function assert(condition, msg) {
  if (!condition) throw new Error('FAIL: ' + msg);
}

// Test 1: Empty session gets filled
tests.push({
  name: 'fills empty session log',
  run: async () => {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    writeFileSync(join(SESSIONS_DIR, 'Session_1.md'), EMPTY_SESSION);

    const { updateAgentsSessionLog } = await import('./vault-writer.mjs');
    updateAgentsSessionLog(
      TEST_DIR,
      ['- User asked to fix auth', '- User asked to add tests'],
      ['src/auth.ts', 'src/login.ts', 'tests/auth.test.ts'],
      ['Chose JWT over session cookies'],
      ['better-sqlite3 needs rebuild after Node upgrade']
    );

    const result = readFileSync(join(SESSIONS_DIR, 'Session_1.md'), 'utf-8');
    assert(result.includes('Status:** Completed'), 'status should be Completed');
    assert(result.includes('User asked to fix auth'), 'should contain what was done');
    assert(result.includes('src/auth.ts'), 'should contain files');
    assert(result.includes('JWT over session'), 'should contain decisions');
    assert(result.includes('better-sqlite3'), 'should contain gotchas');
    assert(result.includes('Auto-completed by vault-writer'), 'should have safety net note');
    // Files Created and Next Session Recommendations remain unfilled (no data source) — that's expected
    // Verify filled sections don't have bare placeholders
    const whatWasDoneSection = result.split('### What Was Done')[1]?.split('###')[0] || '';
    assert(!(/^\s*-\s*$/m.test(whatWasDoneSection)), 'What Was Done should not have empty placeholders');
  }
});

// Test 2: Partial session — only empty sections filled
tests.push({
  name: 'preserves sections already filled by /end',
  run: async () => {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    writeFileSync(join(SESSIONS_DIR, 'Session_2.md'), PARTIAL_SESSION);

    const { updateAgentsSessionLog } = await import('./vault-writer.mjs');
    updateAgentsSessionLog(
      TEST_DIR,
      ['- Overwrite attempt'],
      ['overwrite.ts'],
      ['Overwrite decision'],
      ['Overwrite gotcha']
    );

    const result = readFileSync(join(SESSIONS_DIR, 'Session_2.md'), 'utf-8');
    // What Was Done should NOT be overwritten (already has content)
    assert(result.includes('Fixed the auth bug'), 'should preserve existing What Was Done');
    assert(!result.includes('Overwrite attempt'), 'should not overwrite filled section');
    // Files Modified should NOT be overwritten
    assert(result.includes('src/auth.ts'), 'should preserve existing Files Modified');
    // Decisions should NOT be overwritten
    assert(result.includes('Chose JWT over session cookies'), 'should preserve existing Decisions');
    // Gotchas SHOULD be filled (was empty)
    assert(result.includes('Overwrite gotcha'), 'should fill empty Gotchas');
  }
});

// Test 3: No .agents directory — skip silently
tests.push({
  name: 'skips when no .agents directory',
  run: async () => {
    const noAgentsDir = join(tmpdir(), 'test-no-agents-' + Date.now());
    mkdirSync(noAgentsDir, { recursive: true });

    const { updateAgentsSessionLog } = await import('./vault-writer.mjs');
    // Should not throw
    updateAgentsSessionLog(noAgentsDir, ['- test'], ['file.ts'], [], []);

    rmSync(noAgentsDir, { recursive: true });
  }
});

// Test 4: No in-progress session — skip silently
tests.push({
  name: 'skips when no in-progress session',
  run: async () => {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    const completed = EMPTY_SESSION.replace('Status:** In Progress', 'Status:** Completed');
    writeFileSync(join(SESSIONS_DIR, 'Session_1.md'), completed);

    const { updateAgentsSessionLog } = await import('./vault-writer.mjs');
    // Should not throw
    updateAgentsSessionLog(TEST_DIR, ['- test'], ['file.ts'], [], []);
  }
});

// Test 5: Picks highest-numbered session
tests.push({
  name: 'picks highest-numbered in-progress session',
  run: async () => {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    const completed = EMPTY_SESSION.replace('Status:** In Progress', 'Status:** Completed');
    writeFileSync(join(SESSIONS_DIR, 'Session_1.md'), completed);
    writeFileSync(join(SESSIONS_DIR, 'Session_2.md'), EMPTY_SESSION.replace('Session 1', 'Session 2'));

    const { updateAgentsSessionLog } = await import('./vault-writer.mjs');
    updateAgentsSessionLog(
      TEST_DIR,
      ['- Did some work'],
      ['file.ts'],
      [],
      []
    );

    const s1 = readFileSync(join(SESSIONS_DIR, 'Session_1.md'), 'utf-8');
    const s2 = readFileSync(join(SESSIONS_DIR, 'Session_2.md'), 'utf-8');
    assert(s1.includes('Status:** Completed'), 'Session 1 should stay completed');
    assert(s2.includes('Did some work'), 'Session 2 should be filled');
  }
});

// --- Runner ---
console.log(`Running ${tests.length} tests...\n`);
for (const t of tests) {
  // Clean up between tests
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });

  try {
    await t.run();
    console.log(`  PASS: ${t.name}`);
  } catch (err) {
    console.log(`  FAIL: ${t.name} — ${err.message}`);
  }
}

// Final cleanup
if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
console.log('\nDone.');
```

- [ ] **Step 2: Commit test harness**

```bash
git add ~/.claude/knowledge-mcp/scripts/test-stage5.mjs
git commit -m "test: add test harness for vault-writer Stage 5 safety net"
```

---

### Task 2: Implement updateAgentsSessionLog function

**Files:**
- Modify: `C:/Users/melve/.claude/knowledge-mcp/scripts/vault-writer.mjs`

- [ ] **Step 0: Guard top-level execution for safe imports**

The top-level `if/else` block (lines 34-48) runs `main()` or `backfillMirror()` on import. This must be guarded so test harness imports don't trigger side effects. Replace lines 34-48:

```javascript
// --- CLI entry point (guarded for safe imports) ---
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && fileURLToPath('file:///' + process.argv[1].replace(/\\/g, '/')) === __filename;

if (isDirectRun) {
  if (process.argv.includes('--backfill')) {
    try {
      backfillMirror();
    } catch (err) {
      log(`FATAL (backfill): ${err.message}\n${err.stack}`);
      logErrorToVault(err);
    }
  } else {
    try {
      main();
    } catch (err) {
      log(`FATAL: ${err.message}\n${err.stack}`);
      logErrorToVault(err);
    }
  }
}
```

- [ ] **Step 1: Add the exported function after `findSemanticDuplicate()`**

Add at the end of vault-writer.mjs, the new exported function:

```javascript
/**
 * Stage 5: Safety net — update .agents/SESSIONS/Session_N.md with mechanical data.
 * Only fills sections that still contain empty template placeholders.
 * Skips silently if no .agents/ or no in-progress session.
 */
export function updateAgentsSessionLog(projectDir, whatWasDone, filesChanged, decisions, gotchas) {
  const sessionsDir = join(projectDir, '.agents', 'SESSIONS');
  if (!existsSync(sessionsDir)) {
    log('Stage 5: no .agents/SESSIONS/ — skipping');
    return;
  }

  // Find highest-numbered in-progress session
  const sessionFiles = readdirSync(sessionsDir)
    .filter(f => /^Session_\d+\.md$/.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numB - numA; // descending
    });

  let targetFile = null;
  let content = null;

  for (const file of sessionFiles) {
    const filePath = join(sessionsDir, file);
    const text = readFileSync(filePath, 'utf-8');
    if (/\*\*Status:\*\*\s*In Progress/i.test(text)) {
      targetFile = filePath;
      content = text;
      break;
    }
  }

  if (!targetFile) {
    log('Stage 5: no in-progress session found — skipping');
    return;
  }

  log(`Stage 5: updating ${targetFile.split(/[\\/]/).pop()}`);

  const EMPTY_PLACEHOLDER = /^\s*-\s*$/;
  let filled = [];
  let skipped = [];

  // Helper: check if a section's content is just empty placeholders
  function isSectionEmpty(sectionContent) {
    const lines = sectionContent.split('\n').filter(l => l.trim().length > 0);
    return lines.length === 0 || lines.every(l => EMPTY_PLACEHOLDER.test(l));
  }

  // Helper: replace section content between heading and next heading/---
  function fillSection(text, headingPattern, newContent, sectionName) {
    const lines = text.split('\n');
    let startIdx = -1;
    let endIdx = lines.length;
    let headingLevel = 0;

    // Find the heading
    for (let i = 0; i < lines.length; i++) {
      if (headingPattern.test(lines[i])) {
        startIdx = i;
        headingLevel = (lines[i].match(/^#+/) || [''])[0].length;
        break;
      }
    }

    if (startIdx === -1) {
      skipped.push(sectionName + ' (heading not found)');
      return text;
    }

    // Find end of section (next heading of same or higher level, or ---)
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^---\s*$/.test(line)) {
        endIdx = i;
        break;
      }
      const match = line.match(/^(#+)\s/);
      if (match && match[1].length <= headingLevel) {
        endIdx = i;
        break;
      }
    }

    // Extract section content (between heading and end)
    const sectionLines = lines.slice(startIdx + 1, endIdx).join('\n');

    if (!isSectionEmpty(sectionLines)) {
      skipped.push(sectionName + ' (already populated)');
      return text;
    }

    // Replace
    const newLines = [
      ...lines.slice(0, startIdx + 1),
      newContent,
      ...lines.slice(endIdx)
    ];
    filled.push(sectionName + ` (${newContent.split('\n').filter(l => l.trim()).length} items)`);
    return newLines.join('\n');
  }

  // Fill each section if empty
  if (whatWasDone.length > 0) {
    content = fillSection(content, /^###\s+What Was Done/, whatWasDone.slice(0, 10).join('\n'), 'What Was Done');
  }
  if (filesChanged.length > 0) {
    const fileLines = filesChanged.slice(0, 15).map(f => '- `' + f + '`').join('\n');
    content = fillSection(content, /^###\s+Files Modified/, fileLines, 'Files Modified');
  }
  if (gotchas.length > 0) {
    const gotchaLines = gotchas.slice(0, 5).map(g => '- ' + g).join('\n');
    content = fillSection(content, /^##\s+Gotchas/, gotchaLines, 'Gotchas');
  }
  if (decisions.length > 0) {
    const decisionLines = decisions.slice(0, 5).map(d => '- ' + d).join('\n');
    content = fillSection(content, /^##\s+Decisions Made/, decisionLines, 'Decisions');
  }

  // Mark status as Completed
  content = content.replace(
    /(\*\*Status:\*\*)\s*In Progress/i,
    '$1 Completed'
  );

  // Check off session log checkbox
  content = content.replace(
    /- \[ \] Session log completed \(this file\)/,
    '- [x] Session log completed (this file)'
  );

  // Add safety net note at bottom
  if (!content.includes('Auto-completed by vault-writer')) {
    content = content.trimEnd() + '\n\n> *Auto-completed by vault-writer safety net. Run /end for full close-out (SUMMARY, INBOX, DECISIONS).*\n';
  }

  writeFileSync(targetFile, content);
  log(`Stage 5: filled [${filled.join(', ')}], skipped [${skipped.join(', ')}]`);
}
```

- [ ] **Step 2: Add the Stage 5 call in `main()` after Stage 4**

In `main()`, after the Stage 4 project sync block (around line 228), add:

```javascript
  // --- Stage 5: .agents/ session log safety net ---
  try {
    updateAgentsSessionLog(meta.project_dir, whatWasDone, filesChanged, decisions, gotchas);
  } catch (err) {
    log(`WARN: Stage 5 failed: ${err.message}`);
  }
```

- [ ] **Step 3: Run the test harness**

Run: `node ~/.claude/knowledge-mcp/scripts/test-stage5.mjs`
Expected: All 5 tests PASS

- [ ] **Step 4: Commit implementation**

```bash
git add ~/.claude/knowledge-mcp/scripts/vault-writer.mjs
git commit -m "feat: add Stage 5 safety net — auto-fill .agents/ session logs"
```

---

### Task 3: Manual integration test

- [ ] **Step 1: Verify Stage 5 runs on the current session**

The current Session_2.md in this repo has `Status: In Progress`. When this session ends, vault-writer should detect it and fill it in. To verify before that:

1. Check that `.agents/SESSIONS/Session_2.md` exists and has `In Progress` status
2. Confirm `meta.project_dir` would resolve to `C:/Users/melve/Projects/Self-Improving-Agent`

- [ ] **Step 2: End the session and check**

After ending this session, verify:
- `Session_2.md` status changed to `Completed`
- Work log sections filled with session data
- Safety net note present at bottom
- `/end`'s reflective sections (SUMMARY, INBOX, etc.) still need manual `/end`

---

### Task 4: Update INBOX and cleanup

- [ ] **Step 1: Update INBOX.md**

Add the vault-writer safety net as completed. Rescope the P0:

The P0 "Fix vault-writer extraction filters" should be updated — decisions are already captured via `event.category === 'decision'`. The remaining gap is non-categorized planning discussions. Downgrade to P2 or close with a note.

- [ ] **Step 2: Commit updates**

```bash
git add .agents/TASKS/INBOX.md
git commit -m "chore: update INBOX — safety net done, rescope P0"
```
