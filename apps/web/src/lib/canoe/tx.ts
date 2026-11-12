/** Helpers for reading a NEAR final execution outcome returned by a wallet. */

type Json = Record<string, unknown>;

/** A transaction that reached the chain but failed during execution. */
export class TxFailedError extends Error {
  constructor(message: string, readonly hash: string) {
    super(message);
    this.name = 'TxFailedError';
  }
}

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;

export function txHash(outcome: unknown): string {
  if (!isObject(outcome) || !isObject(outcome.transaction_outcome)) return '';
  const id = outcome.transaction_outcome.id;
  return typeof id === 'string' ? id : '';
}

function failureOf(status: unknown): unknown {
  return isObject(status) && 'Failure' in status ? status.Failure : undefined;
}

function executionError(value: unknown): string | null {
  if (!isObject(value)) return null;
  for (const [key, inner] of Object.entries(value)) {
    if (key === 'ExecutionError' && typeof inner === 'string') return inner;
    const found = executionError(inner);
    if (found) return found;
  }
  return null;
}

/**
 * Returns a readable error when the transaction or any of its receipts failed
 * (for example a contract panic such as "Over category limit: car"), or null
 * when it succeeded. Wallets resolve with the outcome even when execution
 * failed, so callers must check this instead of relying on a rejection.
 */
export function txFailure(outcome: unknown): string | null {
  if (!isObject(outcome)) return null;
  const receipts = Array.isArray(outcome.receipts_outcome) ? outcome.receipts_outcome : [];
  const failure = failureOf(outcome.status)
    ?? receipts.map((r) => (isObject(r) && isObject(r.outcome) ? failureOf(r.outcome.status) : undefined)).find((f) => f !== undefined);
  if (failure === undefined) return null;
  const message = executionError(failure);
  return message ? message.replace(/^Smart contract panicked:\s*/, '') : JSON.stringify(failure);
}
