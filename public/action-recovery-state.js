export const PENDING_ACTION_STORAGE_KEY = 'iv.pending-action.v1';
export const MAX_PENDING_ACTION_CHARS = 12 * 1024;

function normalizePending(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.requestId !== 'string' || value.requestId.length < 1 || value.requestId.length > 128) return null;
  if (!value.action || typeof value.action !== 'object' || Array.isArray(value.action)) return null;
  if (typeof value.action.type !== 'string' || value.action.type.length < 1) return null;

  let serializedAction;
  try {
    serializedAction = JSON.stringify(value.action);
  } catch {
    return null;
  }
  if (!serializedAction || serializedAction.length > MAX_PENDING_ACTION_CHARS) return null;
  return {
    requestId: value.requestId,
    action: JSON.parse(serializedAction),
    key: serializedAction,
  };
}

export function readPendingAction(storage) {
  try {
    const raw = storage?.getItem?.(PENDING_ACTION_STORAGE_KEY);
    if (!raw) return null;
    const pending = normalizePending(JSON.parse(raw));
    if (!pending) storage?.removeItem?.(PENDING_ACTION_STORAGE_KEY);
    return pending;
  } catch {
    return null;
  }
}

export function rememberPendingAction(storage, pending) {
  const normalized = normalizePending(pending);
  if (!normalized) throw new TypeError('invalid pending action');
  try {
    storage?.setItem?.(PENDING_ACTION_STORAGE_KEY, JSON.stringify({
      requestId: normalized.requestId,
      action: normalized.action,
    }));
  } catch {
    // Persistence is a best-effort browser recovery aid. Server validation and
    // request idempotency remain authoritative even when storage is unavailable.
  }
  return normalized;
}

export function forgetPendingAction(storage) {
  try {
    storage?.removeItem?.(PENDING_ACTION_STORAGE_KEY);
  } catch {
    // A storage failure must not change the already-confirmed server result.
  }
}
