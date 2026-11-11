'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import styles from './Hotels.module.css';
export function TravelNav({ active }: { active?: 'flights' | 'hotels' | 'cars' | 'trip' }) {
  const t = useTranslations('Hotels');
  const cars = useTranslations('Cars');
  const canoe = useTranslations('Canoe');
  return <nav className={styles.nav} aria-label={t('travel')}><Link href="/" aria-current={active === 'flights' ? 'page' : undefined}>{t('flights')}</Link><Link href="/hotels" aria-current={active === 'hotels' ? 'page' : undefined}>{t('hotels')}</Link><Link href="/cars" aria-current={active === 'cars' ? 'page' : undefined}>{cars('carsNav')}</Link><Link href="/trip" aria-current={active === 'trip' ? 'page' : undefined}>{canoe('navTrip')}</Link></nav>;
}
