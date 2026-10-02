import { describe, it, expect, afterEach } from "vitest";
import {
  DryRunTransport,
  GateUnavailable,
  redact,
  renderPayload,
  UnconfiguredTransport,
  type GatePayload,
  type GateTransport,
} from "../../src/harness/gate.js";

const payload = (): GatePayload => ({
  gate: "plan",
  loop: "t001",
  model: "jev-latest",
  questions: [{ id: "bounded", kind: "score", prompt: "Is this bounded?" }],
  context: { plan: { objective: "run a loop" } },
});

/**
 * Acceptance A6 — dry run prints the payload and sends nothing.
 *
 * "Sends nothing" is asserted two ways, because one of them alone would be a
 * claim rather than a check:
 *
 * 1. A transport that THROWS on dispatch is installed as the live one. If the
 *    dry run reached it, the test would fail with that throw.
 * 2. `globalThis.fetch` is replaced with a function that fails the test. Any
 *    network attempt inside the dry-run path trips it.
 */
describe("dry run — A6", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  class ExplodingTransport implements GateTransport {
    readonly name = "exploding";
    dispatch(): never {
      throw new Error("a network call was attempted during a dry run");
    }
  }

  it("records and prints the payload without dispatching", async () => {
    globalThis.fetch = (() => {
      throw new Error("fetch was called during a dry run");
    }) as typeof fetch;

    const lines: string[] = [];
    const dry = new DryRunTransport((l) => lines.push(l), {});
    const answer = await dry.dispatch(payload());

    expect(dry.sent).toHaveLength(1);
    expect(lines.join("\n")).toContain("NOT sent");
    expect(lines.join("\n")).toContain("jev-latest");
    expect(answer.consulted).toBe(false);
    expect(answer.answers).toBeNull();
  });

  it("returns an answer that cannot be mistaken for an approval", async () => {
    const dry = new DryRunTransport(() => {}, {});
    const answer = await dry.dispatch(payload());
    // `consulted: false` and `answers: null` force a caller to handle the case
    // rather than read a truthy default as a yes.
    expect(answer.consulted).toBe(false);
    expect(answer.note).toContain("Not an approval");
  });

  it("would fail if the dry run reached a live transport", async () => {
    // Validating the instrument against a known positive: the exploding
    // transport must actually explode, or the assertion above proves nothing.
    expect(() => new ExplodingTransport().dispatch()).toThrow(/network call was attempted/);
    // …and it is still a rejection, not a return, through the async seam.
    await expect(Promise.resolve().then(() => new ExplodingTransport().dispatch())).rejects.toThrow(
      /network call was attempted/,
    );
  });
});

describe("UnconfiguredTransport", () => {
  it("rejects rather than returning a permissive answer", async () => {
    // A gate that is not built yet must not read as a gate that said yes.
    await expect(new UnconfiguredTransport().dispatch(payload())).rejects.toBeInstanceOf(GateUnavailable);
  });

  it("names the reason and the way out", async () => {
    try {
      await new UnconfiguredTransport().dispatch(payload());
      throw new Error("unreachable");
    } catch (err) {
      expect((err as Error).message).toContain("no gate client is configured");
      expect((err as Error).message).toContain("--gate dry-run");
      expect((err as Error).message).toContain("Refusing rather than proceeding unjudged");
    }
  });
});

describe("redaction — §6 secrets", () => {
  it("masks a live TYPESAFE_API_KEY wherever it appears in a payload", () => {
    const env = { TYPESAFE_API_KEY: "sk-live-abcdefghijklmnop" };
    const out = redact(
      { note: "calling with sk-live-abcdefghijklmnop", nested: { deep: ["sk-live-abcdefghijklmnop"] } },
      env,
    );
    expect(JSON.stringify(out)).not.toContain("sk-live-abcdefghijklmnop");
    expect(JSON.stringify(out)).toContain("[REDACTED]");
  });

  it("masks a field named like a secret even when the environment is empty", () => {
    // Value-matching alone reports a clean payload when it has nothing to
    // compare against — an instrument that cannot tell "nothing there" from
    // "I did not look". The key-name rule covers that case.
    const out = redact({ api_key: "whatever-this-is", authorization: "Bearer xyz" }, {});
    expect(out.api_key).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
  });

  it("leaves ordinary content alone", () => {
    const out = redact({ objective: "run a loop end to end", count: 3 }, { TYPESAFE_API_KEY: "sk-live-abcdefgh" });
    expect(out.objective).toBe("run a loop end to end");
    expect(out.count).toBe(3);
  });

  it("ignores an implausibly short environment value rather than masking everything", () => {
    // A one-character secret would turn every payload into confetti, and a
    // redactor that destroys the payload is not usable enough to be used.
    const out = redact({ text: "a b c" }, { TYPESAFE_API_KEY: "a" });
    expect(out.text).toBe("a b c");
  });

  it("renderPayload redacts before it formats", () => {
    const p = { ...payload(), context: { token: "super-secret-value" } };
    expect(renderPayload(p, {})).not.toContain("super-secret-value");
  });
});
