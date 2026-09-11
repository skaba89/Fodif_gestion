import styles from './DataViz.module.css';

const REGIONS = [
  { name: 'Boké', path: 'M40 58 100 34 132 62 113 103 61 105 30 82Z', label: [76, 72] },
  { name: 'Conakry', path: 'M28 107 58 100 70 117 55 132 28 128Z', label: [48, 117] },
  { name: 'Kindia', path: 'M63 108 116 103 139 132 117 160 74 153 52 130Z', label: [96, 132] },
  { name: 'Labé', path: 'M120 67 168 48 196 78 176 111 137 112 112 101Z', label: [154, 84] },
  { name: 'Mamou', path: 'M139 116 177 112 207 137 188 170 139 164 119 150Z', label: [163, 143] },
  { name: 'Faranah', path: 'M192 91 238 78 268 111 247 155 204 151 178 119Z', label: [224, 119] },
  { name: 'Kankan', path: 'M241 74 302 60 337 104 306 151 252 151 268 111Z', label: [291, 111] },
  { name: 'Nzérékoré', path: 'M191 174 244 153 301 156 326 195 294 226 230 219 180 195Z', label: [253, 190] },
] as const;

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function GuineaRegionMap({
  values,
  title = 'Répartition régionale',
}: {
  values: Record<string, number>;
  title?: string;
}) {
  const entries = Object.entries(values);
  const getValue = (name: string) => {
    const normalized = normalizeName(name);
    return entries.find(([key]) => normalizeName(key).includes(normalized) || normalized.includes(normalizeName(key)))?.[1] ?? 0;
  };
  const max = Math.max(1, ...REGIONS.map((region) => getValue(region.name)));

  return (
    <figure className={styles.chartCard} aria-label={title}>
      <figcaption className={styles.chartHeader}>
        <div><h3>{title}</h3><p>Intensité relative selon le périmètre courant.</p></div>
      </figcaption>
      <svg className={styles.map} viewBox="0 0 370 250" role="img" aria-label="Carte choroplèthe des huit régions administratives de Guinée">
        <title>Carte choroplèthe des huit régions administratives de Guinée</title>
        {REGIONS.map((region) => {
          const value = getValue(region.name);
          const ratio = value / max;
          const level = value === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
          return (
            <g key={region.name}>
              <path className={`${styles.mapRegion} ${styles[`level${level}`]}`} d={region.path}>
                <title>{region.name}: {value.toLocaleString('fr-FR')}</title>
              </path>
              <text
                className={`${styles.mapLabel} ${level >= 3 ? styles.mapLabelInverse : ''}`}
                x={region.label[0]}
                y={region.label[1]}
              >
                {region.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={styles.mapLegend} aria-hidden="true">
        <span>Faible</span><span className={styles.mapLegendScale} /><span>Élevé</span>
      </div>
    </figure>
  );
}
