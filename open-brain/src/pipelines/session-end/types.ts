export interface SessionEndOptions {
  projectRoot: string;
  homePath: string;
  sessionId: string | null;
  recalledEntryIds: number[];
  dryRun?: boolean;
}

export type FeedbackRating = "helpful" | "harmful" | "neutral";

export interface ChunkIndexResult {
  sessionsIndexed: number;
  chunksCreated: number;
  errors: string[];
}

export interface FeedbackResult {
  entryId: number;
  key: string;
  rating: FeedbackRating;
  maturityBefore: string;
  maturityAfter: string;
  apoptosis: boolean;
}

export interface AutoFeedbackResult {
  processed: number;
  ratings: FeedbackResult[];
  errors: string[];
}

export interface FrontmatterField {
  helpful_count: number;
  harmful_count: number;
  success_rate: number;
  maturity: string;
  recall_count: number;
}

export interface FrontmatterSyncResult {
  filesUpdated: number;
  filesSkipped: number;
  errors: string[];
}

export interface SkillCluster {
  tag: string;
  count: number;
  files: string[];
  status: "new" | "growing" | "stable" | "approaching";
  consolidatedFrom?: string[];
}

export interface SkillScanResult {
  clusters: SkillCluster[];
  pendingProposals: number;
  approaching: number;
}

export interface SessionEndResult {
  chunks: ChunkIndexResult;
  feedback: AutoFeedbackResult;
  frontmatter: FrontmatterSyncResult;
  skills: SkillScanResult;
}

// --- Dependency injection interfaces ---

export interface ChunkRow {
  session_id: string;
  source: string;
  category: string;
  content: string;
  metadata: string; // JSON string
  project_dir: string;
}

export interface KnowledgeEntry {
  id: number;
  key: string;
  content: string;
  tags: string;
  helpful_count: number;
  harmful_count: number;
  neutral_count: number;
  success_rate: number;
  maturity: string;
  recall_count: number;
  source: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  db_file: string;
  project_dir: string;
  started_at: string;
  ended_at: string;
  event_count: number;
}

export interface ChunkStore {
  insertChunk(chunk: ChunkRow): void;
  insertSession(session: SessionRow): void;
  getIndexedSessionFiles(): string[];
}

export interface KnowledgeStore {
  getEntry(id: number): KnowledgeEntry | null;
  updateFeedback(id: number, rating: FeedbackRating): void;
  getEntryCounters(id: number): Pick<KnowledgeEntry, "helpful_count" | "harmful_count" | "neutral_count" | "success_rate" | "maturity" | "recall_count"> | null;
}
