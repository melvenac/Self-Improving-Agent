import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gitShow } from "../../src/pipelines/session-start/git-read.js";
import { resolveRecordSource } from "../../src/pipelines/session-start/record-source.js";

/**
 * A role file's text from the SAME source the greeting composed it from (T-200).
 *
 * `composeGreeting` renders the record AND the role files from origin/master when this tree's
 * record is behind master's, and from the working tree otherwise. A test that compares the
 * greeting against the WORKING TREE's role file is right only while the two agree: on a behind
 * checkout whose role files differ from master's it goes red although nothing is wrong. This
 * asks `resolveRecordSource`, the function the composition asked, and reads the file from there.
 *
 * Throws rather than returning "", so a test can never pass by comparing against nothing.
 */
export function roleFileFromGreetingSource(root: string, rel: string): { text: string; from: string } {
  const src = resolveRecordSource(root);
  if (src.kind === "master") {
    const shown = gitShow(root, src.upstreamRef, rel);
    if (!shown.ok) throw new Error(`${rel} is not readable at ${src.upstreamRef}: ${shown.cause}`);
    return { text: shown.text.replace(/\s+$/, ""), from: src.upstreamRef };
  }
  return { text: readFileSync(join(root, rel), "utf-8").replace(/\s+$/, ""), from: "the working tree" };
}
