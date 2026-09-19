/**
 * The seam where a decision gate will go, and the dry run that exists before
 * there is anything to get wrong.
 *
 * **Slice one has no gate client.** The Jev client, the plan gate, the
 * developer done-gate and QA scoring are all out of scope. What is in scope is
 * the *shape*: one place every outward request would pass through, so that
 * "sends nothing" is a property of a transport rather than a claim about the
 * whole codebase.
 *
 * That is why {@link DryRunTransport} is written now. A dry run added after a
 * client exists has to be believed; a dry run that predates the client is the
 * only implementation there is, and a test can assert that dispatching is
 * unreachable.
 *
 * ## The default transport refuses
 *
 * {@link UnconfiguredTransport} is what a non-dry run gets in this slice, and
 * it **fails closed**: it throws rather than returning a permissive answer.
 * *Fail closed on anything that would authorise a destructive action.* A gate
 * that is not built yet must not read as a gate that said yes.
 */

/** The three Jev primitives, carried here as shapes only — no client, no call. */
export type GateQuestionKind = "noul" | "choice" | "score";

export interface GateQuestion {
  id: string;
  kind: GateQuestionKind;
  prompt: string;
  /** Present for `choice`; the options the answer must come from. */
  options?: readonly string[];
  /** Present for `score`; what the ends of the scale mean. */
  legend?: readonly string[];
}

export interface GatePayload {
  /** Which gate this is — `plan`, `developer-done`, `qa-score`. */
  gate: string;
  loop: string;
  model: string;
  questions: readonly GateQuestion[];
  /** Whatever the gate is being asked to judge. Redacted before it leaves here. */
  context: Record<string, unknown>;
}

export interface GateAnswer {
  gate: string;
  /** `null` when no gate was consulted. A caller must handle that, not default it. */
  answers: Record<string, unknown> | null;
  consulted: boolean;
  note: string;
}

export interface GateTransport {
  readonly name: string;
  dispatch(payload: GatePayload): GateAnswer;
}

/**
 * Environment variable names whose values must never reach a payload, a log, an
 * artifact or a commit.
 *
 * Redaction works from the **live value** rather than from a pattern that
 * guesses what a key looks like. A regex for "things that look like an API key"
 * is an instrument that cannot prove it looked; comparing against the actual
 * secret can.
 */
export const SECRET_ENV_VARS: readonly string[] = ["TYPESAFE_API_KEY", "ANTHROPIC_API_KEY"];

/**
 * Replace any occurrence of a live secret with a marker.
 *
 * Walks strings, arrays and plain objects. **Also redacts by key name**, so a
 * field called `api_key` is masked even when the environment variable is unset
 * and there is no value to match against — the case where value-matching alone
 * would report a clean payload because it had nothing to compare with.
 */
export function redact<T>(value: T, env: NodeJS.ProcessEnv = process.env): T {
  const secrets = SECRET_ENV_VARS.map((k) => env[k]).filter(
    (v): v is string => typeof v === "string" && v.length >= 8,
  );
  const suspiciousKey = /(^|_)(api_?key|token|secret|authorization|bearer)($|_)/i;

  const walk = (v: unknown, keyHint?: string): unknown => {
    if (typeof v === "string") {
      if (keyHint !== undefined && suspiciousKey.test(keyHint)) return "[REDACTED]";
      let out = v;
      for (const s of secrets) out = out.split(s).join("[REDACTED]");
      return out;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v !== null && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = walk(val, k);
      return o;
    }
    return v;
  };

  return walk(value) as T;
}

/** Render a payload for printing, redacted. The only function that formats a payload. */
export function renderPayload(payload: GatePayload, env: NodeJS.ProcessEnv = process.env): string {
  return JSON.stringify(redact(payload, env), null, 2);
}

/**
 * Records what would have been sent and sends nothing.
 *
 * There is no network code in this class, and that is the assertion A6 rests
 * on: not "it is configured not to send" but "there is nothing here that
 * could".
 */
export class DryRunTransport implements GateTransport {
  readonly name = "dry-run";
  readonly sent: GatePayload[] = [];
  private readonly sink: (line: string) => void;
  private readonly env: NodeJS.ProcessEnv;

  constructor(sink: (line: string) => void = () => {}, env: NodeJS.ProcessEnv = process.env) {
    this.sink = sink;
    this.env = env;
  }

  dispatch(payload: GatePayload): GateAnswer {
    this.sent.push(payload);
    this.sink(`--- gate payload (dry run, NOT sent): ${payload.gate} ---`);
    this.sink(renderPayload(payload, this.env));
    return {
      gate: payload.gate,
      answers: null,
      consulted: false,
      note: "dry run — the payload was printed and no request was made. Not an approval.",
    };
  }
}

export class GateUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GateUnavailable";
  }
}

/**
 * The live transport in this slice: there isn't one.
 *
 * Throwing is the point. The alternative — returning `{consulted: false}` and
 * letting the caller continue — is a gate that silently approves, which is the
 * failure mode every instrument in this project's record has had.
 */
export class UnconfiguredTransport implements GateTransport {
  readonly name = "unconfigured";

  dispatch(payload: GatePayload): GateAnswer {
    throw new GateUnavailable(
      `gate "${payload.gate}" was asked for a decision and no gate client is configured. ` +
        `Slice one ships the runtime with the gates stubbed; the client lands in slice two. ` +
        `Run with --dry-run to see the payload. Refusing rather than proceeding unjudged.`,
    );
  }
}
