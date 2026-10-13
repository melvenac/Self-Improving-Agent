/**
 * T-263 — the runtime's git environment drops the caller's identity variables.
 * Git ranks GIT_AUTHOR_* / GIT_COMMITTER_* above `-c user.name/user.email`, so an inherited
 * one would sign the runtime's commits with the caller's name.
 */

import { describe, expect, it } from "vitest";
import { runtimeGitEnv } from "../../src/harness/git.js";

describe("T-263 — runtimeGitEnv drops inherited identity variables", () => {
  it("I1: the four identity variables are removed, PATH is kept", () => {
    const env = runtimeGitEnv({
      PATH: "p",
      GIT_AUTHOR_NAME: "x",
      GIT_AUTHOR_EMAIL: "x@x.invalid",
      GIT_COMMITTER_NAME: "x",
      GIT_COMMITTER_EMAIL: "x@x.invalid",
    });
    for (const k of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"]) {
      expect(env, k).not.toHaveProperty(k);
    }
    expect(env.PATH).toBe("p");
  });

  it("I2: mixed-case spellings are removed too", () => {
    const env = runtimeGitEnv({ Git_Author_Name: "x", git_committer_email: "x@x.invalid" });
    expect(env).not.toHaveProperty("Git_Author_Name");
    expect(env).not.toHaveProperty("git_committer_email");
  });

  it("I3: a machine read removes them as well", () => {
    const env = runtimeGitEnv({ GIT_AUTHOR_NAME: "x", GIT_COMMITTER_EMAIL: "x@x.invalid" }, null, true);
    expect(env).not.toHaveProperty("GIT_AUTHOR_NAME");
    expect(env).not.toHaveProperty("GIT_COMMITTER_EMAIL");
  });

  it("I4: the *_DATE variables are kept unchanged", () => {
    const env = runtimeGitEnv({
      GIT_AUTHOR_DATE: "2020-01-01T00:00:00Z",
      GIT_COMMITTER_DATE: "2020-01-01T00:00:00Z",
    });
    expect(env.GIT_AUTHOR_DATE).toBe("2020-01-01T00:00:00Z");
    expect(env.GIT_COMMITTER_DATE).toBe("2020-01-01T00:00:00Z");
  });
});
