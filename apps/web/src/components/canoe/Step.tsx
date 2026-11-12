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
