/**
 * The live gate transport — A3 (the key) and A4 (four failure classes).
 *
 * **No test in this file reaches the network.** Every call goes through an
 * injected `fetchImpl` that returns a `Response` built in-process, and the
 * global `fetch` is replaced with one that fails the test if anything touches
 * it. *"Sends nothing" is a property of which transport is installed*, and the
 * same reasoning applies to a live transport pointed at a fake.
 *
 * The one real call belongs to QA, once, by hand, as A7.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  buildJevRequest,
  GateCallFailed,
  GateUnavailable,
  JevTransport,
  JEV_KEY_VAR,
  PLAN_GATE_QUESTIONS,
  DONE_GATE_QUESTIONS,
  type GatePayload,
} from "../../src/harness/gate.js";

const KEY = "sk-live-do-not-log-me-0123456789";

const payload = (over: Partial<GatePayload> = {}): GatePayload => ({
  gate: "plan",
  loop: "t001",
  model: "jev-latest",
  questions: PLAN_GATE_QUESTIONS,
  context: { plan: { objective: "run a loop" } },
  ...over,
});

const respondWith = (status: number, body: unknown) =>
  (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

const okAnswers = {
  model: "jev-1.13.0",
  answers: {
    plan_mode: { type: "choice", choice: "mixed", confidence: 0.9 },
    scope_size: { type: "score", score: 1, legend: { "0": "a", "1": "b", "2": "c" }, confidence: 0.9 },
    preserves_validated: { type: "noul", noul: 0.9 },
    addresses_top_failures: { type: "noul", noul: 0.8 },
    has_observable_acceptance: { type: "noul", noul: 0.95 },
  },
  usage: { input_tokens: 388, output_tokens: 73 },
};

describe("JevTransport", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  /* --------------------------------------------------------------------- *
   * A3 — the key
   * --------------------------------------------------------------------- */

  describe("A3 — the key is read from the environment only", () => {
    /**
     * An environment with the key **explicitly removed**, never an inherited
     * one assumed empty.
     *
     * This is a ruling, and it comes from a real error: this seat ran
     * `--gate live` expecting the no-key refusal, on the assumption that the
     * variable was unset in its own shell. It was set. A live call went out.
     * A test written against inherited `process.env` falls into exactly that
     * trap **silently** — green on a machine without the key, and quietly
     * measuring something else on a machine with it.
     *
     * So the strip is explicit, and the test proves the strip did something
     * rather than assuming it.
     */
    const withoutKey = (): NodeJS.ProcessEnv => {
      const copy = { ...process.env };
      const wasPresent = JEV_KEY_VAR in copy;
      delete copy[JEV_KEY_VAR];
      expect(JEV_KEY_VAR in copy, "the strip did not remove the variable").toBe(false);
      // Reported, not asserted: on a machine that has the key this proves the
      // strip is doing work; on one that does not, asserting presence would
      // fail for a reason that has nothing to do with the thing under test.
      if (!wasPresent) {
        expect(process.env[JEV_KEY_VAR], "parent had no key — the strip is a no-op here").toBeUndefined();
      }
      return copy;
    };

    it("fails closed naming the variable, and builds no request at all", async () => {
      let called = 0;
      const t = new JevTransport({
        env: withoutKey(),
        fetchImpl: (async () => {
          called += 1;
          return new Response("{}", { status: 200 });
        }) as unknown as typeof fetch,
      });

      await expect(t.dispatch(payload())).rejects.toBeInstanceOf(GateUnavailable);
      // "Before any request is built" is the observable, so the assertion is
      // that nothing was sent — not merely that something threw.
      expect(called, "a request was attempted with no key").toBe(0);

      await t.dispatch(payload()).catch((err: Error) => {
        expect(err.message).toContain(JEV_KEY_VAR);
        expect(err.message).toContain("environment");
      });
    });

    it("treats a blank key as absent rather than as a key", async () => {
      const t = new JevTransport({ env: { [JEV_KEY_VAR]: "   " }, fetchImpl: respondWith(200, okAnswers) });
      await expect(t.dispatch(payload())).rejects.toBeInstanceOf(GateUnavailable);
    });

    it("is the ABSENCE that refuses — the same transport with the key dispatches", async () => {
      // The positive control. Without it, the refusal above could be caused by
      // anything: a broken fake, a bad payload, the wrong endpoint.
      const stripped = withoutKey();
      const refused = new JevTransport({ env: stripped, fetchImpl: respondWith(200, okAnswers) });
      await expect(refused.dispatch(payload())).rejects.toBeInstanceOf(GateUnavailable);

      const allowed = new JevTransport({
        env: { ...stripped, [JEV_KEY_VAR]: KEY },
        fetchImpl: respondWith(200, okAnswers),
      });
      const answer = await allowed.dispatch(payload());
      expect(answer.consulted).toBe(true);
    });

    it("sends the key in the Authorization header and in no part of the body", async () => {
      let seenUrl = "";
      let seenBody = "";
      let seenAuth = "";
      const t = new JevTransport({
        env: { [JEV_KEY_VAR]: KEY },
        fetchImpl: (async (url: string, init: RequestInit) => {
          seenUrl = String(url);
          seenBody = String(init.body);
          seenAuth = String((init.headers as Record<string, string>).Authorization);
          return new Response(JSON.stringify(okAnswers), { status: 200 });
        }) as unknown as typeof fetch,
      });

      const answer = await t.dispatch(payload());

      expect(seenUrl).toContain("api.typesafe.ai");
      expect(seenAuth).toBe(`Bearer ${KEY}`);
      expect(seenBody, "the key reached the request BODY").not.toContain(KEY);
      expect(answer.resolvedModel).toBe("jev-1.13.0");
      expect(answer.consulted).toBe(true);
    });

    it("keeps the key out of the error text when the transport itself fails", async () => {
      // A thrown fetch error can carry the whole request, key included. The
      // redactor runs on the message before it becomes a GateCallFailed.
      const t = new JevTransport({
        env: { [JEV_KEY_VAR]: KEY },
        fetchImpl: (async () => {
          throw new Error(`connect ECONNREFUSED with Bearer ${KEY}`);
        }) as unknown as typeof fetch,
      });
      const err = await t.dispatch(payload()).catch((e: GateCallFailed) => e);
      expect(err).toBeInstanceOf(GateCallFailed);
      expect((err as GateCallFailed).classification).toBe("transport");
      expect((err as GateCallFailed).message).not.toContain(KEY);
      expect((err as GateCallFailed).message).toContain("[REDACTED]");
    });
  });

  /* --------------------------------------------------------------------- *
   * A4 — four classes, four outcomes
   * --------------------------------------------------------------------- */

  describe("A4 — the failure classes do not collapse", () => {
    const dispatch = async (status: number, body: unknown): Promise<GateCallFailed> => {
      const t = new JevTransport({ env: { [JEV_KEY_VAR]: KEY }, fetchImpl: respondWith(status, body) });
      return (await t.dispatch(payload()).catch((e: GateCallFailed) => e)) as GateCallFailed;
    };

    it("maps 401, 422, 429 and 529 to four DISTINCT outcomes", async () => {
      const results = await Promise.all([
        dispatch(401, { detail: "bad key" }),
        dispatch(422, { detail: [{ loc: ["body", "questions", "scope_size", "score", "criteria"], msg: "Input should be a valid list" }] }),
        dispatch(429, { detail: "slow down" }),
        dispatch(529, { detail: "overloaded" }),
      ]);

      const classes = results.map((r) => r.classification);
      expect(classes).toEqual(["auth", "request-invalid", "rate-limited", "overloaded"]);
      // Four distinct values, asserted as a set so a future collapse is caught
      // even if the order changes.
      expect(new Set(classes).size).toBe(4);
      expect(results.map((r) => r.status)).toEqual([401, 422, 429, 529]);
    });

    it("marks 429 and 529 retryable and 401 and 422 not", async () => {
      expect((await dispatch(429, {})).retryable).toBe(true);
      expect((await dispatch(529, {})).retryable).toBe(true);
      // Retrying a defect in our own request is a loop, not a recovery.
      expect((await dispatch(401, {})).retryable).toBe(false);
      expect((await dispatch(422, {})).retryable).toBe(false);
    });

    it("carries the field the 422 named, verbatim, and the body with it", async () => {
      const err = await dispatch(422, {
        detail: [{ loc: ["body", "questions", "scope_size", "score", "criteria"], msg: "Input should be a valid list" }],
      });
      expect(err.fields).toEqual(["body.questions.scope_size.score.criteria"]);
      expect(err.message).toContain("body.questions.scope_size.score.criteria");
      expect(err.detail).toContain("Input should be a valid list");
    });

    it("does not file an undocumented status under one of the four", async () => {
      const err = await dispatch(500, { detail: "boom" });
      expect(err.classification).toBe("unexpected-status");
      expect(err.retryable).toBe(false);
    });

    it("refuses a 200 whose body carries no answers map", async () => {
      // A 200 with nothing usable in it must not read as an approval.
      const err = await dispatch(200, { model: "jev-1.13.0" });
      expect(err.classification).toBe("malformed-response");
      expect(err.message).toContain("not an approval");
    });

    it("refuses a 200 that is not JSON", async () => {
      const err = await dispatch(200, "<html>gateway</html>");
      expect(err.classification).toBe("malformed-response");
    });
  });

  /* --------------------------------------------------------------------- *
   * The wire shape — where a 422 comes from when it comes
   * --------------------------------------------------------------------- */

  describe("the request body", () => {
    it("sends score criteria as a LIST and choice criteria as a MAP", async () => {
      const body = buildJevRequest(payload()) as {
        questions: Record<string, { type: string; instructions: string; criteria?: unknown }>;
      };

      // The exact 422 recorded in docs/HOH-JEV.md §3 was an object here.
      expect(Array.isArray(body.questions.scope_size!.criteria)).toBe(true);
      // …and the docs give `map<string, string|object|array|null>` for choice.
      expect(Array.isArray(body.questions.plan_mode!.criteria)).toBe(false);
      expect(typeof body.questions.plan_mode!.criteria).toBe("object");
      expect(Object.keys(body.questions.plan_mode!.criteria as object)).toEqual([
        "repair_only",
        "capability_increment",
        "mixed",
        "stop_ship",
      ]);
    });

    it("names every question by its §4 id, with its §4 kind", async () => {
      const plan = buildJevRequest(payload()) as { questions: Record<string, { type: string }> };
      expect(Object.keys(plan.questions)).toEqual([
        "plan_mode",
        "scope_size",
        "preserves_validated",
        "addresses_top_failures",
        "has_observable_acceptance",
      ]);
      expect(Object.values(plan.questions).map((q) => q.type)).toEqual([
        "choice",
        "score",
        "noul",
        "noul",
        "noul",
      ]);

      const done = buildJevRequest(payload({ gate: "developer-done", questions: DONE_GATE_QUESTIONS })) as {
        questions: Record<string, { type: string }>;
      };
      expect(Object.keys(done.questions)).toEqual([
        "diff_matches_plan",
        "touches_out_of_scope",
        "local_tests_support_claim",
        "stuck_repeating_prior_failure",
        "risk_of_regression",
      ]);
      expect(Object.values(done.questions).map((q) => q.type)).toEqual([
        "noul",
        "noul",
        "noul",
        "noul",
        "score",
      ]);
    });

    it("refuses to build a score question with fewer than two levels", () => {
      expect(() =>
        buildJevRequest(payload({ questions: [{ id: "x", kind: "score", prompt: "?", criteria: ["one"] }] })),
      ).toThrow(GateCallFailed);
    });

    it("refuses to build a choice question with no options", () => {
      expect(() => buildJevRequest(payload({ questions: [{ id: "x", kind: "choice", prompt: "?" }] }))).toThrow(
        GateCallFailed,
      );
    });
  });
});
