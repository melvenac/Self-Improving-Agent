import type { ScoreResult, ScoreHistoryEntry } from "./types.js";
export declare function appendScore(historyPath: string, score: ScoreResult): void;
export declare function readHistory(historyPath: string): ScoreHistoryEntry[];
export declare function calculateTrend(entries: ScoreHistoryEntry[]): "improving" | "stable" | "declining" | "unknown";
