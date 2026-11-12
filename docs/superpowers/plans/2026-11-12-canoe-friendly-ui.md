# CANOE Beginner-Friendly Trip Budget (USD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/trip` usable by people who have never used a crypto wallet, with every price, budget and scraped fare shown in USD.

**Architecture:** Pure helpers in `apps/web/src/lib/canoe/` (USD↔NEAR money maths, friendly error mapping) are unit-tested first. The Trip Budget page is rebuilt as three numbered `Step` sections driven by wallet/trip state, fed by one shared `useNearRates` hook. Flight scraping falls back to USD instead of Google's IP-based guess. The contract and `/api/canoe/*` routes do not change.

**Tech Stack:** Next.js 16 / React 19 client components, next-intl, CSS Modules, Vitest + Testing Library (jsdom), `@hot-labs/near-connect@0.11.4`.

Spec: `docs/superpowers/specs/2026-11-12-canoe-friendly-ui-design.md`.

## Global Constraints

- Plain English copy, no web3 jargon in user-facing text ("receipt", not "transaction"; "set aside", not "lock").
- USD everywhere on `/trip`: budget inputs, offer prices, sample offers, payment amounts (NEAR shown next to USD).
- Demo scale stays `CANOE_DEMO_SCALE_BPS` (default 100 = 1%) and stays part of the quote hash.
- Wallets `near-cli` and `ethereum-wallets` hidden unless `NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS=true`.
- Links: Meteor `https://wallet.meteorwallet.app`, faucet `https://docs.near.org/tools/faucet`.
- CSS Modules only, no inline styles, no Tailwind, no `any`, TypeScript strict (`noUncheckedIndexedAccess` is on).
- Every `messages/<locale>/canoe.json` has the same keys (parity test); non-English locales reuse the English text.
- Do not touch `contracts/`, `/api/canoe/*`, or the quote-hash fields in `lib/canoe/quote.ts`.
- Run commands from `apps/web` unless noted. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Flight scraping defaults to USD

**Files:**
- Create: `apps/web/src/lib/scraper/currency-default.ts`
- Test: `apps/web/src/lib/scraper/currency-default.test.ts`
- Modify: `apps/web/src/lib/scraper/run-scrape.ts:642`
- Modify: `apps/web/src/lib/preview-runner.ts:614`
- Modify: `apps/web/messages/{en,de,es,fr,pt}/settings.json` (`Settings.extraction.autoDetect`), `apps/web/messages/{en,de,es,fr,pt}/components.json` (`ManualEntryForm.autoDetect`)

**Interfaces:**
- Produces: `scrapeCurrency(...candidates: Array<string | null | undefined>): string` — first non-empty candidate, else `'USD'`.

The helper lives in `lib/scraper/` and is imported with a relative path, so the CLI bundle needs no new shim (see CLAUDE.md "Monorepo").

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/scraper/currency-default.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scraper/currency-default.test.ts`
Expected: FAIL with "Cannot find module './currency-default'".

- [ ] **Step 3: Write the helper**

```ts
// apps/web/src/lib/scraper/currency-default.ts
/** Currency used for scraping when neither the query, the user nor the instance sets one. */
export const DEFAULT_SCRAPE_CURRENCY = 'USD';

export function scrapeCurrency(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return DEFAULT_SCRAPE_CURRENCY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/scraper/currency-default.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Use it in both scrape paths**

In `apps/web/src/lib/scraper/run-scrape.ts` add next to the other relative imports:

```ts
import { scrapeCurrency } from './currency-default';
```

and replace line 642

```ts
  const effectiveCurrency = query.currency ?? config?.defaultCurrency ?? null;
```

with

```ts
  const effectiveCurrency = scrapeCurrency(query.currency, config?.defaultCurrency);
```

In `apps/web/src/lib/preview-runner.ts` add

```ts
import { scrapeCurrency } from './scraper/currency-default';
```

and replace line 614

```ts
  const currency: string | null = config?.defaultCurrency ?? bodyCurrency;
```

with

```ts
  const currency: string = scrapeCurrency(config?.defaultCurrency, bodyCurrency);
```

- [ ] **Step 6: Relabel the empty currency option as USD**

Run from repo root:

```bash
python - <<'PY'
import json
labels = {'en': 'USD (default)', 'de': 'USD (Standard)', 'es': 'USD (predeterminado)', 'fr': 'USD (par défaut)', 'pt': 'USD (padrão)'}
for loc, label in labels.items():
    for file, path in (('settings.json', ('Settings', 'extraction', 'autoDetect')), ('components.json', ('ManualEntryForm', 'autoDetect'))):
        p = f'apps/web/messages/{loc}/{file}'
        data = json.load(open(p, encoding='utf-8'))
        node = data
        for key in path[:-1]:
            node = node[key]
        node[path[-1]] = label
        open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
PY
git diff --stat apps/web/messages
```

Expected: 10 files changed, 1 line each. If `git diff` shows whole-file reformatting, revert with `git checkout -- apps/web/messages` and make the ten one-line edits by hand instead.

- [ ] **Step 7: Typecheck and run scraper/preview/i18n tests**

Run: `npx tsc --noEmit -p . && npx vitest run src/lib/scraper src/lib/preview-runner.test.ts src/i18n`
Expected: no type errors; all tests pass. If a test asserted a `null` currency for an unset query, update its expectation to `'USD'` and note it in the commit message.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/scraper/currency-default.ts apps/web/src/lib/scraper/currency-default.test.ts apps/web/src/lib/scraper/run-scrape.ts apps/web/src/lib/preview-runner.ts apps/web/messages
git commit -m "feat(scrape): default flight scraping to USD instead of IP-based guess

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: USD money helpers and USD sample offers

**Files:**
- Create: `apps/web/src/lib/canoe/money.ts`
- Test: `apps/web/src/lib/canoe/money.test.ts`
- Modify: `apps/web/src/lib/canoe/types.ts` (add `original` to `Offer`)
- Modify: `apps/web/src/lib/canoe/offers.ts:66-75` (`sampleOffers`)
- Test: `apps/web/src/lib/canoe/offers.test.ts:39-43`

**Interfaces:**
- Consumes: `applyScale(yocto: bigint, scaleBps: number): bigint`, `fiatToYocto(amount: number, nearPrice: number): bigint` from `./quote`; `Offer`, `Rate` from `./types`.
- Produces:
  - `Offer.original?: { price: number; currency: string }`
  - `usdToYocto(usd: number, usdRate: Rate, scaleBps: number): bigint` (0 → `0n`; negative/NaN or non-USD rate throws)
  - `yoctoToUsd(yocto: bigint, usdRate: Rate, scaleBps: number): number` (real-world USD before the demo scale)
  - `toUsdOffer(offer: Offer, rates: Record<string, Rate>): Offer | null`
  - `formatUsd(amount: number, maximumFractionDigits?: number): string` (default 0 digits)

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/lib/canoe/money.test.ts
import { describe, expect, it } from 'vitest';
import { formatUsd, toUsdOffer, usdToYocto, yoctoToUsd } from './money';
import type { Offer, Rate } from './types';

const NEAR = 10n ** 24n;
const rate = (currency: string, nearPrice: number): Rate => ({ currency, nearPrice, fetchedAt: '2026-11-12T00:00:00Z', source: 'coingecko' });
const usd = rate('USD', 2.5);
const offer = (price: number, currency: string): Offer => ({
  id: 'o1', category: 'flight', label: 'CGK → DPS', price, currency, observedAt: '2026-11-12T00:00:00Z', sourceUrl: null, sample: false,
});

describe('usdToYocto', () => {
  it('converts USD to NEAR at the live rate and applies the demo scale', () => {
    // $100 / 2.5 = 40 NEAR, 1% demo scale = 0.4 NEAR
    expect(usdToYocto(100, usd, 100)).toBe((4n * NEAR) / 10n);
  });
  it('returns zero for a zero budget', () => {
    expect(usdToYocto(0, usd, 100)).toBe(0n);
  });
  it('rejects negative amounts and non-USD rates', () => {
    expect(() => usdToYocto(-1, usd, 100)).toThrow();
    expect(() => usdToYocto(10, rate('IDR', 40_000), 100)).toThrow(/USD/);
  });
});

describe('yoctoToUsd', () => {
  it('turns a scaled NEAR amount back into the real-world USD value', () => {
    expect(yoctoToUsd((4n * NEAR) / 10n, usd, 100)).toBeCloseTo(100, 6);
    expect(yoctoToUsd(0n, usd, 100)).toBe(0);
  });
});

describe('toUsdOffer', () => {
  it('keeps USD offers unchanged', () => {
    const o = offer(95, 'USD');
    expect(toUsdOffer(o, { USD: usd })).toBe(o);
  });
  it('converts other currencies through the NEAR price and remembers the original', () => {
    // IDR 1,500,000 / 40,000 = 37.5 NEAR * $2.5 = $93.75
    expect(toUsdOffer(offer(1_500_000, 'IDR'), { USD: usd, IDR: rate('IDR', 40_000) })).toMatchObject({
      price: 93.75, currency: 'USD', original: { price: 1_500_000, currency: 'IDR' },
    });
  });
  it('returns null while a needed rate is missing', () => {
    expect(toUsdOffer(offer(1_500_000, 'IDR'), { USD: usd })).toBeNull();
    expect(toUsdOffer(offer(1_500_000, 'IDR'), { IDR: rate('IDR', 40_000) })).toBeNull();
  });
});

describe('formatUsd', () => {
  it('formats whole dollars by default and cents on request', () => {
    expect(formatUsd(95)).toBe('$95');
    expect(formatUsd(1250)).toBe('$1,250');
    expect(formatUsd(93.75, 2)).toBe('$93.75');
    expect(formatUsd(95, 2)).toBe('$95');
  });
});
```

Replace the `labels sample offers` test in `apps/web/src/lib/canoe/offers.test.ts` (lines 39-43) with:

```ts
  it('labels sample offers and prices them in USD', () => {
    const samples = sampleOffers(new Date('2026-11-11T00:00:00Z'));
    expect(samples.map((s) => s.category)).toEqual(['flight', 'hotel', 'car']);
    expect(samples.every((s) => s.sample && s.label.startsWith('Sample · '))).toBe(true);
    expect(samples.map((s) => [s.currency, s.price])).toEqual([['USD', 95], ['USD', 85], ['USD', 45]]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/canoe/money.test.ts src/lib/canoe/offers.test.ts`
Expected: money.test.ts FAIL "Cannot find module './money'"; offers test FAIL (samples are IDR).

- [ ] **Step 3: Add `original` to `Offer`**

In `apps/web/src/lib/canoe/types.ts`, change the `Offer` interface to:

```ts
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
```

- [ ] **Step 4: Write `money.ts`**

```ts
// apps/web/src/lib/canoe/money.ts
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
```

- [ ] **Step 5: Switch sample offers to USD**

In `apps/web/src/lib/canoe/offers.ts` replace `sampleOffers` with:

```ts
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/lib/canoe`
Expected: all canoe lib tests pass (money 9 new tests included).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/canoe/money.ts apps/web/src/lib/canoe/money.test.ts apps/web/src/lib/canoe/types.ts apps/web/src/lib/canoe/offers.ts apps/web/src/lib/canoe/offers.test.ts
git commit -m "feat(canoe): USD money helpers and USD sample offers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Friendly error mapping

**Files:**
- Create: `apps/web/src/lib/canoe/errors.ts`
- Test: `apps/web/src/lib/canoe/errors.test.ts`

**Interfaces:**
- Consumes: `Category` from `./types`.
- Produces: `type FriendlyErrorKey = 'overLimit' | 'quoteExpired' | 'tripExpired' | 'tripClosed' | 'alreadyPaid' | 'notOwner' | 'budgetInvalid' | 'cancelled' | 'generic'`; `interface FriendlyError { key: FriendlyErrorKey; category?: Category; details?: string }`; `friendlyError(message: string): FriendlyError`. The keys match `Canoe.errors.<key>` messages added in Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/canoe/errors.test.ts
import { describe, expect, it } from 'vitest';
import { friendlyError } from './errors';

describe('friendlyError', () => {
  it.each([
    ['Over category limit: car', { key: 'overLimit', category: 'car' }],
    ['Smart contract panicked: Over category limit: flight', { key: 'overLimit', category: 'flight' }],
    ['Quote expired', { key: 'quoteExpired' }],
    ['Trip expired', { key: 'tripExpired' }],
    ['Trip is closed', { key: 'tripClosed' }],
    ['Quote already paid', { key: 'alreadyPaid' }],
    ['Only the trip owner can do this', { key: 'notOwner' }],
    ['Attached deposit must equal the sum of limits', { key: 'budgetInvalid' }],
    ['Budget must be greater than zero', { key: 'budgetInvalid' }],
    ['Expiry must be in the future', { key: 'budgetInvalid' }],
    ['User rejected the request', { key: 'cancelled' }],
    ['Wallet closed', { key: 'cancelled' }],
    ['Request denied', { key: 'cancelled' }],
  ])('maps %s', (message, expected) => {
    expect(friendlyError(message)).toEqual(expected);
  });

  it('keeps the original text for anything unknown', () => {
    expect(friendlyError('RPC timeout')).toEqual({ key: 'generic', details: 'RPC timeout' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/canoe/errors.test.ts`
Expected: FAIL "Cannot find module './errors'".

- [ ] **Step 3: Write `errors.ts`**

```ts
// apps/web/src/lib/canoe/errors.ts
import { CATEGORIES, type Category } from './types';

export type FriendlyErrorKey =
  | 'overLimit' | 'quoteExpired' | 'tripExpired' | 'tripClosed' | 'alreadyPaid'
  | 'notOwner' | 'budgetInvalid' | 'cancelled' | 'generic';

export interface FriendlyError {
  key: FriendlyErrorKey;
  category?: Category;
  details?: string;
}

const RULES: ReadonlyArray<[RegExp, FriendlyErrorKey]> = [
  [/Quote expired/, 'quoteExpired'],
  [/Trip expired/, 'tripExpired'],
  [/Trip is closed/, 'tripClosed'],
  [/Quote already paid/, 'alreadyPaid'],
  [/Only the trip owner/, 'notOwner'],
  [/Attached deposit must equal|Budget must be greater than zero|Expiry must be in the future/, 'budgetInvalid'],
  [/reject|cancel|denied|closed/i, 'cancelled'],
];

/** Maps contract panics and wallet errors to a message key a non-crypto user understands. */
export function friendlyError(message: string): FriendlyError {
  const over = /Over category limit: (\w+)/.exec(message);
  const category = CATEGORIES.find((c) => c === over?.[1]?.toLowerCase());
  if (category) return { key: 'overLimit', category };
  const rule = RULES.find(([pattern]) => pattern.test(message));
  return rule ? { key: rule[1] } : { key: 'generic', details: message };
}
```

`Trip is closed` is checked before the generic `closed` wallet rule because `RULES` is ordered.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/canoe/errors.test.ts`
Expected: 14 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/canoe/errors.ts apps/web/src/lib/canoe/errors.test.ts
git commit -m "feat(canoe): map contract and wallet errors to plain-language keys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hide developer wallets and add help links

**Files:**
- Modify: `apps/web/src/lib/canoe/config.ts`
- Modify: `apps/web/src/components/canoe/NearProvider.tsx:23-27` (connector construction)

**Interfaces:**
- Produces (from `@/lib/canoe/config`): `DEV_WALLET_IDS: readonly ['near-cli', 'ethereum-wallets']`, `CANOE_EXCLUDED_WALLETS: string[]`, `METEOR_WALLET_URL: string`, `TESTNET_FAUCET_URL: string`.

Wallet ids come from the live near-connect manifest (`https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json`): `near-cli` ("NEAR CLI") and `ethereum-wallets` ("Ethereum Wallets").

- [ ] **Step 1: Add config values**

Append to `apps/web/src/lib/canoe/config.ts`:

```ts
/** Wallets meant for developers; hidden from the picker unless NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS=true. */
export const DEV_WALLET_IDS = ['near-cli', 'ethereum-wallets'] as const;
export const CANOE_EXCLUDED_WALLETS: string[] =
  process.env.NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS === 'true' ? [] : [...DEV_WALLET_IDS];

export const METEOR_WALLET_URL = 'https://wallet.meteorwallet.app';
export const TESTNET_FAUCET_URL = 'https://docs.near.org/tools/faucet';
```

- [ ] **Step 2: Pass the exclusion list to NearConnector**

In `apps/web/src/components/canoe/NearProvider.tsx` change the config import to

```ts
import { CANOE_EXCLUDED_WALLETS, CANOE_NETWORK, CANOE_RPC_URLS } from '@/lib/canoe/config';
```

and the connector to

```ts
  const connector = useMemo(
    () => new NearConnector({
      network: CANOE_NETWORK,
      providers: { mainnet: CANOE_RPC_URLS.mainnet, testnet: CANOE_RPC_URLS.testnet },
      excludedWallets: CANOE_EXCLUDED_WALLETS,
    }),
    [],
  );
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p . && npx eslint src/lib/canoe/config.ts src/components/canoe/NearProvider.tsx`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/canoe/config.ts apps/web/src/components/canoe/NearProvider.tsx
git commit -m "feat(canoe): hide developer wallets by default and add wallet help links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Three-step Trip Budget page in USD

**Files:**
- Modify: `apps/web/messages/{en,de,es,fr,pt}/canoe.json` (full replacement, identical in all five)
- Modify: `apps/web/src/components/canoe/TripBudget.module.css` (append step/help/progress styles)
- Create: `apps/web/src/components/canoe/useNearRates.ts`
- Create: `apps/web/src/components/canoe/Step.tsx`, Test: `apps/web/src/components/canoe/Step.test.tsx`
- Create: `apps/web/src/components/canoe/WalletHelp.tsx`
- Modify: `apps/web/src/lib/canoe/contract.ts` (`createTripCall` takes yocto), Test: `apps/web/src/lib/canoe/contract.test.ts:26-35`
- Replace: `apps/web/src/components/canoe/TripCreateForm.tsx`, Test: `apps/web/src/components/canoe/TripCreateForm.test.tsx`
- Replace: `apps/web/src/components/canoe/OfferList.tsx`, `apps/web/src/components/canoe/PaymentHistory.tsx`, `apps/web/src/components/canoe/TripBudget.tsx`

**Interfaces:**
- Consumes: Task 2 `usdToYocto`, `yoctoToUsd`, `toUsdOffer`, `formatUsd`; Task 3 `friendlyError`; Task 4 `METEOR_WALLET_URL`, `TESTNET_FAUCET_URL`; existing `TxFailedError` (`@/lib/canoe/tx`), `formatNear` (`@/lib/canoe/quote`), `buildQuote`, `payQuoteArgs`, `remaining`.
- Produces:
  - `createTripCall(limitsYocto: Record<Category, bigint>, expiresAtMs: number): { args: { limits: ContractAmounts; expires_at_ms: number }; deposit: string }`
  - `useNearRates(currencies: readonly string[]): { rates: Record<string, Rate>; failed: boolean }`
  - `Step({ number, title, state, lockedReason, children })`, `type StepState = 'done' | 'active' | 'locked'`
  - `TripCreateForm({ disabled, usdRate, rateError, onCreate })` with `onCreate(limits: Record<Category, bigint>, days: number): Promise<void>`
  - `OfferList({ offers, rates, trip, busy, onPay })` with `onPay(offer: Offer /* USD */, usdRate: Rate): Promise<void>`
  - `PaymentHistory({ payments, txByHash, usdRate })`

Refinement of spec §3: payments render in their own "Your payments" card below the steps whenever the last trip has payments, so they stay visible after the trip ends (Step 3 is locked then).

- [ ] **Step 1: Replace the Canoe messages (all five locales)**

Write this exact JSON to `apps/web/messages/en/canoe.json`, then copy it to `de`, `es`, `fr`, `pt`:

```json
{
  "Canoe": {
    "navTrip": "Trip Budget",
    "eyebrow": "CANOE on NEAR",
    "headline": "One trip, one budget, paid on-chain.",
    "intro": "Set a budget for flights, hotels and car rental. Every payment needs your OK in your wallet, and a payment over budget is refused automatically.",
    "demoNote": "Demo mode: this uses free NEAR test tokens with no real value. Bookings are simulated. Payments are {percent}% of the real price so test balances last.",
    "stepLabel": "Step {number}",
    "stepDone": "Done",
    "step1Title": "Connect your wallet",
    "step1Body": "Your wallet keeps your NEAR. CANOE never sees your keys.",
    "step2Title": "Set your trip budget",
    "step3Title": "Pay for your bookings",
    "lockedConnect": "Connect a wallet first.",
    "lockedBudget": "Set your trip budget first.",
    "connect": "Connect wallet",
    "disconnect": "Disconnect",
    "connectedAs": "Connected as {account}",
    "walletHelpTitle": "New to wallets?",
    "walletHelp1": "Create a free Meteor Wallet and pick a testnet account.",
    "walletHelp1Link": "Open Meteor Wallet",
    "walletHelp2": "Get free test NEAR for that account.",
    "walletHelp2Link": "Open the NEAR faucet",
    "walletHelp3": "Come back here and tap Connect wallet.",
    "flight": "Flights",
    "hotel": "Hotels",
    "car": "Car rental",
    "budgetField": "{category} budget (USD)",
    "tripDays": "Trip length (days)",
    "budgetSummary": "You'll set aside {near} NEAR from your wallet (demo price for {usd}). Unused money comes back when you end the trip.",
    "createButton": "Set aside {near} NEAR",
    "loadingPrice": "Loading price…",
    "rateError": "Can't load the NEAR price right now. Try again in a minute.",
    "endsOn": "Ends {date}",
    "spentLeft": "Spent ≈ {spent} · Left ≈ {left} ({near} NEAR)",
    "endTrip": "End trip & return unused money",
    "lastTrip": "Your last trip budget has ended. Unused money went back to your wallet.",
    "offersTitle": "Offers you're tracking",
    "noOffers": "No tracked offers with a price yet. Track a flight, hotel or car first.",
    "sample": "sample",
    "convertedFrom": "converted from {amount}",
    "payButton": "Pay {usd} · {near} NEAR",
    "overBudget": "More than what's left in your {category} budget — the contract will refuse it.",
    "howItWorksTitle": "What happens when I pay?",
    "howItWorks": "Your wallet asks you to approve the payment. The budget rules are checked by a NEAR smart contract, not by this website. Money only moves if the payment fits what's left in that budget.",
    "paymentsTitle": "Your payments",
    "noPayments": "No payments yet.",
    "paymentLine": "{category} · {usd} · {near} NEAR",
    "viewReceipt": "View receipt",
    "viewContract": "View contract activity",
    "loading": "Loading…",
    "working": "Check your wallet window and tap Approve.",
    "errors": {
      "overLimit": "This costs more than what's left in your {category} budget. Nothing was paid.",
      "quoteExpired": "This price expired. Tap Pay again to get a fresh price.",
      "tripExpired": "This trip budget has ended. Return the unused money and set a new budget.",
      "tripClosed": "This trip budget is already closed.",
      "alreadyPaid": "You already paid for this offer.",
      "notOwner": "Only the wallet that created this budget can use it.",
      "budgetInvalid": "Your budget couldn't be saved. Check the amounts and try again.",
      "cancelled": "You cancelled in your wallet. Nothing was paid.",
      "generic": "Something went wrong. Nothing was paid. (Details: {details})"
    }
  }
}
```

```bash
for l in de es fr pt; do cp apps/web/messages/en/canoe.json apps/web/messages/$l/canoe.json; done
```

- [ ] **Step 2: Append styles**

Append to `apps/web/src/components/canoe/TripBudget.module.css`:

```css
.step { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-card); padding: 1.25rem; display: grid; gap: 1rem; }
.step h2 { font-family: var(--font-display); font-weight: 700; margin: 0; font-size: 1.2rem; }
.step h3 { font-size: 1rem; margin: 0; }
.active { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow), var(--shadow-card); }
.locked { opacity: .65; }
.done { }
.stepHeader { display: flex; gap: .9rem; align-items: center; }
.stepNumber { flex: none; width: 2.1rem; height: 2.1rem; border-radius: 999px; display: grid; place-items: center; font-weight: 700; background: var(--accent-glow); color: var(--accent); }
.done .stepNumber { background: var(--accent); color: var(--bg); }
.stepLabel { font: 600 .72rem var(--font-body); text-transform: uppercase; letter-spacing: .08em; color: var(--text-secondary); }
.status { border-left: 4px solid var(--cta); background: var(--elevated); border-radius: var(--radius-md); padding: .7rem 1rem; font-weight: 600; }
.help { border: 1px dashed var(--border); border-radius: var(--radius-md); background: var(--elevated); padding: .9rem 1rem; display: grid; gap: .5rem; font-size: .9rem; }
.help ol { margin: 0; padding-left: 1.2rem; display: grid; gap: .35rem; }
.help a { font-weight: 600; }
.summary { margin: 0; font-size: .9rem; color: var(--text-secondary); }
.money { display: flex; align-items: center; gap: .4rem; }
.money input { flex: 1; min-width: 0; }
.progress { width: 100%; height: .5rem; appearance: none; border: 0; border-radius: 999px; background: var(--elevated); overflow: hidden; }
.progress::-webkit-progress-bar { background: var(--elevated); border-radius: 999px; }
.progress::-webkit-progress-value { background: var(--accent); border-radius: 999px; }
.progress::-moz-progress-bar { background: var(--accent); border-radius: 999px; }
.details summary { cursor: pointer; font-weight: 600; color: var(--accent); }
.details p { margin: .5rem 0 0; font-size: .9rem; color: var(--text-secondary); line-height: 1.6; }
@media (max-width: 480px) {
  .row { align-items: stretch; }
  .row .button { width: 100%; }
}
```

- [ ] **Step 3: Change `createTripCall` to take yocto (test first)**

Replace the `createTripCall` describe block in `apps/web/src/lib/canoe/contract.test.ts` with:

```ts
describe('createTripCall', () => {
  it('builds yocto limits and a matching deposit', () => {
    const call = createTripCall({ flight: NEAR, hotel: NEAR / 2n, car: 0n }, 99);
    expect(call.args).toEqual({ limits: { flight: NEAR.toString(), hotel: (NEAR / 2n).toString(), car: '0' }, expires_at_ms: 99 });
    expect(call.deposit).toBe((3n * NEAR / 2n).toString());
  });
  it('rejects an empty budget', () => {
    expect(() => createTripCall({ flight: 0n, hotel: 0n, car: 0n }, 99)).toThrow(/greater than zero/);
  });
});
```

Run: `npx vitest run src/lib/canoe/contract.test.ts` — Expected: FAIL (type/values: strings still parsed as NEAR).

In `apps/web/src/lib/canoe/contract.ts` remove `import { nearToYocto } from './quote';` and replace `createTripCall` with:

```ts
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
```

Run: `npx vitest run src/lib/canoe/contract.test.ts` — Expected: PASS. (Typecheck fails in `TripBudget.tsx` until Step 9.)

- [ ] **Step 4: Shared rate hook**

```ts
// apps/web/src/components/canoe/useNearRates.ts
'use client';
import { useEffect, useState } from 'react';
import type { Rate } from '@/lib/canoe/types';

type RateResponse = { ok: true; data: { rate: Rate } } | { ok: false; error: string };
interface RatesState { rates: Record<string, Rate>; failed: boolean }

/** Live NEAR prices for USD plus every currency in `currencies`; `failed` when USD is unavailable. */
export function useNearRates(currencies: readonly string[]): RatesState {
  const key = [...new Set(['USD', ...currencies])].sort().join(',');
  const [state, setState] = useState<RatesState>({ rates: {}, failed: false });

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      key.split(',').map(async (currency) => {
        const body = (await (await fetch(`/api/canoe/rate?currency=${currency}`)).json()) as RateResponse;
        return body.ok ? body.data.rate : null;
      }),
    )
      .then((list) => {
        if (cancelled) return;
        const rates = Object.fromEntries(list.filter((r): r is Rate => r !== null).map((r) => [r.currency, r]));
        setState({ rates, failed: !rates.USD });
      })
      .catch(() => { if (!cancelled) setState((prev) => ({ ...prev, failed: true })); });
    return () => { cancelled = true; };
  }, [key]);

  return state;
}
```

- [ ] **Step 5: `Step` component (test first)**

```tsx
// apps/web/src/components/canoe/Step.test.tsx
/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Step } from './Step';

afterEach(cleanup);

describe('Step', () => {
  it('shows content and marks the active step', () => {
    render(<Step number={2} title="Set your trip budget" state="active"><p>form</p></Step>);
    expect(screen.getByRole('heading', { name: 'Set your trip budget' })).toBeTruthy();
    expect(screen.getByText('form')).toBeTruthy();
    expect(screen.getByText('Step 2')).toBeTruthy();
  });

  it('hides content and explains why when locked', () => {
    render(<Step number={3} title="Pay for your bookings" state="locked" lockedReason="Set your trip budget first."><p>offers</p></Step>);
    expect(screen.queryByText('offers')).toBeNull();
    expect(screen.getByText('Set your trip budget first.')).toBeTruthy();
  });

  it('shows a check mark and Done when finished', () => {
    render(<Step number={1} title="Connect your wallet" state="done"><p>connected</p></Step>);
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('Step 1 · Done')).toBeTruthy();
  });
});
```

Run: `npx vitest run src/components/canoe/Step.test.tsx` — Expected: FAIL "Cannot find module './Step'".

```tsx
// apps/web/src/components/canoe/Step.tsx
'use client';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import styles from './TripBudget.module.css';

export type StepState = 'done' | 'active' | 'locked';

export function Step({ number, title, state, lockedReason, children }: {
  number: number;
  title: string;
  state: StepState;
  lockedReason?: string;
  children?: ReactNode;
}) {
  const t = useTranslations('Canoe');
  const label = state === 'done' ? `${t('stepLabel', { number })} · ${t('stepDone')}` : t('stepLabel', { number });
  return (
    <section className={`${styles.step} ${styles[state]}`} aria-current={state === 'active' ? 'step' : undefined}>
      <header className={styles.stepHeader}>
        <span className={styles.stepNumber} aria-hidden="true">{state === 'done' ? '✓' : number}</span>
        <div>
          <span className={styles.stepLabel}>{label}</span>
          <h2>{title}</h2>
        </div>
      </header>
      {state === 'locked' ? <p className={styles.muted}>{lockedReason}</p> : children}
    </section>
  );
}
```

Run: `npx vitest run src/components/canoe/Step.test.tsx` — Expected: 3 passed.

- [ ] **Step 6: `WalletHelp` component**

```tsx
// apps/web/src/components/canoe/WalletHelp.tsx
'use client';
import { useTranslations } from 'next-intl';
import { METEOR_WALLET_URL, TESTNET_FAUCET_URL } from '@/lib/canoe/config';
import styles from './TripBudget.module.css';

export function WalletHelp() {
  const t = useTranslations('Canoe');
  return (
    <aside className={styles.help} aria-labelledby="canoe-wallet-help">
      <strong id="canoe-wallet-help">{t('walletHelpTitle')}</strong>
      <ol>
        <li>{t('walletHelp1')} <a href={METEOR_WALLET_URL} target="_blank" rel="noreferrer">{t('walletHelp1Link')}</a></li>
        <li>{t('walletHelp2')} <a href={TESTNET_FAUCET_URL} target="_blank" rel="noreferrer">{t('walletHelp2Link')}</a></li>
        <li>{t('walletHelp3')}</li>
      </ol>
    </aside>
  );
}
```

- [ ] **Step 7: USD `TripCreateForm` (test first)**

```tsx
// apps/web/src/components/canoe/TripCreateForm.test.tsx
/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TripCreateForm } from './TripCreateForm';
import type { Rate } from '@/lib/canoe/types';

afterEach(cleanup);
const NEAR = 10n ** 24n;
const usd: Rate = { currency: 'USD', nearPrice: 2.5, fetchedAt: '2026-11-12T00:00:00Z', source: 'coingecko' };

describe('TripCreateForm', () => {
  it('shows how much NEAR the USD budget sets aside', () => {
    render(<TripCreateForm disabled={false} usdRate={usd} rateError={false} onCreate={vi.fn()} />);
    // $100 + $100 + $50 = $250 → 100 NEAR real → 1 NEAR at the 1% demo scale
    expect(screen.getByRole('button', { name: 'Set aside 1 NEAR' })).toBeTruthy();
    expect(screen.getByText(/demo price for \$250/)).toBeTruthy();
  });

  it('submits yocto limits per category', () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<TripCreateForm disabled={false} usdRate={usd} rateError={false} onCreate={onCreate} />);
    // The label also contains the "$" prefix, so match by pattern.
    fireEvent.change(screen.getByLabelText(/Car rental budget \(USD\)/), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Set aside/ }));
    expect(onCreate).toHaveBeenCalledWith({ flight: (4n * NEAR) / 10n, hotel: (4n * NEAR) / 10n, car: NEAR / 10n }, 30);
  });

  it('waits for the price before allowing a budget', () => {
    render(<TripCreateForm disabled={false} usdRate={null} rateError={false} onCreate={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Loading price…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('explains when the price cannot load', () => {
    render(<TripCreateForm disabled={false} usdRate={null} rateError onCreate={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Can't load the NEAR price/);
  });
});
```

Run: `npx vitest run src/components/canoe/TripCreateForm.test.tsx` — Expected: FAIL (old props/labels).

```tsx
// apps/web/src/components/canoe/TripCreateForm.tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CANOE_DEMO_SCALE_BPS } from '@/lib/canoe/config';
import { formatUsd, usdToYocto } from '@/lib/canoe/money';
import { formatNear } from '@/lib/canoe/quote';
import { CATEGORIES, type Category, type Rate } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

export type BudgetYocto = Record<Category, bigint>;

function parseUsd(text: string): number | null {
  const trimmed = text.replace(/,/g, '').trim();
  const value = trimmed === '' ? 0 : Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function toLimits(budget: Record<Category, string>, rate: Rate | null): { limits: BudgetYocto; usd: number } | null {
  const flight = parseUsd(budget.flight);
  const hotel = parseUsd(budget.hotel);
  const car = parseUsd(budget.car);
  if (!rate || flight === null || hotel === null || car === null) return null;
  return {
    limits: {
      flight: usdToYocto(flight, rate, CANOE_DEMO_SCALE_BPS),
      hotel: usdToYocto(hotel, rate, CANOE_DEMO_SCALE_BPS),
      car: usdToYocto(car, rate, CANOE_DEMO_SCALE_BPS),
    },
    usd: flight + hotel + car,
  };
}

export function TripCreateForm({ disabled, usdRate, rateError, onCreate }: {
  disabled: boolean;
  usdRate: Rate | null;
  rateError: boolean;
  onCreate: (limits: BudgetYocto, days: number) => Promise<void>;
}) {
  const t = useTranslations('Canoe');
  const [budget, setBudget] = useState<Record<Category, string>>({ flight: '100', hotel: '100', car: '50' });
  const [days, setDays] = useState('30');
  const plan = toLimits(budget, usdRate);
  const total = plan ? CATEGORIES.reduce((sum, c) => sum + plan.limits[c], 0n) : 0n;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (plan && total > 0n) void onCreate(plan.limits, Math.max(1, Number.parseInt(days, 10) || 1));
      }}
    >
      <div className={styles.grid}>
        {CATEGORIES.map((category) => (
          <label key={category} className={styles.field}>
            {t('budgetField', { category: t(category) })}
            <span className={styles.money}>
              <span aria-hidden="true">$</span>
              <input inputMode="decimal" value={budget[category]} onChange={(e) => setBudget({ ...budget, [category]: e.target.value })} />
            </span>
          </label>
        ))}
        <label className={styles.field}>
          {t('tripDays')}
          <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
      </div>
      {rateError ? <p className={styles.error} role="alert">{t('rateError')}</p> : null}
      {plan && total > 0n ? <p className={styles.summary}>{t('budgetSummary', { near: formatNear(total), usd: formatUsd(plan.usd) })}</p> : null}
      <button className={styles.button} type="submit" disabled={disabled || !plan || total <= 0n}>
        {plan ? t('createButton', { near: formatNear(total) }) : t('loadingPrice')}
      </button>
    </form>
  );
}
```

Run: `npx vitest run src/components/canoe/TripCreateForm.test.tsx` — Expected: 4 passed.

- [ ] **Step 8: USD `OfferList` and `PaymentHistory`**

```tsx
// apps/web/src/components/canoe/OfferList.tsx
'use client';
import { useTranslations } from 'next-intl';
import { remaining, type ContractTrip } from '@/lib/canoe/contract';
import { CANOE_DEMO_SCALE_BPS } from '@/lib/canoe/config';
import { formatUsd, toUsdOffer, usdToYocto } from '@/lib/canoe/money';
import { formatNear } from '@/lib/canoe/quote';
import type { Offer, Rate } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

export function OfferList({ offers, rates, trip, busy, onPay }: {
  offers: Offer[];
  rates: Record<string, Rate>;
  trip: ContractTrip | null;
  busy: boolean;
  onPay: (offer: Offer, usdRate: Rate) => Promise<void>;
}) {
  const t = useTranslations('Canoe');
  const usd = rates.USD;
  if (!offers.length) return <p className={styles.muted}>{t('noOffers')}</p>;

  return (
    <ul className={styles.list}>
      {offers.map((raw) => {
        const offer = toUsdOffer(raw, rates);
        const amount = offer && usd ? usdToYocto(offer.price, usd, CANOE_DEMO_SCALE_BPS) : null;
        const open = trip !== null && trip.open;
        const left = trip && trip.open ? remaining(trip, raw.category) : 0n;
        const over = amount !== null && open && amount > left;
        const price = offer ? formatUsd(offer.price, 2) : '…';
        return (
          <li key={`${raw.category}:${raw.id}`} className={styles.row}>
            <div className={styles.rowMain}>
              <strong>{raw.label}</strong>
              <span className={styles.muted}>
                {t(raw.category)} · {price}
                {raw.sample ? <> · <span className={styles.badge}>{t('sample')}</span></> : null}
              </span>
              {offer?.original ? (
                <span className={styles.muted}>
                  {t('convertedFrom', { amount: new Intl.NumberFormat('en', { style: 'currency', currency: offer.original.currency }).format(offer.original.price) })}
                </span>
              ) : null}
              {over ? <span className={styles.muted}>{t('overBudget', { category: t(raw.category) })}</span> : null}
            </div>
            <button
              className={styles.button}
              type="button"
              disabled={busy || !open || !offer || !usd || amount === null || amount <= 0n}
              onClick={() => { if (offer && usd) void onPay(offer, usd); }}
            >
              {t('payButton', { usd: price, near: amount === null ? '…' : formatNear(amount) })}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

```tsx
// apps/web/src/components/canoe/PaymentHistory.tsx
'use client';
import { useTranslations } from 'next-intl';
import { fromContractCategory, type ContractPayment } from '@/lib/canoe/contract';
import { CANOE_CONTRACT, CANOE_DEMO_SCALE_BPS, explorerAccountUrl, explorerTxUrl } from '@/lib/canoe/config';
import { formatUsd, yoctoToUsd } from '@/lib/canoe/money';
import { formatNear } from '@/lib/canoe/quote';
import type { Rate } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

export function PaymentHistory({ payments, txByHash, usdRate }: { payments: ContractPayment[]; txByHash: Record<string, string>; usdRate: Rate | null }) {
  const t = useTranslations('Canoe');
  if (!payments.length) return <p className={styles.muted}>{t('noPayments')}</p>;
  return (
    <ul className={styles.list}>
      {payments.map((payment) => {
        const tx = txByHash[payment.quote_hash];
        const usd = usdRate ? `≈ ${formatUsd(yoctoToUsd(BigInt(payment.amount), usdRate, CANOE_DEMO_SCALE_BPS))}` : '≈ …';
        return (
          <li key={payment.quote_hash} className={styles.row}>
            <div className={styles.rowMain}>
              <strong>{t('paymentLine', { category: t(fromContractCategory(payment.category)), usd, near: formatNear(payment.amount) })}</strong>
              <span className={styles.muted}>{new Date(payment.paid_at_ms).toLocaleString()}</span>
            </div>
            <a className={styles.ghost} href={tx ? explorerTxUrl(tx) : explorerAccountUrl(CANOE_CONTRACT)} target="_blank" rel="noreferrer">
              {tx ? t('viewReceipt') : t('viewContract')}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 9: Rebuild `TripBudget` as three steps**

```tsx
// apps/web/src/components/canoe/TripBudget.tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NearProvider, useNearWallet } from './NearProvider';
import { Step } from './Step';
import { WalletHelp } from './WalletHelp';
import { TripCreateForm, type BudgetYocto } from './TripCreateForm';
import { OfferList } from './OfferList';
import { PaymentHistory } from './PaymentHistory';
import { useNearRates } from './useNearRates';
import { CANOE_CONTRACT, CANOE_DEMO_SCALE_BPS, CANOE_MERCHANT, explorerTxUrl } from '@/lib/canoe/config';
import { createTripCall, payQuoteArgs, type ContractPayment, type ContractTrip } from '@/lib/canoe/contract';
import { friendlyError } from '@/lib/canoe/errors';
import { formatUsd, yoctoToUsd } from '@/lib/canoe/money';
import { buildQuote, formatNear } from '@/lib/canoe/quote';
import { TxFailedError } from '@/lib/canoe/tx';
import { CATEGORIES, type Offer, type Rate } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

type OffersResponse = { ok: true; data: { offers: Offer[] } } | { ok: false; error: string };
const DAY_MS = 86_400_000;
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function TripBudget() {
  return (
    <NearProvider>
      <TripBudgetInner />
    </NearProvider>
  );
}

function TripBudgetInner() {
  const t = useTranslations('Canoe');
  const { loading, signedAccountId, signIn, signOut, viewFunction, callFunction } = useNearWallet();
  const [trip, setTrip] = useState<ContractTrip | null>(null);
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [txByHash, setTxByHash] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTx, setErrorTx] = useState<string | null>(null);
  const [chainVersion, setChainVersion] = useState(0);
  const { rates, failed: ratesFailed } = useNearRates(offers?.map((o) => o.currency) ?? []);
  const usd = rates.USD ?? null;

  const loadChain = useCallback(async (account: string) => {
    if (!account) return { trip: null, payments: [] as ContractPayment[] };
    const trips = await viewFunction<ContractTrip[]>({ contractId: CANOE_CONTRACT, method: 'get_trips_by_owner', args: { owner: account } });
    const current = [...trips].reverse().find((x) => x.open) ?? trips.at(-1) ?? null;
    const list = current
      ? await viewFunction<ContractPayment[]>({ contractId: CANOE_CONTRACT, method: 'get_payments', args: { trip_id: current.id } })
      : [];
    return { trip: current, payments: list };
  }, [viewFunction]);

  useEffect(() => {
    let cancelled = false;
    loadChain(signedAccountId)
      .then((state) => { if (!cancelled) { setTrip(state.trip); setPayments(state.payments); } })
      .catch((e: unknown) => { if (!cancelled) setError(messageOf(e)); });
    return () => { cancelled = true; };
  }, [loadChain, signedAccountId, chainVersion]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/canoe/offers')
      .then((r) => r.json() as Promise<OffersResponse>)
      .then((body) => { if (!cancelled) { if (body.ok) setOffers(body.data.offers); else setError(body.error); } })
      .catch((e: unknown) => { if (!cancelled) setError(messageOf(e)); });
    return () => { cancelled = true; };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setErrorTx(null);
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
      if (e instanceof TxFailedError && e.hash) setErrorTx(e.hash);
    } finally {
      setBusy(false);
      setChainVersion((v) => v + 1);
    }
  };

  const createTrip = (limits: BudgetYocto, days: number) =>
    run(async () => {
      const call = createTripCall(limits, Date.now() + days * DAY_MS);
      await callFunction({ contractId: CANOE_CONTRACT, method: 'create_trip', args: call.args, deposit: call.deposit });
    });

  const pay = (offer: Offer, usdRate: Rate) =>
    run(async () => {
      if (!trip || !trip.open) throw new Error(t('lockedBudget'));
      const quote = await buildQuote(offer, usdRate, Date.now());
      const { hash } = await callFunction({ contractId: CANOE_CONTRACT, method: 'pay_quote', args: payQuoteArgs(trip.id, quote, CANOE_MERCHANT) });
      if (hash) setTxByHash((prev) => ({ ...prev, [quote.quoteHash]: hash }));
    });

  const withdraw = () =>
    run(async () => {
      if (!trip) return;
      await callFunction({ contractId: CANOE_CONTRACT, method: 'withdraw_remaining', args: { trip_id: trip.id } });
    });

  const errorText = (raw: string) => {
    const friendly = friendlyError(raw);
    if (friendly.key === 'overLimit' && friendly.category) return t('errors.overLimit', { category: t(friendly.category) });
    if (friendly.key === 'generic') return t('errors.generic', { details: friendly.details ?? raw });
    return t(`errors.${friendly.key}`);
  };

  const openTrip = trip && trip.open ? trip : null;
  const lastClosed = trip && !trip.open ? trip : null;
  const usdText = (yocto: bigint) => (usd ? formatUsd(yoctoToUsd(yocto, usd, CANOE_DEMO_SCALE_BPS)) : '…');

  return (
    <div className={styles.root}>
      <p className={styles.banner}>{t('demoNote', { percent: CANOE_DEMO_SCALE_BPS / 100 })}</p>

      {error ? (
        <p className={styles.error} role="alert">
          {errorText(error)}
          {errorTx ? <> <a href={explorerTxUrl(errorTx)} target="_blank" rel="noreferrer">{t('viewReceipt')}</a></> : null}
        </p>
      ) : null}
      {busy ? <p className={styles.status} role="status">{t('working')}</p> : null}

      <Step number={1} title={t('step1Title')} state={signedAccountId ? 'done' : 'active'}>
        {signedAccountId ? (
          <div className={styles.walletBar}>
            <span className={styles.mono}>{t('connectedAs', { account: signedAccountId })}</span>
            <button className={styles.ghost} type="button" onClick={() => void signOut()}>{t('disconnect')}</button>
          </div>
        ) : (
          <>
            <p className={styles.muted}>{t('step1Body')}</p>
            <div>
              <button className={styles.button} type="button" disabled={loading} onClick={() => void signIn().catch((e: unknown) => setError(messageOf(e)))}>
                {loading ? t('loading') : t('connect')}
              </button>
            </div>
            <WalletHelp />
          </>
        )}
      </Step>

      <Step number={2} title={t('step2Title')} state={!signedAccountId ? 'locked' : openTrip ? 'done' : 'active'} lockedReason={t('lockedConnect')}>
        {openTrip ? (
          <>
            <div className={styles.grid}>
              {CATEGORIES.map((category) => {
                const limit = BigInt(openTrip.limits[category]);
                const spent = BigInt(openTrip.spent[category]);
                const left = limit - spent;
                return (
                  <div key={category} className={styles.stat}>
                    <strong>{t(category)}</strong>
                    <progress className={styles.progress} max={100} value={limit > 0n ? Number((spent * 100n) / limit) : 0} aria-label={t(category)} />
                    <span className={styles.muted}>{t('spentLeft', { spent: usdText(spent), left: usdText(left), near: formatNear(left) })}</span>
                  </div>
                );
              })}
            </div>
            <span className={styles.muted}>{t('endsOn', { date: new Date(openTrip.expires_at_ms).toLocaleDateString() })}</span>
            <div>
              <button className={styles.ghost} type="button" disabled={busy} onClick={() => void withdraw()}>{t('endTrip')}</button>
            </div>
          </>
        ) : (
          <>
            <TripCreateForm disabled={busy} usdRate={usd} rateError={ratesFailed} onCreate={createTrip} />
            {lastClosed ? <p className={styles.muted}>{t('lastTrip')}</p> : null}
          </>
        )}
      </Step>

      <Step
        number={3}
        title={t('step3Title')}
        state={openTrip ? 'active' : 'locked'}
        lockedReason={signedAccountId ? t('lockedBudget') : t('lockedConnect')}
      >
        <h3>{t('offersTitle')}</h3>
        {offers === null ? <p className={styles.muted}>{t('loading')}</p> : <OfferList offers={offers} rates={rates} trip={openTrip} busy={busy} onPay={pay} />}
        <details className={styles.details}>
          <summary>{t('howItWorksTitle')}</summary>
          <p>{t('howItWorks')}</p>
        </details>
      </Step>

      {payments.length ? (
        <section className={styles.card}>
          <h2>{t('paymentsTitle')}</h2>
          <PaymentHistory payments={payments} txByHash={txByHash} usdRate={usd} />
        </section>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 10: Typecheck, lint, tests**

Run: `npx tsc --noEmit -p . && npx eslint src/components/canoe src/lib/canoe && npx vitest run src/components/canoe src/lib/canoe src/i18n`
Expected: no type/lint errors; all tests pass, including `messages-parity.test.ts`. If `noUnusedLocals` flags `CATEGORIES` or `nearToYocto` imports, remove the unused import.

- [ ] **Step 11: Commit**

```bash
git add apps/web/messages apps/web/src/components/canoe apps/web/src/lib/canoe/contract.ts apps/web/src/lib/canoe/contract.test.ts
git commit -m "feat(canoe): beginner-friendly three-step Trip Budget priced in USD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verify in the browser

**Files:** none (verification only; fix and commit in the task that owns any file that needs changing).

- [ ] **Step 1: Desktop, not connected.** Open `http://localhost:3003/trip` (dev server `canoe-web`). Expect: demo note; Step 1 active with "Connect wallet" and "New to wallets?" (two links open Meteor and the NEAR faucet); Steps 2 and 3 locked with "Connect a wallet first."
- [ ] **Step 2: Wallet list.** Click "Connect wallet". Expect: NEAR CLI and Ethereum Wallets are absent; Meteor, HOT, Intear and others present. Close the dialog.
- [ ] **Step 3: Developer flag.** Add `export NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS=true` to the scratchpad `canoe-dev.sh`, restart `canoe-web`, reload: NEAR CLI is listed again. Keep the flag on for the next steps (the demo account signs through near-cli).
- [ ] **Step 4: Connected flow.** Connect `canoe-user1.testnet`. Expect Step 1 "Step 1 · Done ✓", Step 2 form with $100/$100/$50 and "You'll set aside … NEAR (demo price for $250)". Set Car to $30, create the budget, sign, then check: budget card with three progress bars and "Spent ≈ $0 · Left ≈ $30 (… NEAR)"; Step 3 active; the sample flight button reads "Pay $95 · … NEAR".
- [ ] **Step 5: Friendly rejection.** Pay the sample car ($45 > $30 left). Expect the alert "This costs more than what's left in your Car rental budget. Nothing was paid." with "View receipt". Pay the flight: a "Your payments" card lists "Flights · ≈ $95 · … NEAR" with "View receipt".
- [ ] **Step 6: Cancel.** Start a payment and close the wallet dialog. Expect "You cancelled in your wallet. Nothing was paid."
- [ ] **Step 7: End trip.** Click "End trip & return unused money", sign. Expect Step 2 form again with "Your last trip budget has ended…", Step 3 locked with "Set your trip budget first.", payments card still visible.
- [ ] **Step 8: Phone width.** `resize_window` preset `mobile` (375×812). Expect no horizontal scroll, full-width pay buttons, readable step headers. Reset to `desktop`.
- [ ] **Step 9: Record** every signed transaction hash in `docs/canoe/testnet-log.md` under a new "Beginner UI run (2026-11-12)" table and commit:

```bash
git add docs/canoe/testnet-log.md
git commit -m "docs(canoe): record testnet run of the beginner-friendly UI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs and final checks

**Files:**
- Modify: README head draft (scratchpad `canoe-readme-head.md`, inserted into `README.md` in the submission task)
- Modify: `docs/superpowers/specs/2026-11-11-canoe-near-design.md` §4.3 (one note line)

- [ ] **Step 1: README draft "Try it" steps 4–9** — replace with:

```markdown
4. Click **Trip Budget** in the top navigation → you see "Demo mode: this uses free NEAR test tokens…" and three steps; Steps 2 and 3 say "Connect a wallet first."
5. In Step 1 click **Connect wallet** and pick a testnet wallet (no wallet yet? follow "New to wallets?": Meteor Wallet + NEAR faucet) → Step 1 shows "Connected as <your-account>.testnet ✓".
6. In Step 2 set Flights $100, Hotels $100, Car rental **$30** and click **Set aside … NEAR**, then approve in the wallet → a budget card shows three bars with "Spent ≈ $0 · Left ≈ …".
7. In Step 3 click **Pay $95 · … NEAR** on the sample flight and approve → "Your payments" lists the flight with **View receipt** (the NEAR transfer to `canoe-dev.testnet` on the explorer).
8. Click **Pay $45 · … NEAR** on the sample car and approve → the contract refuses it and the page says "This costs more than what's left in your Car rental budget. Nothing was paid."
9. Click **End trip & return unused money** and approve → Step 2 shows the form again and the unused NEAR is back in your wallet.

Developer option: `NEXT_PUBLIC_CANOE_SHOW_DEV_WALLETS=true` adds the NEAR CLI wallet (shows the exact `near` command; paste the transaction hash back).
```

- [ ] **Step 2: MVP spec note** — under §4.3 of `docs/superpowers/specs/2026-11-11-canoe-near-design.md` add:

```markdown
> Superseded for currency and UI by `2026-11-12-canoe-friendly-ui-design.md`: budgets, offers and samples are in USD.
```

- [ ] **Step 3: Full web checks**

Run (repo root): `npm run typecheck --workspace=@flight-finder/web && npm run lint --workspace=@flight-finder/web && npm run test --workspace=@flight-finder/web`
Expected: all green. Known flaky upstream test `CarProtectionChoices.test.tsx` may need a rerun; anything else failing must be fixed.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-11-11-canoe-near-design.md
git commit -m "docs(canoe): point MVP spec to the USD beginner UI spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
