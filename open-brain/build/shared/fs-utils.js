import { readFileSync, writeFileSync, existsSync } from "node:fs";
export function readJson(path) {
    if (!existsSync(path))
        return null;
    return JSON.parse(readFileSync(path, "utf-8"));
}
export function readText(path) {
    if (!existsSync(path))
        return null;
    return readFileSync(path, "utf-8");
}
export function writeText(path, content) {
    writeFileSync(path, content, "utf-8");
}
export function fileExists(path) {
    return existsSync(path);
}
//# sourceMappingURL=fs-utils.js.map