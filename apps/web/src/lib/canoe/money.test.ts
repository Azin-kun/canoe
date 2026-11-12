import { describe, expect, it } from 'vitest';
import { formatUsd, toUsdOffer, usdToYocto, yoctoToUsd } from './money';
import type { Offer, Rate } from './types';

const NEAR = 10n ** 24n;
const rate = (currency: string, nearPrice: number): Rate => ({ currency, nearPrice, fetchedAt: '2026-11-12T00:00:00Z', source: 'coingecko' });
const usd = rate('USD', 2.5);
const offer = (price: number, currency: string): Offer => ({
  id: 'o1', category: 'flight', label: 'CGK → DPS', price, currency, observedAt: '2026-11-12T00:00:00Z', sourceUrl: null, sample: false,
});

describe('usdToYocto', () => {
  it('converts USD to NEAR at the live rate and applies the demo scale', () => {
    // $100 / 2.5 = 40 NEAR, 1% demo scale = 0.4 NEAR
    expect(usdToYocto(100, usd, 100)).toBe((4n * NEAR) / 10n);
  });
  it('returns zero for a zero budget', () => {
    expect(usdToYocto(0, usd, 100)).toBe(0n);
  });
  it('rejects negative amounts and non-USD rates', () => {
    expect(() => usdToYocto(-1, usd, 100)).toThrow();
    expect(() => usdToYocto(10, rate('IDR', 40_000), 100)).toThrow(/USD/);
  });
});

describe('yoctoToUsd', () => {
  it('turns a scaled NEAR amount back into the real-world USD value', () => {
    expect(yoctoToUsd((4n * NEAR) / 10n, usd, 100)).toBeCloseTo(100, 6);
    expect(yoctoToUsd(0n, usd, 100)).toBe(0);
  });
});

describe('toUsdOffer', () => {
  it('keeps USD offers unchanged', () => {
    const o = offer(95, 'USD');
    expect(toUsdOffer(o, { USD: usd })).toBe(o);
  });
  it('converts other currencies through the NEAR price and remembers the original', () => {
    // IDR 1,500,000 / 40,000 = 37.5 NEAR * $2.5 = $93.75
    expect(toUsdOffer(offer(1_500_000, 'IDR'), { USD: usd, IDR: rate('IDR', 40_000) })).toMatchObject({
      price: 93.75, currency: 'USD', original: { price: 1_500_000, currency: 'IDR' },
    });
  });
  it('returns null while a needed rate is missing', () => {
    expect(toUsdOffer(offer(1_500_000, 'IDR'), { USD: usd })).toBeNull();
    expect(toUsdOffer(offer(1_500_000, 'IDR'), { IDR: rate('IDR', 40_000) })).toBeNull();
  });
});

describe('formatUsd', () => {
  it('formats whole dollars by default and cents on request', () => {
    expect(formatUsd(95)).toBe('$95');
    expect(formatUsd(1250)).toBe('$1,250');
    expect(formatUsd(93.75, 2)).toBe('$93.75');
    expect(formatUsd(95, 2)).toBe('$95');
  });
});
