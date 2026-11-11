import { describe, expect, it } from 'vitest';
import { applyScale, buildQuote, canonicalJson, fiatToYocto, formatNear, nearToYocto, sha256Hex } from './quote';
import type { Offer, Rate } from './types';

const NEAR = 10n ** 24n;
const offer: Offer = {
  id: 'q1', category: 'flight', label: 'CGK → DPS', price: 1_500_000, currency: 'IDR',
  observedAt: '2026-11-11T03:00:00.000Z', sourceUrl: null, sample: false,
};
const rate: Rate = { currency: 'IDR', nearPrice: 40_000, fetchedAt: '2026-11-11T03:00:00.000Z', source: 'coingecko' };

describe('fiatToYocto', () => {
  it('converts IDR at 40,000 per NEAR', () => {
    expect(fiatToYocto(1_500_000, 40_000)).toBe(375n * NEAR / 10n);
  });
  it('converts USD at 2.5 per NEAR', () => {
    expect(fiatToYocto(10, 2.5)).toBe(4n * NEAR);
  });
  it('rejects non-positive input', () => {
    expect(() => fiatToYocto(0, 2.5)).toThrow(/positive/);
    expect(() => fiatToYocto(10, 0)).toThrow(/positive/);
  });
});

describe('applyScale', () => {
  it('applies basis points', () => {
    expect(applyScale(4n * NEAR, 100)).toBe(4n * NEAR / 100n);
    expect(applyScale(4n * NEAR, 10_000)).toBe(4n * NEAR);
  });
});

describe('nearToYocto / formatNear', () => {
  it('parses decimal NEAR strings', () => {
    expect(nearToYocto('1.5')).toBe(15n * NEAR / 10n);
    expect(nearToYocto('0')).toBe(0n);
    expect(nearToYocto(' 2 ')).toBe(2n * NEAR);
  });
  it('rejects invalid strings', () => {
    expect(() => nearToYocto('abc')).toThrow(/Invalid NEAR amount/);
    expect(() => nearToYocto('-1')).toThrow(/Invalid NEAR amount/);
  });
  it('formats yocto as trimmed NEAR', () => {
    expect(formatNear(15n * NEAR / 10n)).toBe('1.5');
    expect(formatNear('37500000000000000000000000')).toBe('37.5');
    expect(formatNear(0n)).toBe('0');
    expect(formatNear(123456n * NEAR / 1_000_000n, 2)).toBe('0.12');
  });
});

describe('canonicalJson / sha256Hex', () => {
  it('sorts keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe('{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
  });
  it('hashes with sha256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('buildQuote', () => {
  it('builds a deterministic scaled quote', async () => {
    const a = await buildQuote(offer, rate, 1_000, 100);
    const b = await buildQuote(offer, rate, 1_000, 100);
    expect(a).toEqual(b);
    expect(a.amountYocto).toBe((375n * NEAR / 1000n).toString());
    expect(a.quoteRef).toBe('flight:q1');
    expect(a.expiresAtMs).toBe(1_000 + 10 * 60 * 1000);
    expect(a.quoteHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('changes the hash when the scale changes', async () => {
    const a = await buildQuote(offer, rate, 1_000, 100);
    const b = await buildQuote(offer, rate, 1_000, 200);
    expect(a.quoteHash).not.toBe(b.quoteHash);
  });
  it('rejects a rate in another currency', async () => {
    await expect(buildQuote(offer, { ...rate, currency: 'USD' }, 1_000, 100)).rejects.toThrow(/currency/);
  });
});
