'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { clientApi } from '../../../lib/client-api';
import EmptyState from '../../_shared/EmptyState';
import {
  DOSSIER_STATUS_LABELS,
  StatusTone,
  dossierStatusLabel,
  dossierStatusTone,
} from '../../_shared/dossierStatus';
import styles from '../portal.module.css';
import designStyles from '../entrepreneurDesign.module.css';

type Application = {
  id: string;
  numeroDossier: string;
  programmeNom?: string;
  montantDemande: string | number;
  dateSoumission?: string;
  statut: string;
  createdAt: string;
};

const TONE_CLASS: Record<StatusTone, string> = {
  success: designStyles.pillSuccess,
  warning: styles.pill,
  danger: designStyles.pillDanger,
  info: designStyles.pillInfo,
  neutral: styles.pillMuted,
};

export default function TrackingPage() {
  const [dossiers, setDossiers] = useState<Application[]>([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('TOUS');

  async function load() {
    try {
      setDossiers(await clientApi<Application[]>('/api/pme/dossiers'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Chargement impossible');
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(id: string) {
    setMessage('');
    try {
      await clientApi(`/api/pme/dossiers/${id}/submit`, { method: 'POST' });
      setMessage('Dossier soumis avec succès.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Soumission impossible');
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return dossiers.filter((d) => {
      const matchesStatus = statusFilter === 'TOUS' || d.statut === statusFilter;
      const matchesQuery = term.length === 0
        || d.numeroDossier.toLowerCase().includes(term)
        || (d.programmeNom ?? '').toLowerCase().includes(term);
      return matchesStatus && matchesQuery;
    });
  }, [dossiers, query, statusFilter]);

  return (
    <main className={styles.main}>
      <div className={designStyles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Mes dossiers</p>
          <h1 className={styles.title}>Suivi de mes demandes</h1>
          <p className={styles.lead}>Cette liste est filtrée côté backend sur l’entreprise portée par votre session.</p>
        </div>
        <Link className={styles.primary} href="/entrepreneur/demande">Nouvelle demande</Link>
      </div>

      {message && <div className={styles.notice}>{message}</div>}

      <div className={designStyles.filters}>
        <div className={designStyles.filter}>
          <label htmlFor="dossier-search">Rechercher</label>
          <input
            id="dossier-search"
            type="search"
            placeholder="N° de dossier ou programme"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className={designStyles.filter}>
          <label htmlFor="dossier-status">Statut</label>
          <select id="dossier-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="TOUS">Tous les statuts</option>
            {Object.entries(DOSSIER_STATUS_LABELS).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {dossiers.length === 0 ? (
        <div className={styles.section}>
          <EmptyState
            title="Aucun dossier pour le moment"
            message="Vos demandes de financement soumises ou en préparation apparaîtront ici."
            actionHref="/entrepreneur/demande"
            actionLabel="Créer une demande"
          />
        </div>
      ) : (
        <section className={`${styles.card} ${styles.tableCard} ${styles.section}`} tabIndex={0} role="region" aria-label="Tableau, défilement horizontal sur petit écran">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Programme</th>
                <th>Montant</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.numeroDossier}</strong></td>
                  <td>{d.programmeNom ?? '—'}</td>
                  <td>{Number(d.montantDemande).toLocaleString('fr-FR')} GNF</td>
                  <td>{new Date(d.dateSoumission ?? d.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <span className={TONE_CLASS[dossierStatusTone(d.statut)]}>{dossierStatusLabel(d.statut)}</span>
                  </td>
                  <td>
                    <div className={styles.buttonRow}>
                      <Link className={styles.secondary} href={`/entrepreneur/suivi/${d.id}/documents`}>Documents</Link>
                      {d.statut === 'BROUILLON' && (
                        <button className={styles.primary} type="button" onClick={() => submit(d.id)}>Soumettre</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className={styles.lead}>Aucun dossier ne correspond à votre recherche.</p>
          )}
        </section>
      )}
    </main>
  );
}
