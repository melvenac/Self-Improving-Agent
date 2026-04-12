// Category 1: Config & Structure (25 pts max)
// Formula: round((passed + warnings*0.5) / total * 25)
// "fixed" counts as "passed" (same credit)
export function scoreConfigStructure(checks) {
    if (checks.length === 0) {
        return { name: "Config & Structure", score: 0, max: 25, details: { passed: 0, warned: 0, failed: 0 } };
    }
    let passed = 0;
    let warned = 0;
    let failed = 0;
    for (const check of checks) {
        if (check.severity === "pass" || check.severity === "fixed") {
            passed++;
        }
        else if (check.severity === "warn") {
            warned++;
        }
        else {
            failed++;
        }
    }
    const score = Math.round((passed + warned * 0.5) / checks.length * 25);
    return {
        name: "Config & Structure",
        score,
        max: 25,
        details: { passed, warned, failed },
    };
}
// Category 2: Knowledge Quality (25 pts max)
// Precision (10 pts): (helpful / (helpful+harmful+neutral)) * 10
// Coverage (8 pts): (ratedEntries / totalEntries) * 8
// Dedup (7 pts): 7 - min(duplicateClusters * 2, 7)
export function scoreKnowledgeQuality(input) {
    const { helpful, harmful, neutral, totalEntries, ratedEntries, duplicateClusters } = input;
    const totalRated = helpful + harmful + neutral;
    const precision = totalRated > 0 ? (helpful / totalRated) * 10 : 0;
    const coverage = totalEntries > 0 ? (ratedEntries / totalEntries) * 8 : 0;
    const dedup = 7 - Math.min(duplicateClusters * 2, 7);
    const score = Math.round(precision + coverage + dedup);
    return {
        name: "Knowledge Quality",
        score,
        max: 25,
        details: { precision: Math.round(precision * 10) / 10, coverage: Math.round(coverage * 10) / 10, dedup },
    };
}
// Category 3: Staleness (20 pts max)
// Stale (10 pts): round((1 - min(staleRatio*2, 1)) * 10)
// Low success (5 pts): max(0, 5 - lowSuccessCount)
// Summary gap (5 pts): (summarizedSessions / eligibleSessions) * 5
export function scoreStaleness(input) {
    const { staleRatio, lowSuccessCount, summarizedSessions, eligibleSessions } = input;
    const stale = Math.round((1 - Math.min(staleRatio * 2, 1)) * 10);
    const lowSuccess = Math.max(0, 5 - lowSuccessCount);
    const summaryGap = eligibleSessions > 0 ? (summarizedSessions / eligibleSessions) * 5 : 5;
    const score = Math.round(stale + lowSuccess + summaryGap);
    return {
        name: "Staleness",
        score,
        max: 20,
        details: { stale, lowSuccess, summaryGap: Math.round(summaryGap * 10) / 10 },
    };
}
// Category 4: Coverage (20 pts max)
// Domain (10 pts): (domainsWithEntries / totalDomains) * 10
// Maturity (5 pts): round(min((matureCount + provenCount*0.5) / totalEntries * 2, 1) * 5)
// Skill conversion (5 pts): round(min(skillsImplemented / proposalClusters * 2, 1) * 5)
export function scoreCoverage(input) {
    const { domainsWithEntries, totalDomains, matureCount, provenCount, totalEntries, skillsImplemented, proposalClusters } = input;
    const domain = totalDomains > 0 ? (domainsWithEntries / totalDomains) * 10 : 0;
    const maturity = totalEntries > 0
        ? Math.round(Math.min((matureCount + provenCount * 0.5) / totalEntries * 2, 1) * 5)
        : 0;
    const skillConversion = proposalClusters > 0
        ? Math.round(Math.min(skillsImplemented / proposalClusters * 2, 1) * 5)
        : 5;
    const score = Math.round(domain + maturity + skillConversion);
    return {
        name: "Coverage",
        score,
        max: 20,
        details: { domain: Math.round(domain * 10) / 10, maturity, skillConversion },
    };
}
// Category 5: Pipeline Health (10 pts max)
// Hook recency (4 pts): ≤24h → 4, ≤7d → 2, else 0
// Score trend (3 pts): improving → 3, stable → 2, declining → 1, unknown → 0
// Shadow-recall (3 pts): ≤7d → 3, stale → 1, null → 0
export function scorePipelineHealth(input) {
    const { lastHookRun, scoreTrend, lastShadowRecall } = input;
    const now = Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    const d7 = 7 * 24 * 60 * 60 * 1000;
    let hookRecency = 0;
    if (lastHookRun !== null) {
        const age = now - new Date(lastHookRun).getTime();
        hookRecency = age <= h24 ? 4 : age <= d7 ? 2 : 0;
    }
    const trendScore = scoreTrend === "improving" ? 3 :
        scoreTrend === "stable" ? 2 :
            scoreTrend === "declining" ? 1 : 0;
    let shadowScore = 0;
    if (lastShadowRecall !== null) {
        const age = now - new Date(lastShadowRecall).getTime();
        shadowScore = age <= d7 ? 3 : 1;
    }
    const score = hookRecency + trendScore + shadowScore;
    return {
        name: "Pipeline Health",
        score,
        max: 10,
        details: { hookRecency, trendScore, shadowScore },
    };
}
//# sourceMappingURL=scorer.js.map