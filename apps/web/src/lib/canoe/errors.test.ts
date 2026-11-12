import { describe, expect, it } from 'vitest';
import { friendlyError } from './errors';

describe('friendlyError', () => {
  it.each([
    ['Over category limit: car', { key: 'overLimit', category: 'car' }],
    ['Smart contract panicked: Over category limit: flight', { key: 'overLimit', category: 'flight' }],
    ['Quote expired', { key: 'quoteExpired' }],
    ['Trip expired', { key: 'tripExpired' }],
    ['Trip is closed', { key: 'tripClosed' }],
    ['Quote already paid', { key: 'alreadyPaid' }],
    ['Only the trip owner can do this', { key: 'notOwner' }],
    ['Attached deposit must equal the sum of limits', { key: 'budgetInvalid' }],
    ['Budget must be greater than zero', { key: 'budgetInvalid' }],
    ['Expiry must be in the future', { key: 'budgetInvalid' }],
    ['User rejected the request', { key: 'cancelled' }],
    ['Wallet closed', { key: 'cancelled' }],
    ['Request denied', { key: 'cancelled' }],
  ])('maps %s', (message, expected) => {
    expect(friendlyError(message)).toEqual(expected);
  });

  it('keeps the original text for anything unknown', () => {
    expect(friendlyError('RPC timeout')).toEqual({ key: 'generic', details: 'RPC timeout' });
  });
});
