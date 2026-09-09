/* eslint-disable @next/next/no-img-element */
import styles from './FodipOfficialBrand.module.css';

// Exact copy of the logo published by the current FODIP institutional website:
// https://fodip.gov.gn/images/logo/1719846542.jpg
// The application serves the copied asset locally so institutional branding remains available even
// when the public website is slow, unavailable or blocks cross-site image embedding.
export const FODIP_OFFICIAL_LOGO_URL = '/brand/fodip-official.jpg';

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
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </span>
      <span className={styles.copy}>
        <strong>FODIP</strong>
        <span>{subtitle}</span>
      </span>
    </span>
  );
}
