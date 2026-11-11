import { CANOE_DEMO_SCALE_BPS, QUOTE_TTL_MS } from './config';
import type { Offer, Quote, Rate } from './types';

const YOCTO_PER_NEAR = 10n ** 24n;
const MICRO = 1_000_000;

export function fiatToYocto(amount: number, nearPrice: number): bigint {
  if (!(amount > 0) || !(nearPrice > 0) || !Number.isFinite(amount) || !Number.isFinite(nearPrice)) {
    throw new Error('amount and nearPrice must be positive numbers');
  }
  const amountMicro = BigInt(Math.round(amount * MICRO));
  const priceMicro = BigInt(Math.round(nearPrice * MICRO));
  return (amountMicro * YOCTO_PER_NEAR) / priceMicro;
}

export function applyScale(yocto: bigint, scaleBps: number): bigint {
  return (yocto * BigInt(scaleBps)) / 10_000n;
}

export function nearToYocto(near: string): bigint {
  const text = near.trim();
  if (!/^\d+(\.\d{1,24})?$/.test(text)) throw new Error(`Invalid NEAR amount: ${near}`);
  const [whole = '0', fraction = ''] = text.split('.');
  return BigInt(whole) * YOCTO_PER_NEAR + BigInt(fraction.padEnd(24, '0'));
}

export function formatNear(yocto: bigint | string, digits = 4): string {
  const value = typeof yocto === 'bigint' ? yocto : BigInt(yocto);
  const whole = value / YOCTO_PER_NEAR;
  const fraction = (value % YOCTO_PER_NEAR).toString().padStart(24, '0').slice(0, digits).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildQuote(offer: Offer, rate: Rate, nowMs: number, scaleBps = CANOE_DEMO_SCALE_BPS): Promise<Quote> {
  if (offer.currency !== rate.currency) {
    throw new Error(`Rate currency ${rate.currency} does not match offer currency ${offer.currency}`);
  }
  const amountYocto = applyScale(fiatToYocto(offer.price, rate.nearPrice), scaleBps).toString();
  const body = {
    offerId: offer.id,
    category: offer.category,
    quoteRef: `${offer.category}:${offer.id}`,
    fiatAmount: offer.price,
    currency: offer.currency,
    nearPrice: rate.nearPrice,
    rateSource: rate.source,
    scaleBps,
    amountYocto,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + QUOTE_TTL_MS,
  };
  return { ...body, quoteHash: await sha256Hex(canonicalJson(body)) };
}
