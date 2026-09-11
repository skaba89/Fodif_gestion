import Link from 'next/link';
import AnimatedKpiValue from './AnimatedKpiValue';
import { TrendDownIcon, TrendFlatIcon, TrendUpIcon } from './Icons';
import styles from './KpiCard.module.css';

export type KpiTrend = { deltaPct: number | null; direction: 'up' | 'down' | 'flat' | null };

/** One executive KPI with explicit unavailable state and optional API-backed trend. */
export default function KpiCard({
  label,
  value,
  unit,
  definition,
  trend,
  detailHref,
  goodDirection = 'up',
  tone = 'default',
}: {
  label: string;
  value: string | null;
  unit?: string;
  definition: string;
  trend?: KpiTrend | null;
  detailHref?: string;
  goodDirection?: 'up' | 'down';
  tone?: 'default' | 'inverse';
}) {
  const trendIsGood = trend?.direction && (trend.direction === goodDirection || trend.direction === 'flat');
  return (
    <article className={`${styles.card} ${tone === 'inverse' ? styles.inverse : ''}`} data-kpi-card>
      <div className={styles.headRow}>
        <span className={styles.label}>{label}</span>
        <span className={styles.definitionWrap} tabIndex={0} aria-label={definition}>
          <span className={styles.definitionMark} aria-hidden="true">?</span>
          <span className={styles.definitionTooltip} role="tooltip">{definition}</span>
        </span>
      </div>
      {value === null ? (
        <p className={styles.unavailable}>Donnée indisponible</p>
      ) : (
        <div className={styles.valueRow}>
          <strong data-kpi-value>
            <span className={styles.srOnly}>{value}</span>
            <AnimatedKpiValue value={value} />
          </strong>
          {unit && <span className={styles.unit}>{unit}</span>}
        </div>
      )}
      <div className={styles.footRow}>
        {trend && trend.direction && trend.deltaPct !== null ? (
          <span className={`${styles.trend} ${trendIsGood ? styles.trendGood : styles.trendBad}`}>
            {trend.direction === 'up' && <TrendUpIcon aria-hidden />}
            {trend.direction === 'down' && <TrendDownIcon aria-hidden />}
            {trend.direction === 'flat' && <TrendFlatIcon aria-hidden />}
            {trend.deltaPct > 0 ? '+' : ''}{trend.deltaPct} % vs période précédente
          </span>
        ) : (
          <span className={styles.trendMuted}>Tendance non disponible</span>
        )}
        {detailHref && <Link href={detailHref} className={styles.detailLink}>Détail</Link>}
      </div>
    </article>
  );
}
