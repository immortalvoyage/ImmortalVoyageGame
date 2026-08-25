export const DEFAULT_ACTION_ATTEMPTS = 2;

function fallbackResult(code) {
  return { ok: false, code };
}

function isStructuredActionResult(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.ok === 'boolean'
    && typeof value.code === 'string'
    && value.code.length > 0;
}

export async function postActionWithRecovery({
  fetchImpl = globalThis.fetch,
  url = '/api/action',
  requestId,
  action,
  attempts = DEFAULT_ACTION_ATTEMPTS,
}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof requestId !== 'string' || requestId.length === 0) throw new TypeError('requestId is required');
  if (!action || typeof action.type !== 'string') throw new TypeError('action.type is required');
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new TypeError('attempts must be an integer between 1 and 3');
  }

  const body = JSON.stringify({ requestId, action });
  let lastResult = fallbackResult('NETWORK_UNAVAILABLE');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });

      let result;
      let parsed = true;
      try {
        result = await response.json();
      } catch {
        parsed = false;
        result = fallbackResult('INVALID_SERVER_RESPONSE');
      }
      const structured = parsed && isStructuredActionResult(result);

      // A 4xx response is a definitive rejection under the /api/action contract,
      // even if its explanatory body is malformed. A 2xx response is only confirmed
      // when the public result shape is readable; otherwise the mutation may already
      // have committed, so retry with the exact same requestId.
      if (response.status >= 400 && response.status < 500) {
        return { confirmed: true, result: structured ? result : fallbackResult('INVALID_SERVER_RESPONSE') };
      }
      if (response.status < 400 && structured) return { confirmed: true, result };
      lastResult = structured && result.ok === false
        ? result
        : fallbackResult(parsed ? 'INVALID_SERVER_RESPONSE' : 'INVALID_SERVER_RESPONSE');
    } catch {
      lastResult = fallbackResult('NETWORK_UNAVAILABLE');
    }
  }

  return { confirmed: false, result: lastResult };
}
