'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './DataViz.module.css';

// geoBoundaries gbOpen / Guinea / ADM1. The geometry is served by the upstream project rather than
// copied into this repository. Source: WFP / OCHA ROWCA, CC BY 3.0 IGO. The dataset contains the
// eight first-level administrative regions used by the FODIP reference data.
const GEOJSON_URL = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/GIN/ADM1/geoBoundaries-GIN-ADM1_simplified.geojson';
const WIDTH = 640;
const HEIGHT = 470;
const PADDING = 20;

type Position = [number, number];
type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] };
type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: Position[][][] };
type RegionGeometry = PolygonGeometry | MultiPolygonGeometry;
type RegionFeature = {
  type: 'Feature';
  properties: { shapeName?: string; name?: string; NAME_1?: string };
  geometry: RegionGeometry;
};
type RegionFeatureCollection = { type: 'FeatureCollection'; features: RegionFeature[] };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/\b(region|regionde|regiondu|région)\b/gi, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function featureName(feature: RegionFeature) {
  return feature.properties.shapeName ?? feature.properties.name ?? feature.properties.NAME_1 ?? 'Région';
}

function ringsFor(geometry: RegionGeometry): Position[][] {
  return geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flatMap((polygon) => polygon);
}

function featurePoints(feature: RegionFeature) {
  return ringsFor(feature.geometry).flat();
}

function boundsFor(features: RegionFeature[]): Bounds | null {
  const points = features.flatMap(featurePoints);
  if (points.length === 0) return null;
  return points.reduce<Bounds>((bounds, [longitude, latitude]) => ({
    minX: Math.min(bounds.minX, longitude),
    minY: Math.min(bounds.minY, latitude),
    maxX: Math.max(bounds.maxX, longitude),
    maxY: Math.max(bounds.maxY, latitude),
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function project([longitude, latitude]: Position, bounds: Bounds): Position {
  const longitudeSpan = Math.max(0.0001, bounds.maxX - bounds.minX);
  const latitudeSpan = Math.max(0.0001, bounds.maxY - bounds.minY);
  const scale = Math.min(
    (WIDTH - PADDING * 2) / longitudeSpan,
    (HEIGHT - PADDING * 2) / latitudeSpan,
  );
  const projectedWidth = longitudeSpan * scale;
  const projectedHeight = latitudeSpan * scale;
  const offsetX = (WIDTH - projectedWidth) / 2;
  const offsetY = (HEIGHT - projectedHeight) / 2;
  return [
    offsetX + (longitude - bounds.minX) * scale,
    offsetY + (bounds.maxY - latitude) * scale,
  ];
}

function pathFor(feature: RegionFeature, bounds: Bounds) {
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;

  return polygons.map((polygon) => polygon.map((ring) => {
    if (ring.length === 0) return '';
    const [firstX, firstY] = project(ring[0], bounds);
    const segments = ring.slice(1).map((point) => {
      const [x, y] = project(point, bounds);
      return `L${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${firstX.toFixed(1)},${firstY.toFixed(1)}${segments.join('')}Z`;
  }).join('')).join('');
}

function matchValue(values: Record<string, number>, regionName: string) {
  const normalized = normalizeName(regionName);
  const entry = Object.entries(values).find(([key]) => {
    const candidate = normalizeName(key);
    return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
  });
  return entry?.[1] ?? 0;
}

function isSelected(selectedRegion: string | undefined, regionName: string) {
  if (!selectedRegion) return false;
  return normalizeName(selectedRegion) === normalizeName(regionName);
}

export default function GuineaRegionMap({
  values,
  title = 'Répartition régionale',
  selectedRegion,
  onRegionSelect,
  valueLabel = 'dossiers',
}: {
  values: Record<string, number>;
  title?: string;
  selectedRegion?: string;
  onRegionSelect?: (regionName: string) => void;
  valueLabel?: string;
}) {
  const [features, setFeatures] = useState<RegionFeature[]>([]);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setMapState('loading');
    fetch(GEOJSON_URL, { cache: 'force-cache', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Map source returned ${response.status}`);
        const body = await response.json() as RegionFeatureCollection;
        if (body.type !== 'FeatureCollection' || !Array.isArray(body.features) || body.features.length !== 8) {
          throw new Error('Unexpected Guinea ADM1 geometry');
        }
        setFeatures(body.features);
        setMapState('ready');
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setMapState('error');
      });
    return () => controller.abort();
  }, []);

  const bounds = useMemo(() => boundsFor(features), [features]);
  const max = Math.max(1, ...features.map((feature) => matchValue(values, featureName(feature))));

  return (
    <figure className={styles.chartCard} aria-label={title}>
      <figcaption className={styles.chartHeader}>
        <div>
          <h3>{title}</h3>
          <p>Limites administratives réelles ADM1 · intensité selon le nombre de dossiers.</p>
        </div>
        {selectedRegion ? <span className={styles.mapSelection}>{selectedRegion}</span> : null}
      </figcaption>

      {mapState === 'loading' ? (
        <div className={styles.mapLoading} role="status">Chargement de la carte administrative…</div>
      ) : null}

      {mapState === 'error' ? (
        <div className={styles.mapUnavailable} role="status">
          <strong>Carte temporairement indisponible</strong>
          <span>Les indicateurs régionaux restent accessibles dans le classement adjacent.</span>
        </div>
      ) : null}

      {mapState === 'ready' && bounds ? (
        <svg className={styles.map} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Carte réelle des huit régions administratives de Guinée">
          <title>Carte réelle des huit régions administratives de Guinée</title>
          {features.map((feature) => {
            const name = featureName(feature);
            const value = matchValue(values, name);
            const ratio = value / max;
            const level = value === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
            const selected = isSelected(selectedRegion, name);
            const interactive = Boolean(onRegionSelect);
            const activate = () => onRegionSelect?.(name);
            return (
              <path
                key={name}
                d={pathFor(feature, bounds)}
                className={`${styles.mapRegion} ${styles[`level${level}`]} ${interactive ? styles.mapInteractive : ''} ${selected ? styles.mapSelected : ''}`}
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                aria-label={interactive ? `${name}, ${value.toLocaleString('fr-FR')} ${valueLabel}. Filtrer sur cette région.` : undefined}
                aria-pressed={interactive ? selected : undefined}
                onClick={interactive ? activate : undefined}
                onKeyDown={interactive ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                  }
                } : undefined}
              >
                <title>{name}: {value.toLocaleString('fr-FR')} {valueLabel}</title>
              </path>
            );
          })}
        </svg>
      ) : null}

      <div className={styles.mapLegend} aria-hidden="true">
        <span>Faible</span><span className={styles.mapLegendScale} /><span>Élevé</span>
      </div>
      <p className={styles.mapSource}>Limites : geoBoundaries · WFP/OCHA ROWCA · CC BY 3.0 IGO.</p>
    </figure>
  );
}
