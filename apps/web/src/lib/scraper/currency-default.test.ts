import { describe, expect, it } from 'vitest';
import { DEFAULT_SCRAPE_CURRENCY, scrapeCurrency } from './currency-default';

describe('scrapeCurrency', () => {
  it('uses the first currency that is set', () => {
    expect(scrapeCurrency('EUR', 'GBP')).toBe('EUR');
    expect(scrapeCurrency(null, undefined, 'IDR')).toBe('IDR');
  });

  it('ignores empty strings', () => {
    expect(scrapeCurrency('', 'JPY')).toBe('JPY');
  });

  it('falls back to USD instead of letting Google guess from the IP', () => {
    expect(scrapeCurrency(null, undefined)).toBe('USD');
    expect(DEFAULT_SCRAPE_CURRENCY).toBe('USD');
  });
});
