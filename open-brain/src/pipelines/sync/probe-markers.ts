import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { CheckResult } from "./types.js";

const PHRASE = "not for merge";
const TESTS_REL = "open-brain/tests";
const LIMIT = 'LIMIT: the literal phrase "not for merge" under open-brain/tests only. A probe worded any other way is not seen. A directory symlink is not followed. docs/loops is not walked.';

function relPosix(root: string, abs: string): string {
  return relative(root, abs).replace(/\\/g, "/");
}

/**
 * A file under open-brain/tests that still says it is not for merge is an
 * issue. QA probes with that mark reached master and failed Windows CI.
 */
export function checkProbeMarkers(projectRoot: string): CheckResult {
  const name = "probe-markers";
  const dir = join(projectRoot, TESTS_REL);
  let st;
  try {
    st = statSync(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "error";
    const why = code === "ENOENT" ? "is absent" : `unreadable (${code})`;
    return { name, report: true, severity: "issue", message: `${TESTS_REL} ${why}, so probe markers were not read. This is not a pass. ${LIMIT}` };
  }
  if (!st.isDirectory()) {
    return { name, report: true, severity: "issue", message: `${TESTS_REL} is not a directory, so probe markers were not read. This is not a pass. ${LIMIT}` };
  }

  const files: string[] = [];
  const unreadable: string[] = [];
  const walk = (abs: string): void => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch (err) {
      unreadable.push(`${relPosix(projectRoot, abs)} (${(err as NodeJS.ErrnoException).code ?? "error"})`);
      return;
    }
    for (const ent of entries) {
      if (ent.isSymbolicLink()) continue;
      const child = join(abs, ent.name);
      if (ent.isDirectory()) walk(child);
      else if (ent.isFile()) files.push(child);
    }
  };
  walk(dir);

  const hits: string[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch (err) {
      unreadable.push(`${relPosix(projectRoot, file)} (${(err as NodeJS.ErrnoException).code ?? "error"})`);
      continue;
    }
    if (text.includes(PHRASE.toUpperCase())) hits.push(relPosix(projectRoot, file));
  }

  if (unreadable.length > 0) {
    return {
      name,
      report: true,
      severity: "issue",
      message: `${unreadable.length} path(s) under ${TESTS_REL} could not be read, so a probe marker there cannot be ruled out: ${unreadable.slice(0, 5).join(", ")}. This is not a pass. ${LIMIT}`,
    };
  }
  if (hits.length > 0) {
    return {
      name,
      report: true,
      severity: "issue",
      message: `${hits.length} file(s) under ${TESTS_REL} contain "not for merge": ${hits.join(", ")}. Read ${files.length}. ${LIMIT}`,
    };
  }
  return {
    name,
    report: true,
    severity: "pass",
    message: `Read ${files.length} file(s) under ${TESTS_REL}; none contain "not for merge". ${LIMIT}`,
  };
}
