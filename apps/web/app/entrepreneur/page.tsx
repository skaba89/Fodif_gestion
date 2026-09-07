'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { clientApi } from '../../lib/client-api';
import KpiCard from '../_shared/KpiCard';
import { dossierProgressPercent, dossierStatusLabel } from '../_shared/dossierStatus';
import styles from './portal.module.css';
import designStyles from './entrepreneurDesign.module.css';

type Company = { codeFodip: string; raisonSociale: string };
type Application = { id: string; statut: string; montantDemande: string | number };
type Program = { id: string; nom: string; description?: string };

export default function EntrepreneurDashboard() {
  const [company, setCompany] = useState<Company | null>(null);
  const [dossiers, setDossiers] = useState<Application[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      clientApi<Company>('/api/pme/entreprise'),
      clientApi<Application[]>('/api/pme/dossiers'),
      clientApi<Program[]>('/api/programmes'),
    ])
      .then(([c, d, p]) => { setCompany(c); setDossiers(d); setPrograms(p); })
      .catch((e) => setError(e.message));
  }, []);

  const drafts = dossiers.filter((d) => d.statut === 'BROUILLON').length;
  const active = dossiers.filter((d) => !['BROUILLON', 'CLOTURE', 'REJETE', 'ANNULE'].includes(d.statut)).length;

  const totalRequested = useMemo(
    () => dossiers.reduce((sum, d) => sum + Number(d.montantDemande || 0), 0),
    [dossiers],
  );

  // The lead dossier for the hero progress bar: the one furthest along an active workflow, so the
  // bar reflects a real dossier instead of a hardcoded value.
  const leadDossier = useMemo(() => {
    const inProgress = dossiers.filter((d) => !['ANNULE', 'BROUILLON', 'REJETE', 'CLOTURE'].includes(d.statut));
    if (inProgress.length === 0) return null;
    return inProgress.reduce((furthest, current) => (
      dossierProgressPercent(current.statut) > dossierProgressPercent(furthest.statut) ? current : furthest
    ));
  }, [dossiers]);

  const progressPercent = leadDossier ? dossierProgressPercent(leadDossier.statut) : 0;

  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Espace entrepreneur</p>
      <h1 className={styles.title}>{company ? `Bienvenue, ${company.raisonSociale}` : 'Votre espace FODIP'}</h1>
      <p className={styles.lead}>Votre tableau de bord utilise désormais les données de votre session et de PostgreSQL.</p>
      {error && <div className={styles.notice}>{error}</div>}

      <section className={styles.hero}>
        <div className={`${styles.card} ${styles.heroCard}`}>
          <h2>{dossiers.length} dossier(s)</h2>
          <p>{drafts} brouillon(s) · {active} dossier(s) en traitement.</p>
          {leadDossier && (
            <>
              <div
                className={styles.progress}
                role="progressbar"
                aria-label={`Progression du dossier : ${dossierStatusLabel(leadDossier.statut)}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
              >
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className={styles.progressLine}>
                <span>{dossierStatusLabel(leadDossier.statut)}</span>
                <span>{progressPercent}%</span>
              </div>
            </>
          )}
          <div className={styles.buttonRow}>
            <Link className={styles.primary} href="/entrepreneur/demande">Nouvelle demande</Link>
            <Link className={styles.secondary} href="/entrepreneur/suivi">Voir mes dossiers</Link>
          </div>
        </div>
        <div className={`${styles.card} ${styles.quick}`}>
          <p className={styles.eyebrow}>Référence PME</p>
          <strong>{company?.codeFodip ?? '—'}</strong>
          <small>Identité chargée depuis votre entreprise associée.</small>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Vue d’ensemble</h2>
            <p>Chiffres clés de vos demandes de financement.</p>
          </div>
        </div>
        <div className={designStyles.stats}>
          <KpiCard
            label="Dossiers au total"
            value={String(dossiers.length)}
            definition="Nombre total de dossiers, tous statuts confondus, associés à votre entreprise."
            detailHref="/entrepreneur/suivi"
          />
          <KpiCard
            label="Dossiers actifs"
            value={String(active)}
            definition="Dossiers soumis et toujours en cours d’instruction ou d’examen, hors brouillons et dossiers clôturés."
            detailHref="/entrepreneur/suivi"
          />
          <KpiCard
            label="Montant total demandé"
            value={totalRequested.toLocaleString('fr-FR')}
            unit="GNF"
            definition="Somme des montants demandés sur l’ensemble de vos dossiers, tous statuts confondus."
            detailHref="/entrepreneur/suivi"
          />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Programmes actifs</h2>
            <p>Référentiel chargé depuis l’API FODIP.</p>
          </div>
        </div>
        <div className={styles.programs}>
          {programs.map((p) => (
            <article className={`${styles.card} ${styles.program}`} key={p.id}>
              <h3>{p.nom}</h3>
              <p>{p.description ?? 'Programme de financement FODIP.'}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
