import { CATEGORIES, type Category, type Quote } from './types';

export type ContractCategory = 'Flight' | 'Hotel' | 'Car';

export interface ContractAmounts {
  flight: string;
  hotel: string;
  car: string;
}

export interface ContractTrip {
  id: number;
  owner: string;
  limits: ContractAmounts;
  spent: ContractAmounts;
  expires_at_ms: number;
  open: boolean;
}

export interface ContractPayment {
  trip_id: number;
  category: ContractCategory;
  amount: string;
  merchant: string;
  quote_hash: string;
  quote_ref: string;
  paid_at_ms: number;
}

const TO_CONTRACT: Record<Category, ContractCategory> = { flight: 'Flight', hotel: 'Hotel', car: 'Car' };

export const toContractCategory = (category: Category): ContractCategory => TO_CONTRACT[category];

export function fromContractCategory(category: ContractCategory): Category {
  const match = CATEGORIES.find((c) => TO_CONTRACT[c] === category);
  if (!match) throw new Error(`Unknown category ${category}`);
  return match;
}

export function remaining(trip: ContractTrip, category: Category): bigint {
  return BigInt(trip.limits[category]) - BigInt(trip.spent[category]);
}

export function createTripCall(limitsYocto: Record<Category, bigint>, expiresAtMs: number) {
  const limits: ContractAmounts = {
    flight: limitsYocto.flight.toString(),
    hotel: limitsYocto.hotel.toString(),
    car: limitsYocto.car.toString(),
  };
  const total = CATEGORIES.reduce((sum, c) => sum + limitsYocto[c], 0n);
  if (total <= 0n) throw new Error('Budget must be greater than zero');
  return { args: { limits, expires_at_ms: expiresAtMs }, deposit: total.toString() };
}

export function payQuoteArgs(tripId: number, quote: Quote, merchant: string): Record<string, unknown> {
  return {
    trip_id: tripId,
    category: toContractCategory(quote.category),
    amount: quote.amountYocto,
    merchant,
    quote_hash: quote.quoteHash,
    quote_ref: quote.quoteRef,
    quote_expires_at_ms: quote.expiresAtMs,
  };
}
