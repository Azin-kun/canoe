import { apiError, apiSuccess } from '@/lib/api-response';
import { hotelActor, type HotelActor } from '@/lib/hotels/access';
import { HotelError } from '@/lib/hotels/domain';
import { prisma } from '@/lib/prisma';
import { carOffer, cheapestLatestFlight, flightOffer, hotelOffer, sampleOffers } from '@/lib/canoe/offers';
import type { Offer } from '@/lib/canoe/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  let actor: HotelActor;
  try {
    actor = await hotelActor();
  } catch (error) {
    if (error instanceof HotelError) return apiError(error.message, error.status);
    throw error;
  }
  const owner = actor.userId === null ? {} : { userId: actor.userId };
  const today = new Date(new Date().toISOString().slice(0, 10));

  const [queries, hotels, cars] = await Promise.all([
    prisma.query.findMany({
      where: { ...owner, isSeed: false, dateFrom: { gte: today } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, origin: true, destination: true, dateFrom: true, label: true,
        snapshots: {
          orderBy: { scrapedAt: 'desc' },
          take: 60,
          select: { price: true, currency: true, scrapedAt: true, bookingUrl: true, airline: true, fetchRunId: true, status: true },
        },
      },
    }),
    prisma.hotelTracker.findMany({ where: { ...owner, latestPrice: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.carTracker.findMany({ where: { ...owner, latestPriceMinor: { not: null } }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  const offers: Offer[] = [];
  for (const query of queries) {
    const best = cheapestLatestFlight(query.snapshots);
    if (best) offers.push(flightOffer(query, best));
  }
  for (const hotel of hotels) {
    const search = hotel.search as { currency?: unknown };
    const offer = hotelOffer({
      id: hotel.id,
      hotelName: hotel.hotelName,
      latestPrice: hotel.latestPrice === null ? null : Number(hotel.latestPrice),
      currency: typeof search.currency === 'string' ? search.currency : 'USD',
      lastCheckedAt: hotel.lastCheckedAt,
    });
    if (offer) offers.push(offer);
  }
  for (const car of cars) {
    const offer = carOffer(car);
    if (offer) offers.push(offer);
  }
  if (process.env.CANOE_SAMPLE_OFFERS === 'true') offers.push(...sampleOffers(new Date()));

  return apiSuccess({ offers });
}
