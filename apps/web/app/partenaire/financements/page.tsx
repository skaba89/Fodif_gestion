'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import FilterBar, { FilterField } from '../../_shared/FilterBar';
import KpiCard from '../../_shared/KpiCard';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import { GenericStatusBadge } from '../../_shared/StatusBadge';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type Financing = {
  id: string; numeroFinancement: string; numeroDossier: string; raisonSociale: string;
  montantAccorde: number; tauxInteret: number; dureeMois: number; dateDebut: string; dateFinPrevue: string; statut: string;
};
type Result = { items: Financing[]; total: number; page: number; limite: number };

const EMPTY_FILTERS = { search: '', dateFrom: '', dateTo: '' };
type Filters = typeof EMPTY_FILTERS;

export default function PartnerFinancingsPage() {
  const [result, setResult] = useState<Result>({ items: [], total: 0, page: 1, limite: 25 });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [message, setMessage] = useState('');

  const load = useCallback((page: number, applied = filters) => {
    const query = new URLSearchParams({ page: String(page) });
    if (applied.search) query.set('search', applied.search);
    if (applied.dateFrom) query.set('dateFrom', applied.dateFrom);
    if (applied.dateTo) query.set('dateTo', applied.dateTo);
    fetch(`/api/partenaire/financements?${query}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement impossible');
      setResult(body);
    }).catch((error) => setMessage(error.message));
  }, [filters]);

  useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    load(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setMessage('');
    load(1, EMPTY_FILTERS);
  }

  const pageAmount = result.items.reduce((sum, item) => sum + Number(item.montantAccorde), 0);
  const averageRate = result.items.length
    ? result.items.reduce((sum, item) => sum + Number(item.tauxInteret), 0) / result.items.length
    : null;
  const averageDuration = result.items.length
    ? result.items.reduce((sum, item) => sum + Number(item.dureeMois), 0) / result.items.length
    : null;

  const columns = useMemo<ResponsiveColumn<Financing>[]>(() => [
    {
      key: 'financement',
      header: 'Financement',
      render: (item) => <><strong>{item.numeroFinancement}</strong><br />{item.numeroDossier}</>,
    },
    { key: 'entreprise', header: 'Entreprise', render: (item) => item.raisonSociale },
    { key: 'accorde', header: 'Montant accordé', render: (item) => `${Number(item.montantAccorde).toLocaleString('fr-FR')} GNF` },
    { key: 'taux', header: 'Taux', render: (item) => `${Number(item.tauxInteret).toLocaleString('fr-FR')} %` },
    { key: 'duree', header: 'Durée', render: (item) => `${item.dureeMois} mois` },
    { key: 'statut', header: 'Statut', render: (item) => <GenericStatusBadge status={item.statut} /> },
    { key: 'action', header: 'Action', render: (item) => <Button variant="outline" href={`/partenaire/financements/${item.id}`}>Gérer</Button> },
  ], []);

  return <main className={portal.main}>
    <Breadcrumbs items={[
      { label: 'Partenaire bancaire', href: '/partenaire/tableau-de-bord' },
      { label: 'Financements' },
    ]} />
    <p className={portal.eyebrow}>Portefeuille partenaire</p>
    <h1 className={portal.title}>Vos financements FODIP</h1>
    <p className={portal.lead}>Suivez uniquement les financements relevant de votre périmètre bancaire, consultez les échéanciers et déclarez les opérations autorisées dans une vue cohérente avec celle de la Direction.</p>

    <section className={styles.metrics} aria-label="Synthèse de la page courante du portefeuille partenaire">
      <KpiCard label="Financements du périmètre" value={String(result.total)} definition="Nombre total de financements appartenant au périmètre de votre établissement, toutes pages confondues." />
      <KpiCard label="Montant affiché" value={pageAmount.toLocaleString('fr-FR')} unit="GNF" definition="Somme des montants accordés pour les financements affichés sur la page courante." />
      <KpiCard label="Taux moyen affiché" value={averageRate === null ? null : averageRate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} unit="%" definition="Taux d’intérêt moyen calculé uniquement sur les financements de la page courante." />
      <KpiCard label="Durée moyenne affichée" value={averageDuration === null ? null : averageDuration.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} unit="mois" definition="Durée moyenne des financements affichés sur la page courante." />
    </section>
    <p className={portal.lead}>Les montants, taux et durées ci-dessus portent uniquement sur les financements visibles sur la page courante. Le nombre de financements correspond au total de votre périmètre bancaire.</p>

    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={portal.section}>
      <div className={portal.sectionHeader}>
        <div>
          <h2>Portefeuille opérationnel</h2>
          <p>Ouvrez un financement pour consulter son échéancier et les opérations disponibles selon vos droits.</p>
        </div>
      </div>
      <form onSubmit={applyFilters}>
        <FilterBar
          activeCount={Object.values(filters).filter(Boolean).length}
          onReset={resetFilters}
          actions={<Button type="submit">Appliquer le filtre</Button>}
          ariaLabel="Filtres du portefeuille partenaire"
        >
          <FilterField label="Recherche" htmlFor="search">
            <input
              id="search"
              type="text"
              placeholder="N° financement, N° dossier ou raison sociale"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </FilterField>
          <FilterField label="Début depuis le" htmlFor="dateFrom">
            <input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </FilterField>
          <FilterField label="Début jusqu’au" htmlFor="dateTo">
            <input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </FilterField>
        </FilterBar>
      </form>
      <ResponsiveTable
        rows={result.items}
        columns={columns}
        rowKey={(item) => item.id}
        caption="Financements du partenaire bancaire"
        emptyMessage="Aucun financement ne correspond aux critères sélectionnés."
      />
    </section>
    <Pagination page={result.page} limite={result.limite} total={result.total} onChange={(page) => load(page)} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
  </main>;
}
