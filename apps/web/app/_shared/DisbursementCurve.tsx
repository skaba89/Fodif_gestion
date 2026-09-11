import styles from './DataViz.module.css';

export type CurvePoint = { label: string; value: number };

function buildCurve(points: CurvePoint[]) {
  if (points.length === 0) return { line: '', area: '', dots: [] as { x: number; y: number; point: CurvePoint }[] };
  const width = 320;
  const height = 130;
  const padX = 14;
  const padY = 14;
  const max = Math.max(...points.map((point) => point.value), 1);
  const min = Math.min(...points.map((point) => point.value), 0);
  const spread = Math.max(max - min, 1);
  const step = points.length === 1 ? 0 : (width - padX * 2) / (points.length - 1);
  const dots = points.map((point, index) => ({
    point,
    x: padX + step * index,
    y: height - padY - ((point.value - min) / spread) * (height - padY * 2),
  }));
  const line = dots.map((dot, index) => `${index === 0 ? 'M' : 'L'}${dot.x.toFixed(1)} ${dot.y.toFixed(1)}`).join(' ');
  const area = `${line} L${dots[dots.length - 1].x.toFixed(1)} ${height - padY} L${dots[0].x.toFixed(1)} ${height - padY} Z`;
  return { line, area, dots };
}

export default function DisbursementCurve({
  points,
  title = 'Décaissements',
  description = 'Évolution des décaissements sur la période',
}: {
  points: CurvePoint[];
  title?: string;
  description?: string;
}) {
  const chart = buildCurve(points);
  return (
    <figure className={styles.chartCard} aria-label={`${title}. ${description}`}>
      <figcaption className={styles.chartHeader}>
        <div><h3>{title}</h3><p>{description}</p></div>
      </figcaption>
      <svg className={styles.curve} viewBox="0 0 320 130" role="img" aria-label={description}>
        <title>{description}</title>
        <path className={styles.curveGrid} d="M14 36H306M14 72H306M14 108H306" />
        {chart.area ? <path className={styles.curveArea} d={chart.area} /> : null}
        {chart.line ? <path className={styles.curveLine} d={chart.line} pathLength={1} /> : null}
        {chart.dots.map(({ x, y, point }) => (
          <circle className={styles.curveDot} key={`${point.label}-${x}`} cx={x} cy={y} r="3.5">
            <title>{point.label}: {point.value.toLocaleString('fr-FR')} GNF</title>
          </circle>
        ))}
      </svg>
    </figure>
  );
}
