'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NearProvider, useNearWallet } from './NearProvider';
import { TripCreateForm } from './TripCreateForm';
import { OfferList } from './OfferList';
import { PaymentHistory } from './PaymentHistory';
import { CANOE_CONTRACT, CANOE_DEMO_SCALE_BPS, CANOE_MERCHANT } from '@/lib/canoe/config';
import { createTripCall, payQuoteArgs, remaining, type ContractPayment, type ContractTrip } from '@/lib/canoe/contract';
import { buildQuote, formatNear } from '@/lib/canoe/quote';
import { CATEGORIES, type Category, type Offer, type Rate } from '@/lib/canoe/types';
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
  const [chainVersion, setChainVersion] = useState(0);

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
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
      setChainVersion((v) => v + 1);
    }
  };

  const createTrip = (limits: Record<Category, string>, days: number) =>
    run(async () => {
      const call = createTripCall(limits, Date.now() + days * DAY_MS);
      await callFunction({ contractId: CANOE_CONTRACT, method: 'create_trip', args: call.args, deposit: call.deposit });
    });

  const pay = (offer: Offer, rate: Rate) =>
    run(async () => {
      if (!trip) throw new Error(t('noTrip'));
      const quote = await buildQuote(offer, rate, Date.now());
      const { hash } = await callFunction({ contractId: CANOE_CONTRACT, method: 'pay_quote', args: payQuoteArgs(trip.id, quote, CANOE_MERCHANT) });
      if (hash) setTxByHash((prev) => ({ ...prev, [quote.quoteHash]: hash }));
    });

  const withdraw = () =>
    run(async () => {
      if (!trip) return;
      await callFunction({ contractId: CANOE_CONTRACT, method: 'withdraw_remaining', args: { trip_id: trip.id } });
    });

  return (
    <div className={styles.root}>
      <p className={styles.banner}>{t('simulated')} {t('scale', { percent: CANOE_DEMO_SCALE_BPS / 100 })}</p>

      <div className={styles.walletBar}>
        {signedAccountId ? <span className={styles.mono}>{t('signedInAs', { account: signedAccountId })}</span> : <span className={styles.muted}>{t('connectFirst')}</span>}
        {signedAccountId
          ? <button className={styles.ghost} type="button" onClick={() => void signOut()}>{t('disconnect')}</button>
          : <button className={styles.button} type="button" disabled={loading} onClick={() => void signIn().catch((e: unknown) => setError(messageOf(e)))}>{loading ? t('loading') : t('connect')}</button>}
      </div>

      {error ? <p className={styles.error} role="alert">{t('error', { message: error })}</p> : null}
      {busy ? <p className={styles.muted} role="status">{t('working')}</p> : null}

      {signedAccountId && (!trip || !trip.open) ? (
        <section className={styles.card}>
          <h2>{t('createTitle')}</h2>
          <TripCreateForm disabled={busy} onCreate={createTrip} />
        </section>
      ) : null}

      {trip ? (
        <section className={styles.card}>
          <h2>{t('tripTitle', { id: trip.id })} {trip.open ? null : <span className={styles.badge}>{t('closed')}</span>}</h2>
          <span className={styles.muted}>{t('expires', { date: new Date(trip.expires_at_ms).toLocaleString() })}</span>
          <div className={styles.grid}>
            {CATEGORIES.map((category) => (
              <div key={category} className={styles.stat}>
                <strong>{t(category)}</strong>
                <span className={styles.muted}>{t('limit')}: {formatNear(trip.limits[category])} NEAR</span>
                <span className={styles.muted}>{t('spent')}: {formatNear(trip.spent[category])} NEAR</span>
                <span>{t('remaining')}: {formatNear(remaining(trip, category))} NEAR</span>
              </div>
            ))}
          </div>
          {trip.open ? <button className={styles.ghost} type="button" disabled={busy} onClick={() => void withdraw()}>{t('withdraw')}</button> : null}
        </section>
      ) : null}

      <section className={styles.card}>
        <h2>{t('offersTitle')}</h2>
        {offers === null ? <p className={styles.muted}>{t('loading')}</p> : <OfferList offers={offers} trip={trip} busy={busy || !signedAccountId} onPay={pay} />}
      </section>

      <section className={styles.card}>
        <h2>{t('paymentsTitle')}</h2>
        <PaymentHistory payments={payments} txByHash={txByHash} />
      </section>
    </div>
  );
}
