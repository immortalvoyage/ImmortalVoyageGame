export const DEFAULT_ACTION_ATTEMPTS = 2;

function fallbackResult(code) {
  return { ok: false, code };
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
      try {
        result = await response.json();
      } catch {
        result = fallbackResult('INVALID_SERVER_RESPONSE');
      }

      // 2xx/4xx responses are definitive for this request. 5xx and transport
      // failures are ambiguous, so retry only those with the exact same requestId.
      if (response.status < 500) return { confirmed: true, result };
      lastResult = result?.ok === false ? result : fallbackResult('SERVER_UNAVAILABLE');
    } catch {
      lastResult = fallbackResult('NETWORK_UNAVAILABLE');
    }
  }

  return { confirmed: false, result: lastResult };
}
