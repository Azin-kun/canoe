import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRateCache, getNearRate, parseCoingecko } from './rate';

const now = () => new Date('2026-11-11T00:00:00.000Z');
const okFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

beforeEach(() => clearRateCache());

describe('parseCoingecko', () => {
  it('reads near.<currency>', () => {
    expect(parseCoingecko({ near: { idr: 41000 } }, 'IDR')).toBe(41000);
    expect(parseCoingecko({ near: {} }, 'IDR')).toBeNull();
    expect(parseCoingecko('nope', 'IDR')).toBeNull();
  });
});

describe('getNearRate', () => {
  it('uses CoinGecko when it answers', async () => {
    const rate = await getNearRate('IDR', okFetch({ near: { idr: 41000 } }), now);
    expect(rate).toEqual({ currency: 'IDR', nearPrice: 41000, fetchedAt: '2026-11-11T00:00:00.000Z', source: 'coingecko' });
  });
  it('caches for 60 seconds', async () => {
    const fetchImpl = okFetch({ near: { usd: 3 } });
    await getNearRate('USD', fetchImpl, now);
    await getNearRate('USD', fetchImpl, now);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('falls back to the labelled default table', async () => {
    const failing = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const rate = await getNearRate('USD', failing, now);
    expect(rate).toMatchObject({ currency: 'USD', nearPrice: 2.5, source: 'fallback' });
  });
  it('throws when no rate exists', async () => {
    const failing = vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    await expect(getNearRate('JPY', failing, now)).rejects.toThrow('No NEAR rate for JPY');
  });
});
