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
