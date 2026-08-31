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

/** Parse result distinguishing rows that parsed from rows that could not. */
export interface SkillIndexRows {
  /** Data rows under `## Skills`, cells split and trimmed. */
  rows: string[][];
  /**
   * Lines that sit in the table but yield no skill: too few cells, or an empty
   * Domain cell. A skill on such a line is registered in prose but invisible to
   * graduation, so its cluster re-proposes forever — the caller must surface
   * these, never absorb them.
   */
  dropped: string[];
}

/**
 * Table rows under `## Skills`.
 *
 * Header and separator rows are structure, not data — skipping them is parsing.
 * Everything else that fails to yield a domain is a malformed data row and goes
 * to `dropped`: the previous version `continue`d past those, and a mangled row
 * (a lost pipe, a blanked cell) read exactly like an empty index.
 */
export function parseSkillIndexRows(content: string): SkillIndexRows {
  const section = skillsSection(content);
  if (section === null) return { rows: [], dropped: [] };

  const rows: string[][] = [];
  const dropped: string[] = [];
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    // ['', Name, File, Domain, ProblemClass, SourceProject, Version, '']
    const cells = line.split("|").map((c) => c.trim());
    const filled = cells.filter(Boolean);
    // Separator rows (`|---|---|`) can have any width; a lone `|` is no row at all.
    if (filled.every((c) => /^:?-+:?$/.test(c))) continue;
    // The header is identified by Domain sitting in its column. A header whose
    // columns moved would land in `dropped` — which is the right report, since
    // every data row under it is then misread too.
    if (cells[3]?.toLowerCase() === "domain") continue;
    const domain = cells.length >= 5 ? cells[3] : "";
    // No domain, or a `---` placeholder where one belongs: nothing graduates
    // from this row, so it is dropped — and must be reported as such.
    if (!domain || /^:?-+:?$/.test(domain)) {
      dropped.push(line.trim());
      continue;
    }
    rows.push(cells);
  }
  return { rows, dropped };
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
  for (const cells of parseSkillIndexRows(content).rows) {
    for (const tag of cells[3].split(",")) {
      const clean = tag.trim().toLowerCase();
      if (clean) domains.add(clean);
    }
  }
  return domains;
}

/** Number of skills registered in the index. */
export function countSkills(content: string): number {
  return parseSkillIndexRows(content).rows.length;
}
