'use client';

import { useEffect, useMemo, useState } from 'react';
import { clientApi } from '../../../lib/client-api';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import EmptyState from '../../_shared/EmptyState';
import FilterBar, { FilterField } from '../../_shared/FilterBar';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import { useToast } from '../../_shared/Toast';
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
  const { pushToast } = useToast();

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
      pushToast({ tone: 'success', title: 'Dossier soumis', message: 'Votre dossier a été transmis au FODIP pour traitement.' });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Soumission impossible');
      pushToast({ tone: 'error', title: 'Soumission impossible', message: 'Le dossier n’a pas été soumis. Vérifiez les informations puis réessayez.' });
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

  const columns = useMemo<ResponsiveColumn<Application>[]>(() => [
    { key: 'dossier', header: 'Dossier', render: (d) => <strong>{d.numeroDossier}</strong> },
    { key: 'programme', header: 'Programme', render: (d) => d.programmeNom ?? '—' },
    { key: 'montant', header: 'Montant', render: (d) => `${Number(d.montantDemande).toLocaleString('fr-FR')} GNF` },
    { key: 'date', header: 'Date', render: (d) => new Date(d.dateSoumission ?? d.createdAt).toLocaleDateString('fr-FR') },
    {
      key: 'statut',
      header: 'Statut',
      render: (d) => <span className={TONE_CLASS[dossierStatusTone(d.statut)]}>{dossierStatusLabel(d.statut)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (d) => (
        <div className={styles.buttonRow}>
          <Button variant="outline" href={`/entrepreneur/suivi/${d.id}/documents`}>Documents</Button>
          {d.statut === 'BROUILLON' ? <Button onClick={() => submit(d.id)}>Soumettre</Button> : null}
        </div>
      ),
    },
  ], []);

  const activeFilterCount = Number(Boolean(query.trim())) + Number(statusFilter !== 'TOUS');

  return (
    <main className={styles.main}>
      <Breadcrumbs items={[
        { label: 'Entrepreneur', href: '/entrepreneur' },
        { label: 'Suivi des demandes' },
      ]} />
      <div className={designStyles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Mes dossiers</p>
          <h1 className={styles.title}>Suivi de mes demandes</h1>
          <p className={styles.lead}>Cette liste est filtrée côté backend sur l’entreprise portée par votre session.</p>
        </div>
        <Button href="/entrepreneur/demande">Nouvelle demande</Button>
      </div>

      {message && <div className={styles.notice}>{message}</div>}

      <div className={styles.section}>
        <FilterBar
          activeCount={activeFilterCount}
          onReset={() => { setQuery(''); setStatusFilter('TOUS'); }}
          ariaLabel="Filtres de mes dossiers"
        >
          <FilterField label="Rechercher" htmlFor="dossier-search">
            <input
              id="dossier-search"
              type="search"
              placeholder="N° de dossier ou programme"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </FilterField>
          <FilterField label="Statut" htmlFor="dossier-status">
            <select id="dossier-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="TOUS">Tous les statuts</option>
              {Object.entries(DOSSIER_STATUS_LABELS).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </FilterField>
        </FilterBar>
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
        <section className={styles.section}>
          <ResponsiveTable
            rows={filtered}
            columns={columns}
            rowKey={(d) => d.id}
            caption="Suivi de mes demandes de financement"
            emptyMessage="Aucun dossier ne correspond à votre recherche."
          />
        </section>
      )}
    </main>
  );
}
