import { readFileSync, appendFileSync, existsSync } from "node:fs";
export function appendScore(historyPath, score) {
    const entry = {
        total: score.total,
        categories: Object.fromEntries(score.categories.map((c) => [c.name, c.score])),
        date: score.date,
    };
    appendFileSync(historyPath, JSON.stringify(entry) + "\n", "utf-8");
}
export function readHistory(historyPath) {
    if (!existsSync(historyPath))
        return [];
    const content = readFileSync(historyPath, "utf-8").trim();
    if (!content)
        return [];
    return content.split("\n").map((line) => JSON.parse(line));
}
export function calculateTrend(entries) {
    if (entries.length < 2)
        return "unknown";
    const recent = entries.slice(-5);
    const first = recent[0].total;
    const last = recent[recent.length - 1].total;
    const diff = last - first;
    if (diff >= 3)
        return "improving";
    if (diff <= -3)
        return "declining";
    return "stable";
}
//# sourceMappingURL=history.js.map