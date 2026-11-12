import { describe, expect, it } from 'vitest';
import { txFailure, txHash } from './tx';

const panicked = {
  ActionError: {
    index: 0,
    kind: { FunctionCallError: { ExecutionError: 'Smart contract panicked: Over category limit: car' } },
  },
};

describe('txHash', () => {
  it('reads the transaction id from a final execution outcome', () => {
    expect(txHash({ transaction_outcome: { id: 'abc' } })).toBe('abc');
  });

  it('returns an empty string for anything else', () => {
    expect(txHash(null)).toBe('');
    expect(txHash({})).toBe('');
    expect(txHash({ transaction_outcome: { id: 1 } })).toBe('');
  });
});

describe('txFailure', () => {
  it('returns null for a successful outcome', () => {
    expect(txFailure({ status: { SuccessValue: '' }, receipts_outcome: [{ outcome: { status: { SuccessValue: '' } } }] })).toBeNull();
    expect(txFailure(undefined)).toBeNull();
  });

  it('extracts the contract panic message from the top-level status', () => {
    expect(txFailure({ status: { Failure: panicked } })).toBe('Over category limit: car');
  });

  it('extracts a failure from a receipt when the top-level status is missing', () => {
    expect(txFailure({ receipts_outcome: [{ outcome: { status: { SuccessValue: '' } } }, { outcome: { status: { Failure: panicked } } }] }))
      .toBe('Over category limit: car');
  });

  it('falls back to JSON for an unrecognised failure shape', () => {
    expect(txFailure({ status: { Failure: { InvalidTxError: 'NotEnoughBalance' } } })).toBe('{"InvalidTxError":"NotEnoughBalance"}');
  });
});
