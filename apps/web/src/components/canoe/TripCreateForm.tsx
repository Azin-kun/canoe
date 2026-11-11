'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatNear, nearToYocto } from '@/lib/canoe/quote';
import { CATEGORIES, type Category } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

function totalNear(limits: Record<Category, string>): string {
  try {
    return formatNear(CATEGORIES.reduce((sum, c) => sum + nearToYocto(limits[c] || '0'), 0n));
  } catch {
    return '?';
  }
}

export function TripCreateForm({ disabled, onCreate }: { disabled: boolean; onCreate: (limits: Record<Category, string>, days: number) => Promise<void> }) {
  const t = useTranslations('Canoe');
  const [limits, setLimits] = useState<Record<Category, string>>({ flight: '1', hotel: '1', car: '0.5' });
  const [days, setDays] = useState('30');
  const total = totalNear(limits);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void onCreate(limits, Math.max(1, Number.parseInt(days, 10) || 1));
      }}
    >
      <div className={styles.grid}>
        {CATEGORIES.map((category) => (
          <label key={category} className={styles.field}>
            {t('limitNear', { category: t(category) })}
            <input inputMode="decimal" value={limits[category]} onChange={(e) => setLimits({ ...limits, [category]: e.target.value })} />
          </label>
        ))}
        <label className={styles.field}>
          {t('validDays')}
          <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </label>
      </div>
      <button className={styles.button} type="submit" disabled={disabled || total === '?' || total === '0'}>
        {t('createButton', { total })}
      </button>
    </form>
  );
}
