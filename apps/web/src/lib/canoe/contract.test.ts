import { describe, expect, it } from 'vitest';
import { createTripCall, fromContractCategory, payQuoteArgs, remaining, toContractCategory, type ContractTrip } from './contract';
import type { Quote } from './types';

const NEAR = 10n ** 24n;
const trip: ContractTrip = {
  id: 3, owner: 'canoe-user1.testnet', open: true, expires_at_ms: 2_000_000_000_000,
  limits: { flight: (2n * NEAR).toString(), hotel: NEAR.toString(), car: '0' },
  spent: { flight: (NEAR / 2n).toString(), hotel: '0', car: '0' },
};

describe('category mapping', () => {
  it('maps both ways', () => {
    expect(toContractCategory('hotel')).toBe('Hotel');
    expect(fromContractCategory('Car')).toBe('car');
  });
});

describe('remaining', () => {
  it('subtracts spent from limit', () => {
    expect(remaining(trip, 'flight')).toBe(3n * NEAR / 2n);
    expect(remaining(trip, 'car')).toBe(0n);
  });
});

describe('createTripCall', () => {
  it('builds yocto limits and a matching deposit', () => {
    const call = createTripCall({ flight: '1', hotel: '0.5', car: '0' }, 99);
    expect(call.args).toEqual({ limits: { flight: NEAR.toString(), hotel: (NEAR / 2n).toString(), car: '0' }, expires_at_ms: 99 });
    expect(call.deposit).toBe((3n * NEAR / 2n).toString());
  });
  it('rejects an empty budget', () => {
    expect(() => createTripCall({ flight: '0', hotel: '0', car: '0' }, 99)).toThrow(/greater than zero/);
  });
});

describe('payQuoteArgs', () => {
  it('maps a quote to contract args', () => {
    const quote = { category: 'flight', amountYocto: '42', quoteHash: 'a'.repeat(64), quoteRef: 'flight:q1', expiresAtMs: 5 } as Quote;
    expect(payQuoteArgs(3, quote, 'canoe-dev.testnet')).toEqual({
      trip_id: 3, category: 'Flight', amount: '42', merchant: 'canoe-dev.testnet',
      quote_hash: 'a'.repeat(64), quote_ref: 'flight:q1', quote_expires_at_ms: 5,
    });
  });
});
