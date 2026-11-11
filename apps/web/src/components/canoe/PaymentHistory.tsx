'use client';
import { useTranslations } from 'next-intl';
import { fromContractCategory, type ContractPayment } from '@/lib/canoe/contract';
import { CANOE_CONTRACT, explorerAccountUrl, explorerTxUrl } from '@/lib/canoe/config';
import { formatNear } from '@/lib/canoe/quote';
import styles from './TripBudget.module.css';

export function PaymentHistory({ payments, txByHash }: { payments: ContractPayment[]; txByHash: Record<string, string> }) {
  const t = useTranslations('Canoe');
  if (!payments.length) return <p className={styles.muted}>{t('noPayments')}</p>;
  return (
    <ul className={styles.list}>
      {payments.map((payment) => {
        const tx = txByHash[payment.quote_hash];
        return (
          <li key={payment.quote_hash} className={styles.row}>
            <div className={styles.rowMain}>
              <strong>{t(fromContractCategory(payment.category))} · {formatNear(payment.amount)} NEAR → <span className={styles.mono}>{payment.merchant}</span></strong>
              <span className={`${styles.muted} ${styles.mono}`}>{payment.quote_ref} · {new Date(payment.paid_at_ms).toLocaleString()} · {payment.quote_hash.slice(0, 12)}…</span>
            </div>
            <a className={styles.ghost} href={tx ? explorerTxUrl(tx) : explorerAccountUrl(CANOE_CONTRACT)} target="_blank" rel="noreferrer">
              {tx ? t('viewTx') : t('viewContract')}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
