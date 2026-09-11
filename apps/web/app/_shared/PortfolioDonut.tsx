import styles from './DataViz.module.css';

export type DonutSegment = { label: string; value: number };

export default function PortfolioDonut({
  segments,
  centerLabel = 'Total',
}: {
  segments: DonutSegment[];
  centerLabel?: string;
}) {
  const positive = segments.filter((segment) => segment.value > 0);
  const total = positive.reduce((sum, segment) => sum + segment.value, 0);
  const layout = positive.map((segment, index) => {
    const pct = total > 0 ? (segment.value / total) * 100 : 0;
    const offset = positive.slice(0, index).reduce(
      (sum, previous) => sum + (total > 0 ? (previous.value / total) * 100 : 0),
      0,
    );
    return { segment, pct, offset, index };
  });

  return (
    <figure className={styles.chartCard} aria-label="Répartition du portefeuille">
      <div className={styles.donutWrap}>
        <svg className={styles.donut} viewBox="0 0 180 180" role="img" aria-label={`Répartition du portefeuille, total ${total}`}>
          <title>Répartition du portefeuille</title>
          <circle className={styles.donutTrack} cx="90" cy="90" r="58" />
          {layout.map(({ segment, pct, offset, index }) => (
            <circle
              key={segment.label}
              className={`${styles.donutSegment} ${styles[`segment${index % 6}`]}`}
              cx="90"
              cy="90"
              r="58"
              pathLength="100"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-offset}
            >
              <title>{segment.label}: {segment.value.toLocaleString('fr-FR')}</title>
            </circle>
          ))}
          <text className={styles.donutTotal} x="90" y="87">{total.toLocaleString('fr-FR')}</text>
          <text className={styles.donutLabel} x="90" y="104">{centerLabel}</text>
        </svg>

        <figcaption>
          <ul className={styles.legend}>
            {positive.map((segment, index) => (
              <li key={segment.label}>
                <span className={`${styles.legendDot} ${styles[`segment${index % 6}`]}`} aria-hidden="true" />
                <span>{segment.label}</span>
                <strong className={styles.legendValue}>{segment.value.toLocaleString('fr-FR')}</strong>
              </li>
            ))}
          </ul>
        </figcaption>
      </div>
    </figure>
  );
}
