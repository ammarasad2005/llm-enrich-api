// src/llm/retry.js
// Retry the RIGHT failures only. Yes on timeouts, 429, and 5xx. Never on 400/401/403 —
// a bad key will still be bad in four seconds, and on a metered free tier every pointless
// retry burns real quota. Exponential backoff (1s, 2s, 4s) + jitter; obey Retry-After.

const MAX_ATTEMPTS = 3; // 1 initial + 2 retries
const BASE_DELAY_MS = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function statusOf(err) {
  return err?.status ?? err?.response?.status ?? null;
}

export function isRetryable(err) {
  // Timeout / abort from the SDK client.
  if (err?.name === 'APIConnectionTimeoutError' || err?.name === 'AbortError') return true;
  const s = statusOf(err);
  if (s === 429) return true; // rate limited
  if (typeof s === 'number' && s >= 500) return true; // server error
  return false; // 400/401/403/404 etc. -> never retry
}

// Honour a Retry-After header (seconds) if the error carries one.
function retryAfterMs(err) {
  const h = err?.headers?.['retry-after'] ?? err?.response?.headers?.get?.('retry-after');
  if (!h) return null;
  const secs = Number(h);
  return Number.isFinite(secs) ? secs * 1000 : null;
}

// Run `fn` with the retry policy. `onRetry({attempt, delayMs, err})` is optional (logging).
export async function withRetry(fn, { onRetry } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isRetryable(err)) throw err;

      const backoff = BASE_DELAY_MS * 2 ** (attempt - 1); // 1s, 2s, 4s
      const jitter = Math.floor(Math.random() * 250); // small randomness
      const delayMs = retryAfterMs(err) ?? backoff + jitter;

      if (onRetry) onRetry({ attempt, delayMs, err });
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
