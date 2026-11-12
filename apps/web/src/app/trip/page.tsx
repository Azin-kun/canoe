import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isMultiUserEnabled } from '@/lib/multi-user';
import { getCurrentProfile } from '@/lib/user-auth';
import { TravelNav } from '@/components/hotels/TravelNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TripBudget } from '@/components/canoe/TripBudget';
import styles from '@/components/hotels/Hotels.module.css';
import canoeStyles from '@/components/canoe/TripBudget.module.css';

export const dynamic = 'force-dynamic';

export default async function TripPage() {
  if (process.env.SELF_HOSTED !== 'true') notFound();
  if ((await isMultiUserEnabled()) && !(await getCurrentProfile())) redirect('/login?next=/trip');
  const t = await getTranslations('Canoe');
  return (
    <main className={styles.root}>
      <ThemeToggle />
      <TravelNav active="trip" />
      <header className={canoeStyles.hero}>
        <span className={canoeStyles.heroEyebrow}>{t('eyebrow')}</span>
        <h1>{t('headline')}</h1>
        <p>{t('intro')}</p>
      </header>
      <TripBudget />
    </main>
  );
}
