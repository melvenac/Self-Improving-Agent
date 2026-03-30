#!/usr/bin/env node
/**
 * Knowledge DB Dashboard — Read-only web viewer for knowledge.db
 * Run: node knowledge-mcp/scripts/dashboard.mjs
 * Opens: http://localhost:3456
 */
import { createServer } from "node:http";
import { join } from "node:path";
import { homedir } from "node:os";
import { statSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const KB_PATH = join(homedir(), ".claude", "context-mode", "knowledge.db");
const PORT = parseInt(process.env.DASHBOARD_PORT || "3456", 10);

let db;
try {
  db = new Database(KB_PATH, { readonly: true });
  db.pragma("journal_mode = WAL");
} catch (err) {
  console.error(`Failed to open ${KB_PATH}: ${err.message}`);
  process.exit(1);
}

// --- CC Memory scanner ---

const CLAUDE_DIR = join(homedir(), ".claude");

function scanMemories(q) {
  const memories = [];

  // Parse YAML frontmatter from markdown
  function parseFrontmatter(content) {
    const norm = content.replace(/\r\n/g, "\n");
    const match = norm.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { meta: {}, body: norm };
    const meta = {};
    for (const line of match[1].split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) meta[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
    }
    return { meta, body: match[2].trim() };
  }

  // Scan a memory directory
  function scanDir(dir, project) {
    if (!existsSync(dir)) return;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md") || file === "MEMORY.md") continue;
      try {
        const content = readFileSync(join(dir, file), "utf-8");
        const { meta, body } = parseFrontmatter(content);
        memories.push({
          file,
          project,
          name: meta.name || file.replace(".md", ""),
          description: meta.description || "",
          type: meta.type || "unknown",
          body,
          path: join(dir, file),
        });
      } catch {}
    }
  }

  // Global memory
  scanDir(join(CLAUDE_DIR, "memory"), "(global)");

  // Per-project memories
  const projectsDir = join(CLAUDE_DIR, "projects");
  if (existsSync(projectsDir)) {
    for (const proj of readdirSync(projectsDir)) {
      const memDir = join(projectsDir, proj, "memory");
      if (existsSync(memDir)) {
        // Convert dir name back to readable project name
        const projectName = proj.replace(/^[Cc]--/, "").split("-").pop() || proj;
        scanDir(memDir, projectName);
      }
    }
  }

  // Apply filters
  let results = memories;
  if (q.type) results = results.filter(m => m.type === q.type);
  if (q.project) results = results.filter(m => m.project.toLowerCase().includes(q.project.toLowerCase()));
  if (q.search) {
    const s = q.search.toLowerCase();
    results = results.filter(m =>
      m.name.toLowerCase().includes(s) ||
      m.description.toLowerCase().includes(s) ||
      m.body.toLowerCase().includes(s)
    );
  }
  return results;
}

// --- Config scanner ---

const PROJECTS_DIR = join(homedir(), "Projects");

function scanConfig(q) {
  const items = [];

  function addFile(path, scope, project, type) {
    if (!existsSync(path)) return;
    try {
      const content = readFileSync(path, "utf-8").replace(/\r\n/g, "\n");
      const stat = statSync(path);
      items.push({
        path,
        scope,
        project,
        type,
        content,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        name: type === "settings" ? "settings.json" : "CLAUDE.md",
      });
    } catch {}
  }

  // Global config
  addFile(join(CLAUDE_DIR, "CLAUDE.md"), "global", "(global)", "claude-md");
  addFile(join(CLAUDE_DIR, "settings.json"), "global", "(global)", "settings");

  // Project CLAUDE.md files — scan ~/Projects/
  if (existsSync(PROJECTS_DIR)) {
    for (const proj of readdirSync(PROJECTS_DIR)) {
      const projDir = join(PROJECTS_DIR, proj);
      try {
        const s = statSync(projDir);
        if (!s.isDirectory()) continue;
      } catch { continue; }
      addFile(join(projDir, "CLAUDE.md"), "project", proj, "claude-md");
      addFile(join(projDir, ".claude", "settings.json"), "project", proj, "settings");
    }
  }

  // Apply filters
  let results = items;
  if (q.scope) results = results.filter(i => i.scope === q.scope);
  if (q.type) results = results.filter(i => i.type === q.type);
  if (q.project) results = results.filter(i => i.project.toLowerCase().includes(q.project.toLowerCase()));
  if (q.search) {
    const s = q.search.toLowerCase();
    results = results.filter(i => i.content.toLowerCase().includes(s) || i.project.toLowerCase().includes(s));
  }
  return results;
}

// --- API helpers ---

function parseQuery(url) {
  const u = new URL(url, "http://localhost");
  return {
    search: u.searchParams.get("search") || "",
    category: u.searchParams.get("category") || "",
    maturity: u.searchParams.get("maturity") || "",
    source: u.searchParams.get("source") || "",
    session_id: u.searchParams.get("session_id") || "",
    project: u.searchParams.get("project") || "",
    tag: u.searchParams.get("tag") || "",
    type: u.searchParams.get("type") || "",
    scope: u.searchParams.get("scope") || "",
    limit: Math.min(parseInt(u.searchParams.get("limit") || "100", 10), 500),
    offset: parseInt(u.searchParams.get("offset") || "0", 10),
  };
}

function getStats() {
  const sessions = db.prepare("SELECT COUNT(*) as c FROM sessions").get();
  const chunks = db.prepare("SELECT COUNT(*) as c FROM chunks").get();
  const knowledge = db.prepare("SELECT COUNT(*) as c FROM knowledge").get();
  const summaries = db.prepare("SELECT COUNT(*) as c FROM summaries").get();
  const tags = db.prepare("SELECT COUNT(DISTINCT tag) as c FROM tags").get();

  const topTags = db
    .prepare(
      "SELECT tag, COUNT(*) as count FROM tags GROUP BY tag ORDER BY count DESC LIMIT 15"
    )
    .all();

  const maturityDist = db
    .prepare(
      "SELECT COALESCE(maturity, 'progenitor') as maturity, COUNT(*) as count FROM knowledge GROUP BY maturity ORDER BY count DESC"
    )
    .all();

  const categories = db
    .prepare(
      "SELECT category, COUNT(*) as count FROM chunks GROUP BY category ORDER BY count DESC"
    )
    .all();

  const recentSessions = db
    .prepare(
      "SELECT id, project_dir, started_at, event_count FROM sessions ORDER BY started_at DESC LIMIT 5"
    )
    .all();

  const sessionsPerDay = db
    .prepare(
      "SELECT date(started_at) as day, COUNT(*) as count FROM sessions WHERE started_at IS NOT NULL GROUP BY date(started_at) ORDER BY day"
    )
    .all();

  const totalDays = sessionsPerDay.length;
  const avgPerDay = totalDays > 0 ? (sessionsPerDay.reduce((s, r) => s + r.count, 0) / totalDays).toFixed(1) : '0';

  let dbSize = 0;
  try {
    dbSize = statSync(KB_PATH).size;
  } catch {}

  return {
    sessions: sessions.c,
    chunks: chunks.c,
    knowledge: knowledge.c,
    summaries: summaries.c,
    unique_tags: tags.c,
    db_size_bytes: dbSize,
    top_tags: topTags,
    maturity_distribution: maturityDist,
    categories,
    recent_sessions: recentSessions,
    sessions_per_day: sessionsPerDay,
    avg_sessions_per_day: avgPerDay,
  };
}

function getSessions(q) {
  let sql = "SELECT * FROM sessions WHERE 1=1";
  const params = [];

  if (q.project) {
    sql += " AND project_dir LIKE ?";
    params.push(`%${q.project}%`);
  }
  if (q.search) {
    sql += " AND (id LIKE ? OR project_dir LIKE ?)";
    params.push(`%${q.search}%`, `%${q.search}%`);
  }

  sql += " ORDER BY started_at DESC LIMIT ? OFFSET ?";
  params.push(q.limit, q.offset);

  return db.prepare(sql).all(...params);
}

function getChunks(q) {
  const params = [];

  // FTS5 search path
  if (q.search) {
    let sql = `SELECT c.*, GROUP_CONCAT(t.tag) as tags
      FROM chunks_fts fts
      JOIN chunks c ON c.id = fts.rowid
      LEFT JOIN tags t ON t.chunk_id = c.id
      WHERE chunks_fts MATCH ?`;
    params.push(q.search);

    if (q.session_id) { sql += " AND c.session_id = ?"; params.push(q.session_id); }
    if (q.category) { sql += " AND c.category = ?"; params.push(q.category); }
    if (q.tag) { sql += " AND c.id IN (SELECT chunk_id FROM tags WHERE tag = ?)"; params.push(q.tag); }

    sql += " GROUP BY c.id ORDER BY rank LIMIT ? OFFSET ?";
    params.push(q.limit, q.offset);
    return db.prepare(sql).all(...params);
  }

  // Non-search path
  let sql = "SELECT c.*, GROUP_CONCAT(t.tag) as tags FROM chunks c LEFT JOIN tags t ON t.chunk_id = c.id WHERE 1=1";
  if (q.session_id) { sql += " AND c.session_id = ?"; params.push(q.session_id); }
  if (q.category) { sql += " AND c.category = ?"; params.push(q.category); }
  if (q.tag) { sql += " AND c.id IN (SELECT chunk_id FROM tags WHERE tag = ?)"; params.push(q.tag); }

  sql += " GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?";
  params.push(q.limit, q.offset);
  return db.prepare(sql).all(...params);
}

function getKnowledge(q) {
  const params = [];

  // FTS5 search path
  if (q.search) {
    let sql = `SELECT k.*
      FROM knowledge_fts fts
      JOIN knowledge k ON k.id = fts.rowid
      WHERE knowledge_fts MATCH ?`;
    params.push(q.search);

    if (q.maturity) { sql += " AND k.maturity = ?"; params.push(q.maturity); }
    if (q.source) { sql += " AND k.source = ?"; params.push(q.source); }
    if (q.project) { sql += " AND k.project_dir LIKE ?"; params.push(`%${q.project}%`); }

    sql += " ORDER BY rank LIMIT ? OFFSET ?";
    params.push(q.limit, q.offset);
    return db.prepare(sql).all(...params);
  }

  // Non-search path
  let sql = "SELECT * FROM knowledge WHERE 1=1";
  if (q.maturity) { sql += " AND maturity = ?"; params.push(q.maturity); }
  if (q.source) { sql += " AND source = ?"; params.push(q.source); }
  if (q.project) { sql += " AND project_dir LIKE ?"; params.push(`%${q.project}%`); }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(q.limit, q.offset);
  return db.prepare(sql).all(...params);
}

function getSummaries(q) {
  const params = [];

  // FTS5 search path
  if (q.search) {
    let sql = `SELECT s.*
      FROM summaries_fts fts
      JOIN summaries s ON s.id = fts.rowid
      WHERE summaries_fts MATCH ?`;
    params.push(q.search);

    if (q.session_id) { sql += " AND s.session_id = ?"; params.push(q.session_id); }

    sql += " ORDER BY rank LIMIT ? OFFSET ?";
    params.push(q.limit, q.offset);
    return db.prepare(sql).all(...params);
  }

  // Non-search path
  let sql = "SELECT * FROM summaries WHERE 1=1";
  if (q.session_id) { sql += " AND session_id = ?"; params.push(q.session_id); }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(q.limit, q.offset);
  return db.prepare(sql).all(...params);
}

// --- HTML ---

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge DB Dashboard</title>
<style>
  :root {
    --bg: #1a1b26;
    --bg2: #24283b;
    --bg3: #2f3347;
    --fg: #c0caf5;
    --fg2: #a9b1d6;
    --fg3: #565f89;
    --accent: #7aa2f7;
    --green: #9ece6a;
    --yellow: #e0af68;
    --red: #f7768e;
    --orange: #ff9e64;
    --purple: #bb9af7;
    --border: #3b4261;
    --mono: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--fg); font-family: var(--mono); font-size: 13px; line-height: 1.5; }

  /* Layout */
  .header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
  .header h1 { font-size: 16px; color: var(--accent); font-weight: 600; }
  .header .db-path { color: var(--fg3); font-size: 11px; }

  .tabs { display: flex; gap: 0; background: var(--bg2); border-bottom: 1px solid var(--border); padding: 0 24px; }
  .tab { padding: 10px 20px; cursor: pointer; color: var(--fg3); border-bottom: 2px solid transparent; transition: all 0.15s; }
  .tab:hover { color: var(--fg2); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  .content { padding: 24px; max-width: 1400px; }
  .panel { display: none; }
  .panel.active { display: block; }

  /* Controls */
  .controls { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
  input[type="text"], select {
    background: var(--bg2); border: 1px solid var(--border); color: var(--fg);
    padding: 6px 12px; border-radius: 4px; font-family: var(--mono); font-size: 12px;
  }
  input[type="text"]:focus, select:focus { outline: none; border-color: var(--accent); }
  input[type="text"] { width: 260px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 12px; color: var(--fg3); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg); cursor: pointer; user-select: none; }
  th:hover { color: var(--fg2); }
  .sort-arrow { color: var(--accent); font-size: 10px; }
  td { padding: 8px 12px; border-bottom: 1px solid var(--bg3); vertical-align: top; max-width: 400px; }
  tr:hover td { background: var(--bg2); }
  tr.expandable { cursor: pointer; }
  tr.detail-row td { background: var(--bg2); padding: 16px 24px; }
  .content-preview { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .content-full { white-space: pre-wrap; word-break: break-word; color: var(--fg2); max-height: 400px; overflow-y: auto; }

  /* Badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500; }
  .badge-progenitor { background: var(--bg3); color: var(--fg3); }
  .badge-proven { background: #1a3a2a; color: var(--green); }
  .badge-mature { background: #2a3a1a; color: var(--yellow); }
  .badge-retired { background: #3a1a1a; color: var(--red); }
  .badge-category { background: var(--bg3); color: var(--purple); }
  .badge-source { background: var(--bg3); color: var(--orange); }

  /* Stats cards */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 16px; }
  .stat-card .label { color: var(--fg3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .stat-card .value { font-size: 28px; font-weight: 700; color: var(--accent); }
  .stat-card .sub { color: var(--fg3); font-size: 11px; margin-top: 4px; }

  /* Bar chart */
  .bar-chart { margin-top: 16px; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .bar-label { width: 120px; text-align: right; color: var(--fg2); font-size: 12px; flex-shrink: 0; }
  .bar-track { flex: 1; height: 20px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; display: flex; align-items: center; padding-left: 8px; font-size: 11px; color: var(--bg); font-weight: 600; }
  .bar-count { width: 50px; color: var(--fg3); font-size: 12px; }

  /* Pagination */
  .pagination { display: flex; gap: 8px; margin-top: 16px; align-items: center; }
  .pagination button {
    background: var(--bg2); border: 1px solid var(--border); color: var(--fg);
    padding: 6px 14px; border-radius: 4px; cursor: pointer; font-family: var(--mono); font-size: 12px;
  }
  .pagination button:hover { border-color: var(--accent); }
  .pagination button:disabled { opacity: 0.3; cursor: default; }
  .pagination .info { color: var(--fg3); font-size: 12px; }

  /* Responsive */
  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .controls { flex-direction: column; }
    input[type="text"] { width: 100%; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>Knowledge DB</h1>
  <span class="db-path" id="dbPath"></span>
</div>

<div class="tabs">
  <div class="tab active" data-tab="overview">Overview</div>
  <div class="tab" data-tab="sessions">Sessions</div>
  <div class="tab" data-tab="knowledge">Knowledge</div>
  <div class="tab" data-tab="chunks">Chunks</div>
  <div class="tab" data-tab="summaries">Summaries</div>
  <div class="tab" data-tab="memory">Memory</div>
  <div class="tab" data-tab="config">Config</div>
</div>

<div class="content">

  <!-- OVERVIEW -->
  <div class="panel active" id="panel-overview">
    <div class="stats-grid" id="statsGrid"></div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <div>
        <h3 style="color:var(--fg3); margin-bottom:12px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Maturity Distribution</h3>
        <div id="maturityChart" class="bar-chart"></div>
      </div>
      <div>
        <h3 style="color:var(--fg3); margin-bottom:12px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Top Tags</h3>
        <div id="tagsChart" class="bar-chart"></div>
      </div>
    </div>
    <div style="margin-top:24px;">
      <h3 style="color:var(--fg3); margin-bottom:12px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Chunk Categories</h3>
      <div id="categoriesChart" class="bar-chart"></div>
    </div>
    <div style="margin-top:24px;">
      <h3 style="color:var(--fg3); margin-bottom:12px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Sessions Per Day <span id="avgPerDay" style="color:var(--accent);"></span></h3>
      <div id="sessionsPerDayChart" class="bar-chart"></div>
    </div>
  </div>

  <!-- SESSIONS -->
  <div class="panel" id="panel-sessions">
    <div class="controls">
      <input type="text" id="sessionsSearch" placeholder="Search sessions...">
    </div>
    <table>
      <thead><tr>
        <th data-col="id" onclick="sortBy('sessions','id')">ID</th><th data-col="project_dir" onclick="sortBy('sessions','project_dir')">Project</th><th data-col="started_at" onclick="sortBy('sessions','started_at')">Started</th><th data-col="ended_at" onclick="sortBy('sessions','ended_at')">Ended</th><th data-col="event_count" onclick="sortBy('sessions','event_count')">Events</th><th data-col="indexed_at" onclick="sortBy('sessions','indexed_at')">Indexed</th>
      </tr></thead>
      <tbody id="sessionsBody"></tbody>
    </table>
    <div class="pagination" id="sessionsPagination"></div>
  </div>

  <!-- KNOWLEDGE -->
  <div class="panel" id="panel-knowledge">
    <div class="controls">
      <input type="text" id="knowledgeSearch" placeholder="Search key, content, tags (FTS5)...">
      <select id="knowledgeMaturity">
        <option value="">All Maturity</option>
        <option value="progenitor">Progenitor</option>
        <option value="proven">Proven</option>
        <option value="mature">Mature</option>
        <option value="retired">Retired</option>
      </select>
      <select id="knowledgeSource">
        <option value="">All Sources</option>
      </select>
    </div>
    <table>
      <thead><tr>
        <th data-col="id" onclick="sortBy('knowledge','id')">ID</th><th data-col="key" onclick="sortBy('knowledge','key')">Key</th><th data-col="source" onclick="sortBy('knowledge','source')">Source</th><th data-col="maturity" onclick="sortBy('knowledge','maturity')">Maturity</th><th data-col="success_rate" onclick="sortBy('knowledge','success_rate')">Rate</th><th data-col="recall_count" onclick="sortBy('knowledge','recall_count')">Recalls</th><th data-col="tags" onclick="sortBy('knowledge','tags')">Tags</th><th data-col="created_at" onclick="sortBy('knowledge','created_at')">Created</th>
      </tr></thead>
      <tbody id="knowledgeBody"></tbody>
    </table>
    <div class="pagination" id="knowledgePagination"></div>
  </div>

  <!-- CHUNKS -->
  <div class="panel" id="panel-chunks">
    <div class="controls">
      <input type="text" id="chunksSearch" placeholder="Search chunk content (FTS5)...">
      <select id="chunksCategory">
        <option value="">All Categories</option>
      </select>
      <select id="chunksTag">
        <option value="">All Tags</option>
      </select>
      <input type="text" id="chunksSession" placeholder="Filter by session ID...">
    </div>
    <table>
      <thead><tr>
        <th data-col="id" onclick="sortBy('chunks','id')">ID</th><th data-col="session_id" onclick="sortBy('chunks','session_id')">Session</th><th data-col="source" onclick="sortBy('chunks','source')">Source</th><th data-col="category" onclick="sortBy('chunks','category')">Category</th><th data-col="content" onclick="sortBy('chunks','content')">Content</th><th data-col="tags" onclick="sortBy('chunks','tags')">Tags</th><th data-col="created_at" onclick="sortBy('chunks','created_at')">Created</th>
      </tr></thead>
      <tbody id="chunksBody"></tbody>
    </table>
    <div class="pagination" id="chunksPagination"></div>
  </div>

  <!-- SUMMARIES -->
  <div class="panel" id="panel-summaries">
    <div class="controls">
      <input type="text" id="summariesSearch" placeholder="Search summaries (FTS5)...">
    </div>
    <table>
      <thead><tr>
        <th data-col="session_id" onclick="sortBy('summaries','session_id')">Session</th><th data-col="summary" onclick="sortBy('summaries','summary')">Summary</th><th data-col="model" onclick="sortBy('summaries','model')">Model</th><th data-col="created_at" onclick="sortBy('summaries','created_at')">Created</th>
      </tr></thead>
      <tbody id="summariesBody"></tbody>
    </table>
    <div class="pagination" id="summariesPagination"></div>
  </div>

  <!-- MEMORY -->
  <div class="panel" id="panel-memory">
    <div class="controls">
      <input type="text" id="memorySearch" placeholder="Search memories...">
      <select id="memoryType">
        <option value="">All Types</option>
        <option value="user">User</option>
        <option value="feedback">Feedback</option>
        <option value="project">Project</option>
        <option value="reference">Reference</option>
      </select>
      <select id="memoryProject">
        <option value="">All Projects</option>
      </select>
    </div>
    <table>
      <thead><tr>
        <th data-col="name" onclick="sortBy('memory','name')">Name</th>
        <th data-col="type" onclick="sortBy('memory','type')">Type</th>
        <th data-col="project" onclick="sortBy('memory','project')">Project</th>
        <th data-col="description" onclick="sortBy('memory','description')">Description</th>
        <th data-col="file" onclick="sortBy('memory','file')">File</th>
      </tr></thead>
      <tbody id="memoryBody"></tbody>
    </table>
  </div>

  <!-- CONFIG -->
  <div class="panel" id="panel-config">
    <div class="controls">
      <input type="text" id="configSearch" placeholder="Search config content...">
      <select id="configScope">
        <option value="">All Scopes</option>
        <option value="global">Global</option>
        <option value="project">Project</option>
      </select>
      <select id="configType">
        <option value="">All Types</option>
        <option value="claude-md">CLAUDE.md</option>
        <option value="settings">settings.json</option>
      </select>
    </div>
    <table>
      <thead><tr>
        <th data-col="name" onclick="sortBy('config','name')">File</th>
        <th data-col="scope" onclick="sortBy('config','scope')">Scope</th>
        <th data-col="project" onclick="sortBy('config','project')">Project</th>
        <th data-col="size" onclick="sortBy('config','size')">Size</th>
        <th data-col="modified" onclick="sortBy('config','modified')">Modified</th>
      </tr></thead>
      <tbody id="configBody"></tbody>
    </table>
  </div>

</div>

<script>
const API = '';
const PAGE_SIZE = 50;
const state = {
  sessions: { offset: 0, rows: [], sortCol: null, sortAsc: true },
  knowledge: { offset: 0, rows: [], sortCol: null, sortAsc: true },
  chunks: { offset: 0, rows: [], sortCol: null, sortAsc: true },
  summaries: { offset: 0, rows: [], sortCol: null, sortAsc: true },
  memory: { offset: 0, rows: [], sortCol: null, sortAsc: true },
  config: { offset: 0, rows: [], sortCol: null, sortAsc: true },
};

function sortRows(rows, col, asc) {
  return [...rows].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (va == null) va = '';
    if (vb == null) vb = '';
    if (typeof va === 'number' && typeof vb === 'number') return asc ? va - vb : vb - va;
    va = String(va); vb = String(vb);
    return asc ? va.localeCompare(vb) : vb.localeCompare(va);
  });
}

function sortBy(table, col) {
  const s = state[table];
  if (s.sortCol === col) { s.sortAsc = !s.sortAsc; } else { s.sortCol = col; s.sortAsc = true; }
  s.rows = sortRows(s.rows, col, s.sortAsc);
  const renderers = { sessions: renderSessionRows, knowledge: renderKnowledgeRows, chunks: renderChunkRows, summaries: renderSummaryRows, memory: renderMemoryRows, config: renderConfigRows };
  renderers[table]();
  updateSortIndicators(table);
}

function updateSortIndicators(table) {
  const panel = document.getElementById('panel-' + table);
  panel.querySelectorAll('th').forEach(th => {
    const col = th.dataset.col;
    if (!col) return;
    th.querySelector('.sort-arrow')?.remove();
    if (state[table].sortCol === col) {
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = state[table].sortAsc ? ' \\u25B2' : ' \\u25BC';
      th.appendChild(arrow);
    }
  });
}

// --- Helpers ---
function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}
function truncate(s, n = 120) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}
function fmtDate(s) {
  if (!s) return '-';
  return s.replace('T', ' ').slice(0, 19);
}
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
function maturityBadge(m) {
  const v = m || 'progenitor';
  return '<span class="badge badge-' + v + '">' + v + '</span>';
}
function categoryBadge(c) {
  return '<span class="badge badge-category">' + esc(c) + '</span>';
}
function sourceBadge(s) {
  return '<span class="badge badge-source">' + esc(s) + '</span>';
}
function barColor(label) {
  const colors = { progenitor: 'var(--fg3)', proven: 'var(--green)', mature: 'var(--yellow)', retired: 'var(--red)' };
  return colors[label] || 'var(--accent)';
}

async function api(endpoint, params = {}) {
  const u = new URL(endpoint, location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) u.searchParams.set(k, v);
  }
  const r = await fetch(u);
  return r.json();
}

// --- Tabs ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    loadPanel(tab.dataset.tab);
  });
});

// --- Toggle detail rows ---
function toggleRow(btn, id, contentId) {
  const existing = document.getElementById(contentId);
  if (existing) { existing.remove(); return; }
  const tr = btn.closest('tr');
  const detail = document.createElement('tr');
  detail.id = contentId;
  detail.className = 'detail-row';
  detail.innerHTML = '<td colspan="99"><div class="content-full" id="loading-' + id + '">Loading...</div></td>';
  tr.after(detail);
  return detail;
}

// --- Overview ---
async function loadOverview() {
  const d = await api('/api/stats');
  document.getElementById('dbPath').textContent = d.db_path || '';

  document.getElementById('statsGrid').innerHTML =
    card('Sessions', d.sessions) +
    card('Chunks', d.chunks) +
    card('Knowledge', d.knowledge) +
    card('Summaries', d.summaries) +
    card('Unique Tags', d.unique_tags) +
    card('DB Size', fmtBytes(d.db_size_bytes));

  renderBars('maturityChart', d.maturity_distribution, r => r.maturity, r => r.count, barColor);
  renderBars('tagsChart', d.top_tags, r => r.tag, r => r.count, () => 'var(--accent)');
  renderBars('categoriesChart', d.categories, r => r.category, r => r.count, () => 'var(--purple)');

  document.getElementById('avgPerDay').textContent = '(avg: ' + d.avg_sessions_per_day + '/day)';
  renderBars('sessionsPerDayChart', d.sessions_per_day, r => r.day.slice(5), r => r.count, () => 'var(--green)');
}

function card(label, value) {
  return '<div class="stat-card"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
}

function renderBars(containerId, data, labelFn, valueFn, colorFn) {
  if (!data || !data.length) { document.getElementById(containerId).innerHTML = '<span style="color:var(--fg3)">No data</span>'; return; }
  const max = Math.max(...data.map(valueFn));
  document.getElementById(containerId).innerHTML = data.map(r => {
    const pct = max > 0 ? (valueFn(r) / max * 100) : 0;
    return '<div class="bar-row">' +
      '<div class="bar-label">' + esc(labelFn(r)) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + colorFn(labelFn(r)) + '">' + (pct > 15 ? valueFn(r) : '') + '</div></div>' +
      '<div class="bar-count">' + valueFn(r) + '</div></div>';
  }).join('');
}

// --- Sessions ---
function renderSessionRows() {
  const tbody = document.getElementById('sessionsBody');
  tbody.innerHTML = state.sessions.rows.map(r =>
    '<tr class="expandable" onclick="loadSessionChunks(this, \\'' + esc(r.id) + '\\')">' +
    '<td title="' + esc(r.id) + '">' + esc(truncate(r.id, 20)) + '</td>' +
    '<td>' + esc(r.project_dir ? r.project_dir.split(/[\\/\\\\]/).pop() : '-') + '</td>' +
    '<td>' + fmtDate(r.started_at) + '</td>' +
    '<td>' + fmtDate(r.ended_at) + '</td>' +
    '<td>' + (r.event_count || 0) + '</td>' +
    '<td>' + (r.indexed_at ? 'Yes' : 'No') + '</td>' +
    '</tr>'
  ).join('');
}
async function loadSessions() {
  const q = { search: document.getElementById('sessionsSearch').value, limit: PAGE_SIZE, offset: state.sessions.offset };
  state.sessions.rows = await api('/api/sessions', q);
  state.sessions.sortCol = null;
  renderSessionRows();
  renderPagination('sessionsPagination', state.sessions.rows.length, state.sessions, loadSessions);
}

async function loadSessionChunks(tr, sessionId) {
  const cid = 'detail-session-' + sessionId.replace(/[^a-zA-Z0-9]/g, '_');
  const existing = document.getElementById(cid);
  if (existing) { existing.remove(); return; }
  const detail = document.createElement('tr');
  detail.id = cid;
  detail.className = 'detail-row';
  detail.innerHTML = '<td colspan="6"><div class="content-full">Loading chunks...</div></td>';
  tr.after(detail);

  const chunks = await api('/api/chunks', { session_id: sessionId, limit: 20 });
  detail.querySelector('.content-full').innerHTML = chunks.length === 0 ? 'No chunks indexed for this session.' :
    '<table style="width:100%"><thead><tr><th>Cat</th><th>Source</th><th>Content</th><th>Tags</th></tr></thead><tbody>' +
    chunks.map(c =>
      '<tr><td>' + categoryBadge(c.category) + '</td>' +
      '<td>' + esc(truncate(c.source, 30)) + '</td>' +
      '<td style="max-width:500px; white-space:pre-wrap; word-break:break-word;">' + esc(truncate(c.content, 300)) + '</td>' +
      '<td>' + esc(c.tags || '') + '</td></tr>'
    ).join('') + '</tbody></table>';
}

// --- Knowledge ---
function renderKnowledgeRows() {
  const tbody = document.getElementById('knowledgeBody');
  tbody.innerHTML = state.knowledge.rows.map(r =>
    '<tr class="expandable" onclick="toggleKnowledge(this, ' + r.id + ')">' +
    '<td>' + r.id + '</td>' +
    '<td>' + esc(truncate(r.key, 40)) + '</td>' +
    '<td>' + sourceBadge(r.source) + '</td>' +
    '<td>' + maturityBadge(r.maturity) + '</td>' +
    '<td>' + (r.success_rate != null ? (r.success_rate * 100).toFixed(0) + '%' : '-') + '</td>' +
    '<td>' + (r.recall_count || 0) + '</td>' +
    '<td>' + esc(truncate(r.tags, 30)) + '</td>' +
    '<td>' + fmtDate(r.created_at) + '</td></tr>'
  ).join('');
}
async function loadKnowledge() {
  const q = {
    search: document.getElementById('knowledgeSearch').value,
    maturity: document.getElementById('knowledgeMaturity').value,
    source: document.getElementById('knowledgeSource').value,
    limit: PAGE_SIZE, offset: state.knowledge.offset,
  };
  state.knowledge.rows = await api('/api/knowledge', q);
  state.knowledge.sortCol = null;
  renderKnowledgeRows();
  renderPagination('knowledgePagination', state.knowledge.rows.length, state.knowledge, loadKnowledge);

  // Populate source filter
  const sources = [...new Set(state.knowledge.rows.map(r => r.source).filter(Boolean))];
  const sel = document.getElementById('knowledgeSource');
  const curVal = sel.value;
  if (sel.options.length <= 1) {
    sources.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; sel.appendChild(o); });
  }
  sel.value = curVal;
}

function toggleKnowledge(tr, id) {
  const cid = 'detail-k-' + id;
  const existing = document.getElementById(cid);
  if (existing) { existing.remove(); return; }
  const detail = document.createElement('tr');
  detail.id = cid;
  detail.className = 'detail-row';

  const row = tr;
  // Fetch full content from the already-loaded data isn't possible, so we call the API
  api('/api/knowledge', { search: '', limit: 1, offset: 0 }).then(() => {
    // We need to get the full row — use a dedicated endpoint or embed data
  });

  // For now, the content is available in the row data via a data attribute approach.
  // Let's use a simpler approach: fetch from API
  fetch('/api/knowledge/' + id).then(r => r.json()).then(k => {
    detail.innerHTML = '<td colspan="8"><div class="content-full">' +
      '<strong>Key:</strong> ' + esc(k.key) + '\\n' +
      '<strong>Source:</strong> ' + esc(k.source) + '  <strong>Project:</strong> ' + esc(k.project_dir || 'global') + '\\n' +
      '<strong>Maturity:</strong> ' + esc(k.maturity) + '  <strong>Success Rate:</strong> ' + (k.success_rate != null ? (k.success_rate * 100).toFixed(0) + '%' : 'N/A') + '\\n' +
      '<strong>Recalls:</strong> ' + (k.recall_count || 0) + '  <strong>Last Recalled:</strong> ' + fmtDate(k.last_recalled) + '\\n' +
      '<strong>Helpful:</strong> ' + (k.helpful_count || 0) + '  <strong>Harmful:</strong> ' + (k.harmful_count || 0) + '  <strong>Neutral:</strong> ' + (k.neutral_count || 0) + '\\n' +
      '<strong>Tags:</strong> ' + esc(k.tags) + '\\n' +
      '<strong>Created:</strong> ' + fmtDate(k.created_at) + '  <strong>Updated:</strong> ' + fmtDate(k.updated_at) + '\\n\\n' +
      esc(k.content) +
      '</div></td>';
  });

  detail.innerHTML = '<td colspan="8"><div class="content-full">Loading...</div></td>';
  tr.after(detail);
}

// --- Chunks ---
function renderChunkRows() {
  const tbody = document.getElementById('chunksBody');
  tbody.innerHTML = state.chunks.rows.map(r =>
    '<tr class="expandable" onclick="toggleChunk(this, ' + r.id + ')">' +
    '<td>' + r.id + '</td>' +
    '<td title="' + esc(r.session_id) + '">' + esc(truncate(r.session_id, 16)) + '</td>' +
    '<td>' + esc(truncate(r.source, 25)) + '</td>' +
    '<td>' + categoryBadge(r.category) + '</td>' +
    '<td class="content-preview">' + esc(truncate(r.content, 100)) + '</td>' +
    '<td>' + esc(r.tags || '') + '</td>' +
    '<td>' + fmtDate(r.created_at) + '</td></tr>'
  ).join('');
}
async function loadChunks() {
  const q = {
    search: document.getElementById('chunksSearch').value,
    category: document.getElementById('chunksCategory').value,
    tag: document.getElementById('chunksTag').value,
    session_id: document.getElementById('chunksSession').value,
    limit: PAGE_SIZE, offset: state.chunks.offset,
  };
  state.chunks.rows = await api('/api/chunks', q);
  state.chunks.sortCol = null;
  renderChunkRows();
  renderPagination('chunksPagination', state.chunks.rows.length, state.chunks, loadChunks);

  // Populate category filter
  const sel = document.getElementById('chunksCategory');
  if (sel.options.length <= 1) {
    const cats = await api('/api/stats');
    (cats.categories || []).forEach(c => { const o = document.createElement('option'); o.value = c.category; o.textContent = c.category + ' (' + c.count + ')'; sel.appendChild(o); });
  }

  // Populate tag filter
  const tagSel = document.getElementById('chunksTag');
  if (tagSel.options.length <= 1) {
    const stats = await api('/api/stats');
    (stats.top_tags || []).forEach(t => { const o = document.createElement('option'); o.value = t.tag; o.textContent = t.tag + ' (' + t.count + ')'; tagSel.appendChild(o); });
  }
}

// --- Chunk detail ---
function toggleChunk(tr, id) {
  const cid = 'detail-c-' + id;
  const existing = document.getElementById(cid);
  if (existing) { existing.remove(); return; }
  const detail = document.createElement('tr');
  detail.id = cid;
  detail.className = 'detail-row';
  detail.innerHTML = '<td colspan="7"><div class="content-full">Loading...</div></td>';
  tr.after(detail);

  fetch('/api/chunks/' + id).then(r => r.json()).then(c => {
    detail.querySelector('.content-full').innerHTML =
      '<strong>Session:</strong> ' + esc(c.session_id) + '\\n' +
      '<strong>Source:</strong> ' + esc(c.source) + '\\n' +
      '<strong>Category:</strong> ' + esc(c.category) + '\\n' +
      '<strong>Tags:</strong> ' + esc(c.tags || 'none') + '\\n' +
      '<strong>Created:</strong> ' + fmtDate(c.created_at) + '\\n' +
      (c.metadata ? '<strong>Metadata:</strong> ' + esc(c.metadata) + '\\n' : '') +
      '\\n' + esc(c.content);
  });
}

// --- Summaries ---
function renderSummaryRows() {
  const tbody = document.getElementById('summariesBody');
  tbody.innerHTML = state.summaries.rows.map(r =>
    '<tr class="expandable" onclick="toggleSummary(this, ' + r.id + ')">' +
    '<td title="' + esc(r.session_id) + '">' + esc(truncate(r.session_id, 20)) + '</td>' +
    '<td class="content-preview">' + esc(truncate(r.summary, 100)) + '</td>' +
    '<td>' + esc(r.model || '-') + '</td>' +
    '<td>' + fmtDate(r.created_at) + '</td></tr>'
  ).join('');
}
async function loadSummaries() {
  const q = {
    search: document.getElementById('summariesSearch').value,
    limit: PAGE_SIZE, offset: state.summaries.offset,
  };
  state.summaries.rows = await api('/api/summaries', q);
  state.summaries.sortCol = null;
  renderSummaryRows();
  renderPagination('summariesPagination', state.summaries.rows.length, state.summaries, loadSummaries);
}

function toggleSummary(tr, id) {
  const cid = 'detail-s-' + id;
  const existing = document.getElementById(cid);
  if (existing) { existing.remove(); return; }
  const row = state.summaries.rows.find(r => r.id === id);
  if (row) {
    const detail = document.createElement('tr');
    detail.id = cid;
    detail.className = 'detail-row';
    detail.innerHTML = '<td colspan="4"><div class="content-full">' + esc(row.summary) + '</div></td>';
    tr.after(detail);
  }
}

// --- Pagination ---
function renderPagination(containerId, rowCount, stateObj, loadFn) {
  const el = document.getElementById(containerId);
  const hasPrev = stateObj.offset > 0;
  const hasNext = rowCount >= PAGE_SIZE;
  el.innerHTML =
    '<button ' + (hasPrev ? '' : 'disabled') + ' onclick="this.paginatePrev && this.paginatePrev()">Prev</button>' +
    '<span class="info">Showing ' + (stateObj.offset + 1) + '-' + (stateObj.offset + rowCount) + '</span>' +
    '<button ' + (hasNext ? '' : 'disabled') + ' onclick="this.paginateNext && this.paginateNext()">Next</button>';

  const [prevBtn, , nextBtn] = el.children;
  prevBtn.paginatePrev = () => { stateObj.offset = Math.max(0, stateObj.offset - PAGE_SIZE); loadFn(); };
  nextBtn.paginateNext = () => { stateObj.offset += PAGE_SIZE; loadFn(); };
}

// --- Panel loader ---
// --- Memory ---
function renderMemoryRows() {
  const tbody = document.getElementById('memoryBody');
  tbody.innerHTML = state.memory.rows.map(r =>
    '<tr class="expandable" onclick="toggleMemory(this, \\'' + esc(r.file).replace(/'/g, "\\\\'") + '\\')">' +
    '<td>' + esc(r.name) + '</td>' +
    '<td>' + memoryTypeBadge(r.type) + '</td>' +
    '<td>' + esc(r.project) + '</td>' +
    '<td>' + esc(truncate(r.description, 60)) + '</td>' +
    '<td><a href="vscode://file/' + encodeURI(r.path.replace(/\\\\/g, '/')) + '" onclick="event.stopPropagation()" style="color:var(--accent);text-decoration:none;">' + esc(r.file) + '</a></td></tr>'
  ).join('');
}
function memoryTypeBadge(t) {
  const colors = { user: 'var(--accent)', feedback: 'var(--yellow)', project: 'var(--green)', reference: 'var(--purple)' };
  return '<span class="badge" style="background:var(--bg3);color:' + (colors[t] || 'var(--fg3)') + '">' + esc(t) + '</span>';
}
async function loadMemory() {
  const q = {
    search: document.getElementById('memorySearch').value,
    type: document.getElementById('memoryType').value,
    project: document.getElementById('memoryProject').value,
  };
  state.memory.rows = await api('/api/memory', q);
  state.memory.sortCol = null;
  renderMemoryRows();

  // Populate project filter
  const sel = document.getElementById('memoryProject');
  if (sel.options.length <= 1) {
    const projects = [...new Set(state.memory.rows.map(r => r.project))].sort();
    projects.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = p; sel.appendChild(o); });
  }
}
function toggleMemory(tr, file) {
  const cid = 'detail-m-' + file.replace(/[^a-zA-Z0-9]/g, '_');
  const existing = document.getElementById(cid);
  if (existing) { existing.remove(); return; }
  const row = state.memory.rows.find(r => r.file === file);
  if (!row) return;
  const detail = document.createElement('tr');
  detail.id = cid;
  detail.className = 'detail-row';
  detail.innerHTML = '<td colspan="5"><div class="content-full">' +
    '<strong>Name:</strong> ' + esc(row.name) + '\\n' +
    '<strong>Type:</strong> ' + esc(row.type) + '\\n' +
    '<strong>Project:</strong> ' + esc(row.project) + '\\n' +
    '<strong>Description:</strong> ' + esc(row.description) + '\\n' +
    '<strong>Path:</strong> <a href="vscode://file/' + encodeURI(row.path.replace(/\\\\/g, '/')) + '" style="color:var(--accent);">' + esc(row.path) + '</a>\\n\\n' +
    esc(row.body) + '</div></td>';
  tr.after(detail);
}

// --- Config ---
function scopeBadge(s) {
  const color = s === 'global' ? 'var(--orange)' : 'var(--green)';
  return '<span class="badge" style="background:var(--bg3);color:' + color + '">' + esc(s) + '</span>';
}
function renderConfigRows() {
  const tbody = document.getElementById('configBody');
  tbody.innerHTML = state.config.rows.map(r =>
    '<tr class="expandable" onclick="toggleConfig(this, \\'' + esc(r.path).replace(/'/g, "\\\\'").replace(/\\\\/g, '\\\\\\\\') + '\\')">' +
    '<td><a href="vscode://file/' + encodeURI(r.path.replace(/\\\\/g, '/')) + '" onclick="event.stopPropagation()" style="color:var(--accent);text-decoration:none;">' + esc(r.name) + '</a></td>' +
    '<td>' + scopeBadge(r.scope) + '</td>' +
    '<td>' + esc(r.project) + '</td>' +
    '<td>' + fmtBytes(r.size) + '</td>' +
    '<td>' + fmtDate(r.modified) + '</td></tr>'
  ).join('');
}
async function loadConfig() {
  const q = {
    search: document.getElementById('configSearch').value,
    scope: document.getElementById('configScope').value,
    type: document.getElementById('configType').value,
  };
  // Use a separate param name to avoid conflict with memory type filter
  const params = { search: q.search, scope: q.scope };
  if (q.type) params.type = q.type;
  state.config.rows = await api('/api/config', params);
  state.config.sortCol = null;
  renderConfigRows();
}
function toggleConfig(tr, path) {
  const cid = 'detail-cfg-' + path.replace(/[^a-zA-Z0-9]/g, '_');
  const existing = document.getElementById(cid);
  if (existing) { existing.remove(); return; }
  const row = state.config.rows.find(r => r.path === path);
  if (!row) return;
  const detail = document.createElement('tr');
  detail.id = cid;
  detail.className = 'detail-row';
  detail.innerHTML = '<td colspan="5"><div class="content-full" style="max-height:600px;">' +
    '<div style="margin-bottom:8px;">' + scopeBadge(row.scope) + ' <a href="vscode://file/' + encodeURI(row.path.replace(/\\\\/g, '/')) + '" style="color:var(--accent);">Open in VS Code</a></div>' +
    esc(row.content) + '</div></td>';
  tr.after(detail);
}

function loadPanel(name) {
  if (name === 'overview') loadOverview();
  else if (name === 'sessions') loadSessions();
  else if (name === 'knowledge') loadKnowledge();
  else if (name === 'chunks') loadChunks();
  else if (name === 'summaries') loadSummaries();
  else if (name === 'memory') loadMemory();
  else if (name === 'config') loadConfig();
}

// --- Debounced search ---
function debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

document.getElementById('sessionsSearch').addEventListener('input', debounce(() => { state.sessions.offset = 0; loadSessions(); }));
document.getElementById('knowledgeSearch').addEventListener('input', debounce(() => { state.knowledge.offset = 0; loadKnowledge(); }));
document.getElementById('knowledgeMaturity').addEventListener('change', () => { state.knowledge.offset = 0; loadKnowledge(); });
document.getElementById('knowledgeSource').addEventListener('change', () => { state.knowledge.offset = 0; loadKnowledge(); });
document.getElementById('chunksSearch').addEventListener('input', debounce(() => { state.chunks.offset = 0; loadChunks(); }));
document.getElementById('chunksCategory').addEventListener('change', () => { state.chunks.offset = 0; loadChunks(); });
document.getElementById('chunksTag').addEventListener('change', () => { state.chunks.offset = 0; loadChunks(); });
document.getElementById('chunksSession').addEventListener('input', debounce(() => { state.chunks.offset = 0; loadChunks(); }));
document.getElementById('summariesSearch').addEventListener('input', debounce(() => { state.summaries.offset = 0; loadSummaries(); }));
document.getElementById('memorySearch').addEventListener('input', debounce(() => loadMemory()));
document.getElementById('memoryType').addEventListener('change', () => loadMemory());
document.getElementById('memoryProject').addEventListener('change', () => loadMemory());
document.getElementById('configSearch').addEventListener('input', debounce(() => loadConfig()));
document.getElementById('configScope').addEventListener('change', () => loadConfig());
document.getElementById('configType').addEventListener('change', () => loadConfig());

// --- Init ---
loadOverview();
</script>
</body>
</html>`;
}

// --- HTTP Server ---

const routes = {
  "/api/stats": () => {
    const stats = getStats();
    // Override dbSize since we imported statSync
    try { stats.db_size_bytes = statSync(KB_PATH).size; } catch {}
    stats.db_path = KB_PATH;
    return stats;
  },
  "/api/sessions": (q) => getSessions(q),
  "/api/knowledge": (q) => getKnowledge(q),
  "/api/chunks": (q) => getChunks(q),
  "/api/summaries": (q) => getSummaries(q),
  "/api/memory": (q) => scanMemories(q),
  "/api/config": (q) => scanConfig(q),
};

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;

  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Detail endpoints: /api/knowledge/:id and /api/chunks/:id
  const knowledgeMatch = path.match(/^\/api\/knowledge\/(\d+)$/);
  if (knowledgeMatch) {
    const id = parseInt(knowledgeMatch[1], 10);
    const row = db.prepare("SELECT * FROM knowledge WHERE id = ?").get(id);
    res.writeHead(row ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(row || { error: "not found" }));
    return;
  }

  const chunkMatch = path.match(/^\/api\/chunks\/(\d+)$/);
  if (chunkMatch) {
    const id = parseInt(chunkMatch[1], 10);
    const row = db.prepare("SELECT c.*, GROUP_CONCAT(t.tag) as tags FROM chunks c LEFT JOIN tags t ON t.chunk_id = c.id WHERE c.id = ? GROUP BY c.id").get(id);
    res.writeHead(row ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(row || { error: "not found" }));
    return;
  }

  if (routes[path]) {
    const q = parseQuery(req.url);
    try {
      const data = routes[path](q);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (path === "/" || path === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getHTML());
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n  Knowledge DB Dashboard`);
  console.log(`  DB:   ${KB_PATH}`);
  console.log(`  URL:  http://localhost:${PORT}\n`);
});
