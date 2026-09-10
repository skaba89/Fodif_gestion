'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import FilterBar, { FilterField } from '../../_shared/FilterBar';
import KpiCard from '../../_shared/KpiCard';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import { DossierStatusBadge } from '../../_shared/StatusBadge';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../agent.module.css';

type Dossier = { id: string; numeroDossier: string; raisonSociale: string; programmeNom?: string; montantDemande: string | number; statut: string; dateSoumission?: string; agentResponsableId?: string | null };
type Result = { items: Dossier[]; total: number; page: number; limite: number };

export default function AgentDossiersPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [statut, setStatut] = useState('');
  const [recherche, setRecherche] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async (page = 1, status = statut, search = recherche) => {
    const query = new URLSearchParams();
    if (status) query.set('statut', status);
    if (search.trim()) query.set('recherche', search.trim());
    query.set('page', String(page));
    const response = await fetch(`/api/agent/dossiers?${query}`, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
    setResult(body);
  }, [recherche, statut]);

  useEffect(() => { load(1).catch((error) => setMessage(error.message)); }, [load]);
  const counts = useMemo(() => result.items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.statut]: (acc[item.statut] ?? 0) + 1 }), {}), [result.items]);

  function filter(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    load(1).catch((error) => setMessage(error.message));
  }

  function resetFilters() {
    setStatut('');
    setRecherche('');
    setMessage('');
    load(1, '', '').catch((error) => setMessage(error.message));
  }

  const columns = useMemo<ResponsiveColumn<Dossier>[]>(() => [
    { key: 'dossier', header: 'Dossier', render: (dossier) => <strong>{dossier.numeroDossier}</strong> },
    { key: 'entreprise', header: 'Entreprise', render: (dossier) => dossier.raisonSociale },
    { key: 'programme', header: 'Programme', render: (dossier) => dossier.programmeNom ?? '—' },
    { key: 'montant', header: 'Montant demandé', render: (dossier) => `${Number(dossier.montantDemande).toLocaleString('fr-FR')} GNF` },
    { key: 'statut', header: 'Statut', render: (dossier) => <DossierStatusBadge status={dossier.statut} /> },
    { key: 'action', header: 'Action', render: (dossier) => <Button variant="outline" href={`/agent/dossiers/${dossier.id}`}>Vue 360°</Button> },
  ], []);

  const activeFilterCount = Number(Boolean(statut)) + Number(Boolean(recherche.trim()));

  return <main className={portal.main}>
    <Breadcrumbs items={[
      { label: 'Agent', href: '/agent/dossiers' },
      { label: 'Dossiers' },
    ]} />
    <p className={portal.eyebrow}>Portefeuille d’instruction</p>
    <h1 className={portal.title}>Dossiers de financement</h1>
    <p className={portal.lead}>Priorisez les nouvelles demandes, prenez en charge un dossier et accédez à sa vue 360° avec des statuts métier lisibles.</p>

    <section className={styles.metrics} aria-label="Synthèse du portefeuille d’instruction">
      <KpiCard label="Dossiers trouvés" value={String(result.total)} definition="Nombre total de dossiers correspondant aux filtres actuels, toutes pages confondues." />
      <KpiCard label="À prendre en charge" value={String(counts.SOUMIS ?? 0)} definition="Dossiers soumis visibles sur la page courante et encore à prendre en charge." />
      <KpiCard label="En instruction" value={String(counts.EN_INSTRUCTION ?? 0)} definition="Dossiers actuellement en instruction sur la page courante." />
      <KpiCard label="Prêts pour comité" value={String(counts.PRET_COMITE ?? 0)} definition="Dossiers prêts à être transmis au comité sur la page courante." />
    </section>

    <form className={portal.section} onSubmit={filter}>
      <FilterBar
        activeCount={activeFilterCount}
        onReset={resetFilters}
        actions={<Button type="submit">Filtrer</Button>}
        ariaLabel="Filtres des dossiers à instruire"
      >
        <FilterField label="Statut" htmlFor="statut">
          <select id="statut" value={statut} onChange={(event) => setStatut(event.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="SOUMIS">Soumis</option>
            <option value="EN_INSTRUCTION">En instruction</option>
            <option value="COMPLEMENT_REQUIS">Compléments requis</option>
            <option value="PRET_COMITE">Prêt pour le comité</option>
          </select>
        </FilterField>
        <FilterField label="Recherche" htmlFor="recherche">
          <input id="recherche" type="search" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="N° dossier ou PME" />
        </FilterField>
      </FilterBar>
    </form>

    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={portal.section}>
      <div className={portal.sectionHeader}>
        <div>
          <h2>File d’instruction</h2>
          <p>Les dossiers les plus pertinents restent accessibles en vue détaillée, sur ordinateur comme sur mobile.</p>
        </div>
      </div>
      <ResponsiveTable
        rows={result.items}
        columns={columns}
        rowKey={(dossier) => dossier.id}
        caption="Dossiers de financement à instruire"
        emptyMessage="Aucun dossier ne correspond aux critères."
      />
    </section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={(page) => load(page).catch((error) => setMessage(error.message))} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
