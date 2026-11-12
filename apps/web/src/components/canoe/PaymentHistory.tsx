'use client';
import { useTranslations } from 'next-intl';
import { fromContractCategory, type ContractPayment } from '@/lib/canoe/contract';
import { CANOE_CONTRACT, CANOE_DEMO_SCALE_BPS, explorerAccountUrl, explorerTxUrl } from '@/lib/canoe/config';
import { formatUsd, yoctoToUsd } from '@/lib/canoe/money';
import { formatNear } from '@/lib/canoe/quote';
import type { Rate } from '@/lib/canoe/types';
import styles from './TripBudget.module.css';

export function PaymentHistory({ payments, txByHash, usdRate }: { payments: ContractPayment[]; txByHash: Record<string, string>; usdRate: Rate | null }) {
  const t = useTranslations('Canoe');
  if (!payments.length) return <p className={styles.muted}>{t('noPayments')}</p>;
  return (
    <ul className={styles.list}>
      {payments.map((payment) => {
        const tx = txByHash[payment.quote_hash];
        const usd = usdRate ? `≈ ${formatUsd(yoctoToUsd(BigInt(payment.amount), usdRate, CANOE_DEMO_SCALE_BPS))}` : '≈ …';
        return (
          <li key={payment.quote_hash} className={styles.row}>
            <div className={styles.rowMain}>
              <strong>{t('paymentLine', { category: t(fromContractCategory(payment.category)), usd, near: formatNear(payment.amount) })}</strong>
              <span className={styles.muted}>{new Date(payment.paid_at_ms).toLocaleString()}</span>
            </div>
            <a className={styles.ghost} href={tx ? explorerTxUrl(tx) : explorerAccountUrl(CANOE_CONTRACT)} target="_blank" rel="noreferrer">
              {tx ? t('viewReceipt') : t('viewContract')}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
