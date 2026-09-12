'use client';

import GuineaRegionMap from '../_shared/GuineaRegionMap';
import styles from './DirectionTerritoryPanel.module.css';

type Choice = { id: string; nom: string };
type RegionBreakdown = {
  id: string | null;
  nom: string;
  dossiers: number;
  montantDemande: number;
  montantApprouve?: number;
};

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export default function DirectionTerritoryPanel({
  regions,
  choices,
  selectedRegionId,
  onSelectRegion,
  formatAmount,
}: {
  regions: RegionBreakdown[];
  choices: Choice[];
  selectedRegionId: string;
  onSelectRegion: (regionId: string) => void;
  formatAmount: (value: number) => string;
}) {
  const values = Object.fromEntries(regions.map((region) => [region.nom, region.dossiers]));
  const selectedRegion = choices.find((choice) => choice.id === selectedRegionId);
  const sortedRegions = [...regions].sort((left, right) => right.montantDemande - left.montantDemande);
  const maxAmount = Math.max(1, ...sortedRegions.map((region) => region.montantDemande));

  function selectByName(name: string) {
    const normalized = normalizeName(name);
    const choice = choices.find((item) => normalizeName(item.nom) === normalized);
    if (!choice) return;
    onSelectRegion(choice.id === selectedRegionId ? '' : choice.id);
  }

  return (
    <section className={styles.territorySection} id="regions" aria-labelledby="territory-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Pilotage territorial</p>
          <h2 id="territory-title">Portefeuille par région</h2>
          <p>
            Lecture nationale sur les huit régions administratives. Sélectionnez une région sur la carte ou dans le classement
            pour recalculer le cockpit.
          </p>
        </div>
        <div className={styles.scopeBadge}>
          <strong>8</strong>
          <span>régions ADM1</span>
        </div>
      </div>

      <div className={styles.territoryGrid}>
        <GuineaRegionMap
          values={values}
          selectedRegion={selectedRegion?.nom}
          onRegionSelect={selectByName}
          title="Carte régionale de la Guinée"
          valueLabel="dossiers"
        />

        <article className={styles.rankingCard} aria-label="Classement régional du portefeuille">
          <div className={styles.rankingHeader}>
            <div>
              <span>Exposition territoriale</span>
              <strong>{selectedRegion?.nom ?? 'Guinée entière'}</strong>
            </div>
            {selectedRegionId ? (
              <button type="button" className={styles.clearRegion} onClick={() => onSelectRegion('')}>
                Vue nationale
              </button>
            ) : null}
          </div>

          <div className={styles.regionRanking}>
            {sortedRegions.length === 0 ? (
              <p className={styles.empty}>Aucune donnée régionale pour le périmètre courant.</p>
            ) : sortedRegions.map((region, index) => {
              const choice = choices.find((item) => normalizeName(item.nom) === normalizeName(region.nom));
              const isSelected = Boolean(choice && choice.id === selectedRegionId);
              return (
                <button
                  type="button"
                  className={`${styles.regionRow} ${isSelected ? styles.regionRowSelected : ''}`}
                  key={region.id ?? region.nom}
                  onClick={() => choice && onSelectRegion(isSelected ? '' : choice.id)}
                  aria-pressed={isSelected}
                  disabled={!choice}
                >
                  <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={styles.regionIdentity}>
                    <strong>{region.nom}</strong>
                    <small>{region.dossiers.toLocaleString('fr-FR')} dossier{region.dossiers > 1 ? 's' : ''}</small>
                    <span className={styles.barTrack} aria-hidden="true">
                      <span style={{ width: `${Math.max(4, Math.round((region.montantDemande / maxAmount) * 100))}%` }} />
                    </span>
                  </span>
                  <span className={styles.regionAmount}>{formatAmount(region.montantDemande)} <small>GNF</small></span>
                </button>
              );
            })}
          </div>
        </article>
      </div>

      <p className={styles.adminNote}>
        Carte au niveau régional (ADM1). Les évolutions récentes du découpage communal sont un niveau administratif inférieur et
        n’altèrent pas les huit régions utilisées par le cockpit national.
      </p>
    </section>
  );
}
