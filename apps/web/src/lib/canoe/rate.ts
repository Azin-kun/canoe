import type { Rate } from './types';

const CACHE_MS = 60_000;
const DEFAULT_FALLBACK: Record<string, number> = { USD: 2.5, IDR: 40_000, EUR: 2.3 };
const cache = new Map<string, { rate: Rate; at: number }>();

export function clearRateCache(): void {
  cache.clear();
}

export function parseCoingecko(body: unknown, currency: string): number | null {
  if (!body || typeof body !== 'object') return null;
  const near = (body as Record<string, unknown>).near;
  if (!near || typeof near !== 'object') return null;
  const value = (near as Record<string, unknown>)[currency.toLowerCase()];
  return typeof value === 'number' && value > 0 ? value : null;
}

export function fallbackRates(): Record<string, number> {
  const raw = process.env.CANOE_FALLBACK_RATES;
  if (!raw) return DEFAULT_FALLBACK;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0),
    );
  } catch {
    return DEFAULT_FALLBACK;
  }
}

export async function getNearRate(currency: string, fetchImpl: typeof fetch = fetch, now: () => Date = () => new Date()): Promise<Rate> {
  const code = currency.toUpperCase();
  const at = now().getTime();
  const hit = cache.get(code);
  if (hit && at - hit.at < CACHE_MS) return hit.rate;

  let rate: Rate | null = null;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=${code.toLowerCase()}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5_000), headers: { accept: 'application/json' } });
    const price = response.ok ? parseCoingecko(await response.json(), code) : null;
    if (price) rate = { currency: code, nearPrice: price, fetchedAt: now().toISOString(), source: 'coingecko' };
  } catch {
    rate = null;
  }
  if (!rate) {
    const price = fallbackRates()[code];
    if (!price) throw new Error(`No NEAR rate for ${code}`);
    rate = { currency: code, nearPrice: price, fetchedAt: now().toISOString(), source: 'fallback' };
  }
  cache.set(code, { rate, at });
  return rate;
}
