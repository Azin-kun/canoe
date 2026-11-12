export type Category = 'flight' | 'hotel' | 'car';

export const CATEGORIES: readonly Category[] = ['flight', 'hotel', 'car'];

export interface Offer {
  id: string;
  category: Category;
  label: string;
  price: number;
  currency: string;
  observedAt: string;
  sourceUrl: string | null;
  sample: boolean;
  /** Set when the price was converted for display; the scraped price and currency. */
  original?: { price: number; currency: string };
}

export interface Rate {
  currency: string;
  /** Fiat units for one NEAR, e.g. 2.5 USD or 40000 IDR. */
  nearPrice: number;
  fetchedAt: string;
  source: 'coingecko' | 'fallback';
}

export interface Quote {
  offerId: string;
  category: Category;
  quoteRef: string;
  fiatAmount: number;
  currency: string;
  nearPrice: number;
  rateSource: Rate['source'];
  scaleBps: number;
  amountYocto: string;
  createdAtMs: number;
  expiresAtMs: number;
  quoteHash: string;
}
