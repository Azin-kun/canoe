import type { Offer } from './types';

export interface FlightSnapshotRow {
  price: number;
  currency: string;
  scrapedAt: Date;
  bookingUrl: string | null;
  airline: string;
  fetchRunId: string | null;
  status: string;
}

const HOUR_MS = 60 * 60 * 1000;
export const SAMPLE_PREFIX = 'Sample · ';

/** Rows must be sorted by scrapedAt descending. */
export function cheapestLatestFlight(rows: FlightSnapshotRow[]): FlightSnapshotRow | null {
  const latest = rows[0];
  if (!latest) return null;
  const sameRun = (r: FlightSnapshotRow) =>
    latest.fetchRunId !== null
      ? r.fetchRunId === latest.fetchRunId
      : latest.scrapedAt.getTime() - r.scrapedAt.getTime() <= HOUR_MS;
  const candidates = rows.filter((r) => sameRun(r) && r.status === 'available' && r.price > 0);
  return candidates.reduce<FlightSnapshotRow | null>((best, r) => (best === null || r.price < best.price ? r : best), null);
}

export function flightOffer(
  query: { id: string; origin: string; destination: string; dateFrom: Date; label: string | null },
  best: FlightSnapshotRow,
): Offer {
  const date = query.dateFrom.toISOString().slice(0, 10);
  return {
    id: query.id,
    category: 'flight',
    label: query.label ?? `${query.origin} → ${query.destination} · ${date} · ${best.airline}`,
    price: best.price,
    currency: best.currency,
    observedAt: best.scrapedAt.toISOString(),
    sourceUrl: best.bookingUrl,
    sample: false,
  };
}

export function hotelOffer(row: { id: string; hotelName: string; latestPrice: number | null; currency: string; lastCheckedAt: Date | null }): Offer | null {
  if (row.latestPrice === null || !(row.latestPrice > 0)) return null;
  return {
    id: row.id, category: 'hotel', label: row.hotelName, price: row.latestPrice, currency: row.currency,
    observedAt: (row.lastCheckedAt ?? new Date(0)).toISOString(), sourceUrl: null, sample: false,
  };
}

export function minorToMajor(minor: bigint, currency: string): number {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return Number(minor) / 10 ** digits;
}

export function carOffer(row: { id: string; label: string; latestPriceMinor: bigint | null; currency: string; lastCheckedAt: Date | null }): Offer | null {
  if (row.latestPriceMinor === null || row.latestPriceMinor <= 0n) return null;
  return {
    id: row.id, category: 'car', label: row.label, price: minorToMajor(row.latestPriceMinor, row.currency), currency: row.currency,
    observedAt: (row.lastCheckedAt ?? new Date(0)).toISOString(), sourceUrl: null, sample: false,
  };
}

/** Clearly labelled demo offers, enabled with CANOE_SAMPLE_OFFERS=true when live scraping is unavailable. */
export function sampleOffers(now: Date): Offer[] {
  const observedAt = now.toISOString();
  const base = { currency: 'USD', observedAt, sourceUrl: null, sample: true } as const;
  return [
    { ...base, id: 'sample-flight-cgk-dps', category: 'flight', label: `${SAMPLE_PREFIX}CGK → DPS · 2026-12-10`, price: 95 },
    { ...base, id: 'sample-hotel-bali', category: 'hotel', label: `${SAMPLE_PREFIX}Bali beach hotel · 3 nights`, price: 85 },
    { ...base, id: 'sample-car-dps', category: 'car', label: `${SAMPLE_PREFIX}Ngurah Rai economy car · 3 days`, price: 45 },
  ];
}
