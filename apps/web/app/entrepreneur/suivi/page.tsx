'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

type MissingDocument = {
  code: string;
  libelle: string;
  typeDocument: string;
};

type Application = {
  id: string;
  numeroDossier: string;
  programmeNom?: string;
  montantDemande: string | number;
  dateSoumission?: string;
  statut: string;
  createdAt: string;
  documentsRequis?: number;
  documentsPresents?: number;
  documentsManquants?: MissingDocument[];
  completudeDocumentsPct?: number;
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

  const load = useCallback(async () => {
    try {
      setDossiers(await clientApi<Application[]>('/api/pme/dossiers'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chargement impossible');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (id: string) => {
    setMessage('');
    try {
      await clientApi(`/api/pme/dossiers/${id}/submit`, { method: 'POST' });
      setMessage('Dossier soumis avec succès.');
      pushToast({ tone: 'success', title: 'Dossier soumis', message: 'Votre dossier a été transmis au FODIP pour traitement.' });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Soumission impossible');
      pushToast({ tone: 'error', title: 'Soumission impossible', message: 'Le dossier n’a pas été soumis. Vérifiez les informations puis réessayez.' });
    }
  }, [load, pushToast]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return dossiers.filter((dossier) => {
      const matchesStatus = statusFilter === 'TOUS' || dossier.statut === statusFilter;
      const matchesQuery = term.length === 0
        || dossier.numeroDossier.toLowerCase().includes(term)
        || (dossier.programmeNom ?? '').toLowerCase().includes(term);
      return matchesStatus && matchesQuery;
    });
  }, [dossiers, query, statusFilter]);

  const columns = useMemo<ResponsiveColumn<Application>[]>(() => [
    { key: 'dossier', header: 'Dossier', render: (dossier) => <strong>{dossier.numeroDossier}</strong> },
    { key: 'programme', header: 'Programme', render: (dossier) => dossier.programmeNom ?? '—' },
    { key: 'montant', header: 'Montant', render: (dossier) => `${Number(dossier.montantDemande).toLocaleString('fr-FR')} GNF` },
    { key: 'date', header: 'Date', render: (dossier) => new Date(dossier.dateSoumission ?? dossier.createdAt).toLocaleDateString('fr-FR') },
    {
      key: 'documents',
      header: 'Pièces',
      render: (dossier) => {
        const required = dossier.documentsRequis ?? 0;
        const present = dossier.documentsPresents ?? 0;
        const missing = dossier.documentsManquants ?? [];
        if (required === 0) return <span className={styles.pillMuted}>Aucune exigence</span>;
        const complete = present >= required;
        return (
          <span
            className={complete ? designStyles.pillSuccess : styles.pill}
            title={missing.length > 0 ? `Manquants : ${missing.map((document) => document.libelle).join(', ')}` : 'Toutes les pièces obligatoires sont présentes'}
          >
            {present}/{required} · {dossier.completudeDocumentsPct ?? Math.round((present / required) * 100)} %
          </span>
        );
      },
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (dossier) => <span className={TONE_CLASS[dossierStatusTone(dossier.statut)]}>{dossierStatusLabel(dossier.statut)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (dossier) => (
        <div className={styles.buttonRow}>
          <Button variant="outline" href={`/entrepreneur/suivi/${dossier.id}/documents`}>Documents</Button>
          {dossier.statut === 'BROUILLON' ? <Button onClick={() => submit(dossier.id)}>Soumettre</Button> : null}
        </div>
      ),
    },
  ], [submit]);

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
          <p className={styles.lead}>Suivez le statut et la complétude documentaire de chaque dossier avant et après sa transmission au FODIP.</p>
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
            rowKey={(dossier) => dossier.id}
            caption="Suivi de mes demandes de financement"
            emptyMessage="Aucun dossier ne correspond à votre recherche."
          />
        </section>
      )}
    </main>
  );
}
