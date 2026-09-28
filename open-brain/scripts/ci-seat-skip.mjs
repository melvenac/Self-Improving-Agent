import { execFileSync } from "node:child_process";

const before = process.argv[2];
const after = process.argv[3];

function finish(skip) {
  process.stdout.write(`skip=${skip ? "true" : "false"}\n`);
}

try {
  if (!before || !after || /^0+$/.test(before)) {
    finish(false);
    process.exit(0);
  }
  const out = execFileSync(
    "git",
    ["diff", "--name-only", "--no-renames", before, after],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const files = out.split(/\r?\n/).filter((line) => line.length > 0);
  if (files.length === 0) {
    finish(false);
    process.exit(0);
  }
  const docsOnly = files.some((file) => file === "README.md" || file.startsWith("docs/"));
  finish(docsOnly);
} catch {
  finish(false);
}
