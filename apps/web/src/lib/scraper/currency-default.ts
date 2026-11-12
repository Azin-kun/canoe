/** Currency used for scraping when neither the query, the user nor the instance sets one. */
export const DEFAULT_SCRAPE_CURRENCY = 'USD';

export function scrapeCurrency(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return DEFAULT_SCRAPE_CURRENCY;
}
