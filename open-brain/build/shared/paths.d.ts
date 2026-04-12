export interface ResolvedPaths {
    projectRoot: string;
    packageJson: string;
    readme: string;
    changelog: string;
    claudeMd: string;
    prd: string;
    knowledgeMcpPackageJson: string;
    settingsJson: string;
    obsidianVault: string;
    knowledgeDb: string;
    scoreHistory: string;
    projectTemplate: string;
    hooksDir: string;
}
export declare function resolvePaths(projectRoot: string): ResolvedPaths;
