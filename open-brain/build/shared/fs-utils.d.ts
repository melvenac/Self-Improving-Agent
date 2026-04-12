export declare function readJson<T = unknown>(path: string): T | null;
export declare function readText(path: string): string | null;
export declare function writeText(path: string, content: string): void;
export declare function fileExists(path: string): boolean;
