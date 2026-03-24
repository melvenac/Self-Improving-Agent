/**
 * Auto-extract tags from chunk content.
 * Pure regex-based extraction — no external dependencies.
 */

const TECH_KEYWORDS = new Set([
  // Languages
  "typescript", "javascript", "python", "rust", "go", "java", "ruby", "php", "sql", "html", "css",
  // Frameworks & Libraries
  "react", "nextjs", "next", "vue", "angular", "svelte", "express", "fastify", "hono",
  "tailwind", "shadcn", "radix", "prisma", "drizzle",
  // Databases & backends
  "convex", "supabase", "firebase", "postgres", "postgresql", "mysql", "sqlite", "mongodb", "redis",
  // Auth & payments
  "clerk", "auth0", "stripe", "paypal",
  // AI & ML
  "claude", "openai", "anthropic", "gpt", "gemini", "grok", "llm", "mcp", "embeddings",
  // Infra & tools
  "docker", "kubernetes", "traefik", "nginx", "vercel", "cloudflare", "aws", "github", "git",
  "node", "npm", "bun", "pnpm", "yarn", "vite", "webpack", "turbopack", "esbuild",
  // Protocols & formats
  "json", "yaml", "toml", "graphql", "rest", "websocket", "http", "grpc",
  // Testing
  "jest", "vitest", "playwright", "cypress",
  // Other
  "livekit", "twilio", "notion", "linear",
]);

const TOOL_NAMES = new Set([
  "read", "write", "edit", "bash", "grep", "glob", "agent",
  "webfetch", "websearch", "notebookedit", "notebookread",
  "taskwrite", "todowrite",
]);

const ERROR_PATTERNS = [
  /\b(TypeError|ReferenceError|SyntaxError|RangeError|URIError)\b/g,
  /\b(ENOENT|EPERM|EACCES|EEXIST|EISDIR|ENOTDIR|EMFILE|ECONNREFUSED|ETIMEDOUT)\b/g,
  /\b(ERR_[A-Z_]+)\b/g,
];

const FILE_EXT_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go|java|rb|php|sql|md|json|yaml|yml|toml|css|scss|html|svg|sh|bash|env|lock|prisma|graphql|proto)\b/g;

export function extractTags(content: string, category: string, source: string): string[] {
  const tags = new Set<string>();

  // Add category as a tag
  tags.add(category);

  // Extract tech keywords
  const lowerContent = content.toLowerCase();
  for (const keyword of TECH_KEYWORDS) {
    // Word boundary check using regex
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(lowerContent)) {
      tags.add(keyword);
    }
  }

  // Extract tool names from source/content
  const lowerSource = source.toLowerCase();
  for (const tool of TOOL_NAMES) {
    if (lowerSource.includes(tool) || lowerContent.includes(`tool: ${tool}`) || lowerContent.includes(`"${tool}"`)) {
      tags.add(`tool:${tool}`);
    }
  }

  // Extract error types
  for (const pattern of ERROR_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      tags.add(`error:${match[1].toLowerCase()}`);
    }
  }

  // Extract file extensions
  FILE_EXT_PATTERN.lastIndex = 0;
  let extMatch;
  while ((extMatch = FILE_EXT_PATTERN.exec(content)) !== null) {
    tags.add(`ext:${extMatch[1]}`);
  }

  return Array.from(tags);
}
