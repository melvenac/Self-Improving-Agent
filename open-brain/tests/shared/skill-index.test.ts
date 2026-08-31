import { describe, it, expect } from "vitest";
import { parseSkillIndexRows, parseSkillDomains, countSkills } from "../../src/shared/skill-index.js";

const HEADER =
  "| Name | File | Domain | Problem Class | Source Project | Version |\n"
  + "|---|---|---|---|---|---|\n";

const index = (rows: string) => `# Skill Index\n\n## Skills\n\n${HEADER}${rows}`;

/**
 * Regression cover for the silent-drop bug: skillRows() `continue`d past any
 * row it could not parse, so a mangled row made a registered skill invisible
 * to graduation and its cluster re-proposed forever — a corrupted index was
 * indistinguishable from an empty one. Dropped rows are now reported.
 */
describe("parseSkillIndexRows", () => {
  it("parses well-formed rows and reports nothing dropped", () => {
    const { rows, dropped } = parseSkillIndexRows(index(
      "| Docker VPS Deployment | `docker.md` | docker, traefik | deployment | Mail Server | 1.0 |\n"
      + "| Convex Patterns | `convex.md` | convex | data-modeling | Open Brain | 1.0 |\n",
    ));
    expect(rows).toHaveLength(2);
    expect(dropped).toHaveLength(0);
  });

  it("reports a row with too few cells as dropped, not skipped", () => {
    const { rows, dropped } = parseSkillIndexRows(index(
      "| Docker VPS Deployment | `docker.md` |\n",
    ));
    expect(rows).toHaveLength(0);
    expect(dropped).toEqual(["| Docker VPS Deployment | `docker.md` |"]);
  });

  it("reports a row with an empty Domain cell as dropped", () => {
    const { rows, dropped } = parseSkillIndexRows(index(
      "| Docker VPS Deployment | `docker.md` |  | deployment | Mail Server | 1.0 |\n",
    ));
    expect(rows).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it("reports a row with a --- placeholder Domain as dropped", () => {
    const { rows, dropped } = parseSkillIndexRows(index(
      "| Docker VPS Deployment | `docker.md` | --- | deployment | Mail Server | 1.0 |\n",
    ));
    expect(rows).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it("does not count the header or separator as dropped", () => {
    const { rows, dropped } = parseSkillIndexRows(index(""));
    expect(rows).toHaveLength(0);
    expect(dropped).toHaveLength(0);
  });

  it("tolerates alignment-style separators (|:---|---:|)", () => {
    const content = "## Skills\n\n"
      + "| Name | File | Domain | Problem Class | Source Project | Version |\n"
      + "|:---|:---:|---:|---|---|---|\n"
      + "| Convex Patterns | `convex.md` | convex | data-modeling | Open Brain | 1.0 |\n";
    const { rows, dropped } = parseSkillIndexRows(content);
    expect(rows).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it("returns empty for content with no Skills section", () => {
    expect(parseSkillIndexRows("# Nothing here\n")).toEqual({ rows: [], dropped: [] });
  });

  it("mixes parsed and dropped rows in one table", () => {
    const { rows, dropped } = parseSkillIndexRows(index(
      "| Convex Patterns | `convex.md` | convex | data-modeling | Open Brain | 1.0 |\n"
      + "| Broken Row | `broken.md` |\n",
    ));
    expect(rows).toHaveLength(1);
    expect(dropped).toHaveLength(1);
  });
});

describe("parseSkillDomains / countSkills over the new parser", () => {
  it("still graduates every tag of a multi-domain cell", () => {
    const domains = parseSkillDomains(index(
      "| Docker VPS Deployment | `docker.md` | docker, traefik | deployment | Mail Server | 1.0 |\n",
    ));
    expect(domains).toEqual(new Set(["docker", "traefik"]));
  });

  it("counts only rows that actually parsed", () => {
    const count = countSkills(index(
      "| Convex Patterns | `convex.md` | convex | data-modeling | Open Brain | 1.0 |\n"
      + "| Broken Row | `broken.md` |\n",
    ));
    expect(count).toBe(1);
  });
});
