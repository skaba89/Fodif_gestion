import Link from 'next/link';
import { TrendDownIcon, TrendFlatIcon, TrendUpIcon } from './Icons';
import styles from './KpiCard.module.css';

export type KpiTrend = { deltaPct: number | null; direction: 'up' | 'down' | 'flat' | null };

/**
 * One executive KPI - mission "présentation Directeur général" (section 2): "chaque KPI doit
 * comporter valeur, unité, définition, tendance si réellement calculable, comparaison avec la
 * période précédente, lien vers le détail, état indisponible si la donnée manque." Every one of
 * those is a real prop here, not decoration - `value === null` renders the explicit unavailable
 * state instead of a fabricated number, and `trend` only renders when the API actually computed
 * one (a period was selected) rather than always showing *something*.
 *
 * `goodDirection` says which trend direction reads as positive for *this* KPI - "up" is good for
 * montant décaissé, but "down" is good for impayés - so the same up/down icon doesn't always
 * imply the same color.
 */
export default function KpiCard({
  label,
  value,
  unit,
  definition,
  trend,
  detailHref,
  goodDirection = 'up',
}: {
  label: string;
  value: string | null;
  unit?: string;
  definition: string;
  trend?: KpiTrend | null;
  detailHref?: string;
  goodDirection?: 'up' | 'down';
}) {
  const trendIsGood = trend?.direction && (trend.direction === goodDirection || trend.direction === 'flat');
  return (
    <article className={styles.card}>
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
          <strong>{value}</strong>
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
