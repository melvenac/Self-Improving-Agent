import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["tests/**/*.test.ts"],
    // Keeps tests from writing into the real ~/.claude state. See the file.
    setupFiles: ["tests/setup-env.ts"],
  },
});
