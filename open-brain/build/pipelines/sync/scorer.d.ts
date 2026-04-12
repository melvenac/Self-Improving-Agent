import type { CheckResult, CategoryScore } from "./types.js";
export interface KnowledgeQualityInput {
    helpful: number;
    harmful: number;
    neutral: number;
    totalEntries: number;
    ratedEntries: number;
    duplicateClusters: number;
}
export interface StalenessInput {
    staleRatio: number;
    lowSuccessCount: number;
    summarizedSessions: number;
    eligibleSessions: number;
}
export interface CoverageInput {
    domainsWithEntries: number;
    totalDomains: number;
    matureCount: number;
    provenCount: number;
    totalEntries: number;
    skillsImplemented: number;
    proposalClusters: number;
}
export interface PipelineHealthInput {
    lastHookRun: string | null;
    scoreTrend: "improving" | "stable" | "declining" | "unknown";
    lastShadowRecall: string | null;
}
export declare function scoreConfigStructure(checks: CheckResult[]): CategoryScore;
export declare function scoreKnowledgeQuality(input: KnowledgeQualityInput): CategoryScore;
export declare function scoreStaleness(input: StalenessInput): CategoryScore;
export declare function scoreCoverage(input: CoverageInput): CategoryScore;
export declare function scorePipelineHealth(input: PipelineHealthInput): CategoryScore;
