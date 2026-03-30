// Embedding helper — wraps potion-base-32m (32-dim micro model)
// Lazy-loaded, graceful degradation if unavailable

export const EMBEDDING_DIM = 32;

let _embedFn: ((text: string) => Promise<Float32Array[]>) | null = null;
let _initPromise: Promise<boolean> | null = null;
let _available = false;

/**
 * Lazy-init potion-base-32m. Safe to call multiple times —
 * returns cached result after first attempt.
 */
export async function initEmbeddings(): Promise<boolean> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const mod = await import("@yarflam/potion-base-32m");
      _embedFn = mod.embed;
      _available = true;
      console.error("[embed] potion-base-32m loaded (32-dim)");
      return true;
    } catch (err) {
      console.error(
        `[embed] potion-base-32m unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
      _available = false;
      return false;
    }
  })();

  return _initPromise;
}

/**
 * Embed a text string. Returns null if model not loaded.
 */
export async function embedText(text: string): Promise<Float32Array | null> {
  if (!_embedFn) return null;
  try {
    const result = await _embedFn(text);
    return result[0] ?? null;
  } catch (err) {
    console.error(
      `[embed] embedText failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/**
 * Convert Float32Array to Buffer for sqlite-vec insertion.
 * Uses the underlying ArrayBuffer with correct offset/length.
 */
export function vecToBuffer(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

/**
 * Check if embedding model is loaded and ready.
 */
export function embeddingsAvailable(): boolean {
  return _available;
}
