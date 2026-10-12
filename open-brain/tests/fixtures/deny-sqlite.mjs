// T-154: make better-sqlite3 unresolvable in this process and every child that inherits NODE_OPTIONS.
import { registerHooks } from "node:module";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "better-sqlite3" || specifier.startsWith("better-sqlite3/")) {
      throw new Error("T-154 deny: better-sqlite3 is not installed");
    }
    return nextResolve(specifier, context);
  },
});
