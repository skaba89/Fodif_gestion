/* eslint-disable @next/next/no-img-element */
import styles from './FodipOfficialBrand.module.css';

export const FODIP_OFFICIAL_LOGO_URL = 'https://hom-app.fodip.gov.gn/assets/img/fodip.jpg';

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
