import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["tests/**/*.test.ts"],
    // Keeps tests from writing into the real ~/.claude state. See the file.
    // eld-setup.ts is G-042's Step 0 instrument, loaded only when OPEN_BRAIN_ELD_DIR is set. See the file.
    setupFiles: ["tests/setup-env.ts", ...(process.env.OPEN_BRAIN_ELD_DIR ? ["tests/eld-setup.ts"] : [])],
  },
});
