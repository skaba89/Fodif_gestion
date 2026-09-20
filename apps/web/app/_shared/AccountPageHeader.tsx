'use client';

import Link from 'next/link';
import FodipOfficialBrand from './FodipOfficialBrand';
import ThemeToggle from './ThemeToggle';
import styles from './AccountPageHeader.module.css';

export default function AccountPageHeader({
  homeHref,
  subtitle,
}: {
  homeHref: string;
  subtitle: string;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={homeHref} className={styles.brand} aria-label="FODIP — retour à mon espace">
          <FodipOfficialBrand subtitle={subtitle} compact />
        </Link>
        <div className={styles.actions}>
          <Link className={styles.back} href={homeHref}>Retour à mon espace</Link>
          <ThemeToggle buttonClassName={styles.themeToggle} />
        </div>
      </div>
    </header>
  );
}
