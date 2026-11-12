import { applyScale, fiatToYocto } from './quote';
import type { Offer, Rate } from './types';

const YOCTO_PER_NEAR = 10n ** 24n;
const MICRO = 1_000_000n;

function assertUsd(rate: Rate): void {
  if (rate.currency !== 'USD') throw new Error(`Expected a USD rate, got ${rate.currency}`);
}

/** Demo-scaled NEAR (yocto) needed for a real-world USD amount. */
export function usdToYocto(usd: number, usdRate: Rate, scaleBps: number): bigint {
  assertUsd(usdRate);
  if (!Number.isFinite(usd) || usd < 0) throw new Error('USD amount must be zero or more');
  if (usd === 0) return 0n;
  return applyScale(fiatToYocto(usd, usdRate.nearPrice), scaleBps);
}

/** Real-world USD value represented by a demo-scaled NEAR (yocto) amount. */
export function yoctoToUsd(yocto: bigint, usdRate: Rate, scaleBps: number): number {
  assertUsd(usdRate);
  const microNear = (yocto * MICRO * 10_000n) / (YOCTO_PER_NEAR * BigInt(scaleBps));
  return (Number(microNear) / Number(MICRO)) * usdRate.nearPrice;
}

/** The offer priced in USD, converting through the NEAR price of both currencies when needed. */
export function toUsdOffer(offer: Offer, rates: Record<string, Rate>): Offer | null {
  if (offer.currency === 'USD') return offer;
  const from = rates[offer.currency];
  const usd = rates.USD;
  if (!from || !usd) return null;
  const price = Math.round((offer.price / from.nearPrice) * usd.nearPrice * 100) / 100;
  return { ...offer, price, currency: 'USD', original: { price: offer.price, currency: offer.currency } };
}

export function formatUsd(amount: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits }).format(amount);
}
