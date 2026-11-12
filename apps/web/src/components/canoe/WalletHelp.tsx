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
