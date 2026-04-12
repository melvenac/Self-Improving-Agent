import { indexSessionChunks } from "./chunk-indexer.js";
import type { SessionFile } from "./chunk-indexer.js";
import { autoFeedback } from "./auto-feedback.js";
import { syncFrontmatter } from "./frontmatter-sync.js";
import { scanForSkills } from "./skill-scan.js";
import type { ExperienceFile } from "./skill-scan.js";
import type {
  SessionEndOptions,
  SessionEndResult,
  ChunkStore,
  KnowledgeStore,
  FrontmatterField,
} from "./types.js";

export type { SessionFile } from "./chunk-indexer.js";
export type { ExperienceFile } from "./skill-scan.js";

export interface SessionEndInput {
  options: SessionEndOptions;
  sessionSummary: string;
  sessionFiles: SessionFile[];
  experienceFiles: ExperienceFile[];
  previousSkillCounts: Map<string, number>;
  chunkStore: ChunkStore;
  knowledgeStore: KnowledgeStore;
  vaultExperiencesPath: string;
  readVaultFile: (path: string) => string | null;
  writeVaultFile: (path: string, content: string) => void;
}

export function sessionEnd(input: SessionEndInput): SessionEndResult {
  const { options } = input;

  // Stage 1: Index session chunks
  const chunks = indexSessionChunks(
    input.sessionFiles,
    input.chunkStore,
    options.projectRoot
  );

  // Stage 2: Auto-feedback on recalled entries
  const feedback = autoFeedback(
    options.recalledEntryIds,
    input.sessionSummary,
    input.knowledgeStore
  );

  // Stage 3: Frontmatter sync (skipped in dry-run)
  let frontmatter: SessionEndResult["frontmatter"];
  if (options.dryRun) {
    frontmatter = { filesUpdated: 0, filesSkipped: 0, errors: [] };
  } else {
    const getCounters = (id: number): FrontmatterField | null => {
      const counters = input.knowledgeStore.getEntryCounters(id);
      if (counters === null) return null;
      return {
        helpful_count: counters.helpful_count,
        harmful_count: counters.harmful_count,
        success_rate: counters.success_rate,
        maturity: counters.maturity,
        recall_count: counters.recall_count,
      };
    };

    frontmatter = syncFrontmatter(
      feedback.ratings,
      input.vaultExperiencesPath,
      input.readVaultFile,
      input.writeVaultFile,
      getCounters
    );
  }

  // Stage 4: Skill scan
  const skills = scanForSkills(
    input.experienceFiles,
    input.previousSkillCounts
  );

  return { chunks, feedback, frontmatter, skills };
}
