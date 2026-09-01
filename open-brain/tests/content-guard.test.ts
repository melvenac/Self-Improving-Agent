import { describe, it, expect } from "vitest";
import {
  findToolCallScaffolding,
  stripToolCallScaffolding,
  recoverSwallowedTags,
  scaffoldRejectionMessage,
} from "../src/shared/content-guard.js";

/**
 * Eight entries were stored on 2026-08-31 with their body running past its own
 * close and swallowing the next argument. Four lost their tags to it, and the
 * scaffolding reached the DB `content` column, so it was searchable in FTS.
 *
 * The markers are ASSEMBLED here rather than written as literals for the same
 * reason they are in the guard: writing them verbatim makes this file look like
 * a leaked tool call to anything that reads it.
 */
const TAG = "parameter";
const CLOSE = ">";
const CONTENT_CLOSE = `</content${CLOSE}`;
const PARAM_OPEN = `<${TAG} name=`;

const corrupted =
  "Related: both are about not trusting an instrument's output." +
  CONTENT_CLOSE +
  "\n" +
  `${PARAM_OPEN}"tags"${CLOSE}["methodology", "measurement", "open-brain", "census", "era-split"]`;

describe("findToolCallScaffolding", () => {
  it("finds a body that ran past its close", () => {
    const found = findToolCallScaffolding(corrupted);
    expect(found).not.toBeNull();
    expect(found!.marker).toBe(CONTENT_CLOSE);
  });

  it("passes clean prose", () => {
    expect(findToolCallScaffolding("A perfectly ordinary note about databases.")).toBeNull();
  });

  it("does not fire on a note that legitimately discusses HTML", () => {
    // The reason the markers are narrow. A bare `</` would match nearly every
    // note in this vault, which is how the first scan of this bug reported 102
    // affected files when the real number was 8.
    const html = "Close the element with </div> and the section with </section>.";
    expect(findToolCallScaffolding(html)).toBeNull();
  });

  it("reports the earliest marker when several are present", () => {
    const text = `body${CONTENT_CLOSE} then ${PARAM_OPEN}"tags"${CLOSE}[]`;
    expect(findToolCallScaffolding(text)!.index).toBe("body".length);
  });
});

describe("recoverSwallowedTags", () => {
  // The intended tags exist ONLY inside the corrupted text — the row carries
  // the wrong ones. Stripping before extracting destroys them permanently,
  // which is why extraction has to come first.
  it("recovers the tags the author actually intended", () => {
    expect(recoverSwallowedTags(corrupted)).toEqual([
      "methodology", "measurement", "open-brain", "census", "era-split",
    ]);
  });

  it("returns null when the leak captured no tag array", () => {
    expect(recoverSwallowedTags(`some body${CONTENT_CLOSE}`)).toBeNull();
  });

  it("returns null rather than throwing on malformed JSON", () => {
    expect(recoverSwallowedTags(`body${PARAM_OPEN}"tags"${CLOSE}[not json`)).toBeNull();
  });
});

describe("stripToolCallScaffolding", () => {
  it("keeps everything before the marker and drops the rest", () => {
    expect(stripToolCallScaffolding(corrupted))
      .toBe("Related: both are about not trusting an instrument's output.");
  });

  it("leaves clean content untouched apart from trailing space", () => {
    expect(stripToolCallScaffolding("clean note\n")).toBe("clean note");
  });

  it("never empties a note that had real content before the marker", () => {
    expect(stripToolCallScaffolding(corrupted).length).toBeGreaterThan(0);
  });
});

describe("scaffoldRejectionMessage", () => {
  it("names the marker and says the tags did not arrive either", () => {
    const msg = scaffoldRejectionMessage(findToolCallScaffolding(corrupted)!);
    expect(msg).toContain("Refused");
    expect(msg).toContain("Nothing was stored");
    // The load-bearing half: a caller told only "bad content" would strip it and
    // retry, still silently missing the tags.
    expect(msg).toContain("tags");
  });
});
