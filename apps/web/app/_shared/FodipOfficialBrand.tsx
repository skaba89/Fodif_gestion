/* eslint-disable @next/next/no-img-element */
import styles from './FodipOfficialBrand.module.css';

// This exact logo asset is surfaced by the current FODIP institutional website. It is deliberately
// referenced rather than redrawn so the application does not invent or approximate the emblem.
export const FODIP_OFFICIAL_LOGO_URL = 'https://fodipgn.com/images/logo/1719846542.jpg';

export default function FodipOfficialBrand({
  subtitle = 'Plateforme institutionnelle',
  compact = false,
}: {
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <span className={`${styles.brand} ${compact ? styles.compact : ''}`}>
      <span className={styles.logoFrame} aria-hidden="true">
        <img
          className={styles.logo}
          src={FODIP_OFFICIAL_LOGO_URL}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </span>
      <span className={styles.copy}>
        <strong>FODIP</strong>
        <span>{subtitle}</span>
      </span>
    </span>
  );
}
