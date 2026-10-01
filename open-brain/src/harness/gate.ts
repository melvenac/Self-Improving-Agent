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

/** The three Jev primitives. */
export type GateQuestionKind = "noul" | "choice" | "score";

/**
 * One question, in the runtime's shape rather than the wire's.
 *
 * The wire shape is `{type, instructions, criteria}` and `criteria` means two
 * different things depending on the type — **a map for `choice`, an ordered
 * list for `score`** — which is precisely the kind of detail that produces a
 * `422` when it is assumed. Keeping two separately typed fields here means the
 * type system refuses the mix-up that the API would otherwise refuse at
 * runtime, and {@link toWireQuestion} is the one place the translation lives.
 *
 * Confirmed against `docs.typesafe.ai/api.md` on 2026-09-20 by the developer
 * seat. **Not re-verified on the wire** — the one live call is A7, and it is
 * QA's.
 */
export interface GateQuestion {
  /** A key we choose. Not sent to the model; the answer returns under it. */
  id: string;
  kind: GateQuestionKind;
  /** Becomes `instructions` on the wire. */
  prompt: string;
  /**
   * `choice` only. Option → rubric, `null` where an option needs no extra
   * detail. **A MAP on the wire, not a list** — the docs say
   * `map<string, string | object | array | null>`, max 255 options.
   */
  options?: Readonly<Record<string, string | null>>;
  /**
   * `score` only. Ordered level descriptions, **the order is the scale**.
   * A LIST in the request; the response returns a `legend` OBJECT keyed by
   * index. Sending an object here is the exact `422` recorded in
   * `docs/HOH-JEV.md` §3.
   */
  criteria?: readonly string[];
}

/* ------------------------------------------------------------------------- *
 * The two question sets, from docs/HOH-JEV.md §4, question by question
 *
 * The ids and kinds are the contract — QA asserts them against the PAYLOAD,
 * not against a prompt file, so a placeholder here is a failed acceptance row
 * and not a cosmetic difference.
 *
 * Every question carries its meaning in its own text, because the id is never
 * sent to the model. `bounded`/`repairs`/`complete`, the slice-one
 * placeholders, are gone.
 * ------------------------------------------------------------------------- */

export const PLAN_GATE_QUESTIONS: readonly GateQuestion[] = [
  {
    id: "plan_mode",
    kind: "choice",
    prompt:
      "What kind of increment is this plan? Judge the plan as written, not what it could become.",
    options: {
      repair_only: "Fixes known defects and adds no new capability.",
      capability_increment: "Adds one new capability and repairs nothing.",
      mixed: "Both repairs a known defect and adds one new capability.",
      stop_ship:
        "Argues that work should stop rather than continue — the system is in a state where the next increment is not the right move.",
    },
  },
  {
    id: "scope_size",
    kind: "score",
    prompt:
      "How large is the increment this plan describes, relative to one testable change? The order of the levels is the scale.",
    criteria: [
      "Too small to observe: nothing about it would be visible in a test or an artifact.",
      "One testable increment: a single bounded change whose effect can be observed directly.",
      "Unbounded rewrite: several independent changes, or a change whose extent the plan does not fix.",
    ],
  },
  {
    id: "preserves_validated",
    kind: "noul",
    prompt:
      "Does this plan's `preserve` list name the behaviours that are already validated and that this change could break?",
  },
  {
    id: "addresses_top_failures",
    kind: "noul",
    prompt:
      "Does this plan's `repair_targets` address the failures most recently observed, rather than easier unrelated ones?",
  },
  {
    id: "has_observable_acceptance",
    kind: "noul",
    prompt:
      "Does every acceptance criterion name a concrete observable — a command, an output, a file's content, an exit code — rather than a list of files to change or a restatement of the task?",
  },
];

export const DONE_GATE_QUESTIONS: readonly GateQuestion[] = [
  {
    id: "diff_matches_plan",
    kind: "noul",
    prompt: "Does the diff implement what `plan` describes, rather than something adjacent to it?",
  },
  {
    id: "touches_out_of_scope",
    kind: "noul",
    prompt: "Does the diff change anything the plan's `out_of_scope` list excludes?",
  },
  {
    id: "local_tests_support_claim",
    kind: "noul",
    prompt:
      "Do the tests in this diff exercise the change it makes, or would they hold whether or not the change is correct? `checks` already carries the exit codes; this question is about what the tests cover, not about their result.",
  },
  {
    id: "stuck_repeating_prior_failure",
    kind: "noul",
    prompt:
      "Is this attempt repeating an approach that is listed in `prior_failures` as already tried and failed?",
  },
  {
    id: "risk_of_regression",
    kind: "score",
    prompt:
      "How likely is this diff to break a behaviour listed in `plan.preserve`? The order of the levels is the scale.",
    criteria: [
      "Validated behaviour untouched: the diff does not reach the code those behaviours depend on.",
      "Adjacent: the diff touches shared code, but the preserved behaviours have direct coverage.",
      "Likely breakage: the diff changes code a preserved behaviour depends on, with no coverage of it.",
    ],
  },
];

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
  /**
   * The concrete version `jev-latest` resolved to, e.g. `jev-1.13.0`.
   *
   * Recorded with every decision because *"two runs of the same gate are not
   * comparable after an upstream model change"* — a gate verdict with no model
   * beside it is a derived number with nothing to derive it from.
   */
  resolvedModel?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
}

/**
 * The one place an outward request may pass through.
 *
 * **`dispatch` is asynchronous, and that is a ruling rather than a
 * convenience.** A live gate is an HTTP call, and the two ways to make one from
 * synchronous code are both worse than propagating a promise: spawning a
 * process is exactly what the no-shell scan exists to catch, and a blocking
 * request wedges the runtime with no way to time out. So the seam is async from
 * here up, and `runLoop` is async as far as that reaches.
 *
 * The assertion that a test never reaches the network holds unchanged under the
 * async shape: it is a property of which transport is installed, not of when
 * the answer arrives.
 */
export interface GateTransport {
  readonly name: string;
  dispatch(payload: GatePayload): Promise<GateAnswer>;
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

  async dispatch(payload: GatePayload): Promise<GateAnswer> {
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

  async dispatch(payload: GatePayload): Promise<GateAnswer> {
    throw new GateUnavailable(
      `gate "${payload.gate}" was asked for a decision and no gate client is configured. ` +
        `Run with --gate dry-run to see the payload, or --gate live with TYPESAFE_API_KEY set. ` +
        `Refusing rather than proceeding unjudged.`,
    );
  }
}

/* ------------------------------------------------------------------------- *
 * The live transport
 * ------------------------------------------------------------------------- */

/** The name of the variable the key is read from. Named in every refusal. */
export const JEV_KEY_VAR = "TYPESAFE_API_KEY";
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/** The oldest resolved model a slice-four record may carry (S4-3a). */
export const JEV_MIN_MODEL = "jev-1.13.0";

/** `jev-1.13.0` → [1, 13, 0], or null when the string is not that shape. */
function parseJevVersion(value: unknown): [number, number, number] | null {
  if (typeof value !== "string") return null;
  // `.match`, not `.exec`: the spawn-site scan treats a call named exec as a process spawn.
  const m = value.match(/^jev-(\d+)\.(\d+)\.(\d+)$/);
  return m === null ? null : [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Whether a resolved model version is at or above `minimum`, compared field by field as numbers.
 *
 * A string comparison would rank `jev-1.9.0` above `jev-1.13.0`. Anything that is not a `jev-X.Y.Z`
 * string, including `null` and `jev-latest`, fails: an unreported version is not a passing one.
 */
export function jevModelAtLeast(resolved: unknown, minimum: string = JEV_MIN_MODEL): boolean {
  const have = parseJevVersion(resolved);
  const need = parseJevVersion(minimum);
  if (have === null || need === null) return false;
  for (let i = 0; i < 3; i++) {
    if (have[i]! !== need[i]!) return have[i]! > need[i]!;
  }
  return true;
}

/**
 * How a live call failed, as something the runtime can branch on.
 *
 * **Four HTTP classes, four outcomes, and they do not collapse.** `429` and
 * `529` are retryable with backoff; `401` and `422` are defects in our code or
 * config and retrying them is a loop. A transport that returned "gate failed"
 * for all four has not been built.
 *
 * `unexpected-status`, `transport` and `malformed-response` are here for the
 * same reason the allowlist refuses an unlisted path: an unrecognised status
 * must not be filed under one of the four just because it has to go somewhere.
 */
export type GateFailureClass =
  | "auth"
  | "request-invalid"
  | "rate-limited"
  | "overloaded"
  | "unexpected-status"
  | "transport"
  | "malformed-response";

const RETRYABLE: ReadonlySet<GateFailureClass> = new Set<GateFailureClass>(["rate-limited", "overloaded"]);

export class GateCallFailed extends Error {
  readonly classification: GateFailureClass;
  readonly status: number | null;
  readonly retryable: boolean;
  /** For `422`: the field paths the API named, from `detail[].loc`. */
  readonly fields: readonly string[];
  /** The response body, redacted, truncated. Surfaced because the 422 IS the answer. */
  readonly detail: string;

  constructor(
    classification: GateFailureClass,
    status: number | null,
    message: string,
    detail = "",
    fields: readonly string[] = [],
  ) {
    super(message);
    this.name = "GateCallFailed";
    this.classification = classification;
    this.status = status;
    this.retryable = RETRYABLE.has(classification);
    this.fields = fields;
    this.detail = detail;
  }
}

/** Translate one question into the wire shape. The only place that mapping lives. */
export function toWireQuestion(q: GateQuestion): Record<string, unknown> {
  const base: Record<string, unknown> = { type: q.kind, instructions: q.prompt };
  if (q.kind === "choice") {
    if (q.options === undefined) {
      throw new GateCallFailed(
        "request-invalid",
        null,
        `choice question "${q.id}" has no options — a choice with no criteria map cannot be answered, ` +
          `and sending it would spend a call to be told so`,
      );
    }
    base.criteria = { ...q.options };
  }
  if (q.kind === "score") {
    if (q.criteria === undefined || q.criteria.length < 2) {
      throw new GateCallFailed(
        "request-invalid",
        null,
        `score question "${q.id}" needs at least two ordered levels; the order is the scale`,
      );
    }
    // A LIST. An object here is the 422 recorded in docs/HOH-JEV.md §3.
    base.criteria = [...q.criteria];
  }
  return base;
}

/** The request body, exactly as it goes on the wire. Contains no credential. */
export function buildJevRequest(payload: GatePayload): Record<string, unknown> {
  const questions: Record<string, unknown> = {};
  for (const q of payload.questions) questions[q.id] = toWireQuestion(q);
  return { model: payload.model, state: payload.context, questions };
}

export interface JevTransportOptions {
  env?: NodeJS.ProcessEnv;
  /** Injected so tests run against a local fake and never reach the network. */
  fetchImpl?: typeof fetch;
  endpoint?: string;
  timeoutMs?: number;
  log?: (line: string) => void;
}

/**
 * The live gate: one HTTPS POST, one batched set of questions, typed answers.
 *
 * ## The key
 *
 * Read from `process.env` **at call time and nowhere else** — no `.env` file,
 * no config key, no CLI flag, no prompt, no field on this object. It exists in
 * a local `const` for the length of one `fetch` and is never put in anything
 * that gets logged, written or returned. Absence is a {@link GateUnavailable}
 * naming the variable, **thrown before the request is built**, because a
 * refusal that happens after the payload exists has already created the thing
 * it was meant to prevent.
 *
 * ## No process, ever
 *
 * `fetch` with an `AbortSignal` timeout. A spawned `curl` is what the harness's
 * own no-shell scan exists to catch, and it would put the key on a command
 * line, where it reaches the process table and the shell history.
 */
export class JevTransport implements GateTransport {
  readonly name = "jev";
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl: typeof fetch;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly log: (line: string) => void;

  constructor(options: JevTransportOptions = {}) {
    this.env = options.env ?? process.env;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.endpoint = options.endpoint ?? JEV_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.log = options.log ?? (() => {});
  }

  async dispatch(payload: GatePayload): Promise<GateAnswer> {
    const key = this.env[JEV_KEY_VAR];
    if (typeof key !== "string" || key.trim() === "") {
      throw new GateUnavailable(
        `gate "${payload.gate}" cannot run live: ${JEV_KEY_VAR} is not set in this process's ` +
          `environment. It is read from the environment only — never from a file in this repo, a ` +
          `config key, a CLI flag or a prompt. Set it in the shell that runs the harness, or use ` +
          `--gate dry-run. No request was built.`,
      );
    }
    if (typeof this.fetchImpl !== "function") {
      throw new GateUnavailable(
        `gate "${payload.gate}" cannot run live: no fetch implementation is available in this runtime`,
      );
    }

    const body = buildJevRequest(payload);
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          // The one place the key appears. Never stored, never logged.
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new GateCallFailed(
        "transport",
        null,
        `gate "${payload.gate}": the request to ${this.endpoint} did not complete: ` +
          `${redact((err as Error).message, this.env)}`,
      );
    }

    const raw = await response.text().catch(() => "");
    const safe = redact(raw, this.env).slice(0, 2000);

    if (!response.ok) throw classifyStatus(payload.gate, response.status, safe);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new GateCallFailed(
        "malformed-response",
        response.status,
        `gate "${payload.gate}": HTTP ${response.status} with a body that is not JSON`,
        safe,
      );
    }

    const envelope = parsed as { model?: unknown; answers?: unknown; usage?: unknown };
    if (envelope.answers === null || typeof envelope.answers !== "object" || Array.isArray(envelope.answers)) {
      throw new GateCallFailed(
        "malformed-response",
        response.status,
        `gate "${payload.gate}": HTTP ${response.status} but the body has no answers map. ` +
          `A 200 with nothing usable in it is not an approval.`,
        safe,
      );
    }
    const answers = envelope.answers as Record<string, unknown>;
    const asked = payload.questions.map((q) => q.id);
    const missing = asked.filter((id) => !(id in answers));
    const resolvedModel = typeof envelope.model === "string" ? envelope.model : null;

    this.log(
      `gate ${payload.gate}: HTTP ${response.status}, model ${resolvedModel ?? "(not reported)"}, ` +
        `${asked.length - missing.length}/${asked.length} answers`,
    );

    return {
      gate: payload.gate,
      answers,
      consulted: true,
      note:
        `answered by ${resolvedModel ?? "an unreported model version"} at ` +
        `${new Date().toISOString()}` +
        (missing.length > 0 ? `; NOT ANSWERED: ${missing.join(", ")}` : "") +
        `. LIMIT: typed output guarantees the interface, not truth.`,
      resolvedModel,
      usage: (envelope.usage ?? null) as GateAnswer["usage"],
    };
  }
}

/** Map an HTTP status onto one of the outcomes, never onto a neighbour's. */
function classifyStatus(gate: string, status: number, body: string): GateCallFailed {
  const fields = fieldsFrom422(body);
  switch (status) {
    case 401:
      return new GateCallFailed(
        "auth",
        401,
        `gate "${gate}": HTTP 401 — ${JEV_KEY_VAR} is set but was rejected. This is a config defect, ` +
          `not a transient failure, and retrying it is a loop.`,
        body,
      );
    case 422:
      return new GateCallFailed(
        "request-invalid",
        422,
        `gate "${gate}": HTTP 422 — the request body failed validation` +
          (fields.length > 0 ? ` at ${fields.join(", ")}` : "") +
          `. This is a defect in our request, not a transient failure. The body is below verbatim, ` +
          `because the 422 names the exact field and is worth more than a 200.`,
        body,
        fields,
      );
    case 429:
      return new GateCallFailed("rate-limited", 429, `gate "${gate}": HTTP 429 — rate limited. Retryable with backoff.`, body);
    case 529:
      return new GateCallFailed("overloaded", 529, `gate "${gate}": HTTP 529 — service overloaded. Retryable with backoff.`, body);
    default:
      return new GateCallFailed(
        "unexpected-status",
        status,
        `gate "${gate}": HTTP ${status}, which is none of the four documented classes. ` +
          `Reported as its own outcome rather than filed under one of them.`,
        body,
      );
  }
}

/** Pull `detail[].loc` paths out of a 422 body. Returns empty when the shape is not that. */
function fieldsFrom422(body: string): string[] {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (!Array.isArray(parsed.detail)) return [];
    const out: string[] = [];
    for (const item of parsed.detail) {
      const loc = (item as { loc?: unknown }).loc;
      if (Array.isArray(loc)) out.push(loc.map(String).join("."));
    }
    return out;
  } catch {
    return [];
  }
}
