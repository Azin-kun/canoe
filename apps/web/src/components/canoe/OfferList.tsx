'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { remaining, type ContractTrip } from '@/lib/canoe/contract';
import { applyScale, fiatToYocto, formatNear } from '@/lib/canoe/quote';
import { CANOE_DEMO_SCALE_BPS } from '@/lib/canoe/config';
import type { Offer, Rate } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

type RateResponse = { ok: true; data: { rate: Rate } } | { ok: false; error: string };

export function OfferList({ offers, trip, busy, onPay }: { offers: Offer[]; trip: ContractTrip | null; busy: boolean; onPay: (offer: Offer, rate: Rate) => Promise<void> }) {
  const t = useTranslations('Canoe');
  const currencies = useMemo(() => [...new Set(offers.map((o) => o.currency))].sort(), [offers]);
  const [rates, setRates] = useState<Record<string, Rate>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      currencies.map(async (currency) => {
        const body = (await (await fetch(`/api/canoe/rate?currency=${currency}`)).json()) as RateResponse;
        return body.ok ? body.data.rate : null;
      }),
    ).then((list) => {
      if (cancelled) return;
      setRates(Object.fromEntries(list.filter((r): r is Rate => r !== null).map((r) => [r.currency, r])));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [currencies]);

  if (!offers.length) return <p className={styles.muted}>{t('noOffers')}</p>;

  return (
    <ul className={styles.list}>
      {offers.map((offer) => {
        const rate = rates[offer.currency];
        const amount = rate ? applyScale(fiatToYocto(offer.price, rate.nearPrice), CANOE_DEMO_SCALE_BPS) : null;
        const left = trip ? remaining(trip, offer.category) : 0n;
        const fits = amount !== null && trip !== null && trip.open && amount <= left;
        return (
          <li key={`${offer.category}:${offer.id}`} className={styles.row}>
            <div className={styles.rowMain}>
              <strong>{offer.label}</strong>
              <span className={styles.muted}>
                {t(offer.category)} · {new Intl.NumberFormat('en', { style: 'currency', currency: offer.currency }).format(offer.price)}
                {offer.sample ? <> · <span className={styles.badge}>{t('sample')}</span></> : null}
              </span>
              {rate ? <span className={styles.muted}>{t('rateLine', { price: rate.nearPrice, currency: rate.currency, source: rate.source })}</span> : null}
              {!trip || !trip.open ? <span className={styles.muted}>{t('noTrip')}</span> : amount !== null && !fits ? <span className={styles.muted}>{t('overLimit', { category: t(offer.category) })}</span> : null}
            </div>
            <button className={styles.button} type="button" disabled={busy || !trip || !trip.open || !rate || amount === null || amount <= 0n} onClick={() => { if (rate) void onPay(offer, rate); }}>
              {t('payButton', { amount: amount === null ? '…' : formatNear(amount) })}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
