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
