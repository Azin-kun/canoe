import { describe, expect, it } from 'vitest';
import { carOffer, cheapestLatestFlight, flightOffer, hotelOffer, minorToMajor, sampleOffers, type FlightSnapshotRow } from './offers';

const row = (price: number, fetchRunId: string | null, minutesAgo: number, status = 'available'): FlightSnapshotRow => ({
  price, currency: 'USD', airline: 'GA', bookingUrl: 'https://example.test/book', fetchRunId, status,
  scrapedAt: new Date(Date.UTC(2026, 10, 11, 12, 0) - minutesAgo * 60_000),
});

describe('cheapestLatestFlight', () => {
  it('picks the cheapest available fare from the latest run only', () => {
    const rows = [row(120, 'r2', 0), row(99, 'r2', 1), row(80, 'r1', 200), row(70, 'r2', 2, 'sold_out')];
    expect(cheapestLatestFlight(rows)?.price).toBe(99);
  });
  it('groups rows without a run id by a one-hour window', () => {
    const rows = [row(150, null, 0), row(140, null, 30), row(60, null, 120)];
    expect(cheapestLatestFlight(rows)?.price).toBe(140);
  });
  it('returns null when nothing is available', () => {
    expect(cheapestLatestFlight([])).toBeNull();
    expect(cheapestLatestFlight([row(50, 'r', 0, 'sold_out')])).toBeNull();
  });
});

describe('offer builders', () => {
  it('builds a flight offer', () => {
    const offer = flightOffer({ id: 'q1', origin: 'CGK', destination: 'DPS', dateFrom: new Date('2026-12-10T00:00:00Z'), label: null }, row(99, 'r', 0));
    expect(offer).toMatchObject({ id: 'q1', category: 'flight', label: 'CGK → DPS · 2026-12-10 · GA', price: 99, currency: 'USD', sample: false });
  });
  it('builds hotel offers and skips missing prices', () => {
    expect(hotelOffer({ id: 'h1', hotelName: 'Beach Inn', latestPrice: 210.5, currency: 'USD', lastCheckedAt: null })).toMatchObject({ category: 'hotel', price: 210.5 });
    expect(hotelOffer({ id: 'h2', hotelName: 'X', latestPrice: null, currency: 'USD', lastCheckedAt: null })).toBeNull();
  });
  it('converts car minor units by currency precision', () => {
    expect(minorToMajor(12345n, 'USD')).toBe(123.45);
    expect(minorToMajor(5000n, 'JPY')).toBe(5000);
    expect(carOffer({ id: 'c1', label: 'Economy', latestPriceMinor: 9900n, currency: 'EUR', lastCheckedAt: null })).toMatchObject({ category: 'car', price: 99 });
    expect(carOffer({ id: 'c2', label: 'X', latestPriceMinor: null, currency: 'EUR', lastCheckedAt: null })).toBeNull();
  });
  it('labels sample offers', () => {
    const samples = sampleOffers(new Date('2026-11-11T00:00:00Z'));
    expect(samples.map((s) => s.category)).toEqual(['flight', 'hotel', 'car']);
    expect(samples.every((s) => s.sample && s.label.startsWith('Sample · '))).toBe(true);
  });
});
