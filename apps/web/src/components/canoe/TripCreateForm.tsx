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
