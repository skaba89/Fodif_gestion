'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import FilterBar, { FilterField } from '../../_shared/FilterBar';
import KpiCard from '../../_shared/KpiCard';
import Pagination from '../../_shared/Pagination';
import ResponsiveTable, { type ResponsiveColumn } from '../../_shared/ResponsiveTable';
import StatusBadge, { GenericStatusBadge, humanizeCode } from '../../_shared/StatusBadge';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type Financing = {
  id: string; numeroFinancement: string; numeroDossier: string; raisonSociale: string; region?: string;
  montantAccorde: number; montantDecaisse: number; montantRembourse: number; impaye: number; statut: string;
};
type FinancingsResult = { items: Financing[]; total: number; page: number; limite: number };

type AuditLog = {
  id: string; action: string; entityType: string; entityId: string | null; createdAt: string;
  actorEmail?: string | null; actorNom?: string | null; actorPrenom?: string | null;
};
type AuditResult = { items: AuditLog[]; total: number; page: number; limite: number };

const ENTITY_TYPES = ['DOSSIER_FINANCEMENT', 'DOSSIER_DOCUMENT', 'FINANCEMENT', 'DECAISSEMENT', 'REMBOURSEMENT', 'SUIVI_IMPACT', 'UTILISATEUR'];
const ENTITY_LABELS: Record<string, string> = {
  DOSSIER_FINANCEMENT: 'Dossier de financement',
  DOSSIER_DOCUMENT: 'Document de dossier',
  FINANCEMENT: 'Financement',
  DECAISSEMENT: 'Décaissement',
  REMBOURSEMENT: 'Remboursement',
  SUIVI_IMPACT: 'Suivi d’impact',
  UTILISATEUR: 'Utilisateur',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function actorLabel(log: AuditLog): string {
  const fullName = [log.actorPrenom, log.actorNom].filter(Boolean).join(' ').trim();
  if (fullName && log.actorEmail) return `${fullName} · ${log.actorEmail}`;
  return fullName || log.actorEmail || 'Système';
}

const EMPTY_AUDIT_FILTERS = { entityType: '', entityId: '', actorSearch: '', dateFrom: '', dateTo: '' };
type AuditFilters = typeof EMPTY_AUDIT_FILTERS;

export default function AuditeurDashboardPage() {
  const [financings, setFinancings] = useState<FinancingsResult>({ items: [], total: 0, page: 1, limite: 25 });
  const [logs, setLogs] = useState<AuditResult>({ items: [], total: 0, page: 1, limite: 25 });
  const [auditFilters, setAuditFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [message, setMessage] = useState('');

  const loadFinancings = useCallback((page: number) => {
    fetch(`/api/auditeur/financements?page=${page}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement des financements impossible');
      setFinancings(body);
    }).catch((error) => setMessage(error.message));
  }, []);

  const loadLogs = useCallback((page: number, filters = auditFilters) => {
    const query = new URLSearchParams({ page: String(page) });
    if (filters.entityType) query.set('entityType', filters.entityType);
    if (filters.entityId) query.set('entityId', filters.entityId);
    if (filters.actorSearch) query.set('actorSearch', filters.actorSearch);
    if (filters.dateFrom) query.set('dateFrom', new Date(filters.dateFrom).toISOString());
    if (filters.dateTo) query.set('dateTo', new Date(filters.dateTo).toISOString());
    fetch(`/api/auditeur/journal?${query}`, { cache: 'no-store' }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message ?? 'Chargement du journal impossible');
      setLogs(body);
    }).catch((error) => setMessage(error.message));
  }, [auditFilters]);

  useEffect(() => { loadFinancings(1); loadLogs(1); }, [loadFinancings, loadLogs]);

  function filterLogs(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    loadLogs(1);
  }

  function resetAuditFilters() {
    setAuditFilters(EMPTY_AUDIT_FILTERS);
    setMessage('');
    loadLogs(1, EMPTY_AUDIT_FILTERS);
  }

  const drillDownToFinancing = useCallback((financingId: string) => {
    const filters = { ...EMPTY_AUDIT_FILTERS, entityId: financingId };
    setAuditFilters(filters);
    setMessage('');
    loadLogs(1, filters);
    document.getElementById('journal-audit')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loadLogs]);

  const committed = financings.items.reduce((sum, item) => sum + item.montantAccorde, 0);
  const disbursed = financings.items.reduce((sum, item) => sum + item.montantDecaisse, 0);
  const impayes = financings.items.reduce((sum, item) => sum + item.impaye, 0);

  const financingColumns = useMemo<ResponsiveColumn<Financing>[]>(() => [
    {
      key: 'financement',
      header: 'Financement',
      render: (item) => <><strong>{item.numeroFinancement}</strong><br />{item.numeroDossier}</>,
    },
    { key: 'entreprise', header: 'Entreprise', render: (item) => <>{item.raisonSociale}<br />{item.region ?? '—'}</> },
    { key: 'accorde', header: 'Accordé', render: (item) => `${item.montantAccorde.toLocaleString('fr-FR')} GNF` },
    { key: 'decaisse', header: 'Décaissé', render: (item) => `${item.montantDecaisse.toLocaleString('fr-FR')} GNF` },
    { key: 'rembourse', header: 'Remboursé', render: (item) => `${item.montantRembourse.toLocaleString('fr-FR')} GNF` },
    { key: 'impaye', header: 'Impayé', render: (item) => `${item.impaye.toLocaleString('fr-FR')} GNF` },
    { key: 'statut', header: 'Statut', render: (item) => <GenericStatusBadge status={item.statut} /> },
    {
      key: 'audit',
      header: 'Audit',
      render: (item) => (
        <Button type="button" className={portal.secondary} onClick={() => drillDownToFinancing(item.id)}>
          Voir le journal
        </Button>
      ),
    },
  ], [drillDownToFinancing]);

  const auditColumns = useMemo<ResponsiveColumn<AuditLog>[]>(() => [
    { key: 'date', header: 'Date', render: (log) => formatDate(log.createdAt) },
    { key: 'auteur', header: 'Auteur', render: (log) => actorLabel(log) },
    { key: 'action', header: 'Action', render: (log) => <StatusBadge label={humanizeCode(log.action)} tone="info" title={log.action} /> },
    {
      key: 'entite',
      header: 'Entité',
      render: (log) => <>{ENTITY_LABELS[log.entityType] ?? humanizeCode(log.entityType)}{log.entityId ? <><br /><span title={log.entityId}>ID {log.entityId.slice(0, 8)}…</span></> : null}</>,
    },
  ], []);

  return <main className={portal.main}>
    <Breadcrumbs items={[
      { label: 'Auditeur', href: '/auditeur/tableau-de-bord' },
      { label: 'Supervision' },
    ]} />
    <p className={portal.eyebrow}>Contrôle indépendant</p>
    <h1 className={portal.title}>Supervision et audit</h1>
    <p className={portal.lead}>Consultez en lecture seule le portefeuille de financements et les traces d’audit. Cet espace privilégie la lisibilité des preuves sans proposer aucune action de modification.</p>

    <section className={styles.metrics} aria-label="Synthèse de la page courante du périmètre audité">
      <KpiCard label="Financements du périmètre" value={String(financings.total)} definition="Nombre total de financements visibles dans le périmètre d’audit, toutes pages confondues." />
      <KpiCard label="Accordé affiché" value={committed.toLocaleString('fr-FR')} unit="GNF" definition="Somme des montants accordés pour les financements de la page courante." />
      <KpiCard label="Décaissé affiché" value={disbursed.toLocaleString('fr-FR')} unit="GNF" definition="Somme des décaissements associés aux financements de la page courante." />
      <KpiCard label="Impayés affichés" value={impayes.toLocaleString('fr-FR')} unit="GNF" definition="Montant total des impayés pour les financements affichés sur la page courante." goodDirection="down" />
    </section>
    <p className={portal.lead}>Les montants accordés, décaissés et impayés ci-dessus sont calculés sur les financements visibles sur la page courante. Le nombre de financements correspond au total du périmètre audité.</p>

    {message && <div className={`${portal.notice} ${portal.section}`} role="status">{message}</div>}

    <section className={portal.section}>
      <div className={portal.sectionHeader}>
        <div>
          <h2>Portefeuille de financements</h2>
          <p>Vue consolidée des engagements et remboursements, sans droit de création ni de modification.</p>
        </div>
      </div>
      <ResponsiveTable
        rows={financings.items}
        columns={financingColumns}
        rowKey={(item) => item.id}
        caption="Portefeuille de financements audité"
        emptyMessage="Aucun financement n’est enregistré dans le périmètre d’audit."
      />
      <Pagination page={financings.page} limite={financings.limite} total={financings.total} onChange={loadFinancings} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
    </section>

    <section className={portal.section} id="journal-audit">
      <div className={portal.sectionHeader}>
        <div>
          <h2>Journal d’audit</h2>
          <p>Retrouvez les traces d’instruction, de décision, d’administration et d’opérations financières avec des libellés lisibles.</p>
        </div>
      </div>
      <form onSubmit={filterLogs}>
        <FilterBar
          activeCount={Object.values(auditFilters).filter(Boolean).length}
          onReset={resetAuditFilters}
          actions={<Button type="submit">Appliquer le filtre</Button>}
          ariaLabel="Filtres du journal d’audit"
        >
          <FilterField label="Type d’entité" htmlFor="entityType">
            <select
              id="entityType"
              value={auditFilters.entityType}
              onChange={(event) => setAuditFilters((prev) => ({ ...prev, entityType: event.target.value }))}
            >
              <option value="">Toutes les entités</option>
              {ENTITY_TYPES.map((type) => <option key={type} value={type}>{ENTITY_LABELS[type] ?? humanizeCode(type)}</option>)}
            </select>
          </FilterField>
          <FilterField label="Identifiant d’entité" htmlFor="entityId">
            <input
              id="entityId"
              type="text"
              placeholder="UUID du dossier, financement…"
              value={auditFilters.entityId}
              onChange={(event) => setAuditFilters((prev) => ({ ...prev, entityId: event.target.value }))}
            />
          </FilterField>
          <FilterField label="Acteur" htmlFor="actorSearch">
            <input
              id="actorSearch"
              type="text"
              placeholder="Nom, prénom ou email"
              value={auditFilters.actorSearch}
              onChange={(event) => setAuditFilters((prev) => ({ ...prev, actorSearch: event.target.value }))}
            />
          </FilterField>
          <FilterField label="Depuis le" htmlFor="dateFrom">
            <input
              id="dateFrom"
              type="date"
              value={auditFilters.dateFrom}
              onChange={(event) => setAuditFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </FilterField>
          <FilterField label="Jusqu’au" htmlFor="dateTo">
            <input
              id="dateTo"
              type="date"
              value={auditFilters.dateTo}
              onChange={(event) => setAuditFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </FilterField>
        </FilterBar>
      </form>
      <div className={portal.section}>
        <ResponsiveTable
          rows={logs.items}
          columns={auditColumns}
          rowKey={(log) => log.id}
          caption="Journal d’audit de la plateforme"
          emptyMessage="Aucune trace d’audit ne correspond aux critères."
        />
      </div>
      <Pagination page={logs.page} limite={logs.limite} total={logs.total} onChange={(page) => loadLogs(page)} buttonClassName={portal.secondary} rowClassName={portal.buttonRow} />
    </section>
  </main>;
}
