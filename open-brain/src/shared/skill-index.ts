/**
 * Readers for SKILL-INDEX.md, the vault's registry of distilled skills.
 *
 * Two call sites parsed this file independently and both parsed it wrong: they
 * matched `### tag (N experiences) … has skill`, which is the shape of
 * SKILL-CANDIDATES.md, not the index. Graduation detection and the protocol
 * health score therefore reported "no skills exist" no matter what the file
 * said. Keeping the format in one place is what stops the two readers drifting
 * apart again — the same reasoning as obsidianVaultDir() in paths.ts.
 *
 * The file's shape:
 *
 *   ## Skills
 *   | Name | File | Domain | Problem Class | Source Project | Version |
 *   |---|---|---|---|---|---|
 *   | Docker VPS Deployment | `docker.md` | docker, traefik | deployment | … |
 *
 *   ## Pending Proposals
 *   | Proposed Skill | Related Experiences | Domain | Status |
 */

/**
 * The body of the `## Skills` section, or null when absent.
 *
 * Split rather than a lookahead: JavaScript has no `\z`, so `(?=^##\s|\z)`
 * silently degrades to "or a literal z" and fails to terminate a trailing
 * section — the exact bug this replaced.
 */
function skillsSection(content: string): string | null {
  for (const block of content.split(/^##[ \t]+/m).slice(1)) {
    const [heading, ...body] = block.split("\n");
    if (heading.trim() === "Skills") return body.join("\n");
  }
  return null;
}

/** Table rows under `## Skills`, header and separator rows excluded. */
function skillRows(content: string): string[][] {
  const section = skillsSection(content);
  if (section === null) return [];

  const rows: string[][] = [];
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    // ['', Name, File, Domain, ProblemClass, SourceProject, Version, '']
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const domain = cells[3] ?? "";
    if (!domain || /^-+$/.test(domain) || domain.toLowerCase() === "domain") continue;
    rows.push(cells);
  }
  return rows;
}

/**
 * Domain tags that already have a skill, lowercased.
 *
 * Callers compare these against a cluster's tag, so the Domain column is what
 * matters, not the human-facing Name. A cell may list several tags
 * (`docker, traefik`) and each one graduates. Only the `## Skills` section
 * counts: `## Pending Proposals` has a Domain column too, and reading it would
 * graduate candidates that were merely proposed.
 */
export function parseSkillDomains(content: string): Set<string> {
  const domains = new Set<string>();
  for (const cells of skillRows(content)) {
    for (const tag of cells[3].split(",")) {
      const clean = tag.trim().toLowerCase();
      if (clean) domains.add(clean);
    }
  }
  return domains;
}

/** Number of skills registered in the index. */
export function countSkills(content: string): number {
  return skillRows(content).length;
}
